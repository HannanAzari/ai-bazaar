// ── Nestudio V2 — architectural scale calibration (M5) ──────────────────────
//
// Typed scale constants for the Golden Living Nest, calibrated against the locked
// front-facing camera (ADR-028) and the baked `background-v2.png` architecture.
// Reference unit: **avatar standing height = 1.00**. Every furniture height is a
// physical ratio of the avatar; the renderer converts ratios → normalized box
// sizes using the cut-out's pixel aspect so "furniture sits, not floats" (DNA §13).
//
// Pure data — no I/O, no randomness. Final ratios actually used are documented in
// docs/golden-living-nest-scale.md. Additive: touches no existing file.

/** The avatar's rendered height as a fraction of the 3:4 scene HEIGHT (the anchor). */
export const AVATAR_SCENE_HEIGHT_FRACTION = 0.42 as const;

/** Scene aspect ratio width:height (3:4 portrait). Used to convert a physical length
 * between the x- and y-normalized axes (x-fraction = y-fraction × HEIGHT/WIDTH). */
export const SCENE_ASPECT_W = 3 as const;
export const SCENE_ASPECT_H = 4 as const;

/**
 * Physical size of each object as a ratio of avatar height (= 1.00). Ranges are the
 * sprint's starting relationships; `used` is the calibrated value authored into the
 * Golden Living Nest fixture (tuned visually against the background).
 */
export const LIVING_NEST_SCALE = {
  avatar: { heightRatio: 1.0, used: 1.0 },
  sofa: { heightRange: [0.42, 0.52], widthRange: [1.2, 1.6], usedHeight: 0.48, usedWidth: 1.34 },
  coffeeTable: { heightRange: [0.22, 0.3], usedHeight: 0.26, usedWidth: 0.82 },
  mediaConsole: { heightRange: [0.28, 0.38], usedHeight: 0.34 },
  tv: { widthRange: [0.65, 0.95], usedWidth: 0.86 },
  floorLamp: { heightRange: [0.85, 1.05], usedHeight: 0.96 },
  plant: { heightRange: [0.45, 0.75], usedHeight: 0.6 },
  frame: { widthRange: [0.2, 0.35], usedWidth: 0.28 },
  rug: { usedWidth: 1.5 }, // floor footprint, no height (flat on floor)
} as const;

/**
 * Architectural calibration of `background-v2.png` (normalized 0..1), carried from
 * the V2 sceneBox and re-measured for the living-room layout. Drives where the floor
 * meets the wall and how far back the side walls rake.
 */
export const LIVING_NEST_ARCHITECTURE = {
  /** y where the floor meets the front wall (objects ground at/above this band). */
  floorSeamY: 0.62,
  /** Visible front-wall band (top → floor seam). */
  wallTopY: 0.04,
  /** Usable floor depth band (seam → bottom foreground). */
  floorBottomY: 1.0,
  /** Left/right wall slivers (gentle inward rake) — accent/decor only. */
  leftSliverX: 0.16,
  rightSliverX: 0.82,
  /** Camera downward tilt (degrees). */
  cameraTiltDeg: 7,
  /** Floorboard run direction note (front-to-back) — informs rug/foreshortening. */
  floorboards: "front-to-back, converging slightly toward the seam",
} as const;

/**
 * Convert a physical length (in avatar-height units) to a normalized box size on the
 * scene, given the asset's pixel aspect (w/h). `anchorAxis` says which physical
 * dimension the ratio describes ("height" for furniture, "width" for the TV/frame).
 * Returns { width, height } as fractions of scene width / height respectively.
 */
export function ratioToBox(
  ratioOfAvatar: number,
  anchorAxis: "height" | "width",
  pixelAspect: number, // cut-out width / height
): { width: number; height: number } {
  // 1 avatar height = AVATAR_SCENE_HEIGHT_FRACTION of scene height (y-units).
  const avatarHeightY = AVATAR_SCENE_HEIGHT_FRACTION;
  const xPerY = SCENE_ASPECT_H / SCENE_ASPECT_W; // x-fraction = y-fraction × 4/3

  if (anchorAxis === "height") {
    const heightY = ratioOfAvatar * avatarHeightY; // y-fraction
    const widthY = heightY * pixelAspect; // physical width as y-fraction
    return { width: widthY * xPerY, height: heightY };
  }
  // width-anchored (TV, frame): ratio describes physical width.
  const widthY = ratioOfAvatar * avatarHeightY; // physical width as y-fraction
  const heightY = widthY / pixelAspect;
  return { width: widthY * xPerY, height: heightY };
}
