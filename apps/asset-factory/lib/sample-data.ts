import {
  CATEGORY_META,
  type AssetCandidate,
  type AssetStatus,
  type FactoryCategory,
} from "@/lib/types";
import { slugify } from "@/lib/slug";
import { buildPrompt, NEGATIVE_PROMPT } from "@/lib/prompts";

// Seed candidates (Task 8: expanded to 90). 50 interior · 20 exterior · 10
// business · 10 avatar/support. Placeholder local image paths (/samples/<slug>.png)
// — no real uploads. The first 30 are the original V1 set (kept verbatim, incl. the
// 5 approved that back the committed export examples); the rest extend coverage.

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

// ── Original V1 set (30) — unchanged ────────────────────────────────────────
const SEEDS: Seed[] = [
  // Interior (10)
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

  // Exterior (8)
  { category: "market_stall", name: "Wooden Market Stall", pack: "exterior-village", status: "approved", tags: ["market", "stall", "shop"], styleScore: 91 },
  { category: "door", name: "Round Cottage Door", pack: "exterior-village", status: "needs_review", tags: ["door", "entrance", "cottage"], styleScore: 82 },
  { category: "window", name: "Shuttered Cottage Window", pack: "exterior-village", status: "generated", tags: ["window", "cottage", "shutters"] },
  { category: "tree", name: "Little Storybook Tree", pack: "exterior-garden", status: "needs_review", tags: ["tree", "garden", "nature"], styleScore: 85 },
  { category: "flower", name: "Cheerful Flower Pot", pack: "exterior-garden", status: "needs_review", tags: ["flower", "garden", "pot"], width: 200, height: 200, styleScore: 68 },
  { category: "bench", name: "Garden Park Bench", pack: "exterior-garden", status: "needs_review", tags: ["bench", "seat", "garden"], styleScore: 79 },
  { category: "lantern", name: "Hanging Glow Lantern", pack: "exterior-village", status: "rejected", tags: ["lantern", "light", "evening"], styleScore: 40 },
  { category: "sign", name: "Hanging Shop Sign", pack: "exterior-village", status: "needs_review", tags: [], styleScore: 72 },

  // Avatar / support (6)
  { category: "avatar_body", name: "Friendly Avatar Body", pack: "avatar-base", status: "needs_review", tags: ["avatar", "character", "body"], styleScore: 83 },
  { category: "hairstyle", name: "Wavy Bob Hairstyle", pack: "avatar-hair", status: "needs_review", tags: ["hair", "style", "avatar"], styleScore: 77 },
  { category: "clothing", name: "Cozy Knit Sweater", pack: "avatar-wardrobe", status: "generated", tags: ["clothing", "sweater", "wardrobe"] },
  { category: "accessory", name: "Round Glasses", pack: "avatar-wardrobe", status: "needs_review", tags: ["accessory", "glasses", "face"], styleScore: 75 },
  { category: "pet", name: "Sleepy Cat Companion", pack: "avatar-pets", status: "needs_review", tags: ["pet", "cat", "companion"], styleScore: 86 },
  { category: "instrument", name: "Pocket Ukulele", pack: "avatar-support", status: "queued", tags: ["instrument", "music", "ukulele"] },

  // Business (6)
  { category: "cafe_counter", name: "Cafe Counter", pack: "business-cafe", status: "approved", tags: ["cafe", "counter", "coffee"], styleScore: 90 },
  { category: "restaurant_table", name: "Bistro Dining Table", pack: "business-restaurant", status: "needs_review", tags: ["restaurant", "table", "dining"], styleScore: 81 },
  { category: "gym_equipment", name: "Friendly Treadmill", pack: "business-gym", status: "needs_review", tags: ["gym", "fitness", "equipment"], styleScore: 76 },
  { category: "medical_desk", name: "Clinic Reception Desk", pack: "business-medical", status: "needs_review", tags: ["medical", "clinic", "desk"], styleScore: 73 },
  { category: "podcast_setup", name: "Podcast Mic Desk", pack: "business-podcast", status: "generated", tags: ["podcast", "mic", "audio"] },
  { category: "shop_shelf", name: "Stocked Shop Shelf", pack: "business-retail", status: "needs_review", tags: ["shop", "shelf", "retail"], styleScore: 84 },
];

// ── V2.5 expansion (60) — auto-tagged from the name ─────────────────────────
type Extra = {
  c: FactoryCategory;
  n: string;
  s: AssetStatus;
  /** Tag override (e.g. [] to model weak metadata). */
  tags?: string[];
  transparent?: boolean;
};

function toSeed(e: Extra): Seed {
  const slug = slugify(e.n);
  const derived = Array.from(new Set(slug.split("-").filter((w) => w.length >= 3))).slice(0, 3);
  const tags = e.tags ?? (derived.length ? derived : [CATEGORY_META[e.c].group]);
  return {
    category: e.c,
    name: e.n,
    pack: `${CATEGORY_META[e.c].group}-extended`,
    status: e.s,
    tags,
    transparent: e.transparent,
    styleScore: e.s === "approved" ? 85 : 0,
  };
}

