import type { AssetCategory, AssetPlacement, AssetRarity, AssetStatus, CatalogAsset } from "@/lib/types";

// Read-only sample catalog for the asset-metadata foundation. No marketplace,
// payments, or uploads — these are seed records that mirror the Supabase
// `assets` table shape (see schema.sql). Image URLs are placeholders.

export const rarityLabels: Record<AssetRarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  legendary: "Legendary",
};

export const rarityStyles: Record<AssetRarity, string> = {
  common: "bg-ink/5 text-ink/55",
  uncommon: "bg-teal/15 text-teal",
  rare: "bg-blue-100 text-blue-700",
  legendary: "bg-amber-100 text-amber-800",
};

export const statusStyles: Record<AssetStatus, string> = {
  draft: "bg-ink/5 text-ink/45",
  published: "bg-teal/15 text-teal",
  retired: "bg-rose-100 text-terracotta",
};

export const categoryLabels: Record<AssetCategory, string> = {
  furniture: "Furniture",
  wall: "Wall",
  floor: "Floor",
  plant: "Plant",
  lighting: "Lighting",
  decor: "Decor",
  structure: "Structure",
};

export const placementLabels: Record<AssetPlacement, string> = {
  floor: "Floor",
  wall: "Wall",
  ceiling: "Ceiling",
  exterior: "Exterior",
  any: "Any",
};

const ph = (label: string) => `/assets/placeholder/${label}.svg`;

export const catalogAssets: CatalogAsset[] = [
  { id: "ast-001", name: "Cedar Tea Table", category: "furniture", villageTheme: "saffron-yard", placement: "floor", ownerType: "system", rarity: "common", tags: ["tea", "wood"], imageUrl: ph("cedar-tea-table"), status: "published" },
  { id: "ast-002", name: "Paper Lantern String", category: "lighting", villageTheme: "lantern-hill", placement: "ceiling", ownerType: "system", rarity: "uncommon", tags: ["light", "evening"], imageUrl: ph("paper-lantern-string"), status: "published" },
  { id: "ast-003", name: "Moss Window Box", category: "plant", villageTheme: "cedar-ring", placement: "exterior", ownerType: "system", rarity: "common", tags: ["nature", "green"], imageUrl: ph("moss-window-box"), status: "published" },
  { id: "ast-004", name: "Velvet Listening Chair", category: "furniture", villageTheme: "velvet-square", placement: "floor", ownerType: "creator", ownerHandle: "@theovale", rarity: "rare", tags: ["music", "cosy"], imageUrl: ph("velvet-listening-chair"), status: "published" },
  { id: "ast-005", name: "Riso Print Set", category: "decor", villageTheme: "paper-meadow", placement: "wall", ownerType: "creator", ownerHandle: "@linaprints", rarity: "uncommon", tags: ["print", "art"], imageUrl: ph("riso-print-set"), status: "published" },
  { id: "ast-006", name: "Ultramarine Easel", category: "decor", villageTheme: "moon-court", placement: "floor", ownerType: "creator", ownerHandle: "@amalafterlight", rarity: "rare", tags: ["painting", "studio"], imageUrl: ph("ultramarine-easel"), status: "published" },
  { id: "ast-007", name: "Striped Wallpaper — Honey", category: "wall", villageTheme: "honey-grove", placement: "wall", ownerType: "system", rarity: "common", tags: ["pattern", "warm"], imageUrl: ph("striped-wallpaper-honey"), status: "published" },
  { id: "ast-008", name: "Brass Floor Lamp", category: "lighting", villageTheme: "any", placement: "floor", ownerType: "system", rarity: "common", tags: ["light", "brass"], imageUrl: ph("brass-floor-lamp"), status: "published" },
  { id: "ast-009", name: "Folded Crane Mobile", category: "decor", villageTheme: "rose-arcade", placement: "ceiling", ownerType: "creator", ownerHandle: "@junfolds", rarity: "uncommon", tags: ["origami", "paper"], imageUrl: ph("folded-crane-mobile"), status: "draft" },
  { id: "ast-010", name: "Midnight Projector", category: "lighting", villageTheme: "cobalt-lane", placement: "wall", ownerType: "system", rarity: "rare", tags: ["film", "night"], imageUrl: ph("midnight-projector"), status: "published" },
  { id: "ast-011", name: "Orchard Floorboards", category: "floor", villageTheme: "blue-orchard", placement: "floor", ownerType: "system", rarity: "common", tags: ["wood", "warm"], imageUrl: ph("orchard-floorboards"), status: "published" },
  { id: "ast-012", name: "Founders' Hearth", category: "structure", villageTheme: "any", placement: "floor", ownerType: "system", rarity: "legendary", tags: ["fire", "heritage"], imageUrl: ph("founders-hearth"), status: "retired" },
];
