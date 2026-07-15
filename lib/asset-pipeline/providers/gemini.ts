/** Gemini adapter — hosted image model. Thin: no art direction, just delivery. */
import type { AssetGenerationProvider } from "@/lib/asset-pipeline/types";
import { generateN, providerAvailable } from "./shared";

export const geminiAssetProvider: AssetGenerationProvider = {
  id: "gemini",
  label: "Google Gemini",
  note: "hosted image model",
  isAvailable: () => providerAvailable("gemini"),
  generate: (req) => generateN("gemini", req),
};
