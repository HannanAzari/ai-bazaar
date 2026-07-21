/**
 * lib/asset-pipeline/camera.ts — THE canonical Nestudio asset camera (M36 P2).
 * -----------------------------------------------------------------------------
 * Every generated asset — a mug, a desk, a chair, a lamp, a backpack, a TV — must use
 * EXACTLY this camera so the whole catalogue reads as one family. The model is never
 * allowed to invent a new angle. This is the single source of truth; furniture@8 (and
 * anything else that frames an asset) imports it. Do not inline a camera anywhere else.
 *
 * It mirrors the life-simulation camera locked in docs/nestudio-camera-dna-lock.md and
 * lib/asset-dna.ts (front-facing, slightly elevated ~10°, ~35mm). One constant so a
 * catalogue of hundreds cannot drift.
 */

export const CANONICAL_CAMERA_CLAUSE =
  "CAMERA — always identical for every asset: a fixed front-facing, slightly elevated " +
  "three-quarter view with about a 10-degree downward tilt and a ~35mm feel, so the top " +
  "surface is just visible; the object faces the viewer, centred and upright. Never " +
  "eye-level, never a flat side view, never isometric, never a low or dramatic angle, " +
  "never rotated — the exact same camera as every other Nestudio catalogue asset.";
