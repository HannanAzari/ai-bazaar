// ── M25 §P1 — the free-exploration camera ────────────────────────────────────
//
// One pure module for every zoom/pan decision: clamping, focal-point pinch, bounds,
// double-tap, and telling a tap apart from a drag.
//
// PURE ON PURPOSE. No React, no DOM, no refs. The gesture hook that drives this runs at
// touch-frame rate and must never re-render the scene (see `use-scene-camera.ts`), so the
// maths has to be callable from a ref loop — and testable without a browser.
//
// The camera is a viewport transform, NOT scene data. It changes what a visitor is looking
// at; it never changes where an object IS. Every displacement bug in this project came
// from something recomputing geometry, so this module only ever produces
// `translate(...) scale(...)` applied to the stage as a whole.

/** Where the camera is. `scale` 1 = the whole room fitted; `x`/`y` are stage-space px. */
export type Camera = { scale: number; x: number; y: number };

export const CAMERA_MIN_SCALE = 1;
/** ~5×: enough to inspect a book spine, before source art visibly softens. */
export const CAMERA_MAX_SCALE = 5;
/** Where a double-tap lands. Close enough to read a small object, far from the ceiling. */
export const CAMERA_DOUBLE_TAP_SCALE = 2;

export const IDENTITY_CAMERA: Camera = { scale: 1, x: 0, y: 0 };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** The scale, clamped to the supported range. Guards NaN/Infinity from a bad gesture. */
export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return CAMERA_MIN_SCALE;
  return clamp(scale, CAMERA_MIN_SCALE, CAMERA_MAX_SCALE);
}

/**
 * Keep the room on screen.
 *
 * At scale 1 the stage exactly fills its viewport, so there is nowhere to pan and the
 * offset is pinned to 0 — this is what stops a one-finger drag from sliding an unzoomed
 * room away. Above 1 the scaled stage is larger than the viewport, and panning is allowed
 * exactly as far as the overflow, so an edge can reach the viewport edge but never past it.
 */
export function clampOffset(cam: Camera, viewport: { width: number; height: number }): Camera {
  const scale = clampScale(cam.scale);
  const maxX = Math.max(0, (viewport.width * scale - viewport.width) / 2);
  const maxY = Math.max(0, (viewport.height * scale - viewport.height) / 2);
  return {
    scale,
    x: clamp(Number.isFinite(cam.x) ? cam.x : 0, -maxX, maxX),
    y: clamp(Number.isFinite(cam.y) ? cam.y : 0, -maxY, maxY),
  };
}

/**
 * Zoom around a point, keeping whatever is under it under it.
 *
 * This is the whole feel of pinch-to-zoom: the pixel between the fingers must not move.
 * `focal` is in VIEWPORT coordinates relative to the viewport's centre, so the caller
 * subtracts the stage's centre before calling and needs no layout knowledge in here.
 */
export function zoomAround(
  cam: Camera,
  nextScale: number,
  focal: { x: number; y: number },
  viewport: { width: number; height: number },
): Camera {
  const scale = clampScale(nextScale);
  const ratio = scale / cam.scale;
  // The focal point in stage space stays fixed ⇒ new offset = focal - (focal - old) * ratio.
  return clampOffset(
    {
      scale,
      x: focal.x - (focal.x - cam.x) * ratio,
      y: focal.y - (focal.y - cam.y) * ratio,
    },
    viewport,
  );
}

/** Pan by a delta, clamped so the room cannot be lost. */
export function panBy(cam: Camera, dx: number, dy: number, viewport: { width: number; height: number }): Camera {
  return clampOffset({ scale: cam.scale, x: cam.x + dx, y: cam.y + dy }, viewport);
}

/**
 * What a double-tap does: zoom to ~2× around the tapped point, or return to 1×.
 *
 * "Already zoomed" is deliberately generous (anything above 1.05) so a double-tap after a
 * slightly-off pinch reads as "put it back", which is what people expect.
 */
export function doubleTapCamera(
  cam: Camera,
  focal: { x: number; y: number },
  viewport: { width: number; height: number },
): Camera {
  if (cam.scale > 1.05) return IDENTITY_CAMERA;
  return zoomAround(cam, CAMERA_DOUBLE_TAP_SCALE, focal, viewport);
}

