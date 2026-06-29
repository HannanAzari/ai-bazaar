// ── Nestudio V2 — layered interactive visual contract (M5) ──────────────────
//
// Additive extension of the V2 asset contract (`lib/nest-types.ts`) that lets an
// asset optionally declare LAYERS, interactive STATE PACKS, and a clipped screen
// region — so premium interactions can change only the meaningful part of an
// object (a TV's screen, a plant's leaves) instead of transforming one flattened
// PNG. It is **purely additive and optional**: a plain single-image `NestAsset`
// keeps working unchanged; only assets that opt in carry the new fields.
//
// Nothing here is generated or persisted. Preferred animation media, in order:
// CSS transforms → animated WebP → Lottie → alpha WebM (never GIF). See
// docs/golden-living-nest-v1.md and docs/golden-nest-renderer.md "Future animation
// contract". This file does NOT edit the locked `lib/nest-types.ts`.

import type { NestAsset, NestTemplate, NormalizedRect, SceneSlot, NestSlotType } from "@/lib/nest-types";

// ── Living-room layout types (additive — widen slot taxonomy without editing the
// locked nest-types.ts) ──────────────────────────────────────────────────────

/** Living-room slot types: the locked taxonomy plus living-room furniture kinds. */
export type LivingNestSlotType = NestSlotType | "sofa" | "table" | "rug" | "side_table" | "speaker";

/** A SceneSlot whose `slotType` is widened to the living-room taxonomy. */
export type LivingNestSlot = Omit<SceneSlot, "slotType"> & { slotType: LivingNestSlotType };

/** A NestTemplate whose slots are LivingNestSlots. Otherwise identical. */
export type LivingNestTemplate = Omit<NestTemplate, "slots"> & { slots: LivingNestSlot[] };

/**
 * The animation media a visual state plays. Ordered by preference; `css` is the
 * lightweight default (transform/opacity), the others are optional richer loops.
 */
export type NestAnimationFormat = "css" | "webp" | "lottie" | "webm-alpha";

/**
 * One rendered visual state of an asset (idle / active / reduced-motion). Any image
 * field is optional — a state may be pure CSS (no new raster), or swap to a still /
 * animated frame. `reducedMotion` marks the still shown under prefers-reduced-motion.
 */
export interface NestAssetVisualState {
  /** Stable id, e.g. "idle" | "active" | "reduced". */
  id: string;
  /** Still image for this state (defaults to the asset's base imageUrl). */
  imageUrl?: string;
  /** Short transparent animated loop (preferred raster motion). */
  animatedWebpUrl?: string;
  /** Lottie JSON source (vector effects). */
  lottieUrl?: string;
  /** Alpha WebM source (richer approved loops). */
  webmUrl?: string;
  format?: NestAnimationFormat;
  durationMs?: number;
  loop?: boolean;
  /** True when this is the prefers-reduced-motion fallback (a calm still). */
  reducedMotion?: boolean;
}

/**
 * One stacked image layer of a composite asset. Layers paint in array order;
 * `zOffset` fine-tunes order within the asset. An `interactive` layer is the part an
 * interaction animates (e.g. the screen-light or the leaf mass) while the base body
 * layer stays grounded. `clip` optionally restricts a layer to a sub-region of the
 * asset box (normalized 0..1 within the box) — the "clipped screen region" pattern.
 */
export interface NestAssetLayer {
  id: string;
  imageUrl: string;
  /** Paint-order nudge within the asset (higher = nearer the viewer). */
  zOffset: number;
  /** This layer is the animated part of an interaction (screen, leaves, arm). */
  interactive?: boolean;
  /** Restrict the layer to a sub-region of the asset box (normalized 0..1). */
  clip?: NormalizedRect;
}

/**
 * An optional interactive state pack for an asset. Declares its idle / active /
 * reduced-motion states, optional layers, and — for screen-bearing assets — the
 * normalized screen rectangle within the asset box so only the screen lights up
 * (never the whole console rectangle).
 */
export interface NestAssetStatePack {
  /** Resting state (breathing TV-off, plant at rest). */
  idle?: NestAssetVisualState;
  /** Active/tapped state (screen on, leaves swaying, avatar waving). */
  active?: NestAssetVisualState;
  /** Calm still shown under prefers-reduced-motion. */
  reducedMotion?: NestAssetVisualState;
  /** Optional stacked layers (body + interactive part). */
  layers?: NestAssetLayer[];
  /**
   * For a media/screen asset: the screen region inside the asset box (normalized
   * 0..1). The renderer paints screen light + thumbnail ONLY here.
   */
  screenRect?: NormalizedRect;
  /**
   * For a plant: the y-line (0..1 within the box) splitting the static pot (below)
   * from the swaying leaf mass (above). A documented temporary approximation when no
   * separate leaf-layer art exists yet.
   */
  leafSplitY?: number;
}

/**
 * A Living-Nest asset: a `NestAsset` plus the optional layered/state-pack fields and
 * an explicit `placeholder` flag. `placeholder: true` marks temporary stand-in art
 * (e.g. an SVG sofa) that is NOT production-ready — surfaced in the debug overlay and
 * reported as missing final art. Existing single-image assets simply omit these.
 */
export type LivingNestAsset = Omit<NestAsset, "compatibleSlotTypes"> & {
  /** Widened to the living-room slot taxonomy (sofa/table/rug/…). */
  compatibleSlotTypes: LivingNestSlotType[];
  statePack?: NestAssetStatePack;
  /** True ⇒ temporary stand-in art, not approved/production-ready. */
  placeholder?: boolean;
  /** Short note on what the final art still needs (shown in debug). */
  artNote?: string;
};

/** Whether an asset carries an interactive state pack (vs a plain single image). */
export function hasStatePack(asset: LivingNestAsset): boolean {
  return Boolean(asset.statePack && (asset.statePack.active || asset.statePack.layers?.length));
}

/** Whether an asset is temporary placeholder art (not production-ready). */
export function isPlaceholderAsset(asset: LivingNestAsset): boolean {
  return asset.placeholder === true;
}
