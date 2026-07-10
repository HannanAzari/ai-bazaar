/**
 * village-projection.ts
 * -----------------------------------------------------------------------------
 * Pure projection math for a pseudo-3D "curved world" village.
 *
 * NO React, NO DOM, NO Three.js, NO Canvas — just numbers in, numbers out.
 * Everything here is deterministic and unit-testable.
 *
 * COORDINATE MODEL
 * ----------------
 * World space:
 *   - worldX wraps horizontally (a cylinder) with period WORLD_WIDTH.
 *   - worldY is a finite depth axis (soft-clamped, never wraps).
 *
 * Camera { x, y } sits in world space and looks at the ground.
 *
 * Screen space:
 *   - x grows to the right, y grows DOWNWARD (top = 0).
 *   - `horizonY` is the sky/ground seam near the top (>= 1/3 of the viewport
 *     stays sky above it).
 *
 * DEPTH SEMANTICS (read this before reasoning about signs)
 * --------------------------------------------------------
 *   relativeY = clamp(worldY - cameraY)  ... this is `depth`.
 *
 *   relativeY  > 0  => item is IN FRONT of the camera => FOREGROUND
 *                      => lower on screen (bottom), LARGER scale,
 *                         HIGHER zIndex, sharp, opaque.
 *   relativeY == 0  => sits on the horizon seam.
 *   relativeY  < 0  => item is toward/behind the horizon => FAR
 *                      => near the top, SMALLER scale, LOWER zIndex,
 *                         blurred and hazy.
 *
 * So "closest / most-foreground" == large positive relativeY, and the horizon
 * == small/negative relativeY. Moving the camera vertically (cameraY) slides
 * every house between foreground and background, which is exactly the
 * "vertical camera changes which houses are foreground" design goal.
 */

/* ────────────────────────────────────────────────────────────────────────── */
/* Types                                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

export type VillageWorldItem = {
  id: string;
  worldX: number;
  worldY: number;
  kind: "house" | "tree" | "flower" | "lamp" | "path";
};

export type Camera = { x: number; y: number };

/** Generic 2D vector, used for camera position and velocity. */
export type Vec2 = { x: number; y: number };

export type Viewport = { width: number; height: number };

export type ProjectionConfig = {
  /** World is a cylinder of this width; worldX wraps with this period.
   *  Increase → the world is "wider", items repeat less often. */
  WORLD_WIDTH: number;
  /** Finite depth extent of the world; relativeY is clamped to ±WORLD_HEIGHT/2.
   *  Increase → more usable depth between horizon and foreground. */
  WORLD_HEIGHT: number;

  /** Where the horizon seam sits, as a fraction of viewport height (0.35–0.45).
   *  Increase → horizon drops lower, less sky, more ground. */
  horizonYFraction: number;

  /** World-units → pixels for horizontal offset (before depth compression).
   *  Increase → items spread further left/right from center. */
  horizontalScale: number;
  /** World-units → pixels for vertical offset per unit depth.
   *  Increase → foreground items drop faster toward the bottom. */
  verticalScale: number;

  /** Coefficient of the relativeX² dome term (see sign note below).
   *  Increase → stronger convex "curved planet" bulge; edges drop away faster. */
  horizontalCurve: number;
  /** Coefficient of the relativeY² term; adds accelerating vertical perspective.
   *  Increase → foreground falls toward the bottom with more acceleration. */
  depthCurve: number;

  /** How strongly scale responds to depth (relativeY).
   *  Increase → bigger size difference between foreground and horizon. */
  depthScale: number;
  /** Scale of an item sitting exactly on the horizon seam (relativeY = 0).
   *  Increase → everything is uniformly larger. */
  baseScale: number;
  /** Hard floor for scale (far/hazy items).
   *  Increase → distant items never shrink below this. */
  minScale: number;
  /** Hard ceiling for scale (very near items).
   *  Increase → foreground items are allowed to grow larger. */
  maxScale: number;

  /** Horizontal compression factor AT the far horizon, in [0,1].
   *  Lower → stronger perspective convergence (sides pinch toward center far away). */
  horizonCompression: number;

  /** Max |relativeX| (world units) at which an item is still drawn.
   *  Increase → items stay visible further off to the sides. */
  visibilityRadius: number;

  /** Peak blur in pixels applied at the horizon / far edges.
   *  Increase → hazier distance and edges. */
  blurStrength: number;

  /** Fraction of visibilityRadius at which horizontal opacity starts fading.
   *  Lower → items begin fading closer to center. */
  opacityFalloffStart: number;
  /** Opacity floor for items sitting on the horizon (atmospheric haze), in [0,1].
   *  Lower → distant items fade to nothing more aggressively. */
  horizonFade: number;

  /** Multiplier turning depth into an integer zIndex.
   *  Increase → more distinct stacking layers between near and far. */
  zIndexScale: number;

  /** Pointer-pixels → world-units for input mapping.
   *  Increase → dragging moves the camera faster (more sensitive). */
  sensitivity: number;

  /** Recommended per-frame inertia multiplier for applyInertia (0..1).
   *  Higher → drift coasts longer after release. */
  friction: number;
  /** Recommended magnitude cap for clampVelocity (world-units/frame).
   *  Higher → allows faster flings. */
  maxVelocity: number;
};

