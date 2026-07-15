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
  ResolvedRequest,
} from "./types";
import { finishAsset } from "./finish";
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

async function runProvider(provider: AssetGenerationProvider, resolved: ResolvedRequest, dnaVersion: string) {
  const raws = await provider.generate(resolved);
  const candidates = await Promise.all(
    raws.map(async (raw) => ({
      image: await finishAsset(raw, { size: resolved.size }),
      provider: provider.id,
      dnaVersion,
    })),
  );
  return candidates;
}

export type GenerateAssetOpts = {
  /** Force a specific provider (benchmark). Defaults to ACTIVE_ASSET_PROVIDER. */
  provider?: string;
  /** Fall back to the local canvas provider if the hosted one fails. Editor: true.
   *  Benchmark: false (judge each provider honestly, no silent substitution). */
  allowFallback?: boolean;
};

/**
 * Generate DNA-conformant candidates from a cutout. Provider-independent: callers
 * pass a subject + cutout, never a provider-specific prompt.
 */
export async function generateAsset(request: AssetGenerationRequest, opts: GenerateAssetOpts = {}): Promise<AssetGenerationResult> {
  const resolved = resolve(request);
  const dnaVersion = resolved.prompt.dnaVersion;
  const requested = getAssetProvider(opts.provider);

  try {
    const candidates = await runProvider(requested, resolved, dnaVersion);
    return { provider: requested.id, requestedProvider: requested.id, usedFallback: false, candidates };
  } catch (err) {
    const error = (err as Error).message;
    if (!opts.allowFallback || requested.id === FALLBACK_ASSET_PROVIDER) {
      // Honest failure — no silent substitution.
      return { provider: requested.id, requestedProvider: requested.id, usedFallback: false, candidates: [], error };
    }
    const fallback = getAssetProvider(FALLBACK_ASSET_PROVIDER);
    const candidates = await runProvider(fallback, resolved, dnaVersion);
    return { provider: fallback.id, requestedProvider: requested.id, usedFallback: true, candidates, error };
  }
}
