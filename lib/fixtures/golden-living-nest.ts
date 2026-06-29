// ── Golden Living Nest — fixture (M5 visual lock candidate) ──────────────────
//
// A warm, premium **living room** for a creator's digital identity — the explicit
// product framing of the Golden Nest. It is a SEPARATE fixture from the prior V2
// (`./golden-nest-v2.ts`, untouched) and removes all office furniture from the
// active composition: **no desk, no desk chair, no loose desk books, no
// centre-floor plant**. Those assets stay in the library (for a future Home Office
// Nest) but are never composed here.
//
// Active living-room objects (8): media (TV+console) · frame · sofa · coffee table ·
// floor lamp · side plant · avatar · rug. Sofa / coffee table / rug are TEMPORARY
// SVG PLACEHOLDERS (no approved cut-out exists yet) — flagged `placeholder: true`
// and reported in docs/golden-living-nest-v1.md. TV / frame / lamp / plant / avatar
// reuse the approved alpha cut-outs under cutouts-v2/.
//
// Scale is calibrated against `lib/nest-scale.ts` (avatar = 1.00) and the baked
// architecture; bounds were authored from the scale formula and tuned visually.
// Additive: edits no existing fixture, type, or art.

import type { ComposedNest, Interaction, NestAsset } from "@/lib/nest-types";
import { CURRENT_NEST_DNA_VERSION, NEST_CAMERA_CONTRACT_VERSION } from "@/lib/nest-types";
import type { LivingNestAsset, LivingNestSlot, LivingNestTemplate } from "@/lib/nest-visual-types";
import { GOLDEN_NEST_V2_ASSETS } from "@/lib/fixtures/golden-nest-v2";

const T = "2026-06-29T00:00:00.000Z";
const ART = "/nests/golden-nest-v1/cutouts-v2"; // approved alpha cut-outs
const PH = "/nests/golden-living-nest-v1/placeholders"; // temporary stand-in art

// ── Interactions — premium living-room behaviours ────────────────────────────
export const GOLDEN_LIVING_NEST_INTERACTIONS: Interaction[] = [
  {
    id: "tv_screen_video",
    name: "TV — screen wakes → video",
    trigger: "tap",
    animation: "screen_on", // only the clipped screen lights, never the whole console
    contentType: "video",
    reducedMotionFallback: "none",
    notes: "Screen region lights + thumbnail; localized light spill. Console never glows.",
  },
  {
    id: "frame_focus_gallery",
    name: "Frame — focus → gallery",
    trigger: "tap",
    animation: "zoom",
    contentType: "gallery",
    reducedMotionFallback: "none",
  },
  {
    id: "lamp_glow_ambience",
    name: "Lamp — warm glow → ambience",
    trigger: "tap",
    animation: "light",
    contentType: "ambience",
    reducedMotionFallback: "none",
    notes: "Localized lamp glow + smooth room-ambience transition (no full-scene flash).",
  },
  {
    id: "plant_leaf_sway",
    name: "Plant — leaves sway (ambient)",
    trigger: "tap",
    animation: "leaf_sway", // only the leaf mass sways; the pot stays planted
    contentType: "none",
    reducedMotionFallback: "none",
  },
  {
    id: "avatar_greet",
    name: "Avatar — breathing idle → greeting",
    trigger: "tap",
    animation: "wave", // subtle breathing idle; small greeting on tap
    contentType: "intro",
    reducedMotionFallback: "none",
  },
];

export const GOLDEN_LIVING_NEST_INTERACTIONS_BY_ID: Record<string, Interaction> =
  GOLDEN_LIVING_NEST_INTERACTIONS.reduce<Record<string, Interaction>>((acc, i) => {
    acc[i.id] = i;
    return acc;
  }, {});

