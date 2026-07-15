/**
 * Local canvas adapter — the always-available fallback (no key, no network). It
 * cannot REINTERPRET geometry the way a diffusion model can; it applies Nestudio's
 * warm-key + matte palette treatment to the transparent cutout. Honest about what
 * it is: a graceful degradation so the editor flow never dead-ends offline, never a
 * claim to have rebuilt the object. Labeled as such wherever it's used.
 */

import type { AssetGenerationProvider } from "@/lib/asset-pipeline/types";
import type { RasterImage } from "@/lib/ai/types";
import { relight, paletteLock } from "@/lib/ai/canvas";

async function treat(cutout: RasterImage): Promise<RasterImage> {
  // Preserve the cutout's true alpha; only warm the light + calm the palette.
  const lit = await relight(cutout, 0.1);
  return paletteLock(lit, { saturation: 0.7, satCap: 0.62, warmth: 0.4 });
}

export const localAssetProvider: AssetGenerationProvider = {
  id: "local",
  label: "Local (Canvas)",
  note: "offline fallback · not a reinterpretation",
  isAvailable: async () => true,
  async generate(req) {
    const out: RasterImage[] = [];
    for (let i = 0; i < req.variants; i++) out.push(await treat(req.cutout));
    return out;
  },
};
