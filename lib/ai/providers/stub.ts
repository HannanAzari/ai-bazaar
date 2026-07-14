/**
 * lib/ai/providers/stub.ts — the default, dependency-free image backend.
 * -----------------------------------------------------------------------------
 * A real, working provider that runs entirely in the browser with NO API key, so
 * the whole pipeline is provable end-to-end in dev/preview/CI. It uses Canvas to
 * knock out the background, stylize toward the Nestudio look, and upscale. When a
 * hosted model is configured (see gemini.ts), it takes over via the same
 * interface — no studio or UI code changes.
 */

import type { AIImageProvider, AssembledPrompt, GenerateOptions, RasterImage, RemoveBgOptions } from "../types";
import { containSquare, knockoutBackground, stylizeCozy, upscaleSmooth } from "../canvas";

export const stubProvider: AIImageProvider = {
  id: "stub",
  label: "Local preview (Canvas)",
  capabilities: ["stylize", "removeBackground", "upscale"],

  async stylize(source: RasterImage, prompt: AssembledPrompt, opts: GenerateOptions): Promise<RasterImage> {
    const size = opts.size ?? Number(prompt.params.size ?? 640);
    const framed = await containSquare(source, size);
    // Posterize level nudged by the prompt seed for a little variety.
    const levels = 5 + (((opts.seed ?? 0) % 3) as number);
    return stylizeCozy(framed, levels);
  },

  async removeBackground(source: RasterImage, opts?: RemoveBgOptions): Promise<RasterImage> {
    return knockoutBackground(source, opts?.tolerance ?? 26);
  },

  async upscale(source: RasterImage, factor: number): Promise<RasterImage> {
    return upscaleSmooth(source, factor);
  },
};