export type ProjectedItem = {
  id: string;
  kind: VillageWorldItem["kind"];
  screenX: number;
  screenY: number;
  scale: number;
  opacity: number;
  blur: number;
  zIndex: number;
  visible: boolean;
  /** relativeY, exposed for debugging / overlays. */
  depth: number;
};

/* ────────────────────────────────────────────────────────────────────────── */
/* Defaults                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export const DEFAULT_PROJECTION_CONFIG: ProjectionConfig = {
  WORLD_WIDTH: 2000,
  WORLD_HEIGHT: 1200,

  horizonYFraction: 0.4, // 40% sky above the seam → keeps >= 1/3 sky

  horizontalScale: 0.5,
  verticalScale: 0.8,

  // SIGN NOTE (dome curve):
  //   screenY += horizontalCurve * relativeX²
  //   screenY grows DOWNWARD, so a POSITIVE horizontalCurve pushes side items
  //   DOWN. That makes the ground read as CONVEX — you are standing on top of a
  //   small planet and the edges "fall away" from the raised center. To instead
  //   model the concave inside of a dome (edges rise), make this NEGATIVE.
  horizontalCurve: 0.00015,
  depthCurve: 0.00005,

  depthScale: 0.0013,
  baseScale: 0.55,
  minScale: 0.18,
  maxScale: 1.7,

  horizonCompression: 0.4,

  visibilityRadius: 850,

  blurStrength: 3.5,

  opacityFalloffStart: 0.65,
  horizonFade: 0.18,

  zIndexScale: 1,

  sensitivity: 1.0,

  friction: 0.92,
  maxVelocity: 60,
};

/** Below this opacity an item is considered invisible. */
const OPACITY_EPSILON = 0.02;

/* ────────────────────────────────────────────────────────────────────────── */
/* Small pure helpers                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

/** Clamp v into [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

/**
 * Shortest signed horizontal distance from cameraX to worldX on a cylinder of
 * period worldWidth. Result is in (-worldWidth/2, worldWidth/2]. An item just
 * past the right edge therefore reappears as a small NEGATIVE delta on the left.
 */
export function wrapDeltaX(worldX: number, cameraX: number, worldWidth: number): number {
  const half = worldWidth / 2;
  return ((((worldX - cameraX + half) % worldWidth) + worldWidth) % worldWidth) - half;
}

/** Normalized depth in [0,1]: 0 = far horizon, 1 = near foreground. */
function normalizedDepth(relativeY: number, config: ProjectionConfig): number {
  const { WORLD_HEIGHT } = config;
  return clamp((relativeY + WORLD_HEIGHT / 2) / WORLD_HEIGHT, 0, 1);
}

/**
 * Horizontal perspective compression as a function of depth.
 * Far items (horizon) get squeezed toward the center (converging lines);
 * near items get the full horizontalScale spread. Returns [horizonCompression, 1].
 */
