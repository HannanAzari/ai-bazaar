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
  matteGrade,
  stylizeCozy,
  upscaleSmooth,
} from "../canvas";

export const stubProvider: AIImageProvider = {
  id: "stub",
  label: "Local premium (Canvas)",
  capabilities: ["stylize", "removeBackground", "upscale"],

  async stylize(source: RasterImage, prompt: AssembledPrompt, opts: GenerateOptions): Promise<RasterImage> {
    const size = opts.size ?? Number(prompt.params.size ?? 640);
    const framed = await containSquare(source, size);
    const relightStrength = Number(prompt.params.relight ?? 0.22);
    const lit = await relight(framed, relightStrength);
    const matte = await matteGrade(lit);
    // A whisper of posterize for the illustrated edge; seed varies it slightly.
    const levels = 7 + (((opts.seed ?? 0) % 3) as number);
    return stylizeCozy(matte, levels);
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
