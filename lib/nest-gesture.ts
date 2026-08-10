// ── M26A §4 — deterministic gesture ownership ────────────────────────────────
//
// Exactly one owner per pointer gesture, decided at pointer-DOWN and locked until
// pointer-up. Nothing may take a gesture over mid-way.
//
// This exists because the previous model was two independent listeners racing: the editor
// canvas handled object drags on the scene, while the camera hook listened on the viewport
// ancestor and independently decided whether to pan. Both saw the same bubbling
// `pointermove`, so a drag could move an object AND pan the room, and a drag that began on
// a resize handle (which is not inside the object element) panned the camera instead of
// resizing. "Dragging selected books moves the entire Nest" is that race.
//
// Pure: no React, no DOM types beyond a target predicate. Fully unit-testable.

/** Who owns a gesture. `none` means the gesture does nothing at all. */
export type GestureOwner =
  | "camera-pinch"
  | "camera-pan"
  | "object-move"
  /** M26-S §2 — two fingers on the SELECTED object: scale + rotate + translate together. */
  | "object-transform"
  | "object-resize"
  | "object-rotate"
  | "select"
  | "none";

/** What the pointer landed on, in priority order of specificity. */
export type GestureTargetKind = "resize-handle" | "rotate-handle" | "selected-object" | "other-object" | "empty";

export type GestureContext = {
  /** How many pointers are down INCLUDING this one. */
  pointerCount: number;
  target: GestureTargetKind;
  /** Camera scale at the moment of pointer-down. */
  scale: number;
  /** The object under the pointer, when there is one. */
  objectId?: string;
  /** A locked object rejects manipulation but can still be selected. */
  locked?: boolean;
  /**
   * M26-S §2 — at least one pointer is inside the SELECTED object's transform region
   * (`transformRegionFor`). Only meaningful when `pointerCount >= 2`.
   */
  onSelectedTransformRegion?: boolean;
};

/**
 * Decide the owner. The order below IS the brief's priority list, top to bottom.
 *
 * Two fingers always win, wherever they land — a pinch that begins with one finger on a
 * sofa is still a pinch, and must never drag the sofa across the room.
 */
export function resolveGestureOwner(ctx: GestureContext): GestureOwner {
  if (ctx.pointerCount >= 2) {
    // M26-S §2 — two fingers on the SELECTED object transform it (Instagram-style);
    // two fingers anywhere else are always a camera pinch. Selection is what makes this
    // safe: M26A had to delete the old two-finger object gesture precisely because it
    // fired on any object under two fingers and silently rewrote geometry.
    return ctx.onSelectedTransformRegion && !ctx.locked ? "object-transform" : "camera-pinch";
  }

  switch (ctx.target) {
    case "resize-handle":
      return ctx.locked ? "none" : "object-resize";
    case "rotate-handle":
      return ctx.locked ? "none" : "object-rotate";
    case "selected-object":
    case "other-object":
      // ── M26-R P0 — ONE FINGER ON AN OBJECT MOVES THAT OBJECT. ──────────────
      //
      // These two cases are deliberately identical. M26A-final split them: an
      // already-selected object owned `object-move`, an unselected one owned `select`.
      // But the canvas arms `kind: "move"` for BOTH, and the move gate demands
      // `object-move` — so a drag on anything not already selected was gated out and the
      // object simply never moved. Tap-then-release-then-drag worked; the natural
      // press-and-drag did nothing. That is the founder-reported regression.
      //
      // The split also compared against `selectedId` from the PREVIOUS render, so even a
      // re-tap could evaluate stale. Two ways to get one decision wrong.
      //
      // Selection already happens at pointer-down (`selectAtPoint`), so by the time a move
      // is possible the object IS selected — the distinction bought nothing and cost the
      // core interaction. Behaviour over elegance.
      //
      // A locked object still selects, so it can be inspected and unlocked; it just never
      // moves.
      return ctx.locked ? "select" : "object-move";
    case "empty":
      // At 1× the room exactly fills the viewport, so there is nothing to pan to; the
      // gesture belongs to the page (scrolling a feed) or to deselection.
      return ctx.scale > 1.001 ? "camera-pan" : "none";
  }
}

/** True when this owner manipulates object geometry (and must block the camera). */
export function ownerMovesObject(o: GestureOwner): boolean {
  return o === "object-move" || o === "object-transform" || o === "object-resize" || o === "object-rotate";
}

/** True when this owner moves the camera (and must not touch geometry). */
export function ownerMovesCamera(o: GestureOwner): boolean {
  return o === "camera-pinch" || o === "camera-pan";
}

/**
 * A gesture already in flight, with its owner locked.
 *
 * `upgrade` exists for the ONE legitimate transition: a second finger arriving turns any
 * single-finger gesture into a pinch. That is not the camera stealing a drag — it is the
 * creator explicitly asking to zoom, and the object is left exactly where it was.
 */
export type ActiveGesture = { owner: GestureOwner; objectId?: string; pointerId: number };

export function beginGesture(ctx: GestureContext, pointerId: number): ActiveGesture {
  return { owner: resolveGestureOwner(ctx), ...(ctx.objectId ? { objectId: ctx.objectId } : {}), pointerId };
}

/**
 * The owner after another pointer goes down. Only ever escalates to a pinch; it never
 * re-decides between object and camera, because that is the bug this module prevents.
 */
export function upgradeGesture(active: ActiveGesture, pointerCount: number, onSelectedTransformRegion = false): ActiveGesture {
  if (pointerCount < 2) return active;
  // A second finger arriving on the object the creator is already holding is a transform,
  // not a camera pinch — that is the sticker gesture. Anywhere else, the camera takes it
  // and the object is abandoned exactly where it is.
  const movingSelected = active.owner === "object-move" || active.owner === "object-transform";
  return { ...active, owner: movingSelected && onSelectedTransformRegion ? "object-transform" : "camera-pinch" };
}

