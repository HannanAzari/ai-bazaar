/**
 * lib/ai/providers/gemini.ts — hosted-model backend (SCAFFOLD, server-only).
 * -----------------------------------------------------------------------------
 * Nestudio's offline asset scripts already use Google Gemini image models via
 * `GEMINI_API_KEY` (see scripts/generate-p0-pilot.mjs). This is where the same
 * model plugs into the live engine — implementing the SAME AIImageProvider
 * interface as the stub, so enabling it is a one-line registry swap and touches no
 * studio or UI code.
 *
 * It is intentionally NOT implemented in M20 (this is an architecture sprint). It
 * is server-only: it must be called from an API route (app/api/ai/*), never the
 * client, so the key never reaches the browser. `isConfigured()` lets the engine
 * decide whether to offer it.
 */

import type { AIImageProvider, RasterImage } from "../types";

export function isConfigured(): boolean {
  return typeof process !== "undefined" && !!process.env?.GEMINI_API_KEY;
}

function notReady(): Promise<RasterImage> {
  throw new Error(
    "Gemini provider is not enabled in M20. Implement stylize()/removeBackground()/upscale() " +
      "against the Gemini image API (GEMINI_API_KEY) inside an app/api/ai route, then register it.",
  );
}

export const geminiProvider: AIImageProvider = {
  id: "gemini",
  label: "Google Gemini (hosted)",
  capabilities: ["stylize", "removeBackground", "upscale"],
  stylize: notReady,
  removeBackground: notReady,
  upscale: notReady,
};
