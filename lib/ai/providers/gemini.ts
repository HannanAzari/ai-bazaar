/**
 * lib/ai/providers/gemini.ts — hosted-model backend (real, env-gated).
 * -----------------------------------------------------------------------------
 * Implements the SAME AIImageProvider interface as the local stub. `stylize`
 * posts the framed source + assembled prompt to the server route
 * (app/api/ai/generate), which calls Google Gemini with GEMINI_API_KEY — so the
 * key never touches the browser. Background-removal + upscale reuse the local
 * Canvas ops (deterministic + fast). If the route replies 501 (no key), the call
 * throws and the engine/UI can fall back to the local provider.
 *
 * Enabling hosted quality = register this as the default provider once a key is
 * set; no studio or UI change.
 */

import type { AIImageProvider, AssembledPrompt, GenerateOptions, RasterImage, RemoveBgOptions } from "../types";
import { rasterFromDataUrl } from "../canvas";
import { stubProvider } from "./stub";

/** True only where a server env could hold the key (checked server-side by the route). */
export function isConfigured(): boolean {
  return typeof process !== "undefined" && !!process.env?.GEMINI_API_KEY;
}

async function callRoute(source: RasterImage, prompt: AssembledPrompt, opts: GenerateOptions): Promise<RasterImage> {
  const res = await fetch("/api/ai/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      imageDataUrl: source.dataUrl,
      positive: prompt.positive,
      negative: prompt.negative,
      size: opts.size ?? Number(prompt.params.size ?? 1024),
    }),
    signal: opts.signal,
  });
  if (res.status === 501) {
    throw new Error("Hosted provider not configured (no GEMINI_API_KEY) — use the local provider.");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Generation failed (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { imageDataUrl: string };
  return rasterFromDataUrl(json.imageDataUrl);
}

export const geminiProvider: AIImageProvider = {
  id: "gemini",
  label: "Google Gemini (hosted)",
  capabilities: ["stylize", "removeBackground", "upscale"],
  stylize: callRoute,
  // Cutout + upscale stay local — reliable and free.
  removeBackground: (source: RasterImage, opts?: RemoveBgOptions) => stubProvider.removeBackground(source, opts),
  upscale: (source: RasterImage, factor: number) => stubProvider.upscale(source, factor),
};
