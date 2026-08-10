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
export type GestureOwner = "camera-pinch" | "camera-pan" | "object-move" | "object-resize" | "object-rotate" | "select" | "none";

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
};

/**
 * Decide the owner. The order below IS the brief's priority list, top to bottom.
 *
 * Two fingers always win, wherever they land — a pinch that begins with one finger on a
 * sofa is still a pinch, and must never drag the sofa across the room.
 */
export function resolveGestureOwner(ctx: GestureContext): GestureOwner {
  if (ctx.pointerCount >= 2) return "camera-pinch";

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
  return o === "object-move" || o === "object-resize" || o === "object-rotate";
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
export function upgradeGesture(active: ActiveGesture, pointerCount: number): ActiveGesture {
  if (pointerCount >= 2) return { ...active, owner: "camera-pinch" };
  return active;
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