// ── Assets ───────────────────────────────────────────────────────────────────
function asset(
  p: Pick<LivingNestAsset, "id" | "name" | "category" | "assetType" | "compatibleSlotTypes"> & {
    img: string;
  } & Partial<LivingNestAsset>,
): LivingNestAsset {
  const { img, ...rest } = p;
  return {
    tags: [],
    dnaVersion: CURRENT_NEST_DNA_VERSION,
    cameraContractVersion: NEST_CAMERA_CONTRACT_VERSION,
    imageUrl: img,
    thumbnailUrl: img,
    transparentPngUrl: img,
    variants: [],
    states: [{ name: "idle" }],
    approvalStatus: "approved",
    source: "curated",
    createdAt: T,
    updatedAt: T,
    ...rest,
  };
}

// Active living-room assets.
const TV = asset({
  id: "ast-tv",
  name: "Media Unit",
  category: "electronics",
  assetType: "hero",
  compatibleSlotTypes: ["media"],
  img: `${ART}/tv-v2.png`,
  tags: ["screen", "media", "video"],
  defaultInteractionId: "tv_screen_video",
  states: [{ name: "idle" }, { name: "active" }],
  statePack: {
    // The screen region inside the asset box (normalized 0..1) — only this lights up.
    screenRect: { x: 0.165, y: 0.075, width: 0.67, height: 0.45 },
    active: { id: "active", format: "css" },
    idle: { id: "idle", format: "css" },
  },
});

const FRAME = asset({
  id: "ast-framed-photo",
  name: "Framed Gallery",
  category: "decor",
  assetType: "hero",
  compatibleSlotTypes: ["frame"],
  img: `${ART}/frame-v2.png`,
  tags: ["frame", "gallery"],
  defaultInteractionId: "frame_focus_gallery",
  states: [{ name: "idle" }, { name: "active" }],
});

const SOFA = asset({
  id: "ast-sofa",
  name: "Cozy Sofa",
  category: "furniture",
  assetType: "hero",
  compatibleSlotTypes: ["sofa"],
  img: `${PH}/sofa.svg`,
  tags: ["sofa", "seating", "living"],
  placeholder: true,
  artNote: "Needs approved front-facing transparent sofa cut-out (3/4, seat-forward).",
});

const COFFEE_TABLE = asset({
  id: "ast-coffee-table",
  name: "Coffee Table",
  category: "furniture",
  assetType: "standard",
  compatibleSlotTypes: ["table"],
  img: `${PH}/coffee-table.svg`,
  tags: ["table", "living"],
  placeholder: true,
  artNote: "Needs approved oak coffee-table cut-out with a small accent tray.",
});

const RUG = asset({
  id: "ast-rug",
  name: "Floor Rug",
  category: "decor",
  assetType: "filler",
  compatibleSlotTypes: ["rug"],
  img: `${PH}/rug.svg`,
  tags: ["rug", "floor"],
  placeholder: true,
  artNote: "Needs approved foreshortened rug footprint (warm, one accent border).",
});

const LAMP = asset({
  id: "ast-floor-lamp",
  name: "Floor Lamp",
  category: "lighting",
  assetType: "standard",
  compatibleSlotTypes: ["lamp"],
  img: `${ART}/lamp-v2.png`,
  tags: ["lamp", "light", "ambience"],
  defaultInteractionId: "lamp_glow_ambience",
  states: [{ name: "idle" }, { name: "active" }],
  statePack: { active: { id: "active", format: "css" } },
});

const PLANT = asset({
  id: "ast-side-plant",
  name: "Potted Plant",
  category: "plant",
  assetType: "filler",
  compatibleSlotTypes: ["plant"],
  img: `${ART}/plant-v2.png`,
  tags: ["plant", "greenery"],
  defaultInteractionId: "plant_leaf_sway",
  statePack: {
    // Below this y (within the box) = static pot; above = swaying leaf mass.
    // Documented temporary approximation — no separate leaf-layer art exists yet.
    leafSplitY: 0.58,
    active: { id: "active", format: "css" },
  },
  artNote: "Premium leaf-only sway wants a separate leaf layer; using a clipped-band approximation.",
});