/**
 * Whether a MOVE event should be handled by this owner. The whole point: the answer
 * depends only on what was decided at pointer-down.
 */
export function gestureAllows(active: ActiveGesture | null, want: GestureOwner): boolean {
  return active?.owner === want;
}

/**
 * Classify a DOM target into a `GestureTargetKind`.
 *
 * Kept here (rather than inline in the canvas) so the priority order and the data
 * attributes that encode it stay in one place. The caller supplies a `closest` lookup so
 * this module needs no DOM types.
 */
export function classifyTarget(
  closest: (selector: string) => { id?: string; locked?: boolean } | null,
  selectedId: string | undefined,
): { target: GestureTargetKind; objectId?: string; locked?: boolean } {
  // Handles first: they are rendered OUTSIDE the object's own element (they must be, so
  // they can sit in screen space), which is exactly why a target test that only looked for
  // the object element sent handle drags to the camera.
  if (closest("[data-resize-handle]")) return { target: "resize-handle" };
  if (closest("[data-rotate-handle]")) return { target: "rotate-handle" };

  const obj = closest("[data-editor-object]");
  if (!obj?.id) return { target: "empty" };
  return {
    target: obj.id === selectedId ? "selected-object" : "other-object",
    objectId: obj.id,
    ...(obj.locked ? { locked: true } : {}),
  };
}

// ── M26-S §2 — the two-finger object transform ───────────────────────────────
//
// The natural sticker gesture from Instagram/Telegram: put two fingers on the selected
// object and it scales and rotates together, following the fingers directly. Resize handles
// remain as a precision/accessibility alternative, not the primary mobile interaction.
//
// M26A deleted the old two-finger object gesture because it fired on ANY object under two
// fingers — so pinching to look closer silently rewrote geometry. The distinction that
// makes it safe now is SELECTION: two fingers transform only the object the creator has
// explicitly selected. Two fingers anywhere else are still, always, a camera pinch.

/** A two-finger sample. Distances are in screen px; the angle is in degrees. */
export type PinchSample = { distance: number; angleDeg: number; midpoint: { x: number; y: number } };

export function pinchSample(a: { x: number; y: number }, b: { x: number; y: number }): PinchSample {
  return {
    distance: Math.hypot(a.x - b.x, a.y - b.y),
    angleDeg: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
    midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
  };
}

/**
 * The object transform implied by moving from `start` to `now`.
 *
 * Returned as RATIOS and DELTAS, never absolutes: the caller multiplies the object's
 * width-at-gesture-start by `scale` and adds `rotationDeg` to its rotation-at-start. That
 * keeps the whole gesture a pure function of its own beginning, so a dropped frame or a
 * re-render cannot make it drift.
 */
export function objectTransformFromPinch(
  start: PinchSample,
  now: PinchSample,
): { scale: number; rotationDeg: number; dx: number; dy: number } {
  return {
    // A degenerate start (both fingers on the same pixel) must not produce Infinity.
    scale: start.distance > 4 ? now.distance / start.distance : 1,
    rotationDeg: shortestAngleDelta(start.angleDeg, now.angleDeg),
    // Midpoint travel translates the object too, so a two-finger gesture can reposition as
    // well as resize — which is what makes it feel like holding the object rather than
    // operating a control.
    dx: now.midpoint.x - start.midpoint.x,
    dy: now.midpoint.y - start.midpoint.y,
  };
}

/** Degrees from `a` to `b`, wrapped to (-180, 180] so crossing ±180° never spins. */
export function shortestAngleDelta(a: number, b: number): number {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/**
 * The touch region a SELECTED object claims for a two-finger transform.
 *
 * A 10px book on a phone cannot receive two fingers inside its own bounds — asking for that
 * would make the gesture unusable on exactly the objects that need it most. The selected
 * object therefore claims a generous region around itself: at least `minPx` across, grown
 * from its visible box.
 *
 * Only the SELECTED object gets this. Unselected objects keep their real bounds, so the
 * region cannot swallow a pinch the creator meant for the room.
 */
export function transformRegionFor(
  rect: { left: number; top: number; width: number; height: number },
  minPx = 90,
): { left: number; top: number; width: number; height: number } {
  const w = Math.max(rect.width, minPx);
  const h = Math.max(rect.height, minPx);
  return {
    left: rect.left + rect.width / 2 - w / 2,
    top: rect.top + rect.height / 2 - h / 2,
    width: w,
    height: h,
  };
}

/** Whether a point falls inside a region. */
export function regionContains(r: { left: number; top: number; width: number; height: number }, p: { x: number; y: number }): boolean {
  return p.x >= r.left && p.x <= r.left + r.width && p.y >= r.top && p.y <= r.top + r.height;
}

/**
 * Two fingers are down. Do they belong to the selected object, or to the camera?
 *
 * The rule: if EITHER finger is inside the selected object's transform region, the object
 * owns it. Requiring both would fail the small-object case the region exists to solve —
 * one finger anchors on the book, the other spreads into open room.
 */
export function twoFingerOwner(
  a: { x: number; y: number },
  b: { x: number; y: number },
  selectedRegion: { left: number; top: number; width: number; height: number } | null,
): "object-transform" | "camera-pinch" {
  if (!selectedRegion) return "camera-pinch";
  return regionContains(selectedRegion, a) || regionContains(selectedRegion, b) ? "object-transform" : "camera-pinch";
}
