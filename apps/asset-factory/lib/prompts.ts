import { ALL_CATEGORIES, CATEGORY_META, type FactoryCategory } from "@/lib/types";

// ── Nestudio Premium Game Style V1 (V3.1) ────────────────────────────────────
//
// The generation prompt identity. Targets POLISHED MOBILE GAME COLLECTIBLE quality
// (Clash of Clans / Royal Match / Hay Day are *quality references only* — never
// mimic their art). The hard rules: ONE isolated object, transparent PNG, no
// environment / platform / pedestal / extra props, soft glossy materials, rounded
// shapes, clean silhouette, consistent 30° isometric, readable at 64–128px.
//
// This replaces the earlier storybook prompt system. See docs/premium-style.md.

export const STYLE_ID = "premium_game_v1";
export const STYLE_NAME = "Nestudio Premium Game Style V1";
export const STYLE_VERSION = 1;

/** The master prompt — the shared spine of every generated asset. */
export const MASTER_PROMPT =
  "Premium mobile game asset. Single isolated object. High readability. Soft glossy materials. " +
  "Rounded shapes. Clean silhouette. Consistent 30-degree isometric camera. Transparent PNG background. " +
  "No platform. No pedestal. No floor. No environment. No extra props. Mobile game collectible quality. " +
  "Optimized for game inventory and room decoration systems.";

/** The negative prompt — strongly discourages scenes, props, and bad rendering. */
export const NEGATIVE_PROMPT =
  "room scene, furniture set, multiple objects, base, platform, pedestal, floor plane, rug, books, lamp, " +
  "plant, extra decorations, text, watermark, logo, signature, photorealism, realistic photography, " +
  "painterly illustration, storybook rendering, flat vector, random perspective, front view, side view, " +
  "cropped object, dramatic shadows, sunset lighting, golden hour, white background, scene background";

/** Reusable premium style tokens appended to every prompt for consistency. */
export const STYLE_TOKENS: string[] = [
  "premium mobile game asset",
  "single isolated object",
  "soft glossy materials",
  "rounded shapes",
  "clean silhouette",
  "30-degree isometric",
  "soft studio lighting",
  "transparent background",
  "high readability",
];

/** A short, single-object descriptor per category. Object ONLY — never props,
 * platforms, or scenes (the master/negative prompts enforce the rest). */
export const CATEGORY_PROMPTS: Record<FactoryCategory, string> = {
  // Interior
  chair: "a single accent chair",
  table: "a single small table",
  desk: "a single writing desk",
  shelf: "a single bookshelf",
  sofa: "a single two-seat sofa",
  rug: "a single round rug, flat",
  plant: "a single potted plant in a simple pot",
  lamp: "a single floor lamp",
  book: "a single closed hardcover book",
  computer: "a single computer monitor",
  microphone: "a single studio microphone",
  camera: "a single camera",
  guitar: "a single acoustic guitar",
  product_display: "a single product display stand",
  wall_art: "a single framed artwork",
  tv_screen: "a single flat-screen tv",
  // Exterior
  door: "a single door",
  window: "a single window",
  tree: "a single small tree",
  flower: "a single flower in a pot",
  fence: "a single fence segment",
  sign: "a single hanging sign",
  lantern: "a single lantern",
  mailbox: "a single mailbox",
  bench: "a single bench",
  market_stall: "a single market stall",
  // Avatar / support
  avatar_body: "a single character figure",
  hairstyle: "a single hairstyle",
  clothing: "a single clothing item",
  accessory: "a single accessory",
  pet: "a single cute pet",
  instrument: "a single musical instrument",
  tool: "a single tool",
  // Business
  cafe_counter: "a single cafe counter",
  restaurant_table: "a single restaurant table",
  gym_equipment: "a single piece of gym equipment",
  medical_desk: "a single reception desk",
  workshop_tool: "a single workshop tool",
  podcast_setup: "a single podcast microphone setup",
  shop_shelf: "a single shop shelf",
};

export type BuiltPrompt = {
  category: FactoryCategory;
  prompt: string;
  negativePrompt: string;
};

/**
 * Compose the full positive prompt for a category. An optional `subject` overrides
 * the canned descriptor; `extra` appends free-form detail. Always begins with the
 * master prompt and ends with the style tokens so every asset shares one spine.
 */
export function buildPrompt(
  category: FactoryCategory,
  options: { subject?: string; extra?: string } = {},
): string {
  const subject = options.subject?.trim() || CATEGORY_PROMPTS[category];
  const parts = [MASTER_PROMPT, subject];
  if (options.extra?.trim()) parts.push(options.extra.trim());
  parts.push(STYLE_TOKENS.join(", "));
  return parts.join(", ");
}

/** Build positive + negative prompts for a category in one object. */
export function buildPromptPair(
  category: FactoryCategory,
  options: { subject?: string; extra?: string } = {},
): BuiltPrompt {
  return {
    category,
    prompt: buildPrompt(category, options),
    negativePrompt: NEGATIVE_PROMPT,
  };
}

/** Build prompt pairs for a batch of categories (defaults to every category). */
export function buildBatchPrompts(
  categories: FactoryCategory[] = ALL_CATEGORIES,
): BuiltPrompt[] {
  return categories.map((category) => buildPromptPair(category));
}

/** Convenience: human label for a category (delegates to CATEGORY_META). */
export function categoryLabel(category: FactoryCategory): string {
  return CATEGORY_META[category].label;
}
