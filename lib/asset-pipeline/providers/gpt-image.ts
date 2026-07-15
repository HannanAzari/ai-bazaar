/** GPT Image adapter — OpenAI hosted image model. Thin: no art direction. */
import type { AssetGenerationProvider } from "@/lib/asset-pipeline/types";
import { generateN, providerAvailable } from "./shared";

export const gptImageAssetProvider: AssetGenerationProvider = {
  id: "gpt-image",
  label: "OpenAI GPT Image",
  note: "hosted image model",
  isAvailable: () => providerAvailable("gpt-image"),
  generate: (req) => generateN("gpt-image", req),
};
