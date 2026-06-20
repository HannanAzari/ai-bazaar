// ── Nestudio-compatible string unions ───────────────────────────────────────
// These mirror the main app's unions (lib/types.ts) EXACTLY so exported records
// drop straight into the Nestudio catalog. They are re-declared (not imported)
// to keep the factory a decoupled, separately-deployable app.

export type NestudioAssetCategory =
  | "furniture"
  | "wall"
  | "floor"
  | "plant"
  | "lighting"
  | "decor"
  | "structure"
  | "door"
  | "stairs";

export type AssetPlacement = "floor" | "wall" | "ceiling" | "exterior" | "any";

export type RoomZoneType =
  | "back_wall"
  | "left_wall"
  | "right_wall"
  | "floor_left"
  | "floor_center"
  | "floor_right"
  | "shelf"
  | "window"
  | "door";

export type RoomActionType =
  | "link"
  | "video"
  | "product"
  | "booking"
  | "contact"
  | "gallery"
  | "profile"
  | "room_link"
  | "guestbook"
  | "collection"
  | "none";

/** Shape of a record in the Nestudio catalog (lib/assets.ts `CatalogAsset`). */
export type NestudioCatalogAsset = {
  id: string;
  name: string;
  category: NestudioAssetCategory;
  villageTheme: string;
  placement: AssetPlacement;
  ownerType: "system" | "creator";
  rarity: "common" | "uncommon" | "rare" | "legendary";
  tags: string[];
  imageUrl: string;
  status: "draft" | "published" | "retired";
  compatibleZones?: RoomZoneType[];
  defaultScale?: number;
  defaultActionType?: RoomActionType;
};

// ── Factory taxonomy ─────────────────────────────────────────────────────────

/** Coarse grouping used by the dashboard filters and the asset bible. */
export type CategoryGroup = "interior" | "exterior" | "avatar" | "business";

/** The granular, generation-facing category of an asset candidate. */
export type FactoryCategory =
  // Interior
  | "chair"
  | "table"
  | "desk"
  | "shelf"
  | "sofa"
  | "rug"
  | "plant"
  | "lamp"
  | "book"
  | "computer"
  | "microphone"
  | "camera"
  | "guitar"
  | "product_display"
  | "wall_art"
  | "tv_screen"
  // Exterior
  | "door"
  | "window"
  | "tree"
  | "flower"
  | "fence"
  | "sign"
  | "lantern"
  | "mailbox"
  | "bench"
  | "market_stall"
  // Avatar / support
  | "avatar_body"
  | "hairstyle"
  | "clothing"
  | "accessory"
  | "pet"
  | "instrument"
  | "tool"
  // Business
  | "cafe_counter"
  | "restaurant_table"
  | "gym_equipment"
  | "medical_desk"
  | "workshop_tool"
  | "podcast_setup"
  | "shop_shelf";

/** The lifecycle status of a candidate, from generation through review. */
export type AssetStatus =
  | "queued"
  | "generated"
  | "needs_review"
  | "approved"
  | "rejected"
  | "needs_edit";

/**
 * An asset candidate moving through the factory. Generation fields (prompt, seed,
 * model*) are inert in V1 — assets are imported/uploaded, not generated. Review
 * fields (status, reviewer, reviewedAt, qualityNotes) drive the dashboard. The
 * Nestudio-export fields (placementType, compatibleZones, defaultScale,
 * defaultActionType) make an approved candidate map straight to a `CatalogAsset`.
 */
export type AssetCandidate = {
  id: string;
  name: string;
  slug: string;
  category: FactoryCategory;
  pack: string;
  status: AssetStatus;
  imageUrl: string;
  localPath?: string;
  prompt: string;
  negativePrompt: string;
  modelProvider: string;
  modelName: string;
  seed: number;
  width: number;
  height: number;
  transparent: boolean;
  tags: string[];
  compatibleZones: RoomZoneType[];
  placementType: AssetPlacement;
  defaultScale: number;
  defaultActionType: RoomActionType;
  styleScore: number;
  qualityNotes: string;
  reviewer: string;
  reviewedAt: string;
  /** Lifestyle personality (V3.7.2), set when saved from a Style Lab collection sample. */
  personality?: string;
  /** Where the candidate came from, e.g. "style_lab" (V3.7.2). */
  source?: string;
  /** The originating Style Lab sample id (V3.7.2) — used to prevent duplicate saves. */
  sourceSampleId?: string;
  createdAt: string;
};

