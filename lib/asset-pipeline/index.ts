/**
 * lib/asset-pipeline — Stage 2 public surface. Nestudio imports from here and never
 * from a concrete provider. Switching the model is one config line in router.ts.
 */

export * from "./types";
export {
  generateAsset,
  getAssetProvider,
  listAssetProviders,
  ASSET_PROVIDERS,
  ACTIVE_ASSET_PROVIDER,
  FALLBACK_ASSET_PROVIDER,
} from "./router";
export { finishAsset } from "./finish";
export { inventoryAssetFromCandidate } from "./save";
export { fetchAvailability, providerAvailable } from "./providers/shared";
