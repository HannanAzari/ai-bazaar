/**
 * village-surface.ts
 * -----------------------------------------------------------------------------
 * ONE shared curved-surface projection for the whole village. Every object —
 * houses, roads, paths, trees, bushes, flowers, lamps, fences, labels, shadows —
 * lives in surface coordinates (longitude, latitude) and derives its screen
 * position from the SAME projectSurface() call. Nothing stores screen coords.
 *
 * MODEL — a small planet (orthographic tilted sphere)
 * ---------------------------------------------------
 * The village sits on the surface of a sphere. We look at it from outside, tilted
 * down onto the near cap. Because the projection is orthographic, the sphere's
 * silhouette on screen is a FIXED circle of radius `radius` centred at
 * (viewport.width/2, viewport.height * centerYFraction) — that circle IS the
 * terrain limb / horizon. Every surface point projects to a screen point INSIDE
 * that disc.
 *
 *   a   = longitude - camera.longitude          (rotation about the polar axis)
 *   p3  = ( cosLat·sin a ,  sinLat ,  cosLat·cos a )   unit sphere point
 *   tilt the sphere down by β = tilt + camera.tilt about the screen X axis
 *   z   = toward-camera component after tilt
 *
 *   z > 0  → FRONT hemisphere: visible, anchored on the near surface.
 *   z = 0  → the LIMB: the point sits exactly on the horizon circle.
 *   z ≤ 0  → BACK hemisphere: hidden BEHIND the earth (occluded, not just faded).
 *
 * Rotating camera.longitude spins the world: objects slide toward one limb,
 * cross z=0, vanish behind the earth, and re-emerge from the opposite limb.
 * Because the outward surface normal of a sphere equals the point direction, `z`
 * is also the normal's toward-camera component — so it doubles as the occlusion
 * test AND the foreshortening / scale term. No object can float in open sky: its
 * anchor is always a real point on this one surface.
 */

/* ────────────────────────────────────────────────────────────────────────── */
/* Types                                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

/** A position ON the village surface. This is the ONLY way to place an object. */
export type SurfacePoint = {
  /** Radians around the polar axis; wraps every 2π. */
  longitude: number;
  /** Radians up/down the surface band (0 ≈ front-centre of the near cap). */
  latitude: number;
  /** Optional height standing out from the surface (unused by anchor math). */
  elevation?: number;
};

/** The movable camera: which longitude faces us, and how far we tilt onto the cap. */
export type SurfaceCamera = { longitude: number; tilt: number };

export type SurfaceViewport = { width: number; height: number };

export type Vec2 = { x: number; y: number };

export type SurfaceConfig = {
  /** Sphere radius in px. Increase → gentler curvature, bigger world. */
  radius: number;
  /** Sphere centre Y as a fraction of viewport height (usually > 1 → below screen).
   *  Increase → the whole globe sinks; less ground, more sky. */
  centerYFraction: number;
  /** Base pitch (radians) looking down onto the near cap.
   *  Increase → we see more of the "top", the village band sits lower/rounder. */
  tilt: number;
  /** Extra vertical exaggeration of latitude bands. 1 = true sphere.
   *  Increase → the village band is stretched taller on screen. */
  latExaggeration: number;

  /** Scale of a point at the near sub-camera pole (z = 1).
   *  Increase → everything larger. */
  baseScale: number;
  /** How much scale grows from limb (z→0) to front (z→1).
   *  Increase → stronger near/far size difference. */
  scaleByDepth: number;
  minScale: number;
  maxScale: number;

  /** Toward-camera band over which a front object fades in from the limb (0..1).
   *  A thin transition so objects sink into haze right as they cross behind. */
  limbFade: number;
  /** Peak blur (px) at the limb, easing to 0 at the near front. */
  blurStrength: number;

  /** Pointer px → radians of longitude rotation. Increase → spins faster. */
  sensitivityLon: number;
  /** Pointer px → radians of camera tilt. Increase → vertical drag tilts more. */
  sensitivityTilt: number;
  /** Clamp on camera.tilt so vertical drag can't flip the globe. */
  tiltMin: number;
  tiltMax: number;

  /** Inertia decay per frame (0..1) and a velocity cap (rad/frame). */
  friction: number;
  maxVelocity: number;
};