/** Static metadata per factory category: grouping + Nestudio mapping + defaults. */
export type CategoryMeta = {
  group: CategoryGroup;
  label: string;
  nestudioCategory: NestudioAssetCategory;
  placement: AssetPlacement;
  compatibleZones: RoomZoneType[];
  defaultActionType: RoomActionType;
  defaultScale: number;
};

const wallZones: RoomZoneType[] = ["back_wall", "left_wall", "right_wall"];
const floorZones: RoomZoneType[] = ["floor_left", "floor_center", "floor_right"];
// Decor lives on the shelf or any wall (the zones whose allowed categories include `decor`).
const shelfWall: RoomZoneType[] = ["shelf", "back_wall", "left_wall", "right_wall"];

// IMPORTANT: every category's `nestudioCategory` must be accepted by its
// `compatibleZones` under the nine-zone template (lib/zones.ts), or the asset can
// never be placed. Nestudio's zones accept: walls→decor/wall · shelf→decor/plant ·
// window→decor · floor→furniture/plant/structure/floor/stairs/door · door→
// structure/door/stairs. There is NO zone for `lighting`, and floor zones do NOT
// accept `decor` — so floor-standing items map to furniture/structure, and small
// props map to decor on shelves/walls. (V2.5 validation enforces this.)

/** The single source of truth mapping a factory category to its Nestudio shape. */
export const CATEGORY_META: Record<FactoryCategory, CategoryMeta> = {
  // ── Interior ──
  chair: { group: "interior", label: "Chair", nestudioCategory: "furniture", placement: "floor", compatibleZones: floorZones, defaultActionType: "none", defaultScale: 1 },
  table: { group: "interior", label: "Table", nestudioCategory: "furniture", placement: "floor", compatibleZones: floorZones, defaultActionType: "none", defaultScale: 1 },
  desk: { group: "interior", label: "Desk", nestudioCategory: "furniture", placement: "floor", compatibleZones: floorZones, defaultActionType: "contact", defaultScale: 1 },
  shelf: { group: "interior", label: "Shelf", nestudioCategory: "furniture", placement: "floor", compatibleZones: floorZones, defaultActionType: "link", defaultScale: 1.1 },
  sofa: { group: "interior", label: "Sofa", nestudioCategory: "furniture", placement: "floor", compatibleZones: floorZones, defaultActionType: "none", defaultScale: 1.2 },
  rug: { group: "interior", label: "Rug", nestudioCategory: "floor", placement: "floor", compatibleZones: ["floor_center"], defaultActionType: "none", defaultScale: 1.3 },
  plant: { group: "interior", label: "Plant", nestudioCategory: "plant", placement: "floor", compatibleZones: ["floor_left", "floor_right", "shelf"], defaultActionType: "none", defaultScale: 0.9 },
  lamp: { group: "interior", label: "Lamp", nestudioCategory: "furniture", placement: "floor", compatibleZones: ["floor_left", "floor_right"], defaultActionType: "none", defaultScale: 0.95 },
  book: { group: "interior", label: "Book", nestudioCategory: "decor", placement: "wall", compatibleZones: shelfWall, defaultActionType: "link", defaultScale: 0.7 },
  computer: { group: "interior", label: "Computer", nestudioCategory: "furniture", placement: "floor", compatibleZones: floorZones, defaultActionType: "link", defaultScale: 0.9 },
  microphone: { group: "interior", label: "Microphone", nestudioCategory: "furniture", placement: "floor", compatibleZones: floorZones, defaultActionType: "video", defaultScale: 0.8 },
  camera: { group: "interior", label: "Camera", nestudioCategory: "decor", placement: "wall", compatibleZones: shelfWall, defaultActionType: "gallery", defaultScale: 0.8 },
  guitar: { group: "interior", label: "Guitar", nestudioCategory: "furniture", placement: "floor", compatibleZones: ["floor_left", "floor_right"], defaultActionType: "none", defaultScale: 1 },
  product_display: { group: "interior", label: "Product Display", nestudioCategory: "furniture", placement: "floor", compatibleZones: floorZones, defaultActionType: "product", defaultScale: 1.1 },
  wall_art: { group: "interior", label: "Wall Art", nestudioCategory: "decor", placement: "wall", compatibleZones: wallZones, defaultActionType: "gallery", defaultScale: 1 },
  tv_screen: { group: "interior", label: "TV / Screen", nestudioCategory: "decor", placement: "wall", compatibleZones: wallZones, defaultActionType: "video", defaultScale: 1.1 },

  // ── Exterior ──
  door: { group: "exterior", label: "Door", nestudioCategory: "door", placement: "exterior", compatibleZones: ["door", "floor_left", "floor_right"], defaultActionType: "room_link", defaultScale: 1 },
  window: { group: "exterior", label: "Window", nestudioCategory: "decor", placement: "wall", compatibleZones: ["window", ...wallZones], defaultActionType: "none", defaultScale: 1 },
  tree: { group: "exterior", label: "Tree", nestudioCategory: "plant", placement: "exterior", compatibleZones: ["floor_left", "floor_right"], defaultActionType: "none", defaultScale: 1.4 },
  flower: { group: "exterior", label: "Flower", nestudioCategory: "plant", placement: "exterior", compatibleZones: ["floor_left", "floor_right", "shelf"], defaultActionType: "none", defaultScale: 0.7 },
  fence: { group: "exterior", label: "Fence", nestudioCategory: "structure", placement: "exterior", compatibleZones: floorZones, defaultActionType: "none", defaultScale: 1.1 },
  sign: { group: "exterior", label: "Sign", nestudioCategory: "decor", placement: "wall", compatibleZones: wallZones, defaultActionType: "link", defaultScale: 0.95 },
  lantern: { group: "exterior", label: "Lantern", nestudioCategory: "decor", placement: "wall", compatibleZones: shelfWall, defaultActionType: "none", defaultScale: 0.8 },
  mailbox: { group: "exterior", label: "Mailbox", nestudioCategory: "structure", placement: "exterior", compatibleZones: ["floor_left", "floor_right"], defaultActionType: "contact", defaultScale: 0.85 },
  bench: { group: "exterior", label: "Bench", nestudioCategory: "furniture", placement: "exterior", compatibleZones: floorZones, defaultActionType: "none", defaultScale: 1.1 },
  market_stall: { group: "exterior", label: "Market Stall", nestudioCategory: "structure", placement: "exterior", compatibleZones: floorZones, defaultActionType: "product", defaultScale: 1.2 },

  // ── Avatar / support ──
  avatar_body: { group: "avatar", label: "Avatar Body", nestudioCategory: "structure", placement: "floor", compatibleZones: floorZones, defaultActionType: "profile", defaultScale: 1 },
  hairstyle: { group: "avatar", label: "Hairstyle", nestudioCategory: "decor", placement: "any", compatibleZones: shelfWall, defaultActionType: "none", defaultScale: 0.6 },
  clothing: { group: "avatar", label: "Clothing", nestudioCategory: "decor", placement: "any", compatibleZones: shelfWall, defaultActionType: "none", defaultScale: 0.8 },
  accessory: { group: "avatar", label: "Accessory", nestudioCategory: "decor", placement: "any", compatibleZones: shelfWall, defaultActionType: "none", defaultScale: 0.5 },
  pet: { group: "avatar", label: "Pet", nestudioCategory: "structure", placement: "floor", compatibleZones: ["floor_left", "floor_right"], defaultActionType: "none", defaultScale: 0.7 },
  instrument: { group: "avatar", label: "Instrument", nestudioCategory: "furniture", placement: "floor", compatibleZones: ["floor_left", "floor_right"], defaultActionType: "none", defaultScale: 0.9 },
  tool: { group: "avatar", label: "Tool", nestudioCategory: "decor", placement: "any", compatibleZones: shelfWall, defaultActionType: "none", defaultScale: 0.6 },

  // ── Business ──
  cafe_counter: { group: "business", label: "Cafe Counter", nestudioCategory: "furniture", placement: "floor", compatibleZones: floorZones, defaultActionType: "product", defaultScale: 1.2 },
  restaurant_table: { group: "business", label: "Restaurant Table", nestudioCategory: "furniture", placement: "floor", compatibleZones: floorZones, defaultActionType: "booking", defaultScale: 1.1 },
  gym_equipment: { group: "business", label: "Gym Equipment", nestudioCategory: "furniture", placement: "floor", compatibleZones: ["floor_left", "floor_right"], defaultActionType: "booking", defaultScale: 1.1 },
  medical_desk: { group: "business", label: "Medical Desk", nestudioCategory: "furniture", placement: "floor", compatibleZones: floorZones, defaultActionType: "booking", defaultScale: 1 },
  workshop_tool: { group: "business", label: "Workshop Tool", nestudioCategory: "decor", placement: "wall", compatibleZones: shelfWall, defaultActionType: "none", defaultScale: 0.8 },
  podcast_setup: { group: "business", label: "Podcast Setup", nestudioCategory: "furniture", placement: "floor", compatibleZones: floorZones, defaultActionType: "video", defaultScale: 1.1 },
  shop_shelf: { group: "business", label: "Shop Shelf", nestudioCategory: "furniture", placement: "floor", compatibleZones: floorZones, defaultActionType: "product", defaultScale: 1.1 },
};

