// ── Nest Translator — intent → structured Nest DNA spec ──────────────────────
//
// Mirrors lib/asset-pipeline/translator.ts, but the target is an EMPTY Nest
// (architecture only), not an object. The founder reviews/edits this spec BEFORE
// spending on generation. Server route: app/api/ai/nest/translate.

export type NestWallConfig = "front-only" | "front-left" | "front-right" | "front-left-right" | "corner";

export type NestSpec = {
  name: string;
  category: string; // "Music Studio", "Industrial Loft", "Japanese Room"…
  mood: string; // "warm / creative / calm"
  architecturalStyle: string; // "mid-century", "industrial", "japandi"…
  walls: NestWallConfig;
  floorMaterial: string; // "matte warm timber"
  ceiling: string; // "flat soft-white ceiling" / "exposed timber beams"
  windows: string; // "large left-side window, soft daylight" / "none"
  palette: string; // "warm neutrals — oat, clay, ochre"
  lighting: string; // "evening indirect key, soft shadows"
  timeOfDay: string; // "evening"
  architecturalDetails: string[]; // ["arched doorway", "wainscoting"]
  recommendedAssetTags: string[]; // asset tags that suit this room (metadata only)
  compatibilityVersion: string; // camera DNA version
  estimatedCostUsd: number;
  brandNeutral: { ok: boolean; note: string };
  moderation: { ok: boolean; note: string };
  /** The concise empty-room description handed to the generator. */
  generationSubject: string;
};

// The Nest camera must match the editor's object camera so rooms + assets share one world.
export const NEST_CAMERA_DNA_VERSION = "front-facing-v1";

export const NEST_WALL_CONFIGS: NestWallConfig[] = ["front-only", "front-left", "front-right", "front-left-right", "corner"];

/** One text-to-image generation at high quality (portrait). No reference/edit pass. */
export function estimateNestCost(): number {
  return 0.19;
}

const CATEGORY_HINTS = [
  "Minimal Apartment", "Industrial Loft", "Photography Studio", "Music Studio", "Japanese Room",
  "Art Gallery", "Gaming Room", "Coffee House", "Luxury Penthouse", "Library", "Modern Office", "Creator Studio",
];

export function buildNestTranslatorSystemPrompt(): string {
  return [
    "You are the Nestudio Nest Translator. Turn a founder's short description of a room into a strict JSON spec for generating an EMPTY Nest — a bare architectural stage that creators will decorate later.",
    "You describe ARCHITECTURE ONLY: walls, windows, floor, ceiling, lighting, mood, architectural details. NEVER furniture, props, plants, rugs, art, decorations, people, text or logos — those are added later by the creator, never baked into the room.",
    "The Nestudio world is: warm, minimal, timeless, premium, inviting; matte materials; soft diffuse lighting; one canonical camera (straight-on, eye-level, front wall facing the viewer). Keep every room within this language.",
    `Category should be one of or close to: ${CATEGORY_HINTS.join(", ")}.`,
    `walls must be one of: ${NEST_WALL_CONFIGS.join(", ")}.`,
    "Return ONLY a JSON object with keys: name, category, mood, architecturalStyle, walls, floorMaterial, ceiling, windows, palette, lighting, timeOfDay, architecturalDetails (string array), recommendedAssetTags (string array of asset kinds that suit this room), brandNeutral {ok:boolean,note:string}, moderation {ok:boolean,note:string}, generationSubject.",
    "generationSubject: one vivid sentence describing the EMPTY room's architecture, materials and light — no objects, no furniture, no people. This is the prompt the image model sees.",
    "brandNeutral.ok=false only if the request demands a real brand/trademarked space. moderation.ok=false only for unsafe/disallowed content.",
  ].join("\n");
}
