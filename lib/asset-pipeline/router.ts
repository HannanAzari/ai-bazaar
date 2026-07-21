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
import { extractContract, buildIdentityPrompt, validateIdentity, targetedRepair } from "@/lib/identity";
import type { IdentityContract } from "@/lib/identity/types";
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
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_ASSET_PROVIDER) || "gpt-image";

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

/** Resolve the DNA → prompt → provider-facing request. When an identity contract is
 *  present the prompt is assembled from its IMMUTABLE constraints (identity > DNA). */
function resolve(request: AssetGenerationRequest, contract: IdentityContract | null): ResolvedRequest {
  const dna = request.dna ?? NESTUDIO_ASSET_DNA;
  const dnaPrompt = buildAssetDnaPrompt(request.subject, request.notes, dna);
  const prompt = contract ? buildIdentityPrompt(contract, dnaPrompt) : dnaPrompt;
  return {
    cutout: request.cutout,
    prompt,
    subject: request.subject,
    size: dna.export.size,
    variants: Math.max(1, request.variants),
    original: request.original,
    mask: request.mask,
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
  /** Run the Style Validator gate (report only). Default: on in the browser. */
  validate?: boolean;
  /** Run the Identity Lock gate + targeted repair. Default: on in the browser. */
  identity?: boolean;
};

/**
 * The Identity Lock pipeline. Provider-independent. Priority: IDENTITY > FUNCTION > DNA.
 *
 *   contract (extract) → single generation → identity gate (hard) → targeted repair
 *   (only the failing area) → style gate (report). No regenerate-until-acceptable loop.
 *
 * Identity is enforced deterministically in post — we never rely on the model to
 * preserve it. At most ONE generation + one optional targeted repair.
 */
export async function generateAsset(request: AssetGenerationRequest, opts: GenerateAssetOpts = {}): Promise<AssetGenerationResult> {
  const requested = getAssetProvider(opts.provider);
  const inBrowser = typeof window !== "undefined";
  const useIdentity = opts.identity !== false && inBrowser;

  // 1. Extract the immutable identity contract (browser only).
  let contract: IdentityContract | null = null;
  if (useIdentity) {
    try {
      contract = await extractContract({ cutout: request.cutout, subject: request.subject, preserveDetails: request.preserveDetails ?? true });
    } catch { contract = null; }
  }

  const resolved = resolve(request, contract);
  const dnaVersion = resolved.prompt.dnaVersion;

  // 2. Single generation (with the local fallback only if the hosted one errors).
  let providerId = requested.id;
  let usedFallback = false;
  let error: string | undefined;
  let candidates: AssetCandidate[];
  try {
    candidates = await runProvider(requested, resolved, dnaVersion);
  } catch (err) {
    error = (err as Error).message;
    if (!opts.allowFallback || requested.id === FALLBACK_ASSET_PROVIDER) {
      return { provider: requested.id, requestedProvider: requested.id, usedFallback: false, candidates: [], error };
    }
    candidates = await runProvider(getAssetProvider(FALLBACK_ASSET_PROVIDER), resolved, dnaVersion);
    providerId = FALLBACK_ASSET_PROVIDER;
    usedFallback = true;
  }

  if (candidates.length === 0) {
    return { provider: providerId, requestedProvider: requested.id, usedFallback, candidates: [], error };
  }

  let chosen = candidates[0];

  // 3. Identity gate (hard) → 4. targeted repair (only the failing area).
  let identity: AssetGenerationResult["identity"];
  let repaired = false;
  if (useIdentity && contract) {
    identity = await validateIdentity(chosen.image, contract);
    if (!identity.pass) {
      const fixed = await targetedRepair(chosen.image, contract, identity.failures);
      chosen = { ...chosen, image: fixed };
      identity = await validateIdentity(fixed, contract); // re-check after repair
      repaired = true;
    }
  }

  // 5. Style gate (report only — identity already enforced; no regeneration).
  let report: AssetGenerationResult["report"];
  if (opts.validate !== false && inBrowser) {
    const profile = await getOfficialProfile().catch(() => FALLBACK_PROFILE);
    report = validateStyle(await fingerprintOf(chosen.image), profile);
  }

  return { provider: providerId, requestedProvider: requested.id, usedFallback, candidates: [chosen], error, report, identity, repaired };
}
