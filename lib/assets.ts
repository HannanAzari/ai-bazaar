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
  door: "Door",
  stairs: "Stairs",
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

  // ── Room-ready assets (placeable in the room engine) ──
  { id: "ast-bookshelf", name: "Bookshelf", category: "furniture", villageTheme: "any", placement: "floor", ownerType: "system", rarity: "common", tags: ["books", "links"], imageUrl: ph("bookshelf"), status: "published", compatibleZones: ["floor_left", "floor_right", "floor_center"], defaultScale: 1.1, defaultActionType: "link" },
  { id: "ast-painting", name: "Painting Frame", category: "decor", villageTheme: "any", placement: "wall", ownerType: "system", rarity: "common", tags: ["art", "gallery"], imageUrl: ph("painting"), status: "published", compatibleZones: ["back_wall", "left_wall", "right_wall"], defaultScale: 1, defaultActionType: "gallery" },
  { id: "ast-screen", name: "TV / Screen", category: "decor", villageTheme: "any", placement: "wall", ownerType: "system", rarity: "uncommon", tags: ["video", "screen"], imageUrl: ph("screen"), status: "published", compatibleZones: ["back_wall", "left_wall", "right_wall"], defaultScale: 1.1, defaultActionType: "video" },
  { id: "ast-desk", name: "Writing Desk", category: "furniture", villageTheme: "any", placement: "floor", ownerType: "system", rarity: "common", tags: ["work", "notes"], imageUrl: ph("desk"), status: "published", compatibleZones: ["floor_left", "floor_center", "floor_right"], defaultScale: 1, defaultActionType: "contact" },
  { id: "ast-sofa", name: "Cosy Sofa", category: "furniture", villageTheme: "any", placement: "floor", ownerType: "system", rarity: "common", tags: ["lounge", "cosy"], imageUrl: ph("sofa"), status: "published", compatibleZones: ["floor_center", "floor_left", "floor_right"], defaultScale: 1.2, defaultActionType: "none" },
  { id: "ast-rug", name: "Round Rug", category: "floor", villageTheme: "any", placement: "floor", ownerType: "system", rarity: "common", tags: ["textile", "warm"], imageUrl: ph("rug"), status: "published", compatibleZones: ["floor_center"], defaultScale: 1.3, defaultActionType: "none" },
  { id: "ast-plant", name: "Potted Plant", category: "plant", villageTheme: "any", placement: "floor", ownerType: "system", rarity: "common", tags: ["nature", "green"], imageUrl: ph("plant"), status: "published", compatibleZones: ["floor_left", "floor_right", "shelf"], defaultScale: 0.9, defaultActionType: "none" },
  { id: "ast-product-shelf", name: "Product Shelf", category: "furniture", villageTheme: "any", placement: "floor", ownerType: "system", rarity: "uncommon", tags: ["shop", "products"], imageUrl: ph("product-shelf"), status: "published", compatibleZones: ["floor_left", "floor_right", "shelf"], defaultScale: 1.1, defaultActionType: "product" },
  { id: "ast-guestbook-table", name: "Guestbook Table", category: "furniture", villageTheme: "any", placement: "floor", ownerType: "system", rarity: "uncommon", tags: ["guestbook", "welcome"], imageUrl: ph("guestbook-table"), status: "published", compatibleZones: ["floor_left", "floor_right"], defaultScale: 1, defaultActionType: "guestbook" },
  { id: "ast-photo-wall", name: "Photo Wall", category: "decor", villageTheme: "any", placement: "wall", ownerType: "system", rarity: "common", tags: ["photos", "memories"], imageUrl: ph("photo-wall"), status: "published", compatibleZones: ["back_wall", "left_wall", "right_wall"], defaultScale: 1.1, defaultActionType: "gallery" },
  { id: "ast-door", name: "Door", category: "door", villageTheme: "any", placement: "exterior", ownerType: "system", rarity: "common", tags: ["door", "navigation"], imageUrl: ph("door"), status: "published", compatibleZones: ["door", "floor_left", "floor_right"], defaultScale: 1, defaultActionType: "room_link" },
  { id: "ast-stairs", name: "Stairs", category: "stairs", villageTheme: "any", placement: "floor", ownerType: "system", rarity: "uncommon", tags: ["stairs", "navigation"], imageUrl: ph("stairs"), status: "published", compatibleZones: ["floor_left", "floor_right", "floor_center", "door"], defaultScale: 1.1, defaultActionType: "room_link" },

  // ── Room V3 interactive objects ──
  { id: "ast-avatar-portrait", name: "Avatar Portrait", category: "decor", villageTheme: "any", placement: "wall", ownerType: "system", rarity: "uncommon", tags: ["profile", "creator"], imageUrl: ph("avatar-portrait"), status: "published", compatibleZones: ["back_wall", "left_wall", "right_wall"], defaultScale: 1, defaultActionType: "profile" },
  { id: "ast-certificate", name: "Creator Certificate", category: "decor", villageTheme: "any", placement: "wall", ownerType: "system", rarity: "rare", tags: ["profile", "badge"], imageUrl: ph("certificate"), status: "published", compatibleZones: ["back_wall", "left_wall", "right_wall"], defaultScale: 0.95, defaultActionType: "profile" },
  { id: "ast-achievement-board", name: "Achievement Board", category: "decor", villageTheme: "any", placement: "wall", ownerType: "system", rarity: "uncommon", tags: ["profile", "stats"], imageUrl: ph("achievement-board"), status: "published", compatibleZones: ["back_wall", "left_wall", "right_wall"], defaultScale: 1.05, defaultActionType: "profile" },
  { id: "ast-projector", name: "Projector", category: "decor", villageTheme: "any", placement: "wall", ownerType: "system", rarity: "uncommon", tags: ["video", "film"], imageUrl: ph("projector"), status: "published", compatibleZones: ["back_wall", "left_wall", "right_wall"], defaultScale: 1.1, defaultActionType: "video" },
  { id: "ast-sign", name: "Sign", category: "decor", villageTheme: "any", placement: "wall", ownerType: "system", rarity: "common", tags: ["link", "wayfinding"], imageUrl: ph("sign"), status: "published", compatibleZones: ["back_wall", "left_wall", "right_wall"], defaultScale: 0.95, defaultActionType: "link" },
  { id: "ast-display-table", name: "Display Table", category: "furniture", villageTheme: "any", placement: "floor", ownerType: "system", rarity: "uncommon", tags: ["shop", "product"], imageUrl: ph("display-table"), status: "published", compatibleZones: ["floor_left", "floor_center", "floor_right"], defaultScale: 1.1, defaultActionType: "product" },
  { id: "ast-business-card", name: "Business Card", category: "decor", villageTheme: "any", placement: "wall", ownerType: "system", rarity: "common", tags: ["contact", "card"], imageUrl: ph("business-card"), status: "published", compatibleZones: ["shelf", "back_wall", "left_wall", "right_wall"], defaultScale: 0.85, defaultActionType: "contact" },
];

/** Assets that can be placed in a room (carry room-engine metadata). */
export function roomReadyAssets(): CatalogAsset[] {
  return catalogAssets.filter((asset) => asset.compatibleZones && asset.compatibleZones.length > 0);
}

export function getAsset(id: string): CatalogAsset | undefined {
  return catalogAssets.find((asset) => asset.id === id);
}
