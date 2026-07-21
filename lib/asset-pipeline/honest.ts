/**
 * lib/asset-pipeline/honest.ts — the M35 GPT-Image "honest" path.
 * -----------------------------------------------------------------------------
 * ONE generation, the model's GENUINE result, no corrections:
 *   • furniture@8 prompt (identity stated as truth, not style tricks)
 *   • cutout + original photo sent together (the route attaches references)
 *   • NO conformToNestudio (no palette lock / posterise / matte grade)
 *   • NO identity re-composite / targeted repair (no source pixels painted back)
 *   • NO regenerate-until-acceptable loop, NO candidate selection
 *   • NO silent fallback to Gemini or the local canvas — OpenAI errors surface
 *
 * The only post-processing is honest FRAMING (finishAsset = trim + pad; it only
 * keys out a background when the result is NOT already transparent, and gpt-image-1
 * returns native alpha, so nothing is removed). We want to SEE the real result
 * before deciding whether any correction is ever warranted.
 *
 * Browser-only (Canvas + the identity extractor). Returns rich, truthful metadata
 * for the /dev/gpt-image comparison screen and the editor.
 */

import type { RasterImage } from "@/lib/ai/types";
import { rasterFromDataUrl, alphaStats } from "@/lib/ai/canvas";
import { NESTUDIO_ASSET_DNA } from "@/lib/asset-dna";
import { finishAsset } from "./finish";
import { extractContract } from "@/lib/identity";
import type { IdentityContract } from "@/lib/identity/types";
import { buildFurniture8Prompt, FURNITURE_8_VERSION, type PreserveMode } from "./furniture-8";

export type HonestRequest = {
  /** The clean tap-to-select cutout (primary image sent to the model). */
  cutout: RasterImage;
  /** The full original photograph — attached as a reference (detail the cutout lost). */
  original?: RasterImage;
  /** The object mask, optional — attached as a reference. */
  mask?: RasterImage;
  /** What the object is ("coffee mug"). */
  subject: string;
  /** Preserve keeps writing/logos/patterns; Simplify strips them. */
  mode: PreserveMode;
  /** Optional explicit real-object description (must describe the object, not style). */
  identityNotes?: string;
  /** Optional user nudge from the "Improve" flow, appended verbatim (not a style trick). */
  notes?: string;
  signal?: AbortSignal;
};

export type HonestResult = {
  ok: boolean;
  provider: "openai";
  /** The ACTUAL model the server used (from the response), or null on failure. */
  model: string | null;
  promptVersion: string;
  mode: PreserveMode;
  usedFallback: false;
  /** Wall-clock of the single API call (ms). */
  latencyMs: number;
  /** Estimated API cost in USD from token usage, or null if unavailable. */
  costUsd: number | null;
  /** 0 — no automatic retries. A retry only ever follows a genuine network failure. */
  retryCount: number;
  /** Exactly what OpenAI returned, untouched (for the comparison screen). */
  raw: RasterImage | null;
  /** The framed transparent asset (trim + pad only — no conform, no repair). */
  finished: RasterImage | null;
  /** The images actually sent to the model. */
  sent: { cutout: RasterImage; original?: RasterImage; mask?: RasterImage };
  /** The prompt actually sent. */
  prompt: string;
  negative: string;
  /** True alpha present in the RAW output (native transparent background). */
  hasAlpha: boolean;
  dimensions: { raw?: { w: number; h: number }; finished?: { w: number; h: number } };
  error?: string;
};

type RouteResponse = {
  imageDataUrl?: string;
  model?: string;
  costUsd?: number | null;
  error?: string;
};

/**
 * Generate ONE Nestudio asset from a real object via GPT Image — honestly.
 * Never falls back; any OpenAI/network error is returned in `error` with ok:false.
 */
export async function generateAssetHonest(req: HonestRequest): Promise<HonestResult> {
  const mode = req.mode;

  // Build furniture@8. The object-specific identity is the truth we can measure
  // (or an explicit description) — never a style trick. Extraction failure is fine.
  let contract: IdentityContract | null = null;
  if (!req.identityNotes) {
    try {
      contract = await extractContract({
        cutout: req.cutout,
        subject: req.subject,
        preserveDetails: mode === "preserve",
      });
    } catch {
      contract = null;
    }
  }
  const built = buildFurniture8Prompt({
    subject: req.subject,
    contract,
    mode,
    identityNotes: req.identityNotes,
  });
  const prompt = req.notes && req.notes.trim() ? `${built.positive}\n\nUSER REQUEST: ${req.notes.trim()}` : built.positive;
  const negative = built.negative;

  const base: Omit<HonestResult, "ok" | "raw" | "finished" | "error" | "model" | "costUsd" | "hasAlpha" | "dimensions"> & {
    dimensions: HonestResult["dimensions"];
  } = {
    provider: "openai",
    promptVersion: FURNITURE_8_VERSION,
    mode,
    usedFallback: false,
    latencyMs: 0,
    retryCount: 0,
    sent: { cutout: req.cutout, original: req.original, mask: req.mask },
    prompt,
    negative,
    dimensions: {},
  };

  const extraImages = [req.original?.dataUrl, req.mask?.dataUrl].filter(Boolean) as string[];
  const started = performance.now();
  let json: RouteResponse;
  try {
    const res = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "gpt-image",
        imageDataUrl: req.cutout.dataUrl,
        extraImages,
        positive: prompt,
        negative,
        inputFidelity: mode === "preserve" ? "high" : "low",
        quality: "high",
        size: NESTUDIO_ASSET_DNA.export.size,
      }),
      signal: req.signal,
    });
    json = (await res.json().catch(() => ({}))) as RouteResponse;
    if (!res.ok || !json.imageDataUrl) {
      return {
        ...base,
        ok: false,
        model: json.model ?? null,
        costUsd: json.costUsd ?? null,
        hasAlpha: false,
        raw: null,
        finished: null,
        latencyMs: Math.round(performance.now() - started),
        error: json.error ?? `OpenAI generation failed (HTTP ${res.status}).`,
      };
    }
  } catch (e) {
    return {
      ...base,
      ok: false,
      model: null,
      costUsd: null,
      hasAlpha: false,
      raw: null,
      finished: null,
      latencyMs: Math.round(performance.now() - started),
      error: (e as Error).name === "AbortError" ? "Cancelled." : `Network error: ${(e as Error).message}`,
    };
  }
  const latencyMs = Math.round(performance.now() - started);

  const raw = await rasterFromDataUrl(json.imageDataUrl!);
  const stats = await alphaStats(raw);
  const hasAlpha = stats.transparentCorners && stats.coverage < 0.995;

  // Honest framing ONLY: trim + pad. finishAsset keys out a background solely when the
  // result is not already transparent; gpt-image-1 returns native alpha, so nothing is
  // removed. No conform, no palette, no repair.
  const finished = await finishAsset(raw, { size: NESTUDIO_ASSET_DNA.export.size });

  return {
    ...base,
    ok: true,
    model: json.model ?? "gpt-image-1",
    costUsd: json.costUsd ?? null,
    latencyMs,
    hasAlpha,
    raw,
    finished,
    dimensions: {
      raw: { w: raw.width, h: raw.height },
      finished: { w: finished.width, h: finished.height },
    },
  };
}
