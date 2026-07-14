/**
 * lib/ai/providers/stub.ts — the default local image backend (Canvas).
 * -----------------------------------------------------------------------------
 * A real, working provider that runs in the browser with NO API key, so the whole
 * pipeline is provable end-to-end. M21 upgraded it from a toy into a genuine
 * processing chain: connected-component background removal with edge feathering
 * and despeckle, then relight (warm key + ambient occlusion) → matte grade →
 * gentle posterize toward the Nestudio look. It cannot invent geometry the way a
 * hosted diffusion model can, but it produces a clean, consistently-lit,
 * transparent, premium-matte asset from a real photo. A hosted provider (gemini)
 * takes over via the SAME interface when configured.
 */

import type { AIImageProvider, AssembledPrompt, GenerateOptions, RasterImage, RemoveBgOptions } from "../types";
import {
  containSquare,
  floodFillBackground,
  featherAlpha,
  despeckle,
  relight,
  paletteLock,
  upscaleSmooth,
} from "../canvas";

export const stubProvider: AIImageProvider = {
  id: "stub",
  label: "Local premium (Canvas)",
  capabilities: ["stylize", "removeBackground", "upscale"],

  async stylize(source: RasterImage, prompt: AssembledPrompt, opts: GenerateOptions): Promise<RasterImage> {
    const size = opts.size ?? Number(prompt.params.size ?? 640);
    const framed = await containSquare(source, size);
    // ONE fixed treatment for every object → one artist's hand: a whisper of warm
    // form-light, then the Nestudio palette lock (calm saturation + warm neutrals).
    // No posterize — quantizing the light ramp banded flat faces with a hard
    // diagonal, which broke the calm, matte, timeless read.
    const lit = await relight(framed, Number(prompt.params.relight ?? 0.1));
    return paletteLock(lit, {
      saturation: Number(prompt.params.saturation ?? 0.62),
      satCap: Number(prompt.params.satCap ?? 0.55),
      warmth: Number(prompt.params.warmth ?? 0.45),
    });
  },

  async removeBackground(source: RasterImage, opts?: RemoveBgOptions): Promise<RasterImage> {
    const cut = await floodFillBackground(source, opts?.tolerance ?? 32);
    const feathered = await featherAlpha(cut);
    return despeckle(feathered);
  },

  async upscale(source: RasterImage, factor: number): Promise<RasterImage> {
    return upscaleSmooth(source, factor);
  },
};
