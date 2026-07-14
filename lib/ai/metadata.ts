/**
 * lib/ai/metadata.ts — rich asset insight inference.
 * -----------------------------------------------------------------------------
 * Turns a subject + the generated pixels into structured metadata that future
 * search, placement and the Admin Factory depend on: category, tags, colours,
 * material, rarity, recommended room, surface type, scale hint and anchor point.
 * Pure + deterministic (colours + anchor come from measured stats passed in), so
 * it's unit-tested and reusable by every studio.
 */

import type { AlphaStats } from "./canvas";
import type { AssetKind } from "./types";

export type SurfaceType = "floor" | "table" | "shelf" | "wall";
export type ScaleHint = "small" | "medium" | "large";
export type Rarity = "common" | "uncommon" | "rare";

export type AssetInsights = {
  category: string;
  tags: string[];
  colors: string[];
  material: string;
  rarity: Rarity;
  recommendedRoom: string;
  surfaceType: SurfaceType;
  scaleHint: ScaleHint;
  /** Ground-contact anchor (bottom-centre of the object), normalized 0..1. */
  anchor: { x: number; y: number };
};

type Profile = {
  match: string[];
  category: string;
  material: string;
  room: string;
  surface: SurfaceType;
  scale: ScaleHint;
  rarity?: Rarity;
};

// Small hand-tuned knowledge base — the sprint's target objects + common cousins.
const PROFILES: Profile[] = [
  { match: ["mug", "cup", "coffee", "tea"], category: "decor", material: "ceramic", room: "kitchen", surface: "table", scale: "small" },
  { match: ["camera", "dslr", "lens"], category: "creator_tool", material: "metal & plastic", room: "studio", surface: "table", scale: "small", rarity: "uncommon" },
  { match: ["plant", "monstera", "fern", "cactus", "flower", "pot"], category: "plant", material: "foliage & terracotta", room: "living", surface: "floor", scale: "large" },
  { match: ["book", "notebook", "journal"], category: "decor", material: "paper & board", room: "studio", surface: "shelf", scale: "small" },
  { match: ["chair", "armchair", "sofa", "couch", "stool", "seat"], category: "furniture", material: "fabric & wood", room: "living", surface: "floor", scale: "large" },
  { match: ["controller", "gamepad", "console"], category: "electronics", material: "matte plastic", room: "living", surface: "table", scale: "small" },
  { match: ["guitar", "ukulele", "violin", "instrument"], category: "creator_tool", material: "wood", room: "studio", surface: "floor", scale: "large", rarity: "uncommon" },
  { match: ["headphone", "headset", "earphone"], category: "electronics", material: "matte plastic & foam", room: "studio", surface: "shelf", scale: "small" },
  { match: ["lamp", "light"], category: "lighting", material: "metal & linen", room: "living", surface: "table", scale: "medium" },
  { match: ["table", "desk"], category: "furniture", material: "wood", room: "living", surface: "floor", scale: "large" },
  { match: ["tv", "monitor", "screen", "laptop"], category: "electronics", material: "matte plastic & glass", room: "living", surface: "table", scale: "medium" },
  { match: ["frame", "poster", "picture", "art"], category: "decor", material: "wood & paper", room: "living", surface: "wall", scale: "medium" },
];

const DEFAULT_PROFILE: Profile = { match: [], category: "decor", material: "mixed matte", room: "living", surface: "table", scale: "medium" };

function profileFor(subject: string): Profile {
  const s = subject.toLowerCase();
  return PROFILES.find((p) => p.match.some((m) => s.includes(m))) ?? DEFAULT_PROFILE;
}

/** Stable 0..1 from a string (deterministic rarity roll without randomness). */
function hashUnit(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function rollRarity(subject: string, base?: Rarity): Rarity {
  if (base) return base;
  const r = hashUnit(subject);
  return r > 0.93 ? "rare" : r > 0.72 ? "uncommon" : "common";
}

/** Infer full asset insights. `stats` (optional) gives the ground-contact anchor. */
export function inferInsights(input: {
  subject: string;
  kind: AssetKind;
  colors?: string[];
  stats?: AlphaStats;
}): AssetInsights {
  const p = profileFor(input.subject);
  const anchor = input.stats && input.stats.coverage > 0
    ? { x: (input.stats.bbox.minX + input.stats.bbox.maxX) / 2 / input.stats.width, y: input.stats.bbox.maxY / input.stats.height }
    : { x: 0.5, y: 0.9 };
  const tags = Array.from(
    new Set([
      input.kind,
      ...input.subject.toLowerCase().split(/\s+/).filter((w) => w.length > 2),
      p.category,
      p.material.split(/\s*&\s*|\s+/)[0],
      p.room,
      p.surface,
    ]),
  );
  return {
    category: p.category,
    tags,
    colors: input.colors ?? [],
    material: p.material,
    rarity: rollRarity(input.subject, p.rarity),
    recommendedRoom: p.room,
    surfaceType: p.surface,
    scaleHint: p.scale,
    anchor,
  };
}
