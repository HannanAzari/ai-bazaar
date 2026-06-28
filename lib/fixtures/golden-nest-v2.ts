// ── Golden Nest V2 — fixture (premium transparent cut-outs) ─────────────────
//
// A separate V2 worked example using the real, alpha-validated cut-outs under
// public/nests/golden-nest-v1/cutouts-v2/ (see scripts/cutout-golden-nest-v2.py
// + metadata/reports/golden-nest-v2-cutout-validation.*). The V1 fixture
// (./golden-nest.ts) is left untouched for side-by-side comparison.
//
// The Scene Slot layout is re-authored from the actual silhouettes and the
// background-v2 architecture into believable zones (NOT the failed V1 wall-sticker
// placement):
//   media (centre, hero TV+console, grounded) · frame (secondary wall) ·
//   workspace (lower-right: desk + books accessory) · storage (right wall:
//   bookshelf) · ambience (left: lamp + plant) · avatar (foreground floor).
//
// Scale system — avatar height = 1.0 reference. Final ratios (documented in
// docs/golden-nest-renderer.md). Bounds are normalized 0..1 on the 3:4 scene; box
// width:height matches each cut-out's pixel aspect so `object-contain` fills the
// box with no letterbox, bottom-anchored for floor objects.

import type {
  ComposedNest,
  Interaction,
  NestAsset,
  NestTemplate,
  SceneSlot,
} from "@/lib/nest-types";
import { CURRENT_NEST_DNA_VERSION, NEST_CAMERA_CONTRACT_VERSION } from "@/lib/nest-types";
import { GOLDEN_NEST_INTERACTIONS } from "@/lib/fixtures/golden-nest";

const T = "2026-06-27T00:00:00.000Z";
const ART = "/nests/golden-nest-v1/cutouts-v2";

// ── Interactions: the V1 five + an avatar intro (preserves all interactions) ──
const AVATAR_INTRO: Interaction = {
  id: "avatar_intro",
  name: "Avatar — wave → intro",
  trigger: "tap",
  animation: "wave", // → "wiggle" effect in the renderer
  contentType: "intro",
  reducedMotionFallback: "none",
};

export const GOLDEN_NEST_V2_INTERACTIONS: Interaction[] = [...GOLDEN_NEST_INTERACTIONS, AVATAR_INTRO];
export const GOLDEN_NEST_V2_INTERACTIONS_BY_ID: Record<string, Interaction> =
  GOLDEN_NEST_V2_INTERACTIONS.reduce<Record<string, Interaction>>((acc, i) => {
    acc[i.id] = i;
    return acc;
  }, {});

// ── Assets (same ids/categories as V1; art points at the V2 cut-outs) ────────
function asset(
  p: Pick<NestAsset, "id" | "name" | "category" | "assetType" | "compatibleSlotTypes"> & {
    art: string;
  } & Partial<NestAsset>,
): NestAsset {
  const { art, ...rest } = p;
  return {
    tags: [],
    dnaVersion: CURRENT_NEST_DNA_VERSION,
    cameraContractVersion: NEST_CAMERA_CONTRACT_VERSION,
    imageUrl: `${ART}/${art}.png`,
    thumbnailUrl: `${ART}/${art}.png`,
    transparentPngUrl: `${ART}/${art}.png`,
    variants: [],
    states: [{ name: "idle" }],
    approvalStatus: "approved",
    source: "curated",
    createdAt: T,
    updatedAt: T,
    ...rest,
  };
}

export const GOLDEN_NEST_V2_ASSETS: NestAsset[] = [
  asset({ id: "ast-tv", art: "tv-v2", name: "Media Unit", category: "electronics", assetType: "hero", compatibleSlotTypes: ["media"], tags: ["screen", "media", "video"], defaultInteractionId: "tv_glow_open_youtube", states: [{ name: "idle" }, { name: "open" }] }),
  asset({ id: "ast-framed-photo", art: "frame-v2", name: "Framed Photo", category: "decor", assetType: "hero", compatibleSlotTypes: ["frame"], tags: ["frame", "gallery"], defaultInteractionId: "frame_zoom_gallery", states: [{ name: "idle" }, { name: "open" }] }),
  asset({ id: "ast-bookshelf", art: "bookshelf-v2", name: "Bookshelf", category: "furniture", assetType: "hero", compatibleSlotTypes: ["shelf"], tags: ["shelf", "books"], defaultInteractionId: "book_open_article", states: [{ name: "idle" }, { name: "open" }] }),
  asset({ id: "ast-stacked-books", art: "books-v2", name: "Stacked Books", category: "decor", assetType: "filler", compatibleSlotTypes: ["books"], tags: ["books"], defaultInteractionId: "book_open_article" }),
  asset({ id: "ast-desk", art: "desk-v2", name: "Writing Desk", category: "furniture", assetType: "standard", compatibleSlotTypes: ["desk"], tags: ["desk", "work"] }),
  asset({ id: "ast-potted-plant", art: "plant-v2", name: "Potted Plant", category: "plant", assetType: "filler", compatibleSlotTypes: ["plant"], tags: ["plant"], defaultInteractionId: "plant_wiggle" }),
  asset({ id: "ast-floor-lamp", art: "lamp-v2", name: "Floor Lamp", category: "lighting", assetType: "standard", compatibleSlotTypes: ["lamp"], tags: ["lamp", "light"], defaultInteractionId: "lamp_toggle_ambience", states: [{ name: "idle" }, { name: "active" }] }),
  asset({ id: "ast-avatar", art: "avatar-v2", name: "Creator Avatar", category: "avatar", assetType: "avatar", compatibleSlotTypes: ["avatar"], tags: ["avatar"], source: "runtime_avatar", defaultInteractionId: "avatar_intro" }),
];

