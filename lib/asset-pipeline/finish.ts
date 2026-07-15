/**
 * lib/asset-pipeline/finish.ts — turn a provider's RAW image into a DNA-conformant
 * transparent PNG. Runs ONCE, uniformly, for every provider — so a Gemini asset and
 * a GPT-Image asset are finished identically and are truly comparable.
 *
 * Providers are told to paint the object on a plain SOLID colour (the DNA's
 * transparency rule) precisely so we can key it out here to TRUE alpha — never a
 * painted checkerboard. If a provider already returns transparency, we skip the
 * key-out and just trim + pad.
 *
 * Browser-only (Canvas). No art direction here — only masking + framing.
 */

import type { RasterImage } from "@/lib/ai/types";
import { alphaStats, floodFillBackground, featherAlpha, despeckle, trimTransparent, padSquare } from "@/lib/ai/canvas";
import { NESTUDIO_ASSET_DNA } from "@/lib/asset-dna";

/** Key out a solid background if present, then trim + pad into the square export. */
export async function finishAsset(
  raw: RasterImage,
  opts: { size?: number; padding?: number; tolerance?: number } = {},
): Promise<RasterImage> {
  const size = opts.size ?? NESTUDIO_ASSET_DNA.export.size;
  const padding = opts.padding ?? NESTUDIO_ASSET_DNA.padding.fraction;

  let img = raw;
  const stats = await alphaStats(img);
  if (!stats.transparentCorners) {
    // Solid studio background → key it out to real transparency.
    const knocked = await floodFillBackground(img, opts.tolerance ?? 32);
    const feathered = await featherAlpha(knocked);
    img = await despeckle(feathered);
  }
  const trimmed = await trimTransparent(img);
  return padSquare(trimmed, size, padding);
}
