/**
 * lib/asset-pipeline/honest.ts — the GPT-Image "honest" path (M35 + M36 polish).
 * -----------------------------------------------------------------------------
 * ONE generation, the model's GENUINE result, no corrections:
 *   • rich identity FIRST — a vision model describes the object (P3); fallback to the
 *     deterministic extractor. furniture@8 states that identity as fact (identity > style).
 *   • canonical camera, no-external-shadow instruction, official furniture as STYLE refs (P5).
 *   • cutout + original photo + official style refs sent together (route attaches them).
 *   • NO conform (palette/posterise/matte grade), NO identity re-composite / repair,
 *     NO regenerate loop, NO candidate selection, NO silent fallback — errors surface.
 *
 * Post-processing is masking + framing ONLY (finishClean, P1): key out a solid
 * background if present, strip external glow/halo/floor-shadow, keep the object, trim,
 * pad. Internal shading / AO is kept. No recolour, no repair.
 *
 * Browser-only (Canvas + the identity extractor). Returns rich, truthful metadata.
 */

import type { RasterImage } from "@/lib/ai/types";
import { rasterFromDataUrl, alphaStats } from "@/lib/ai/canvas";
import { NESTUDIO_ASSET_DNA } from "@/lib/asset-dna";
import { finishClean } from "./cleanup";
import { extractContract } from "@/lib/identity";
import { buildFurniture8Prompt, deriveIdentityNotes, FURNITURE_8_VERSION, type PreserveMode } from "./furniture-8";

/** Where the object-specific identity came from. */
export type IdentitySource = "provided" | "vision" | "deterministic" | "subject";

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
  /** The object-specific identity block used, and where it came from. */
  identityNotes: string;
  identitySource: IdentitySource;
  identityModel?: string;
  /** How many official furniture style references were attached (P5). */
  styleRefCount?: number;
  error?: string;
};

type RouteResponse = {
  imageDataUrl?: string;
  model?: string;
  costUsd?: number | null;
  styleRefCount?: number;
  error?: string;
};

type IdentityResponse = { identityNotes?: string; model?: string; error?: string };

/**
 * Resolve the object's identity block, richest source first:
 *   provided → vision model (P3) → deterministic pixel extractor → bare subject.
 * Never throws; generation must not block on identity.
 */
async function resolveIdentity(req: HonestRequest): Promise<{ notes: string; source: IdentitySource; model?: string }> {
  const subject = (req.subject || "home object").trim();
  if (req.identityNotes && req.identityNotes.trim()) {
    return { notes: req.identityNotes.trim(), source: "provided" };
  }
  // 1) Vision identity — the rich description (materials, text, decorative elements).
  try {
    const res = await fetch("/api/ai/identity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        imageDataUrl: req.cutout.dataUrl,
        extraImages: req.original ? [req.original.dataUrl] : [],
        subject,
        preserveDetails: req.mode === "preserve",
      }),
      signal: req.signal,
    });
    if (res.ok) {
      const j = (await res.json()) as IdentityResponse;
      if (j.identityNotes && j.identityNotes.trim()) {
        return { notes: j.identityNotes.trim(), source: "vision", model: j.model };
      }
    }
  } catch {
    /* fall through to deterministic */
  }
  // 2) Deterministic pixel extractor.
  try {
    const contract = await extractContract({ cutout: req.cutout, subject, preserveDetails: req.mode === "preserve" });
    return { notes: deriveIdentityNotes(contract), source: "deterministic" };
  } catch {
    return { notes: `- ${subject}`, source: "subject" };
  }
}

/**
 * Generate ONE Nestudio asset from a real object via GPT Image — honestly.
 * Never falls back; any OpenAI/network error is returned in `error` with ok:false.
 */
export async function generateAssetHonest(req: HonestRequest): Promise<HonestResult> {
  const mode = req.mode;

  // Identity FIRST (P3/P6): resolve the richest identity available, state it as fact.
  const identity = await resolveIdentity(req);

  const built = buildFurniture8Prompt({
    subject: req.subject,
    mode,
    identityNotes: identity.notes,
    withStyleRefs: true, // official furniture attached as STYLE refs (P5)
  });
  const prompt = req.notes && req.notes.trim() ? `${built.positive}\n\nUSER REQUEST: ${req.notes.trim()}` : built.positive;
  const negative = built.negative;

  const base: Omit<HonestResult, "ok" | "raw" | "finished" | "error" | "model" | "costUsd" | "hasAlpha" | "dimensions" | "styleRefCount"> & {
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
    identityNotes: identity.notes,
    identitySource: identity.source,
    identityModel: identity.model,
    dimensions: {},
  };

  // Only the original goes as a client-side object reference; official style refs are
  // attached server-side (P5). Keeping this lean bounds input-token cost.
  const extraImages = req.original ? [req.original.dataUrl] : [];
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
        styleRefs: true,
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
        styleRefCount: json.styleRefCount,
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

  // Production framing (P1): key-out only if needed, strip external glow/halo/shadow,
  // keep the object, trim + pad. No conform, no palette, no repair.
  const finished = await finishClean(raw, { size: NESTUDIO_ASSET_DNA.export.size });

  return {
    ...base,
    ok: true,
    model: json.model ?? "gpt-image-1",
    costUsd: json.costUsd ?? null,
    styleRefCount: json.styleRefCount,
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
