import { type FactoryCategory } from "@/lib/types";
import { PERSONALITIES } from "@/lib/sofa-dna";
import { GENERATION_DEFAULTS } from "@/lib/generation-config";

// Nestudio Production Plan (V3.7 lock). The batch manifest for the FIRST production
// run: the smallest asset set that can assemble TARGET_ROOMS unique rooms across all
// ten locked personalities. NOT a new experiment / style / personality system — it
// reuses the frozen V3.7 DNA + the existing PERSONALITIES, and just declares how many
// of each category to keep and in what order to generate them, with the cost math.
//
// Minimization strategy:
//   • HERO seating (sofa, armchair) is generated per-personality — it carries identity.
//   • Everything else is a SHARED pool: the frozen DNA already makes tables, storage,
//     lighting, greenery, and decor read as one family, so a handful is reused across
//     all rooms. This keeps the batch tiny while every room still feels on-personality.

export const PERSONALITY_COUNT = PERSONALITIES.length; // 10
export const TARGET_ROOMS = 20;
/** Locked style → low candidate count (generate N, approve 1). */
export const CANDIDATES_PER_ASSET = 2;

export type AssetTier = 1 | 2;
export type VariantStrategy = "per_personality" | "shared";

export type ProductionCategory = {
  key: string;
  label: string;
  /** Nearest FactoryCategory used for prompting (some Tier-2 items reuse a close enum). */
  category: FactoryCategory;
  tier: AssetTier;
  strategy: VariantStrategy;
  /** Unique assets to KEEP for this category. */
  variants: number;
  role: string;
};

export const PRODUCTION_CATEGORIES: ProductionCategory[] = [
  // ── Tier 1 ──
  { key: "sofa", label: "Sofa", category: "sofa", tier: 1, strategy: "per_personality", variants: PERSONALITY_COUNT, role: "hero seating — carries personality" },
  { key: "armchair", label: "Armchair", category: "chair", tier: 1, strategy: "per_personality", variants: PERSONALITY_COUNT, role: "hero seating — room variety + future characters" },
  { key: "coffee_table", label: "Coffee Table", category: "table", tier: 1, strategy: "shared", variants: 4, role: "shared surface, reused across rooms" },
  { key: "rug", label: "Rug", category: "rug", tier: 1, strategy: "shared", variants: 4, role: "shared floor anchor" },
  { key: "shelf", label: "Shelf", category: "shelf", tier: 1, strategy: "shared", variants: 3, role: "shared open storage / display" },
  { key: "cabinet", label: "Cabinet", category: "shelf", tier: 1, strategy: "shared", variants: 3, role: "shared closed storage" },
  { key: "desk", label: "Desk", category: "desk", tier: 1, strategy: "shared", variants: 3, role: "shared work surface" },
  { key: "lamp", label: "Lamp", category: "lamp", tier: 1, strategy: "shared", variants: 3, role: "shared lighting" },
  { key: "plant", label: "Plant", category: "plant", tier: 1, strategy: "shared", variants: 3, role: "shared greenery" },
  { key: "wall_art", label: "Wall Art", category: "wall_art", tier: 1, strategy: "shared", variants: 4, role: "shared wall accent" },
  // ── Tier 2 ──
  { key: "book", label: "Books", category: "book", tier: 2, strategy: "shared", variants: 2, role: "shelf filler" },
  { key: "electronics", label: "Electronics", category: "computer", tier: 2, strategy: "shared", variants: 2, role: "desk / shelf tech" },
  { key: "gaming_accessory", label: "Gaming Accessory", category: "accessory", tier: 2, strategy: "shared", variants: 2, role: "gamer / creator detail" },
  { key: "decor_object", label: "Decor Object", category: "product_display", tier: 2, strategy: "shared", variants: 3, role: "shelf / table decor" },
  { key: "storage_object", label: "Storage Object", category: "shelf", tier: 2, strategy: "shared", variants: 2, role: "baskets / boxes" },
];

export function keptAssetCount(cats: ProductionCategory[] = PRODUCTION_CATEGORIES): number {
  return cats.reduce((n, c) => n + c.variants, 0);
}

export function tierCount(tier: AssetTier): number {
  return keptAssetCount(PRODUCTION_CATEGORIES.filter((c) => c.tier === tier));
}

/** Total hero (per-personality) seating assets — the room-identity coverage driver. */
export function heroSeatingCount(): number {
  return keptAssetCount(PRODUCTION_CATEGORIES.filter((c) => c.strategy === "per_personality"));
}

export function imagesToGenerate(candidatesPerAsset: number = CANDIDATES_PER_ASSET, cats: ProductionCategory[] = PRODUCTION_CATEGORIES): number {
  return keptAssetCount(cats) * Math.max(1, Math.floor(candidatesPerAsset));
}

export function estimatedCostUsd(
  candidatesPerAsset: number = CANDIDATES_PER_ASSET,
  costPerImage: number = GENERATION_DEFAULTS.openaiCostPerImage,
  cats: ProductionCategory[] = PRODUCTION_CATEGORIES,
): number {
  return Math.round(imagesToGenerate(candidatesPerAsset, cats) * costPerImage * 100) / 100;
}

/** Batch order: hero per-personality first (identity), then shared Tier 1, then Tier 2. */
export function batchOrder(): ProductionCategory[] {
  const rank = (c: ProductionCategory) => (c.strategy === "per_personality" ? 0 : c.tier === 1 ? 1 : 2);
  return [...PRODUCTION_CATEGORIES].sort((a, b) => rank(a) - rank(b));
}

export type PlanSummary = {
  keptAssets: number;
  tier1: number;
  tier2: number;
  heroSeating: number;
  candidatesPerAsset: number;
  images: number;
  costUsd: number;
  costMinUsd: number;
  targetRooms: number;
  personalities: number;
  /** True when the kept set can cover the target rooms across all personalities. */
  coversTarget: boolean;
};

export function productionPlanSummary(candidatesPerAsset: number = CANDIDATES_PER_ASSET): PlanSummary {
  const hero = heroSeatingCount();
  return {
    keptAssets: keptAssetCount(),
    tier1: tierCount(1),
    tier2: tierCount(2),
    heroSeating: hero,
    candidatesPerAsset,
    images: imagesToGenerate(candidatesPerAsset),
    costUsd: estimatedCostUsd(candidatesPerAsset),
    costMinUsd: estimatedCostUsd(1),
    targetRooms: TARGET_ROOMS,
    personalities: PERSONALITY_COUNT,
    // Each room needs one personality-appropriate hero seat; 2 hero seats/personality
    // → 2 distinct rooms/personality → covers 20 rooms across 10 personalities.
    coversTarget: hero >= TARGET_ROOMS && PERSONALITY_COUNT * 2 >= TARGET_ROOMS,
  };
}