export type ProjectedSurfacePoint = {
  x: number;
  y: number;
  scale: number;
  /** Toward-camera component of the surface normal: 1 = facing us, 0 = limb. */
  normalZ: number;
  /** True when on the near/front hemisphere (z > 0) and not fully faded. */
  visible: boolean;
  opacity: number;
  blur: number;
  /** Integer stacking order; nearer (higher z) paints on top. */
  zIndex: number;
};

/* ────────────────────────────────────────────────────────────────────────── */
/* Defaults                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export const DEFAULT_SURFACE_CONFIG: SurfaceConfig = {
  radius: 340,
  centerYFraction: 0.82, // centre near the lower third → we see the near cap + a curved horizon
  tilt: 0.72,
  latExaggeration: 1.0,

  baseScale: 1.05,
  scaleByDepth: 0.55,
  minScale: 0.24,
  maxScale: 1.5,

  limbFade: 0.16,
  blurStrength: 2.5,

  sensitivityLon: 0.0055,
  sensitivityTilt: 0.0022,
  tiltMin: 0.42,
  tiltMax: 0.95,

  friction: 0.94,
  maxVelocity: 0.16,
};

const OPACITY_EPSILON = 0.02;

/* ────────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

export function clamp(v: number, min: number, max: number): number {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

/** Wrap an angle into (-π, π]. */
export function wrapAngle(a: number): number {
  const TAU = Math.PI * 2;
  a = ((a % TAU) + TAU) % TAU;
  return a > Math.PI ? a - TAU : a;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Core projection                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Project a surface point to screen space. Pure: same inputs → same output.
 * The returned point is where an object's GROUND ANCHOR (bottom-centre) sits.
 */
export function projectSurface(
  point: SurfacePoint,
  camera: SurfaceCamera,
  viewport: SurfaceViewport,
  config: SurfaceConfig = DEFAULT_SURFACE_CONFIG,
): ProjectedSurfacePoint {
  const a = point.longitude - camera.longitude; // rotation
  const cosLat = Math.cos(point.latitude);
  const sinLat = Math.sin(point.latitude);

  // Unit sphere point.
  const x0 = cosLat * Math.sin(a);
  const y0 = sinLat;
  const z0 = cosLat * Math.cos(a);

  // Tilt (pitch) the sphere down about the screen X axis.
  const beta = config.tilt + camera.tilt;
  const cb = Math.cos(beta);
  const sb = Math.sin(beta);
  const y1 = y0 * cb - z0 * sb;
  const z1 = y0 * sb + z0 * cb; // toward-camera component

  const R = config.radius;
  const cx = viewport.width / 2;
  const cy = viewport.height * config.centerYFraction;

  const x = cx + x0 * R;
  const y = cy - y1 * R * config.latExaggeration;

  const normalZ = z1;

  // Foreshortening: monotonic in z — near front (z→1) large, limb (z→0) small.
  const nd = clamp(z1, 0, 1);
  const scale = clamp(
    config.baseScale * ((1 - config.scaleByDepth) + config.scaleByDepth * nd),
    config.minScale,
    config.maxScale,
  );

  // Back hemisphere is HIDDEN by the earth — not merely faded.
  const front = z1 > 0;
  // Thin fade band as a front object approaches the limb, so it dissolves into
  // atmospheric haze right as it crosses behind (no hard pop).
  const opacity = front ? clamp(z1 / config.limbFade, 0, 1) : 0;
  const blur = front ? config.blurStrength * (1 - nd) : 0;

  // Nearer points paint on top. z ∈ (-1,1] → integer band.
  const zIndex = Math.round((z1 + 1) * 1000);

  const visible = front && opacity > OPACITY_EPSILON;

  return {
    x,
    y,
    scale,
    normalZ,
    visible,
    opacity,
    blur,
    zIndex,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Inertia / physics (pure)                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export function applyInertia(velocity: Vec2, friction: number): Vec2 {
  return { x: velocity.x * friction, y: velocity.y * friction };
}

export function clampVelocity(v: Vec2, max: number): Vec2 {
  const mag = Math.hypot(v.x, v.y);
  if (mag <= max || mag === 0) return { x: v.x, y: v.y };
  const s = max / mag;
  return { x: v.x * s, y: v.y * s };
}