const AVATAR = asset({
  id: "ast-avatar",
  name: "Creator Avatar",
  category: "avatar",
  assetType: "avatar",
  compatibleSlotTypes: ["avatar"],
  img: `${ART}/avatar-v2.png`,
  tags: ["avatar", "creator"],
  source: "runtime_avatar",
  defaultInteractionId: "avatar_greet",
  statePack: {
    idle: { id: "idle", format: "css" }, // subtle breathing
    active: { id: "active", format: "css" }, // greeting on tap
  },
  artNote: "Premium wave/blink wants separate arm + eye layers; using a breathing + greeting-lean approximation.",
});

// Parked library assets (office furniture) — kept for a future Home Office Nest,
// never composed into the Living Nest.
const PARKED: LivingNestAsset[] = GOLDEN_NEST_V2_ASSETS.filter((a: NestAsset) =>
  ["ast-desk", "ast-bookshelf", "ast-stacked-books"].includes(a.id),
);

export const GOLDEN_LIVING_NEST_ASSETS: LivingNestAsset[] = [
  RUG,
  FRAME,
  TV,
  LAMP,
  PLANT,
  SOFA,
  COFFEE_TABLE,
  AVATAR,
  ...PARKED,
];

export const GOLDEN_LIVING_NEST_ASSETS_BY_ID: Record<string, LivingNestAsset> =
  GOLDEN_LIVING_NEST_ASSETS.reduce<Record<string, LivingNestAsset>>((acc, a) => {
    acc[a.id] = a;
    return acc;
  }, {});

// ── Scene Slots — living-room zones (bounds from lib/nest-scale.ts, tuned) ────
const SLOTS: LivingNestSlot[] = [
  {
    id: "slot-rug",
    name: "Rug (under seating)",
    slotType: "rug",
    acceptedAssetCategories: ["decor"],
    bounds: { x: 0.08, y: 0.77, width: 0.62, height: 0.175 },
    anchorPoint: { x: 0.39, y: 0.945 },
    zIndex: 0,
    plane: "floor",
    importance: "optional",
    scaleRef: 1.5,
    contactShadow: false,
  },
  {
    id: "slot-frame",
    name: "Wall frame (secondary)",
    slotType: "frame",
    acceptedAssetCategories: ["decor"],
    bounds: { x: 0.18, y: 0.15, width: 0.157, height: 0.1135 },
    anchorPoint: { x: 0.2585, y: 0.207 },
    zIndex: 1,
    plane: "front_wall",
    importance: "primary",
    defaultInteractionId: "frame_focus_gallery",
    scaleRef: 0.28,
    contactShadow: false,
  },
  {
    id: "slot-media",
    name: "Media wall (TV + console, hero)",
    slotType: "media",
    acceptedAssetCategories: ["electronics"],
    bounds: { x: 0.259, y: 0.422, width: 0.482, height: 0.233 },
    anchorPoint: { x: 0.5, y: 0.655 },
    zIndex: 2,
    plane: "floor",
    importance: "primary",
    defaultInteractionId: "tv_screen_video",
    scaleRef: 0.86,
    contactShadow: true,
  },
  {
    id: "slot-lamp",
    name: "Floor lamp (beside sofa, left)",
    slotType: "lamp",
    acceptedAssetCategories: ["lighting"],
    bounds: { x: 0.0, y: 0.397, width: 0.155, height: 0.403 },
    anchorPoint: { x: 0.075, y: 0.8 },
    zIndex: 3,
    plane: "floor",
    importance: "optional",
    defaultInteractionId: "lamp_glow_ambience",
    scaleRef: 0.96,
    contactShadow: true,
  },
  {
    id: "slot-plant",
    name: "Side plant (against right wall)",
    slotType: "plant",
    acceptedAssetCategories: ["plant"],
    bounds: { x: 0.7295, y: 0.528, width: 0.241, height: 0.252 },
    anchorPoint: { x: 0.85, y: 0.78 },
    zIndex: 3,
    plane: "floor",
    importance: "optional",
    defaultInteractionId: "plant_leaf_sway",
    scaleRef: 0.6,
    contactShadow: true,
  },
  {
    id: "slot-sofa",
    name: "Sofa (seating hero, lower-left)",
    slotType: "sofa",
    acceptedAssetCategories: ["furniture"],
    bounds: { x: 0.001, y: 0.727, width: 0.678, height: 0.193 },
    anchorPoint: { x: 0.34, y: 0.92 },
    zIndex: 4,
    plane: "floor",
    importance: "primary",
    scaleRef: 0.46,
    contactShadow: true,
  },
  {
    id: "slot-coffee-table",
    name: "Coffee table (in front of sofa)",
    slotType: "table",
    acceptedAssetCategories: ["furniture"],
    bounds: { x: 0.3225, y: 0.821, width: 0.275, height: 0.109 },
    anchorPoint: { x: 0.46, y: 0.93 },
    zIndex: 5,
    plane: "floor",
    importance: "primary",
    scaleRef: 0.26,
    contactShadow: true,
  },
  {
    id: "slot-avatar",
    name: "Avatar (foreground, off-centre right)",
    slotType: "avatar",
    acceptedAssetCategories: ["avatar"],
    bounds: { x: 0.575, y: 0.545, width: 0.23, height: 0.42 },
    anchorPoint: { x: 0.69, y: 0.965 },
    zIndex: 6,
    plane: "floor",
    importance: "primary",
    defaultInteractionId: "avatar_greet",
    scaleRef: 1.0,
    contactShadow: true,
  },
];