export const GOLDEN_NEST_V2_ASSETS_BY_ID: Record<string, NestAsset> =
  GOLDEN_NEST_V2_ASSETS.reduce<Record<string, NestAsset>>((acc, a) => {
    acc[a.id] = a;
    return acc;
  }, {});

// ── Scene Slots — re-authored zoned layout ───────────────────────────────────
// Each slot: bounds (box matching the cut-out aspect), anchorPoint (bottom-centre
// for floor, centre for wall), plane, zIndex, scaleRef (avatar=1.0), contactShadow,
// defaultInteractionId. Bounds were tuned visually against background-v2.
const SLOTS: SceneSlot[] = [
  {
    id: "slot-frame",
    name: "Wall frame (secondary)",
    slotType: "frame",
    acceptedAssetCategories: ["decor"],
    bounds: { x: 0.205, y: 0.2, width: 0.165, height: 0.12 },
    anchorPoint: { x: 0.2875, y: 0.26 },
    zIndex: 1,
    plane: "front_wall",
    importance: "primary",
    defaultInteractionId: "frame_zoom_gallery",
    scaleRef: 0.28,
    contactShadow: false,
  },
  {
    id: "slot-media",
    name: "Media wall (hero)",
    slotType: "media",
    acceptedAssetCategories: ["electronics"],
    bounds: { x: 0.27, y: 0.48, width: 0.46, height: 0.222 },
    anchorPoint: { x: 0.5, y: 0.702 },
    zIndex: 2,
    plane: "floor",
    importance: "primary",
    defaultInteractionId: "tv_glow_open_youtube",
    scaleRef: 0.78,
    contactShadow: true,
  },
  {
    id: "slot-lamp",
    name: "Ambience lamp (left)",
    slotType: "lamp",
    acceptedAssetCategories: ["lighting"],
    bounds: { x: 0.01, y: 0.3, width: 0.16, height: 0.418 },
    anchorPoint: { x: 0.09, y: 0.718 },
    zIndex: 3,
    plane: "floor",
    importance: "optional",
    defaultInteractionId: "lamp_toggle_ambience",
    scaleRef: 0.95,
    contactShadow: true,
  },
  {
    id: "slot-bookshelf",
    name: "Storage shelf (right wall)",
    slotType: "shelf",
    acceptedAssetCategories: ["furniture"],
    bounds: { x: 0.78, y: 0.285, width: 0.2, height: 0.418 },
    anchorPoint: { x: 0.88, y: 0.703 },
    zIndex: 3,
    plane: "floor",
    importance: "optional",
    defaultInteractionId: "book_open_article",
    scaleRef: 0.95,
    contactShadow: true,
  },
  {
    id: "slot-desk",
    name: "Workspace desk (lower-right)",
    slotType: "desk",
    acceptedAssetCategories: ["furniture", "creator_tool"],
    bounds: { x: 0.55, y: 0.748, width: 0.305, height: 0.202 },
    anchorPoint: { x: 0.7025, y: 0.95 },
    zIndex: 4,
    plane: "floor",
    importance: "primary",
    scaleRef: 0.46,
    contactShadow: true,
  },
  {
    id: "slot-plant",
    name: "Plant (centre-front, balance)",
    slotType: "plant",
    acceptedAssetCategories: ["plant"],
    bounds: { x: 0.3395, y: 0.775, width: 0.201, height: 0.21 },
    anchorPoint: { x: 0.44, y: 0.985 },
    zIndex: 4,
    plane: "floor",
    importance: "optional",
    defaultInteractionId: "plant_wiggle",
    scaleRef: 0.48,
    contactShadow: true,
  },
  {
    id: "slot-books",
    name: "Books accessory (on desk)",
    slotType: "books",
    acceptedAssetCategories: ["decor"],
    bounds: { x: 0.648, y: 0.788, width: 0.085, height: 0.0365 },
    anchorPoint: { x: 0.6905, y: 0.8245 },
    zIndex: 5,
    plane: "foreground",
    importance: "optional",
    defaultInteractionId: "book_open_article",
    scaleRef: 0.14,
    contactShadow: false,
  },
  {
    id: "slot-avatar",
    name: "Avatar (foreground)",
    slotType: "avatar",
    acceptedAssetCategories: ["avatar"],
    bounds: { x: 0.03, y: 0.525, width: 0.241, height: 0.44 },
    anchorPoint: { x: 0.1505, y: 0.965 },
    zIndex: 6,
    plane: "floor",
    importance: "primary",
    defaultInteractionId: "avatar_intro",
    scaleRef: 1.0,
    contactShadow: true,
  },
];

