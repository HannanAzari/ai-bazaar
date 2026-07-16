/**
 * lib/asset-pipeline/router.ts — the one entry point + the one config switch.
 * -----------------------------------------------------------------------------
 * `generateAsset(request)` is what Nestudio calls. It:
 *   1. resolves the Asset DNA → a prompt (assembled, not authored),
 *   2. hands the SAME cutout + prompt to the active provider,
 *   3. finishes every raw image uniformly (key-out → true alpha → trim → pad),
 *   4. returns comparable, DNA-conformant candidates.
 *
 * The active provider is ONE constant (ACTIVE_ASSET_PROVIDER), overridable per call
 * (the benchmark tool drives every provider through the exact same path). Nothing
 * downstream knows which provider produced an asset.
 */

import { NESTUDIO_ASSET_DNA, buildAssetDnaPrompt } from "@/lib/asset-dna";
import type {
  AssetGenerationProvider,
  AssetGenerationRequest,
  AssetGenerationResult,
  AssetCandidate,
  ResolvedRequest,
} from "./types";
import { finishAsset } from "./finish";
import { conformToNestudio, fingerprintOf } from "@/lib/art-engine/conform";
import { validateStyle } from "@/lib/art-engine/validator";
import { getOfficialProfile, FALLBACK_PROFILE } from "@/lib/art-engine/official";
import type { StyleProfile } from "@/lib/art-engine/fingerprint";
import { geminiAssetProvider } from "./providers/gemini";
import { gptImageAssetProvider } from "./providers/gpt-image";
import { imagenAssetProvider, fluxAssetProvider } from "./providers/unavailable";
import { localAssetProvider } from "./providers/local";

/* ── Registry ─────────────────────────────────────────────────────────────────
 * Order = benchmark display order. Add a provider here (+ route support) and it is
 * instantly swappable — no downstream change. */
export const ASSET_PROVIDERS: AssetGenerationProvider[] = [
  gptImageAssetProvider,
  geminiAssetProvider,
  imagenAssetProvider,
  fluxAssetProvider,
  localAssetProvider,
];

const REGISTRY = new Map(ASSET_PROVIDERS.map((p) => [p.id, p]));

/**
 * THE config switch. Change this one line to change which model powers Nestudio.
 * (Env override keeps prod/preview swappable without a code change.)
 */
export const ACTIVE_ASSET_PROVIDER: string =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_ASSET_PROVIDER) || "gemini";

/** The always-available graceful fallback (offline / hosted failure). */
export const FALLBACK_ASSET_PROVIDER = "local";

export function getAssetProvider(id?: string): AssetGenerationProvider {
  const key = id ?? ACTIVE_ASSET_PROVIDER;
  const p = REGISTRY.get(key);
  if (!p) throw new Error(`Unknown asset provider: ${key}`);
  return p;
}

export function listAssetProviders(): AssetGenerationProvider[] {
  return ASSET_PROVIDERS.slice();
}

/** Resolve the DNA → prompt → provider-facing request. */
function resolve(request: AssetGenerationRequest): ResolvedRequest {
  const dna = request.dna ?? NESTUDIO_ASSET_DNA;
  const prompt = buildAssetDnaPrompt(request.subject, request.notes, dna);
  return {
    cutout: request.cutout,
    prompt,
    subject: request.subject,
    size: dna.export.size,
    variants: Math.max(1, request.variants),
    signal: request.signal,
  };
}

async function runProvider(provider: AssetGenerationProvider, resolved: ResolvedRequest, dnaVersion: string): Promise<AssetCandidate[]> {
  const raws = await provider.generate(resolved);
  // finish (key-out → trim → pad) then CONFORM to the one Nestudio material language
  // (Art Engine, identity-preserving). Deterministic + free — no extra generation cost.
  return Promise.all(
    raws.map(async (raw) => ({
      image: await conformToNestudio(await finishAsset(raw, { size: resolved.size })),
      provider: provider.id,
      dnaVersion,
    })),
  );
}

export type GenerateAssetOpts = {
  /** Force a specific provider (benchmark). Defaults to ACTIVE_ASSET_PROVIDER. */
  provider?: string;
  /** Fall back to the local canvas provider if the hosted one fails. Editor: true.
   *  Benchmark: false (judge each provider honestly, no silent substitution). */
  allowFallback?: boolean;
  /** Run the Style Validator gate + regenerate on failure. Default: on in the browser. */
  validate?: boolean;
  /** Max generation attempts when the style gate fails (Phase 7 — cost-aware). */
  maxAttempts?: number;
};

/** Score candidates against the official style profile; return the best + its report. */
async function pickBestByStyle(candidates: AssetCandidate[], profile: StyleProfile) {
  const scored = await Promise.all(
    candidates.map(async (c) => ({ c, report: validateStyle(await fingerprintOf(c.image), profile) })),
  );
  scored.sort((a, b) => b.report.score - a.report.score);
  return scored[0];
}

/**
 * Generate DNA-conformant candidates from a cutout. Provider-independent: callers
 * pass a subject + cutout, never a provider-specific prompt.
 *
 * The Style Validator (Art Engine) gates the result: if a candidate doesn't measure
 * up to the official library, the pipeline regenerates — but only on failure, at most
 * `maxAttempts` (Phase 7: intelligence over brute force, not brute force per call).
 */
export async function generateAsset(request: AssetGenerationRequest, opts: GenerateAssetOpts = {}): Promise<AssetGenerationResult> {
  const resolved = resolve(request);
  const dnaVersion = resolved.prompt.dnaVersion;
  const requested = getAssetProvider(opts.provider);

  const doValidate = opts.validate !== false && typeof window !== "undefined";
  const maxAttempts = doValidate ? Math.max(1, opts.maxAttempts ?? 2) : 1;
  let reference: StyleProfile | null = null;
  if (doValidate) {
    reference = await getOfficialProfile().catch(() => FALLBACK_PROFILE);
  }

  let lastError: string | undefined;
  let best: { c: AssetCandidate; report: ReturnType<typeof validateStyle> } | null = null;
  let bestBatch: AssetCandidate[] = [];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let candidates: AssetCandidate[];
    try {
      candidates = await runProvider(requested, resolved, dnaVersion);
    } catch (err) {
      lastError = (err as Error).message;
      if (!opts.allowFallback || requested.id === FALLBACK_ASSET_PROVIDER) {
        return { provider: requested.id, requestedProvider: requested.id, usedFallback: false, candidates: [], error: lastError };
      }
      const fallback = getAssetProvider(FALLBACK_ASSET_PROVIDER);
      const fbCandidates = await runProvider(fallback, resolved, dnaVersion);
      const report = reference ? (await pickBestByStyle(fbCandidates, reference)).report : undefined;
      return { provider: fallback.id, requestedProvider: requested.id, usedFallback: true, candidates: fbCandidates, error: lastError, report };
    }

    if (!doValidate || !reference) {
      return { provider: requested.id, requestedProvider: requested.id, usedFallback: false, candidates };
    }

    const top = await pickBestByStyle(candidates, reference);
    if (!best || top.report.score > best.report.score) { best = top; bestBatch = candidates; }
    if (top.report.pass) break; // the gate is satisfied — stop (no extra cost)
  }

  return {
    provider: requested.id,
    requestedProvider: requested.id,
    usedFallback: false,
    candidates: bestBatch,
    report: best?.report,
  };
}
