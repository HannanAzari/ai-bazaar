// ── Golden Nest v1 — sample fixtures (M1) ───────────────────────────────────
//
// One worked example of the V2 Nest data contract (`lib/nest-types.ts`): a single
// front-facing Nest Template with 8 Scene Slots, 8 curated assets, 5 interactions,
// and one ComposedNest manifest. This is reference/test data — nothing is persisted
// or composed at runtime. Image URLs point at the local **Golden Nest v1 art pack**
// (M3) under public/nests/golden-nest-v1/ — hand-authored DESIGNED PLACEHOLDER PNGs
// (see scripts/build-golden-nest-art.mjs + docs/golden-nest-renderer.md). Drop final
// raster art over the same filenames to upgrade.
//
// These fixtures are intentionally self-consistent: every ComposedNest assignment
// references a real slot + an approved, slot-compatible asset, so
// `validateComposedNest` returns ok with no warnings.

import type {
  ComposedNest,
  Interaction,
  NestAsset,
  NestTemplate,
  SceneSlot,
} from "@/lib/nest-types";
import {
  CURRENT_NEST_DNA_VERSION,
  NEST_CAMERA_CONTRACT_VERSION,
} from "@/lib/nest-types";

/** Fixed timestamp so the fixtures are deterministic (no Date.now()). */
const T = "2026-06-26T00:00:00.000Z";

const ART = "/nests/golden-nest-v1"; // placeholder asset path root

// ── Interactions (the Object → Animation → Content library, MVP) ─────────────

export const GOLDEN_NEST_INTERACTIONS: Interaction[] = [
  {
    id: "tv_glow_open_youtube",
    name: "TV — glow → video",
    trigger: "tap",
    animation: "glow",
    contentType: "video",
    reducedMotionFallback: "none",
    notes: "Screen warms up, then opens the creator's video content.",
  },
  {
    id: "book_open_article",
    name: "Book/shelf — open → article",
    trigger: "tap",
    animation: "open",
    contentType: "article",
    reducedMotionFallback: "none",
  },
  {
    id: "lamp_toggle_ambience",
    name: "Lamp — light → toggle ambience",
    trigger: "tap",
    animation: "light",
    contentType: "ambience",
    reducedMotionFallback: "none",
    notes: "Cycles the Nest's ambience preset; no external content.",
  },
  {
    id: "frame_zoom_gallery",
    name: "Frame — zoom → gallery",
    trigger: "tap",
    animation: "zoom",
    contentType: "gallery",
    reducedMotionFallback: "none",
  },
  {
    id: "plant_wiggle",
    name: "Plant — leaf sway (ambient)",
    trigger: "auto",
    animation: "leaf_sway",
    contentType: "none",
    reducedMotionFallback: "none",
    notes: "Ambient only — decorative, no content.",
  },
];

export const GOLDEN_NEST_INTERACTIONS_BY_ID: Record<string, Interaction> =
  GOLDEN_NEST_INTERACTIONS.reduce<Record<string, Interaction>>((acc, i) => {
    acc[i.id] = i;
    return acc;
  }, {});

// ── Assets (curated library sample) ──────────────────────────────────────────

