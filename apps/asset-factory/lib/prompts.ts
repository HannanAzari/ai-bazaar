import { ALL_CATEGORIES, CATEGORY_META, type FactoryCategory } from "@/lib/types";

// Master prompt system for the Nestudio Asset Factory.
//
// V1 does NOT call any image-generation API. These strings are the canonical,
// versioned prompt templates a reviewer copies into an external tool (or that a
// future V2 generation queue will consume). Keeping them here makes the visual
// style reproducible and testable. See docs/asset-bible.md for the rationale.

/** The shared style spine every asset prompt is built from. */
export const MASTER_PROMPT =
  "cozy 2.5D isometric game asset, soft rounded shapes, warm golden-hour lighting, " +
  "gentle long shadows fully contained within the frame, clean transparent PNG background, " +
  "hand-illustrated storybook style, readable at small size, single centered object, " +
  "consistent 30-degree isometric camera angle, muted warm parchment palette";

/** The shared negative prompt — the forbidden styles from the asset bible. */
export const NEGATIVE_PROMPT =
  "photorealistic, photograph, 3D render, harsh neon, oversaturated, random perspective, " +
  "front view, flat 2D, text, watermark, logo, signature, white background, opaque background, " +
  "drop shadow cut off, cropped, blurry, low quality, multiple objects, busy scene, dark gritty";

/** Reusable style tokens appended to every prompt for consistency. */
export const STYLE_TOKENS: string[] = [
  "2.5D isometric",
  "cozy",
  "soft rounded shapes",
  "golden-hour lighting",
  "transparent background",
  "storybook illustration",
  "nestudio style",
];

/** A short, category-specific descriptor injected into the master prompt. */
export const CATEGORY_PROMPTS: Record<FactoryCategory, string> = {
  // Interior
  chair: "a single cozy accent chair with soft cushioning",
  table: "a small wooden side table with rounded edges",
  desk: "a tidy writing desk with a warm wood finish",
  shelf: "a freestanding bookshelf with a few cozy objects",
  sofa: "a plush two-seat sofa with soft pillows",
  rug: "a round woven rug seen from a gentle isometric angle",
  plant: "a potted leafy houseplant in a ceramic pot",
  lamp: "a warm glowing floor lamp with a soft shade",
  book: "a small stack of hardcover books",
  computer: "a compact desktop computer with a soft-glow screen",
  microphone: "a studio microphone on a small stand",
  camera: "a friendly retro camera on a tripod",
  guitar: "an acoustic guitar resting upright",
  product_display: "a small retail product display stand with items",
  wall_art: "a single framed piece of wall art",
  tv_screen: "a wall-mounted flat screen with a soft glow",
  // Exterior
  door: "a charming front door set in a small frame",
  window: "a cozy cottage window with shutters",
  tree: "a small rounded storybook tree",
  flower: "a cluster of cheerful potted flowers",
  fence: "a short wooden picket fence section",
  sign: "a hanging shop sign on a small post",
  lantern: "a warm glowing hanging lantern",
  mailbox: "a small standing mailbox",
  bench: "a cozy wooden park bench",
  market_stall: "a small covered market stall with an awning",
  // Avatar / support
  avatar_body: "a friendly rounded avatar character body, neutral pose",
  hairstyle: "a single hairstyle asset on a transparent head guide",
  clothing: "a single folded clothing item",
  accessory: "a small wearable accessory",
  pet: "a small cute companion pet",
  instrument: "a small handheld musical instrument",
  tool: "a single handheld craft tool",
  // Business
  cafe_counter: "a cozy cafe service counter with a small espresso machine",
  restaurant_table: "a set restaurant table for two",
  gym_equipment: "a friendly piece of gym equipment",
  medical_desk: "a tidy medical reception desk",
  workshop_tool: "a wall-mounted workshop tool",
  podcast_setup: "a cozy podcast desk with mic and headphones",
  shop_shelf: "a retail shop shelf stocked with goods",
};

export type BuiltPrompt = {
  category: FactoryCategory;
  prompt: string;
  negativePrompt: string;
};

/**
 * Compose the full positive prompt for a category. An optional `subject`
 * overrides the canned descriptor; `extra` appends free-form detail. The output
 * always begins with the master prompt and ends with the style tokens so every
 * asset shares the same visual spine.
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