export const GOLDEN_LIVING_NEST_TEMPLATE: LivingNestTemplate = {
  id: "golden-living-nest-v1",
  name: "Golden Living Nest",
  description:
    "A warm, premium living room for a creator's digital identity — sofa + coffee table + " +
    "media wall + ambience, front-facing (ADR-028). Office furniture lives in a future Home Office Nest.",
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
    { slotId: "slot-rug", assetId: "ast-rug" },
    { slotId: "slot-frame", assetId: "ast-framed-photo" },
    { slotId: "slot-media", assetId: "ast-tv" },
    { slotId: "slot-lamp", assetId: "ast-floor-lamp" },
    { slotId: "slot-plant", assetId: "ast-side-plant" },
    { slotId: "slot-sofa", assetId: "ast-sofa" },
    { slotId: "slot-coffee-table", assetId: "ast-coffee-table" },
    { slotId: "slot-avatar", assetId: "ast-avatar" },
  ],
  approvalStatus: "approved",
  createdAt: T,
  updatedAt: T,
};

export const GOLDEN_LIVING_NEST_COMPOSED: ComposedNest = {
  id: "composed-golden-living-nest-v1",
  ownerId: "demo-owner-living",
  houseId: "demo-house-living",
  templateId: "golden-living-nest-v1",
  slotAssignments: [
    { slotId: "slot-rug", assetId: "ast-rug" },
    { slotId: "slot-frame", assetId: "ast-framed-photo", content: { contentType: "gallery", title: "Recent work" } },
    { slotId: "slot-media", assetId: "ast-tv", content: { contentType: "video", url: "https://example.com/creator/video", title: "Latest video" } },
    { slotId: "slot-lamp", assetId: "ast-floor-lamp" },
    { slotId: "slot-plant", assetId: "ast-side-plant" },
    { slotId: "slot-sofa", assetId: "ast-sofa" },
    { slotId: "slot-coffee-table", assetId: "ast-coffee-table" },
    { slotId: "slot-avatar", assetId: "ast-avatar", content: { contentType: "intro", title: "Hi, I'm the creator" } },
  ],
  avatarAssetId: "ast-avatar",
  personalAssetIds: [],
  ambiencePresetId: "warm_day",
  accessLevel: "public",
  quickLinks: [
    { id: "ql-video", label: "Latest video", url: "https://example.com/creator/video" },
    { id: "ql-site", label: "Website", url: "https://example.com/creator" },
  ],
  createdAt: T,
  updatedAt: T,
};