export const GOLDEN_NEST_V2_TEMPLATE: NestTemplate = {
  id: "golden-nest-v2",
  name: "Golden Nest V2 — Warm Studio",
  description:
    "Front-facing cinematic Nest composed from premium transparent cut-outs, zoned " +
    "into media / workspace / storage / ambience / avatar against the real warm-room background.",
  cameraContractVersion: NEST_CAMERA_CONTRACT_VERSION,
  dnaVersion: CURRENT_NEST_DNA_VERSION,
  backgroundImageUrl: "/nests/golden-nest-v1/background-v2.png",
  aspectRatio: "3:4",
  sceneBox: {
    frontWall: { x: 0.16, y: 0.04, width: 0.84, height: 0.58 },
    leftSliver: { x: 0.0, y: 0.04, width: 0.16, height: 0.58 },
    rightSliver: { x: 0.82, y: 0.04, width: 0.18, height: 0.58 },
    floor: { x: 0.0, y: 0.62, width: 1.0, height: 0.38 },
    floorSeamY: 0.62,
    cameraTiltDeg: 7,
  },
  slots: SLOTS,
  ambiencePresets: [
    { id: "warm_day", name: "Warm day", tint: "#fff6e0", glow: "#ffe9b8", intensity: 0.22 },
    { id: "golden_evening", name: "Golden evening", tint: "#f6d8a8", glow: "#ffc55c", intensity: 0.38 },
    { id: "cozy_night", name: "Cozy night", tint: "#46365a", glow: "#ffc55c", intensity: 0.48 },
  ],
  defaultSlotAssignments: [
    { slotId: "slot-frame", assetId: "ast-framed-photo" },
    { slotId: "slot-media", assetId: "ast-tv" },
    { slotId: "slot-lamp", assetId: "ast-floor-lamp" },
    { slotId: "slot-bookshelf", assetId: "ast-bookshelf" },
    { slotId: "slot-desk", assetId: "ast-desk" },
    { slotId: "slot-plant", assetId: "ast-potted-plant" },
    { slotId: "slot-books", assetId: "ast-stacked-books" },
    { slotId: "slot-avatar", assetId: "ast-avatar" },
  ],
  approvalStatus: "approved",
  createdAt: T,
  updatedAt: T,
};

export const GOLDEN_NEST_V2_COMPOSED: ComposedNest = {
  id: "composed-golden-nest-v2",
  ownerId: "demo-owner-1",
  houseId: "demo-house-1",
  templateId: "golden-nest-v2",
  slotAssignments: [
    { slotId: "slot-frame", assetId: "ast-framed-photo", content: { contentType: "gallery", title: "Recent work" } },
    { slotId: "slot-media", assetId: "ast-tv", content: { contentType: "video", url: "https://youtube.com/@creator", title: "My channel" } },
    { slotId: "slot-lamp", assetId: "ast-floor-lamp" },
    // Bookshelf intentionally omitted from the presentation Nest — the background's
    // baked right-wall niche reads as the architectural storage. The bookshelf asset
    // + slot remain in the library/template for future use (7 objects > 8 crowded).
    { slotId: "slot-desk", assetId: "ast-desk" },
    { slotId: "slot-plant", assetId: "ast-potted-plant" },
    { slotId: "slot-books", assetId: "ast-stacked-books", content: { contentType: "article", url: "https://creator.blog/reading", title: "Reading list" } },
    { slotId: "slot-avatar", assetId: "ast-avatar", content: { contentType: "intro", title: "Hi, I'm the creator" } },
  ],
  avatarAssetId: "ast-avatar",
  personalAssetIds: [],
  ambiencePresetId: "warm_day",
  accessLevel: "public",
  quickLinks: [
    { id: "ql-yt", label: "YouTube", url: "https://youtube.com/@creator" },
    { id: "ql-blog", label: "Blog", url: "https://creator.blog" },
    { id: "ql-shop", label: "Shop", url: "https://creator.shop" },
  ],
  createdAt: T,
  updatedAt: T,
};