const EXTRA: Extra[] = [
  // Interior (+40 → 50 total)
  { c: "chair", n: "Velvet Accent Chair", s: "approved" },
  { c: "chair", n: "Rattan Bistro Chair", s: "approved" },
  { c: "chair", n: "Bean Bag Seat", s: "needs_review" },
  { c: "chair", n: "Office Task Chair", s: "queued" },
  { c: "table", n: "Oak Coffee Table", s: "approved" },
  { c: "table", n: "Nesting Side Tables", s: "approved" },
  { c: "table", n: "Drop-leaf Table", s: "needs_review" },
  { c: "desk", n: "Standing Desk", s: "approved" },
  { c: "desk", n: "Corner Study Desk", s: "needs_review" },
  { c: "shelf", n: "Ladder Bookshelf", s: "approved" },
  { c: "shelf", n: "Cube Storage Shelf", s: "approved" },
  { c: "shelf", n: "Floating Wall Shelf", s: "needs_review" },
  { c: "sofa", n: "Tufted Loveseat", s: "approved" },
  { c: "sofa", n: "Modular Corner Sofa", s: "approved" },
  { c: "rug", n: "Striped Wool Rug", s: "approved" },
  { c: "rug", n: "Shaggy Accent Rug", s: "needs_review" },
  { c: "plant", n: "Fiddle Leaf Fig", s: "approved" },
  { c: "plant", n: "Hanging Pothos", s: "approved" },
  { c: "plant", n: "Snake Plant", s: "approved", tags: [] }, // weak metadata (no tags)
  { c: "plant", n: "Succulent Trio", s: "needs_review" },
  { c: "lamp", n: "Arc Floor Lamp", s: "approved" },
  { c: "lamp", n: "Paper Table Lamp", s: "approved" },
  { c: "lamp", n: "Clip Reading Lamp", s: "rejected" },
  { c: "book", n: "Stacked Hardcovers", s: "approved" },
  { c: "book", n: "Open Sketchbook", s: "needs_review" },
  { c: "computer", n: "Retro Monitor", s: "approved" },
  { c: "computer", n: "Laptop on Stand", s: "needs_review" },
  { c: "microphone", n: "Boom Arm Mic", s: "approved" },
  { c: "microphone", n: "Vintage Ribbon Mic", s: "approved" },
  { c: "camera", n: "Tripod Camera", s: "approved" },
  { c: "camera", n: "Instant Camera", s: "needs_review" },
  { c: "guitar", n: "Acoustic Guitar Stand", s: "approved" },
  { c: "guitar", n: "Electric Guitar", s: "generated" },
  { c: "product_display", n: "Tiered Display Stand", s: "approved" },
  { c: "product_display", n: "Glass Showcase", s: "needs_review" },
  { c: "wall_art", n: "Abstract Canvas", s: "approved", transparent: false },
  { c: "wall_art", n: "Botanical Print Set", s: "approved" },
  { c: "wall_art", n: "Framed Map", s: "generated" },
  { c: "tv_screen", n: "Wide Wall Screen", s: "approved" },
  { c: "tv_screen", n: "Retro CRT", s: "needs_review" },

  // Exterior (+12 → 20 total)
  { c: "door", n: "Arched Garden Gate", s: "approved" },
  { c: "window", n: "Bay Window", s: "approved", tags: [] }, // weak metadata (no tags)
  { c: "tree", n: "Potted Olive Tree", s: "approved" },
  { c: "tree", n: "Cherry Blossom Tree", s: "needs_review" },
  { c: "flower", n: "Window Flower Box", s: "approved" },
  { c: "flower", n: "Tulip Planter", s: "needs_review" },
  { c: "fence", n: "White Picket Fence", s: "approved" },
  { c: "sign", n: "Hanging Cafe Sign", s: "approved" },
  { c: "sign", n: "Open Closed Sign", s: "generated" },
  { c: "lantern", n: "Path Lantern", s: "approved" },
  { c: "bench", n: "Reading Park Bench", s: "approved" },
  { c: "market_stall", n: "Striped Market Stall", s: "approved" },

  // Business (+4 → 10 total)
  { c: "cafe_counter", n: "Espresso Bar Counter", s: "approved" },
  { c: "restaurant_table", n: "Bistro Two-Top", s: "approved" },
  { c: "gym_equipment", n: "Yoga Mat Station", s: "needs_review" },
  { c: "podcast_setup", n: "Podcast Booth Desk", s: "approved" },

  // Avatar / support (+4 → 10 total)
  { c: "avatar_body", n: "Casual Avatar Body", s: "approved" },
  { c: "hairstyle", n: "Curly Hairstyle", s: "needs_review" },
  { c: "pet", n: "Corgi Companion", s: "approved" },
  { c: "tool", n: "Paintbrush Set", s: "generated" },
];

const ALL_SEEDS: Seed[] = [...SEEDS, ...EXTRA.map(toSeed)];

/** A fresh copy of the 90 seed candidates (callers may mutate the result). */
export function sampleCandidates(): AssetCandidate[] {
  return ALL_SEEDS.map((seed, i) => mk(seed, i));
}
