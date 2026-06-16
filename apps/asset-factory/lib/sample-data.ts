import {
  CATEGORY_META,
  type AssetCandidate,
  type AssetStatus,
  type FactoryCategory,
} from "@/lib/types";
import { slugify } from "@/lib/slug";
import { buildPrompt, NEGATIVE_PROMPT } from "@/lib/prompts";

// 30 seed candidates (Task 9): 10 interior · 8 exterior · 6 avatar · 6 business.
// Placeholder local image paths (/samples/<slug>.png) — no real uploads in V1.

const BASE_TIME = Date.UTC(2026, 5, 16, 9, 0, 0); // 2026-06-16T09:00:00Z

type Seed = {
  category: FactoryCategory;
  name: string;
  pack: string;
  status: AssetStatus;
  tags: string[];
  transparent?: boolean;
  width?: number;
  height?: number;
  styleScore?: number;
  reviewer?: string;
};

function mk(seed: Seed, index: number): AssetCandidate {
  const meta = CATEGORY_META[seed.category];
  const slug = slugify(seed.name);
  const createdAt = new Date(BASE_TIME + index * 60_000).toISOString();
  const reviewed = seed.status === "approved" || seed.status === "rejected" || seed.status === "needs_edit";
  return {
    id: `${seed.category}-${slug}`,
    name: seed.name,
    slug,
    category: seed.category,
    pack: seed.pack,
    status: seed.status,
    imageUrl: `/samples/${slug}.png`,
    prompt: buildPrompt(seed.category),
    negativePrompt: NEGATIVE_PROMPT,
    modelProvider: "placeholder",
    modelName: "sample-seed",
    seed: 1000 + index,
    width: seed.width ?? 1024,
    height: seed.height ?? 1024,
    transparent: seed.transparent ?? true,
    tags: seed.tags,
    compatibleZones: meta.compatibleZones,
    placementType: meta.placement,
    defaultScale: meta.defaultScale,
    defaultActionType: meta.defaultActionType,
    styleScore: seed.styleScore ?? 0,
    qualityNotes: "",
    reviewer: reviewed ? seed.reviewer ?? "hannan" : "",
    reviewedAt: reviewed ? new Date(BASE_TIME + index * 60_000 + 30_000).toISOString() : "",
    createdAt,
  };
}

const SEEDS: Seed[] = [
  // ── Interior (10) ──
  { category: "chair", name: "Cozy Reading Chair", pack: "interior-starter", status: "approved", tags: ["chair", "cozy", "reading"], styleScore: 92 },
  { category: "rug", name: "Round Jute Rug", pack: "interior-starter", status: "approved", tags: ["rug", "jute", "round"], styleScore: 88 },
  { category: "plant", name: "Leafy Corner Plant", pack: "interior-starter", status: "approved", tags: ["plant", "green", "corner"], styleScore: 90 },
  { category: "sofa", name: "Soft Linen Sofa", pack: "interior-starter", status: "needs_review", tags: ["sofa", "lounge", "linen"], styleScore: 80 },
  { category: "desk", name: "Maple Writing Desk", pack: "interior-starter", status: "needs_review", tags: ["desk", "work", "wood"], styleScore: 78 },
  { category: "lamp", name: "Warm Floor Lamp", pack: "interior-starter", status: "generated", tags: ["lamp", "light", "warm"] },
  { category: "wall_art", name: "Framed Sunset Print", pack: "interior-art", status: "needs_review", tags: ["art", "frame", "gallery"], transparent: false, styleScore: 70 },
  { category: "tv_screen", name: "Cozy Wall Screen", pack: "interior-tech", status: "needs_review", tags: ["screen", "video", "wall"], styleScore: 74 },
  { category: "shelf", name: "Open Pine Shelf", pack: "interior-starter", status: "needs_edit", tags: ["shelf", "books", "storage"], styleScore: 60 },
  { category: "computer", name: "Desktop Workstation", pack: "interior-tech", status: "queued", tags: ["computer", "work", "tech"] },

  // ── Exterior (8) ──
  { category: "market_stall", name: "Wooden Market Stall", pack: "exterior-village", status: "approved", tags: ["market", "stall", "shop"], styleScore: 91 },
  { category: "door", name: "Round Cottage Door", pack: "exterior-village", status: "needs_review", tags: ["door", "entrance", "cottage"], styleScore: 82 },
  { category: "window", name: "Shuttered Cottage Window", pack: "exterior-village", status: "generated", tags: ["window", "cottage", "shutters"] },
  { category: "tree", name: "Little Storybook Tree", pack: "exterior-garden", status: "needs_review", tags: ["tree", "garden", "nature"], styleScore: 85 },
  { category: "flower", name: "Cheerful Flower Pot", pack: "exterior-garden", status: "needs_review", tags: ["flower", "garden", "pot"], width: 200, height: 200, styleScore: 68 },
  { category: "bench", name: "Garden Park Bench", pack: "exterior-garden", status: "needs_review", tags: ["bench", "seat", "garden"], styleScore: 79 },
  { category: "lantern", name: "Hanging Glow Lantern", pack: "exterior-village", status: "rejected", tags: ["lantern", "light", "evening"], styleScore: 40 },
  { category: "sign", name: "Hanging Shop Sign", pack: "exterior-village", status: "needs_review", tags: [], styleScore: 72 },

  // ── Avatar / support (6) ──
  { category: "avatar_body", name: "Friendly Avatar Body", pack: "avatar-base", status: "needs_review", tags: ["avatar", "character", "body"], styleScore: 83 },
  { category: "hairstyle", name: "Wavy Bob Hairstyle", pack: "avatar-hair", status: "needs_review", tags: ["hair", "style", "avatar"], styleScore: 77 },
  { category: "clothing", name: "Cozy Knit Sweater", pack: "avatar-wardrobe", status: "generated", tags: ["clothing", "sweater", "wardrobe"] },
  { category: "accessory", name: "Round Glasses", pack: "avatar-wardrobe", status: "needs_review", tags: ["accessory", "glasses", "face"], styleScore: 75 },
  { category: "pet", name: "Sleepy Cat Companion", pack: "avatar-pets", status: "needs_review", tags: ["pet", "cat", "companion"], styleScore: 86 },
  { category: "instrument", name: "Pocket Ukulele", pack: "avatar-support", status: "queued", tags: ["instrument", "music", "ukulele"] },

  // ── Business (6) ──
  { category: "cafe_counter", name: "Cafe Counter", pack: "business-cafe", status: "approved", tags: ["cafe", "counter", "coffee"], styleScore: 90 },
  { category: "restaurant_table", name: "Bistro Dining Table", pack: "business-restaurant", status: "needs_review", tags: ["restaurant", "table", "dining"], styleScore: 81 },
  { category: "gym_equipment", name: "Friendly Treadmill", pack: "business-gym", status: "needs_review", tags: ["gym", "fitness", "equipment"], styleScore: 76 },
  { category: "medical_desk", name: "Clinic Reception Desk", pack: "business-medical", status: "needs_review", tags: ["medical", "clinic", "desk"], styleScore: 73 },
  { category: "podcast_setup", name: "Podcast Mic Desk", pack: "business-podcast", status: "generated", tags: ["podcast", "mic", "audio"] },
  { category: "shop_shelf", name: "Stocked Shop Shelf", pack: "business-retail", status: "needs_review", tags: ["shop", "shelf", "retail"], styleScore: 84 },
];

/** A fresh copy of the 30 seed candidates (callers may mutate the result). */
export function sampleCandidates(): AssetCandidate[] {
  return SEEDS.map((seed, i) => mk(seed, i));
}
