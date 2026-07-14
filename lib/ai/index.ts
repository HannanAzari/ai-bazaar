/**
 * lib/ai — Nestudio's one AI engine. Import from here.
 * -----------------------------------------------------------------------------
 * The UI and studios use ONLY these exports; they never import a provider or
 * build a prompt string by hand. Adding Avatar/Background/House/Admin later means
 * enabling a StudioConfig + writing one prompt builder — no change to this surface.
 */

export * from "./types";
export { NESTUDIO_STYLE, mergeStyle } from "./style";
export {
  buildBasePrompt,
  buildFurniturePrompt,
  buildDecorationPrompt,
  buildAvatarPrompt,
  buildBackgroundPrompt,
  buildHousePrompt,
  PROMPT_BUILDERS,
  getPromptBuilder,
  PROMPT_REGISTRY,
  ACTIVE_PROMPT_VERSION,
} from "./prompts";
export { getProvider, registerProvider, setDefaultProvider, listProviders } from "./provider";
export { DEFAULT_STAGES, runPipeline, resolveStages } from "./pipeline";
export { STYLE_PRESETS, DEFAULT_PRESET, getPreset, listPresets, type StylePreset } from "./presets";
export { validateAsset, DEFAULT_QUALITY_CONFIG, type QualityReport, type QualityConfig, type QualityIssue } from "./quality";
export { improvePrompt, generateWithRefinement, type RefinementResult, type RefinementAttempt } from "./refine";
export { inferInsights, type AssetInsights, type SurfaceType, type ScaleHint, type Rarity } from "./metadata";
export {
  alphaStats,
  dominantColors,
  floodFillBackground,
  featherAlpha,
  relight,
  matteGrade,
  addContactShadow,
  type AlphaStats,
} from "./canvas";
export {
  STUDIO_CONFIGS,
  getStudioConfig,
  generateAsset,
  removeBackground,
  stylizeAsset,
  upscaleAsset,
  type GenerateAssetOptions,
} from "./engine";