function depthCompression(relativeY: number, config: ProjectionConfig): number {
  const t = normalizedDepth(relativeY, config);
  return config.horizonCompression + (1 - config.horizonCompression) * t;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Core projection                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Project a single world item to screen space. Pure: same inputs → same output.
 */
export function projectItem(
  item: VillageWorldItem,
  camera: Camera,
  viewport: Viewport,
  config: ProjectionConfig = DEFAULT_PROJECTION_CONFIG,
): ProjectedItem {
  const { WORLD_WIDTH, WORLD_HEIGHT } = config;

  // ── Relative world position ────────────────────────────────────────────
  const relativeX = wrapDeltaX(item.worldX, camera.x, WORLD_WIDTH); // shortest wrap
  const relativeY = clamp(item.worldY - camera.y, -WORLD_HEIGHT / 2, WORLD_HEIGHT / 2); // soft clamp
  const depth = relativeY;

  // ── Screen anchors ─────────────────────────────────────────────────────
  const centerX = viewport.width / 2;
  const horizonY = viewport.height * config.horizonYFraction;

  // ── Horizontal placement (with perspective compression) ────────────────
  const compression = depthCompression(relativeY, config);
  const screenX = centerX + relativeX * config.horizontalScale * compression;

  // ── Vertical placement (linear depth + dome curve + depth curve) ───────
  const screenY =
    horizonY +
    relativeY * config.verticalScale +
    config.horizontalCurve * relativeX * relativeX + // dome: edges fall away
    config.depthCurve * relativeY * relativeY; // accelerating vertical perspective

  // ── Scale: driven primarily by depth ───────────────────────────────────
  const scale = clamp(
    config.baseScale + relativeY * config.depthScale,
    config.minScale,
    config.maxScale,
  );

  // ── Derived falloff quantities ─────────────────────────────────────────
  const t = normalizedDepth(relativeY, config); // 0 far … 1 near
  const absX = Math.abs(relativeX);
  const edgeFactor = clamp(absX / config.visibilityRadius, 0, 1); // 0 center … 1 edge

  // ── Opacity: horizontal edge fade × atmospheric depth fade ─────────────
  const fadeStart = config.visibilityRadius * config.opacityFalloffStart;
  const horizontalOpacity =
    absX <= fadeStart
      ? 1
      : clamp(1 - (absX - fadeStart) / (config.visibilityRadius - fadeStart), 0, 1);
  const depthOpacity = config.horizonFade + (1 - config.horizonFade) * t; // horizon → hazy
  const opacity = clamp(horizontalOpacity * depthOpacity, 0, 1);

  // ── Blur: strongest at horizon and at the far side edges ───────────────
  const blur = Math.max(0, config.blurStrength * (0.65 * (1 - t) + 0.35 * edgeFactor));

  // ── zIndex: monotonic in depth so foreground overlaps background ───────
  // Larger relativeY ⇒ larger screenY AND larger scale ⇒ higher zIndex.
  const zIndex = Math.round((relativeY + WORLD_HEIGHT / 2) * config.zIndexScale);

  // ── Visibility ─────────────────────────────────────────────────────────
  const visible = absX <= config.visibilityRadius && opacity > OPACITY_EPSILON;

  return {
    id: item.id,
    kind: item.kind,
    screenX,
    screenY,
    scale,
    opacity,
    blur,
    zIndex,
    visible,
    depth,
  };
}

/**
 * Project every item and return them sorted by zIndex ascending, so a naive
 * render loop paints background → foreground in the correct order.
 */
export function projectAll(
  items: readonly VillageWorldItem[],
  camera: Camera,
  viewport: Viewport,
  config: ProjectionConfig = DEFAULT_PROJECTION_CONFIG,
): ProjectedItem[] {
  return items
    .map((item) => projectItem(item, camera, viewport, config))
    .sort((a, b) => a.zIndex - b.zIndex);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Inertia / physics (all pure)                                                */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Decay a velocity by a friction factor in (0,1). Returns a NEW vector.
 * Call once per frame while coasting. friction closer to 1 → longer drift.
 */
export function applyInertia(velocity: Vec2, friction: number): Vec2 {
  return { x: velocity.x * friction, y: velocity.y * friction };
}

/**
 * Clamp a velocity vector's MAGNITUDE to max (world-units/frame). Returns a NEW
 * vector; direction is preserved. Guards against zero-length vectors.
 */
export function clampVelocity(v: Vec2, max: number): Vec2 {
  const mag = Math.hypot(v.x, v.y);
  if (mag <= max || mag === 0) return { x: v.x, y: v.y };
  const s = max / mag;
  return { x: v.x * s, y: v.y * s };
}

/**
 * Integrate the camera one step: camera += velocity * dt. Returns a NEW camera.
 * The camera is intentionally NOT wrapped here — horizontal wrapping is handled
 * per-item by wrapDeltaX, so cameraX may grow unbounded without visual seams.
 */
export function stepCamera(camera: Camera, velocity: Vec2, dt = 1): Camera {
  return { x: camera.x + velocity.x * dt, y: camera.y + velocity.y * dt };
}

/**
 * Convert a pointer drag (in pixels) to a camera-space velocity/delta.
 * Dragging right/down scrolls the world so it follows the finger, hence the
 * camera moves in the OPPOSITE direction. Scaled by config.sensitivity.
 */
export function dragToVelocity(
  dxPx: number,
  dyPx: number,
  config: ProjectionConfig = DEFAULT_PROJECTION_CONFIG,
): Vec2 {
  return { x: -dxPx * config.sensitivity, y: -dyPx * config.sensitivity };
}