/** True when the camera is at rest — used to hide the reset control and re-enable scroll. */
export function isIdentityCamera(cam: Camera): boolean {
  return cam.scale <= 1.001 && Math.abs(cam.x) < 0.5 && Math.abs(cam.y) < 0.5;
}

/** The CSS for a camera. `translate` before `scale` so the offset is in viewport pixels. */
export function cameraTransform(cam: Camera): string {
  return `translate3d(${round(cam.x)}px, ${round(cam.y)}px, 0) scale(${round(cam.scale, 4)})`;
}

function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

// ── Tap vs drag ──────────────────────────────────────────────────────────────
//
// The single most important classification in the runtime. A visitor panning across a
// room must not fire the interaction their finger happens to lift over — that would make
// the room feel booby-trapped — and a visitor tapping an object must not have it swallowed
// as a 2px drag.

/** Movement (px) beyond which a gesture is a drag, not a tap. Standard touch slop. */
export const TAP_SLOP_PX = 10;
/** Longer than this and it is a press/pan, not a tap. */
export const TAP_MAX_MS = 500;

export type GestureSample = { x: number; y: number; t: number };

/**
 * Whether a completed one-finger gesture should fire an interaction.
 *
 * `maxDistance` is the FURTHEST the finger travelled, not the start→end distance: a finger
 * that pans away and comes back has still panned, and firing an interaction on it is the
 * "accidental activation while panning" the brief calls out.
 */
export function isTap(start: GestureSample, end: GestureSample, maxDistance: number): boolean {
  if (end.t - start.t > TAP_MAX_MS) return false;
  return maxDistance <= TAP_SLOP_PX;
}

