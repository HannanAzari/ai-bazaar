/**
 * Honest placeholder adapters for providers we don't yet have keys for (Imagen,
 * Flux, a future LoRA/fine-tune). They exist so switching to them is ONE config
 * change the day a key arrives — and so the benchmark lists them as "no key"
 * instead of pretending they aren't part of the roadmap. They never fabricate an
 * image: calling generate() throws a clear, honest error.
 */

import type { AssetGenerationProvider } from "@/lib/asset-pipeline/types";
import { providerAvailable } from "./shared";

function unavailableProvider(id: string, label: string, note: string): AssetGenerationProvider {
  return {
    id,
    label,
    note,
    // Server truth wins — if a key is added later, the route reports it available
    // and the SAME adapter starts working (route routes by `provider`).
    isAvailable: () => providerAvailable(id),
    async generate() {
      throw new Error(`${label} is not configured yet (no API key). Add a key and route support to enable it.`);
    },
  };
}

export const imagenAssetProvider = unavailableProvider("imagen", "Google Imagen", "roadmap · no key");
export const fluxAssetProvider = unavailableProvider("flux", "Flux", "roadmap · no key");
