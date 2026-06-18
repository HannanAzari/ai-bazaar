import { ALL_CATEGORIES, CATEGORY_META, type FactoryCategory } from "@/lib/types";
import { NESTUDIO_CAMERA_SPEC_V1, NESTUDIO_OBJECT_RULES_V1 } from "@/lib/nestudio-spec";

// ── Nestudio Master Style V2 (V3.4) ──────────────────────────────────────────
//
// The unified generation identity. Targets a PREMIUM COLLECTIBLE GAME ASSET: a
// polished game-economy / inventory item that stays highly readable at 64px and
// 128px, slightly stylized — NOT toy-like, NOT puffy, NOT realistic, NOT storybook,
// NOT painterly, NOT plastic, NOT cluttered. Think premium-casual mobile game with
// clean Disney/Pixar-inspired readability, never a Royal Match / Clash clone, an
// Apple product render, or photorealism.
//
// This replaces the V3.1–V3.3 multi-style experiments (royal_match / modern_designer
// / clash) with ONE locked direction. The hard camera + object rules live in
// lib/nestudio-spec.ts (Camera Spec V1 + Object Rules V1) and are folded in below so
// every asset shares one camera, one framing, and a single isolated object.
// See docs/premium-style.md.

export const STYLE_ID = "nestudio_v2";
export const STYLE_NAME = "Nestudio Master Style V2";
export const STYLE_VERSION = 2;

// ── Nestudio Visual DNA (V3.5) ───────────────────────────────────────────────
//
// The IDENTITY layer. V3.4 defined the camera + object rules but left the *style
// language* generic ("neutral premium palette", "game inventory item"), so outputs
// read as generic furniture icons that don't belong to one world. This DNA is the
// positive signature that makes every object recognizably Nestudio: a modern
// Scandinavian art direction, soft rounded geometry, specific tactile materials, a
// warm cohesive palette with ONE confident accent, and a SINGLE locked warm
// lighting/rendering signature shared across the whole catalog. Personality (a
// different sofa each time) comes from the per-object subject, never from changing
// this DNA. Discovered on the sofa-only experiment — see docs/premium-style.md.
//
// IMPORTANT: this is style language ONLY. It does not touch the camera, the
// transparency, or the single-object isolation (those live in nestudio-spec.ts).
export const NESTUDIO_DNA =
  "Nestudio world identity: a cohesive family of premium collectible room objects with a modern " +
  "Scandinavian influence — soft rounded geometry, gently chamfered edges, designer-furniture " +
  "craftsmanship, and a friendly, approachable character. Tactile natural materials such as oiled oak, " +
  "wool, boucle, felt, soft leather, and matte ceramic, in a warm cozy palette of muted earthy tones " +
  "with a single confident accent color. Cohesive stylized 3D render with a soft matte finish, a gentle " +
  "warm key light from the upper-left, soft ambient fill, and smooth subtle gradients — the same " +
  "lighting and rendering signature shared across every object in the world.";

/** The master prompt — the shared spine of every generated asset. */
export const MASTER_PROMPT =
  "Premium collectible game asset, a polished, characterful room object. Slightly stylized with clean, " +
  "Pixar-inspired readability, optimized to stay crisp and recognizable at 64px and 128px. " +
  `${NESTUDIO_OBJECT_RULES_V1.promptFragment} ${NESTUDIO_CAMERA_SPEC_V1.promptFragment} ` +
  "Soft studio lighting with subtle ambient occlusion and a clean, bold silhouette. " +
  "Part of one cohesive, recognizable Nestudio world.";

/** The negative prompt — strongly discourages scenes, props, and off-style rendering. */
export const NEGATIVE_PROMPT =
  "room scene, furniture set, multiple objects, base, platform, pedestal, floor plane, ground plane, rug, " +
  "books, lamp, plant, side table, extra props, extra decorations, cluttered, busy composition, " +
  "text, watermark, logo, signature, photorealism, realistic photography, painterly illustration, " +
  "storybook rendering, flat vector, toy-like, puffy, inflated, plastic toy, glossy plastic, " +
  "random perspective, front view, side view, top-down, cropped object, dramatic shadows, " +
  "sunset lighting, golden hour, white background, scene background, " +
  // V3.5 — ban the generic-identity failure modes (style language only).
  "generic furniture catalog, furniture showroom, icon pack, app icon, clipart, sticker, " +
  "realistic furniture photography, product photograph, luxury mansion furniture, ornate, " +
  "baroque carving, children's furniture, kids furniture";

/** Reusable Nestudio V2 style tokens appended to every prompt for consistency. */
export const STYLE_TOKENS: string[] = [
  "premium collectible room object",
  "single isolated object",
  "modern Scandinavian influence",
  "soft rounded geometry",
  "warm cozy palette with one accent",
  "cohesive Nestudio world",
  "bold readable silhouette",
  "3/4 isometric, ~30 degrees",
  "soft warm studio lighting",
  "transparent background",
  "readable at 64px and 128px",
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
