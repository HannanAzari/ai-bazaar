// ── Nestudio V2 — visual-content bounds (M7B.1) ─────────────────────────────
//
// Cut-out PNGs carry transparent padding (~7% on each side from the alpha cut-out
// pipeline), so the *image* box is larger than the *visible object*. Selection
// frames, movement constraints, alignment and hotspot calibration should use the
// **visible-content bounds** where known, so a padded PNG (e.g. the avatar or the
// thin floor lamp) no longer has an oversized selection/collision region.
//
// Three distinct concepts:
//   • image bounds         — the full PNG box (0..1 = the object's box on the scene)
//   • visual-content bounds — the visible art inside the PNG (this module)
//   • interaction hotspot bounds — asset-local regions (lib/nest-hotspot-catalog)
//
// Additive, optional, backward-compatible: absent metadata falls back to full image
// bounds. No computer-vision here — values are authored from each cut-out's measured
// alpha bounding box. No destructive cropping; the art is untouched.

import type { NormalizedRect } from "@/lib/nest-types";
import type { EditableNestObject } from "@/lib/nest-editor-types";

/** Visible-content rectangle, normalized 0..1 relative to the source image. */
export interface NormalizedVisualBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NestAssetVisualMetadata {
  /** The visible art rectangle inside the (possibly padded) PNG. */
  visualBounds?: NormalizedVisualBounds;
  /** Where the object meets the floor (normalized 0..1 in the image), for grounding. */
  groundContactPoint?: { x: number; y: number };
}

/** Full-image fallback (no padding). */
export const FULL_VISUAL_BOUNDS: NormalizedVisualBounds = { x: 0, y: 0, width: 1, height: 1 };

// Authored from each cut-out's measured alpha bounding box (cutouts-v2). Placeholder
// SVGs (sofa/coffee-table/rug) fill their viewBox, so they use the full fallback.
export const ASSET_VISUAL_METADATA: Record<string, NestAssetVisualMetadata> = {
  "ast-avatar": { visualBounds: { x: 0.168, y: 0.069, width: 0.664, height: 0.862 }, groundContactPoint: { x: 0.5, y: 0.931 } },
  "ast-tv": { visualBounds: { x: 0.069, y: 0.107, width: 0.862, height: 0.786 }, groundContactPoint: { x: 0.5, y: 0.893 } },
  "ast-framed-photo": { visualBounds: { x: 0.069, y: 0.071, width: 0.862, height: 0.858 } },
  "ast-floor-lamp": { visualBounds: { x: 0.239, y: 0.069, width: 0.522, height: 0.862 }, groundContactPoint: { x: 0.5, y: 0.931 } },
  "ast-side-plant": { visualBounds: { x: 0.097, y: 0.069, width: 0.806, height: 0.862 }, groundContactPoint: { x: 0.5, y: 0.931 } },
  "ast-desk": { visualBounds: { x: 0.069, y: 0.078, width: 0.862, height: 0.844 }, groundContactPoint: { x: 0.5, y: 0.922 } },
  "ast-bookshelf": { visualBounds: { x: 0.193, y: 0.069, width: 0.614, height: 0.862 }, groundContactPoint: { x: 0.5, y: 0.931 } },
  "ast-stacked-books": { visualBounds: { x: 0.069, y: 0.12, width: 0.862, height: 0.76 }, groundContactPoint: { x: 0.5, y: 0.88 } },
};

const clampUnit = (n: number): boolean => n >= -1e-6 && n <= 1 + 1e-6;

/** Validate visual bounds are inside 0..1 with positive size. */
export function validateVisualBounds(b: NormalizedVisualBounds | undefined): string[] {
  if (!b) return [];
  const errors: string[] = [];
  for (const k of ["x", "y", "width", "height"] as const) {
    if (typeof b[k] !== "number" || !Number.isFinite(b[k]) || !clampUnit(b[k])) errors.push(`visualBounds.${k} out of [0,1]`);
  }
  if (b.width <= 0 || b.height <= 0) errors.push("visualBounds size must be > 0");
  if (b.x + b.width > 1 + 1e-6 || b.y + b.height > 1 + 1e-6) errors.push("visualBounds leaves the image");
  return errors;
}

/** The visual metadata for an asset, if any. */
export function visualMetaFor(assetId: string): NestAssetVisualMetadata | undefined {
  return ASSET_VISUAL_METADATA[assetId];
}

/** The visible-content bounds for an asset, falling back to full image bounds. */
export function visualBoundsFor(assetId: string): NormalizedVisualBounds {
  return ASSET_VISUAL_METADATA[assetId]?.visualBounds ?? FULL_VISUAL_BOUNDS;
}

/**
 * The visible-content rectangle of an object instance in **scene** coordinates
 * (the PNG box inset by the asset's visual bounds). Used for selection frames,
 * collision/clamping and alignment so padded PNGs don't read as oversized.
 */
export function visibleRect(obj: Pick<EditableNestObject, "x" | "y" | "width" | "height">, assetId: string): NormalizedRect {
  const vb = visualBoundsFor(assetId);
  return {
    x: obj.x + vb.x * obj.width,
    y: obj.y + vb.y * obj.height,
    width: vb.width * obj.width,
    height: vb.height * obj.height,
  };
}

/** Convert an asset-local rect (e.g. a hotspot or visual bounds) into scene coords. */
export function localRectToScene(local: NormalizedRect, obj: Pick<EditableNestObject, "x" | "y" | "width" | "height">): NormalizedRect {
  return {
    x: obj.x + local.x * obj.width,
    y: obj.y + local.y * obj.height,
    width: local.width * obj.width,
    height: local.height * obj.height,
  };
}