/** Distance between two points. */
export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** The midpoint of two touches — the pinch focal point. */
export function midpoint(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// ── Source-resolution honesty ────────────────────────────────────────────────

/**
 * The scale beyond which an asset is being upscaled past its source pixels.
 *
 * We do NOT silently smooth this over. If a creator zooms to 5× and the art only holds up
 * to 2.4×, that is a fact about the library, and the fix is better source art — not a
 * blur filter that hides it. The runtime logs this in development only.
 */
export function maxSharpScale(sourcePx: number, renderedPxAtScale1: number): number {
  if (renderedPxAtScale1 <= 0) return CAMERA_MAX_SCALE;
  return Math.max(1, sourcePx / renderedPxAtScale1);
}

/** A development warning when an asset cannot hold the full zoom range, or null. */
export function resolutionWarning(assetId: string, sourcePx: number, renderedPxAtScale1: number): string | null {
  const sharp = maxSharpScale(sourcePx, renderedPxAtScale1);
  if (sharp >= CAMERA_MAX_SCALE) return null;
  return `[nest-camera] "${assetId}" is sharp to ~${sharp.toFixed(1)}× (source ${sourcePx}px, rendered ${Math.round(renderedPxAtScale1)}px at 1×). Zooming to ${CAMERA_MAX_SCALE}× will soften it — the fix is a larger source, not a filter.`;
}

// ── Overlapping tap targets ──────────────────────────────────────────────────

export type TapCandidate = {
  id: string;
  /** The object's VISUAL rectangle in viewport px (not its padded touch area). */
  rect: { left: number; top: number; width: number; height: number };
  zIndex: number;
};

/**
 * Which object a tap belongs to when several targets overlap.
 *
 * Needed because tiny objects carry an invisible ~14px touch pad (a 10px book on a phone
 * is otherwise untappable), and two books side by side on a shelf have pads that overlap
 * completely. Without this, the second book won every tap intended for the first — the
 * "overlapping targets become confusing" case the sprint calls out.
 *
 * The order is the brief's:
 *   1. an object whose VISUAL box actually contains the point wins (highest z-index of
 *      those, since that is the one the visitor can see under their finger);
 *   2. otherwise the nearest visual centre wins — the visitor aimed at something.
 *
 * No second-tap chooser: with these two rules the ambiguous case does not arise in
 * practice, and a disambiguation popup would be worse than a wrong guess.
 */
export function resolveTapTarget(candidates: TapCandidate[], point: { x: number; y: number }): string | null {
  if (!candidates.length) return null;

  const contains = (c: TapCandidate) =>
    point.x >= c.rect.left &&
    point.x <= c.rect.left + c.rect.width &&
    point.y >= c.rect.top &&
    point.y <= c.rect.top + c.rect.height;

  const direct = candidates.filter(contains);
  if (direct.length) {
    return direct.reduce((best, c) => (c.zIndex >= best.zIndex ? c : best)).id;
  }

  const centreDistance = (c: TapCandidate) =>
    Math.hypot(point.x - (c.rect.left + c.rect.width / 2), point.y - (c.rect.top + c.rect.height / 2));

  return candidates.reduce((best, c) => (centreDistance(c) < centreDistance(best) ? c : best)).id;
}

// ── M26A §5 — screen ⇄ scene ─────────────────────────────────────────────────
//
// ONE conversion, used by object movement, resize, rotation, new-asset placement and
// sticker/text placement. Adding a second positioning system is how the editor and the
// visitor drifted apart in every previous sprint.
//
// `viewportRect` is the CLIPPING box in client coordinates (the element the camera is
// attached to). `base` is the untransformed size of the stage inside it. Both are read
// from the DOM by the caller, so this stays pure.

export type Rect = { left: number; top: number; width: number; height: number };

/**
 * A client point → canonical scene coordinates (0..1 of the 3:4 scene).
 *
 * The camera scales about the viewport centre and then translates, so the inverse is:
 * subtract the viewport centre, subtract the pan, divide by the scale, then normalise
 * against the untransformed stage.
 */
export function screenToScene(
  point: { x: number; y: number },
  cam: Camera,
  viewportRect: Rect,
  base: { width: number; height: number },
): { nx: number; ny: number } {
  const cx = viewportRect.left + viewportRect.width / 2;
  const cy = viewportRect.top + viewportRect.height / 2;
  const sx = (point.x - cx - cam.x) / cam.scale;
  const sy = (point.y - cy - cam.y) / cam.scale;
  return {
    nx: base.width > 0 ? sx / base.width + 0.5 : 0.5,
    ny: base.height > 0 ? sy / base.height + 0.5 : 0.5,
  };
}

/** The inverse: a canonical scene point → where it currently sits on screen. */
export function sceneToScreen(
  scene: { nx: number; ny: number },
  cam: Camera,
  viewportRect: Rect,
  base: { width: number; height: number },
): { x: number; y: number } {
  const cx = viewportRect.left + viewportRect.width / 2;
  const cy = viewportRect.top + viewportRect.height / 2;
  return {
    x: cx + cam.x + (scene.nx - 0.5) * base.width * cam.scale,
    y: cy + cam.y + (scene.ny - 0.5) * base.height * cam.scale,
  };
}

/**
 * A screen DELTA → a scene delta. Drag distances shrink as you zoom in, which is exactly
 * what makes a 10px book placeable at 5×.
 */
export function screenDeltaToScene(
  dx: number,
  dy: number,
  cam: Camera,
  base: { width: number; height: number },
): { dnx: number; dny: number } {
  return {
    dnx: base.width > 0 ? dx / (base.width * cam.scale) : 0,
    dny: base.height > 0 ? dy / (base.height * cam.scale) : 0,
  };
}

/**
 * The region of the scene the creator can currently SEE, in canonical coordinates.
 *
 * A new asset added while zoomed belongs at the centre of this, not at the centre of the
 * whole room — otherwise it lands off-screen and the creator thinks nothing happened.
 */
export function visibleSceneRect(
  cam: Camera,
  viewportRect: Rect,
  base: { width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  const tl = screenToScene({ x: viewportRect.left, y: viewportRect.top }, cam, viewportRect, base);
  const br = screenToScene(
    { x: viewportRect.left + viewportRect.width, y: viewportRect.top + viewportRect.height },
    cam,
    viewportRect,
    base,
  );
  const x = Math.max(0, Math.min(1, tl.nx));
  const y = Math.max(0, Math.min(1, tl.ny));
  return {
    x,
    y,
    width: Math.max(0, Math.min(1, br.nx) - x),
    height: Math.max(0, Math.min(1, br.ny) - y),
  };
}

/** The centre of what the creator can see — where a newly added asset goes. */
export function visibleSceneCentre(
  cam: Camera,
  viewportRect: Rect,
  base: { width: number; height: number },
): { nx: number; ny: number } {
  const r = visibleSceneRect(cam, viewportRect, base);
  return { nx: r.x + r.width / 2, ny: r.y + r.height / 2 };
}