/** Helper to keep the 8 fixtures terse and consistent. */
function asset(
  partial: Pick<
    NestAsset,
    "id" | "name" | "category" | "assetType" | "compatibleSlotTypes"
  > & {
    /** Art-pack file stem in public/nests/golden-nest-v1/ (e.g. "tv" → tv.png). */
    art: string;
  } & Partial<NestAsset>,
): NestAsset {
  const { art, ...rest } = partial;
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

export const GOLDEN_NEST_ASSETS: NestAsset[] = [
  asset({
    id: "ast-tv",
    art: "tv",
    name: "Wall TV",
    category: "electronics",
    assetType: "hero",
    compatibleSlotTypes: ["media"],
    tags: ["screen", "media", "video"],
    defaultInteractionId: "tv_glow_open_youtube",
    states: [{ name: "idle" }, { name: "open" }],
    variants: [{ id: "tv-walnut", name: "Walnut frame", material: "walnut" }],
  }),
  asset({
    id: "ast-framed-photo",
    art: "frame",
    name: "Framed Photo",
    category: "decor",
    assetType: "hero",
    compatibleSlotTypes: ["frame"],
    tags: ["frame", "gallery", "photo"],
    defaultInteractionId: "frame_zoom_gallery",
    states: [{ name: "idle" }, { name: "open" }],
  }),
  asset({
    id: "ast-bookshelf",
    art: "bookshelf",
    name: "Oak Bookshelf",
    category: "furniture",
    assetType: "hero",
    compatibleSlotTypes: ["shelf"],
    tags: ["shelf", "books", "storage"],
    defaultInteractionId: "book_open_article",
    states: [{ name: "idle" }, { name: "open" }],
  }),
  asset({
    id: "ast-stacked-books",
    art: "books",
    name: "Stacked Books",
    category: "decor",
    assetType: "filler",
    compatibleSlotTypes: ["books"],
    tags: ["books", "reading"],
    defaultInteractionId: "book_open_article",
  }),
  asset({
    id: "ast-desk",
    art: "desk",
    name: "Writing Desk",
    category: "furniture",
    assetType: "standard",
    compatibleSlotTypes: ["desk"],
    tags: ["desk", "work"],
  }),
  asset({
    id: "ast-potted-plant",
    art: "plant",
    name: "Potted Plant",
    category: "plant",
    assetType: "filler",
    compatibleSlotTypes: ["plant"],
    tags: ["plant", "greenery"],
    defaultInteractionId: "plant_wiggle",
  }),
  asset({
    id: "ast-floor-lamp",
    art: "lamp",
    name: "Warm Floor Lamp",
    category: "lighting",
    assetType: "standard",
    compatibleSlotTypes: ["lamp"],
    tags: ["lamp", "light", "ambience"],
    defaultInteractionId: "lamp_toggle_ambience",
    states: [{ name: "idle" }, { name: "active" }],
    variants: [
      { id: "lamp-sage", name: "Sage", accent: "#8aa17a" },
      { id: "lamp-caramel", name: "Caramel", accent: "#c98a4b" },
    ],
  }),
  asset({
    id: "ast-avatar",
    art: "avatar",
    name: "Creator Avatar",
    category: "avatar",
    assetType: "avatar",
    compatibleSlotTypes: ["avatar"],
    tags: ["avatar", "creator"],
    source: "runtime_avatar",
    states: [{ name: "idle" }],
  }),
];

export const GOLDEN_NEST_ASSETS_BY_ID: Record<string, NestAsset> =
  GOLDEN_NEST_ASSETS.reduce<Record<string, NestAsset>>((acc, a) => {
    acc[a.id] = a;
    return acc;
  }, {});

// ── Template (one front-facing cinematic scene, 8 slots) ─────────────────────

const SLOTS: SceneSlot[] = [
  {
    id: "slot-media",
    name: "Media wall",
    slotType: "media",
    acceptedAssetCategories: ["electronics"],
    bounds: { x: 0.16, y: 0.12, width: 0.34, height: 0.24 },
    anchorPoint: { x: 0.33, y: 0.36 },
    zIndex: 1,
    plane: "front_wall",
    importance: "primary",
    defaultInteractionId: "tv_glow_open_youtube",
  },
  {
    id: "slot-frame",
    name: "Photo frame",
    slotType: "frame",
    acceptedAssetCategories: ["decor"],
    bounds: { x: 0.58, y: 0.14, width: 0.18, height: 0.16 },
    anchorPoint: { x: 0.67, y: 0.3 },
    zIndex: 1,
    plane: "front_wall",
    importance: "primary",
    defaultInteractionId: "frame_zoom_gallery",
  },
  {
    id: "slot-shelf",
    name: "Bookshelf",
    slotType: "shelf",
    acceptedAssetCategories: ["furniture"],
    bounds: { x: 0.58, y: 0.34, width: 0.2, height: 0.26 },
    anchorPoint: { x: 0.68, y: 0.6 },
    zIndex: 2,
    plane: "front_wall",
    importance: "optional",
    defaultInteractionId: "book_open_article",
  },
  {
    id: "slot-books",
    name: "Books",
    slotType: "books",
    acceptedAssetCategories: ["decor"],
    bounds: { x: 0.6, y: 0.5, width: 0.12, height: 0.08 },
    anchorPoint: { x: 0.66, y: 0.58 },
    zIndex: 3,
    plane: "front_wall",
    importance: "optional",
    defaultInteractionId: "book_open_article",
  },
  {
    id: "slot-desk",
    name: "Desk",
    slotType: "desk",
    acceptedAssetCategories: ["furniture", "creator_tool"],
    bounds: { x: 0.62, y: 0.62, width: 0.3, height: 0.26 },
    anchorPoint: { x: 0.77, y: 0.88 },
    zIndex: 4,
    plane: "floor",
    importance: "primary",
  },
  {
    id: "slot-plant",
    name: "Plant",
    slotType: "plant",
    acceptedAssetCategories: ["plant"],
    bounds: { x: 0.18, y: 0.6, width: 0.16, height: 0.28 },
    anchorPoint: { x: 0.26, y: 0.88 },
    zIndex: 3,
    plane: "floor",
    importance: "optional",
    defaultInteractionId: "plant_wiggle",
  },
  {
    id: "slot-lamp",
    name: "Floor lamp",
    slotType: "lamp",
    acceptedAssetCategories: ["lighting"],
    bounds: { x: 0.02, y: 0.38, width: 0.13, height: 0.42 },
    anchorPoint: { x: 0.08, y: 0.8 },
    zIndex: 2,
    plane: "left_sliver",
    importance: "optional",
    defaultInteractionId: "lamp_toggle_ambience",
  },
  {
    id: "slot-avatar",
    name: "Avatar",
    slotType: "avatar",
    acceptedAssetCategories: ["avatar"],
    bounds: { x: 0.34, y: 0.56, width: 0.22, height: 0.36 },
    anchorPoint: { x: 0.45, y: 0.92 },
    zIndex: 5,
    plane: "floor",
    importance: "primary",
  },
];

export const GOLDEN_NEST_TEMPLATE: NestTemplate = {
  id: "golden-nest-v1",
  name: "Golden Nest — Warm Studio",
  description:
    "The first front-facing cinematic Nest template: full front wall + side-wall " +
    "slivers + floor, shallow depth, warm studio light. The reference for V2 composition.",
  cameraContractVersion: NEST_CAMERA_CONTRACT_VERSION,
  dnaVersion: CURRENT_NEST_DNA_VERSION,
  backgroundImageUrl: `${ART}/background.png`,
  aspectRatio: "3:4",
  sceneBox: {
    frontWall: { x: 0.12, y: 0.05, width: 0.76, height: 0.57 },
    leftSliver: { x: 0.0, y: 0.05, width: 0.12, height: 0.6 },
    rightSliver: { x: 0.88, y: 0.05, width: 0.12, height: 0.6 },
    floor: { x: 0.0, y: 0.62, width: 1.0, height: 0.38 },
    floorSeamY: 0.62,
    cameraTiltDeg: 7,
  },
  slots: SLOTS,
  ambiencePresets: [
    { id: "warm_day", name: "Warm day", tint: "#fff6e0", glow: "#ffe9b8", intensity: 0.25 },
    { id: "golden_evening", name: "Golden evening", tint: "#f6d8a8", glow: "#ffc55c", intensity: 0.4 },
    { id: "cozy_night", name: "Cozy night", tint: "#46365a", glow: "#ffc55c", intensity: 0.5 },
  ],
  defaultSlotAssignments: [
    { slotId: "slot-media", assetId: "ast-tv" },
    { slotId: "slot-frame", assetId: "ast-framed-photo" },
    { slotId: "slot-shelf", assetId: "ast-bookshelf" },
    { slotId: "slot-books", assetId: "ast-stacked-books" },
    { slotId: "slot-desk", assetId: "ast-desk" },
    { slotId: "slot-plant", assetId: "ast-potted-plant" },
    { slotId: "slot-lamp", assetId: "ast-floor-lamp" },
    { slotId: "slot-avatar", assetId: "ast-avatar" },
  ],
  approvalStatus: "approved",
  createdAt: T,
  updatedAt: T,
};

// ── ComposedNest (one creator's assembled Nest) ──────────────────────────────

export const GOLDEN_NEST_COMPOSED: ComposedNest = {
  id: "composed-golden-nest-v1",
  ownerId: "demo-owner-1",
  houseId: "demo-house-1",
  templateId: "golden-nest-v1",
  slotAssignments: [
    {
      slotId: "slot-media",
      assetId: "ast-tv",
      variantId: "tv-walnut",
      content: {
        contentType: "video",
        url: "https://youtube.com/@creator",
        title: "My channel",
      },
    },
    {
      slotId: "slot-frame",
      assetId: "ast-framed-photo",
      content: {
        contentType: "gallery",
        title: "Recent work",
        data: { image1: `${ART}/sample/g1.webp`, image2: `${ART}/sample/g2.webp` },
      },
    },
    {
      slotId: "slot-shelf",
      assetId: "ast-bookshelf",
      content: { contentType: "article", url: "https://creator.blog/latest", title: "Writing" },
    },
    { slotId: "slot-books", assetId: "ast-stacked-books" },
    { slotId: "slot-desk", assetId: "ast-desk" },
    { slotId: "slot-plant", assetId: "ast-potted-plant" },
    { slotId: "slot-lamp", assetId: "ast-floor-lamp", variantId: "lamp-caramel" },
    { slotId: "slot-avatar", assetId: "ast-avatar" },
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
