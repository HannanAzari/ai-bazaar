// ── Production Pack V1 — contract-alignment fixture (M9.1) ───────────────────
//
// The live-contract materialization of the M9.1 decisions for Production Pack V1
// (docs/production-pack-v1-plan.md, metadata/production-pack-v1.json):
//   1. the 4 new NestSlotTypes (seat/table/rug/pinboard) — defined in lib/nest-types.ts
//   2. the 2 new interactions (laptop_screen_website, speaker_pulse_music) — here
//   3. cover/photo surface skins modeled as STANDALONE surface assets (category
//      "surface" + surfaceKind), not NestAssetVariants — here
//   4. output paths public/nests/production-v1/{backgrounds,objects,surfaces}/
//
// This is reference/test data only — nothing renders, persists, or generates. No
// artwork exists yet; image URLs point at the planned production-v1 surface path.
// The Golden Nest fixtures (./golden-nest.ts, ./golden-nest-v2.ts) are untouched.

import type { Interaction, NestAsset, NestSurfaceKind } from "@/lib/nest-types";
import { CURRENT_NEST_DNA_VERSION, NEST_CAMERA_CONTRACT_VERSION } from "@/lib/nest-types";
import { GOLDEN_NEST_INTERACTIONS } from "@/lib/fixtures/golden-nest";

const T = "2026-07-01T00:00:00.000Z";
const SURF = "/nests/production-v1/surfaces"; // planned delivery path (M9.1 decision 4)

// ── 2. New interactions (Object → Animation → Content) ───────────────────────

/** Laptop / monitor screen wakes, then opens the creator's site/code. */
export const LAPTOP_SCREEN_WEBSITE: Interaction = {
  id: "laptop_screen_website",
  name: "Laptop — screen on → website",
  trigger: "tap",
  animation: "screen_on",
  contentType: "website",
  reducedMotionFallback: "none",
  notes: "The laptop/monitor screen wakes, then opens the creator's website/code.",
};

/** Small speaker pulses, then opens the creator's music. */
export const SPEAKER_PULSE_MUSIC: Interaction = {
  id: "speaker_pulse_music",
  name: "Speaker — pulse → music",
  trigger: "tap",
  animation: "pulse",
  contentType: "music",
  reducedMotionFallback: "none",
  notes: "A soft pulse, then opens the creator's music.",
};

/**
 * The Production Pack V1 interaction library = the Golden Nest five
 * (tv/book/lamp/frame/plant) + the two M9.1 additions. Every `defaultInteractionId`
 * referenced by a Production Pack V1 asset resolves in this set.
 */
export const PRODUCTION_PACK_INTERACTIONS: Interaction[] = [
  ...GOLDEN_NEST_INTERACTIONS,
  LAPTOP_SCREEN_WEBSITE,
  SPEAKER_PULSE_MUSIC,
];

export const PRODUCTION_PACK_INTERACTIONS_BY_ID: Record<string, Interaction> =
  PRODUCTION_PACK_INTERACTIONS.reduce<Record<string, Interaction>>((acc, i) => {
    acc[i.id] = i;
    return acc;
  }, {});

// ── 3. Standalone surface-skin assets (category "surface") ───────────────────

function surfaceAsset(
  p: Pick<NestAsset, "id" | "name"> & {
    art: string;
    surfaceKind: NestSurfaceKind;
    aspect: string;
    accent?: string;
    tags: string[];
  },
): NestAsset {
  return {
    id: p.id,
    name: p.name,
    category: "surface",
    surfaceKind: p.surfaceKind,
    tags: p.tags,
    dnaVersion: CURRENT_NEST_DNA_VERSION,
    cameraContractVersion: NEST_CAMERA_CONTRACT_VERSION,
    assetType: "filler",
    imageUrl: `${SURF}/${p.art}.png`,
    thumbnailUrl: `${SURF}/${p.art}.png`,
    transparentPngUrl: `${SURF}/${p.art}.png`,
    // A surface skin fills a host's editable surface — it does not snap into a
    // scene slot, so it declares no compatible slot types.
    compatibleSlotTypes: [],
    variants: [],
    states: [{ name: "idle" }],
    approvalStatus: "draft", // no artwork generated yet (M9.1 is contract-only)
    source: "curated",
    createdAt: T,
    updatedAt: T,
  };
}

/**
 * The 5 editable-surface skins (3 book covers + 2 photo cards) as standalone
 * `surface` assets. They fill a host's `cover` / `photo` editable surface; any
 * book/frame can host any compatible skin (the projection model), which is why
 * they are standalone assets rather than variants bolted onto one book/frame.
 */
export const PRODUCTION_PACK_SURFACE_ASSETS: NestAsset[] = [
  surfaceAsset({ id: "ast-fx-bookcover-a", name: "Book Cover Skin — Warm", art: "ast-fx-bookcover-a", surfaceKind: "cover", aspect: "3:4", accent: "#c98a4b", tags: ["book cover", "skin", "surface", "warm"] }),
  surfaceAsset({ id: "ast-fx-bookcover-b", name: "Book Cover Skin — Sage", art: "ast-fx-bookcover-b", surfaceKind: "cover", aspect: "3:4", accent: "#8aa17a", tags: ["book cover", "skin", "surface", "sage"] }),
  surfaceAsset({ id: "ast-fx-bookcover-c", name: "Book Cover Skin — Cobalt", art: "ast-fx-bookcover-c", surfaceKind: "cover", aspect: "3:4", accent: "#3f5aa6", tags: ["book cover", "skin", "surface", "cobalt", "accent"] }),
  surfaceAsset({ id: "ast-fx-photo-surface-portrait", name: "Photo Surface — Portrait", art: "ast-fx-photo-surface-portrait", surfaceKind: "photo", aspect: "3:4", tags: ["photo", "surface", "portrait", "skin"] }),
  surfaceAsset({ id: "ast-fx-photo-surface-landscape", name: "Photo Surface — Landscape", art: "ast-fx-photo-surface-landscape", surfaceKind: "photo", aspect: "4:3", tags: ["photo", "surface", "landscape", "skin"] }),
];

export const PRODUCTION_PACK_SURFACE_ASSETS_BY_ID: Record<string, NestAsset> =
  PRODUCTION_PACK_SURFACE_ASSETS.reduce<Record<string, NestAsset>>((acc, a) => {
    acc[a.id] = a;
    return acc;
  }, {});
