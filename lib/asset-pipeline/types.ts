/**
 * lib/asset-pipeline/types.ts — Stage 2 contracts: CUTOUT → NESTUDIO ASSET.
 * -----------------------------------------------------------------------------
 * The clean, provider-INDEPENDENT interface at the centre of M32. Nestudio calls
 * `generateAsset()`; it never knows whether GPT Image, Gemini, Imagen or Flux
 * produced the pixels. Switching provider is one config change
 * (ACTIVE_ASSET_PROVIDER). Every provider receives the SAME Asset DNA + cutout and
 * must satisfy it — providers are judged against the DNA, never by prompt tricks.
 *
 * A provider adapter is THIN and contains NO art direction: it takes a resolved
 * request (cutout + DNA-derived prompt + size) and returns raw candidate images.
 * All finishing (key-out → true alpha → trim → pad) happens ONCE, uniformly, in
 * the router — so every provider's output is comparable and DNA-conformant.
 *
 * PURE TYPES — no DOM, no React, no SDK.
 */

import type { RasterImage } from "@/lib/ai/types";
import type { AssetDna, AssetDnaPrompt } from "@/lib/asset-dna";

/** What a caller hands in. */
export type AssetGenerationRequest = {
  /** The Stage-1 transparent-PNG cutout. */
  cutout: RasterImage;
  /** What the thing is — "coffee mug". Drives the DNA prompt + naming. */
  subject: string;
  /** Optional minimal user nudge (we do NOT optimise prompts). */
  notes?: string;
  /** Defaults to NESTUDIO_ASSET_DNA. */
  dna?: AssetDna;
  /** How many candidates to produce (A/B/C → 3). */
  variants: number;
  signal?: AbortSignal;
};

/** The request after the router resolves the DNA + prompt — what a provider sees. */
export type ResolvedRequest = {
  cutout: RasterImage;
  prompt: AssetDnaPrompt;
  subject: string;
  /** Square export size from the DNA. */
  size: number;
  variants: number;
  signal?: AbortSignal;
};

/** One finished candidate. */
export type AssetCandidate = {
  /** The finished transparent PNG (keyed, trimmed, padded per the DNA). */
  image: RasterImage;
  /** The provider that ACTUALLY produced it (never mislabeled on fallback). */
  provider: string;
  dnaVersion: string;
};

/** The result of a generation call. */
export type AssetGenerationResult = {
  /** The provider that actually produced the candidates. */
  provider: string;
  /** The provider that was requested (differs on fallback). */
  requestedProvider: string;
  usedFallback: boolean;
  candidates: AssetCandidate[];
  /** The hosted provider's error, surfaced rather than hidden. */
  error?: string;
};

/**
 * The one interface every image backend implements. GPT Image, Gemini, Imagen,
 * Flux, a future LoRA — all the same shape. `generate` returns RAW images; the
 * router finishes them uniformly.
 */
export interface AssetGenerationProvider {
  id: string;
  label: string;
  /** Marketing/benchmark note (e.g. "hosted diffusion", "no key"). */
  note?: string;
  /**
   * Best-effort availability. On the client this is a hint (the real key check is
   * server-side); the router still tries and surfaces honest errors. Providers with
   * no key return false so the UI can grey them out.
   */
  isAvailable(): Promise<boolean>;
  /** Produce `variants` raw candidate images from one cutout + the DNA prompt. */
  generate(req: ResolvedRequest): Promise<RasterImage[]>;
}