// ── Generation jobs (V3) ─────────────────────────────────────────────────────

export type GenerationJobStatus =
  | "draft"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export const ALL_JOB_STATUSES: GenerationJobStatus[] = [
  "draft", "queued", "running", "completed", "failed", "cancelled",
];

/** A batch image-generation job (V3). Dry-run jobs build prompts + placeholder
 * candidates with NO provider call; real jobs call Replicate server-side. Every
 * produced candidate enters `needs_review` — never auto-approved. */
export type GenerationJob = {
  id: string;
  status: GenerationJobStatus;
  category: FactoryCategory;
  pack: string;
  count: number;
  /** The asset idea / subject the operator typed (drives the prompt). */
  subject: string;
  /** The chosen style family (V3.2), e.g. "royal_match". */
  styleId: string;
  prompt: string;
  negativePrompt: string;
  modelProvider: string;
  modelName: string;
  requestedBy: string;
  estimatedCost: number;
  actualCost?: number;
  /** True when no provider was called (prompts + placeholder candidates only). */
  dryRun: boolean;
  generatedCandidateIds: string[];
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
};

// ── Style Lab (V3.1) ─────────────────────────────────────────────────────────

export type StyleDecision = "pending" | "approved" | "rejected";

/** Five-dimension calibration score for one sample (V3.4), each 0–10. */
export type SampleScores = {
  consistency: number;
  readability: number;
  silhouette: number;
  styleFit: number;
  productionReadiness: number;
};

/** One generated style-calibration variation. Style Lab samples are SEPARATE from
 * catalog candidates — they exist only to calibrate the golden visual identity and
 * are never exported. */
export type StyleSample = {
  id: string;
  itemKey: string;
  category: FactoryCategory;
  subject: string;
  styleId: string;
  /** Provider that produced this variation (V3.3), e.g. "replicate" | "openai". */
  provider: string;
  /** Provider model id (V3.3), e.g. "gpt-image-1". */
  model: string;
  variation: number;
  prompt: string;
  imageUrl: string;
  seed: number;
  decision: StyleDecision;
  /** Marked as the closest variation to the Nestudio identity (one per item+style). */
  closest: boolean;
  /** Five-dimension calibration scores (V3.4), set during a Calibration Session. */
  scores?: SampleScores;
  /** Free-form reviewer note for this sample (V3.4). */
  note?: string;
  /** Whether this sample is a real provider render or a zero-cost dry-run placeholder
   *  (V3.7 persistence). Absent on legacy samples → derived from the imageUrl. */
  kind?: "real" | "dry_run";
  /** The lifestyle personality (V3.7), e.g. "Minimalist" — set on collection samples. */
  personality?: string;
  createdAt: string;
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_META) as FactoryCategory[];

export function categoriesInGroup(group: CategoryGroup): FactoryCategory[] {
  return ALL_CATEGORIES.filter((c) => CATEGORY_META[c].group === group);
}

export const ALL_STATUSES: AssetStatus[] = [
  "queued",
  "generated",
  "needs_review",
  "approved",
  "rejected",
  "needs_edit",
];

// ── Review activity log (V2) ─────────────────────────────────────────────────

/** What kind of review event a log entry records. */
export type ReviewActionType =
  | "approved"
  | "rejected"
  | "needs_edit"
  | "needs_review"
  | "imported"
  | "metadata_edited";

/** One entry in the shared review activity log. */
export type ReviewAction = {
  id: string;
  candidateId: string;
  candidateName: string;
  action: ReviewActionType;
  reviewer: string;
  note?: string;
  createdAt: string;
};

// ── Asset packs (V2.5) ───────────────────────────────────────────────────────

/** A pack's lifecycle: draft → validating → ready (for export). */
export type AssetPackStatus = "draft" | "validating" | "ready";

export const ALL_PACK_STATUSES: AssetPackStatus[] = ["draft", "validating", "ready"];

/** A first-class, curated bundle of asset candidates used to validate the
 * catalog pipeline (review → export → designer). */
export type AssetPack = {
  id: string;
  slug: string;
  name: string;
  description: string;
  /** Free-form theme label, e.g. "cozy", "cafe", "workspace". */
  theme: string;
  status: AssetPackStatus;
  /** Candidate ids in this pack. */
  assetIds: string[];
  createdAt: string;
};

