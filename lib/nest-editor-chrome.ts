// ── M26-P §3 — where editor chrome goes, in SCREEN pixels ────────────────────
//
// The context toolbar must follow the selected object closely, flip to the other side when
// it would leave the viewport, and never scale with the camera. All of that is geometry, so
// it lives here as pure functions rather than as CSS guesses inside the component.
//
// Everything in this module is in VIEWPORT coordinates (CSS pixels, origin top-left).
// Nothing here ever sees a scene coordinate — that is the whole point: the toolbar used to
// be anchored to the object's scene box at a fixed offset, so a rotated object left it
// floating far away, and an object near an edge pushed it off the phone.

export type Rect = { left: number; top: number; width: number; height: number };
export type Size = { width: number; height: number };

/** The gap between the object's bounds and the toolbar (§3: 10–14px). */
export const TOOLBAR_GAP_PX = 12;
/** How close any chrome may come to the viewport edge. */
export const VIEWPORT_MARGIN_PX = 8;
/** Vertical room the rotate control occupies above the object, so the bar clears it. */
export const ROTATE_CLEARANCE_PX = 68;

/**
 * The axis-aligned bounding box of a rectangle rotated about its own centre.
 *
 * A rotated object is WIDER and TALLER than its box, and anchoring chrome to the unrotated
 * box is what let the toolbar overlap a tilted object. Rotation is in degrees, clockwise,
 * matching the CSS `rotate()` the object itself is drawn with.
 */
export function rotatedAabb(box: Rect, rotationDeg = 0): Rect {
  if (!rotationDeg) return box;
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const width = box.width * cos + box.height * sin;
  const height = box.width * sin + box.height * cos;
  return {
    left: box.left + box.width / 2 - width / 2,
    top: box.top + box.height / 2 - height / 2,
    width,
    height,
  };
}

/**
 * Where to put the toolbar for an object with these screen bounds.
 *
 * Above by preference, below when there is not enough room above, and always clamped
 * horizontally so it cannot leave the viewport. `hasRotateControl` reserves the space the
 * rotate handle occupies above the object, so the two never overlap — the collision that
 * previously let the handle swallow taps meant for Mirror.
 */
export function toolbarPlacement(
  bounds: Rect,
  bar: Size,
  viewport: Size,
  hasRotateControl = false,
): { left: number; top: number; side: "above" | "below" } {
  const clearance = hasRotateControl ? ROTATE_CLEARANCE_PX : 0;
  const above = bounds.top - clearance - TOOLBAR_GAP_PX - bar.height;
  const below = bounds.top + bounds.height + TOOLBAR_GAP_PX;

  // Prefer above; flip when that would clip the top of the screen AND below actually fits.
  const aboveFits = above >= VIEWPORT_MARGIN_PX;
  const belowFits = below + bar.height <= viewport.height - VIEWPORT_MARGIN_PX;
  const side: "above" | "below" = aboveFits || !belowFits ? "above" : "below";

  // Even the chosen side is clamped: an object taller than the screen has no good answer,
  // and a bar half off the top is worse than one slightly overlapping the object.
  const top = clamp(side === "above" ? above : below, VIEWPORT_MARGIN_PX, Math.max(VIEWPORT_MARGIN_PX, viewport.height - bar.height - VIEWPORT_MARGIN_PX));

  const centred = bounds.left + bounds.width / 2 - bar.width / 2;
  const left = clamp(centred, VIEWPORT_MARGIN_PX, Math.max(VIEWPORT_MARGIN_PX, viewport.width - bar.width - VIEWPORT_MARGIN_PX));

  return { left, top, side };
}

/**
 * M27 P0-A — where the rotation degree pill goes.
 *
 * The SAME derivation as the toolbar: the object's rotated screen bounds in, a clamped
 * viewport position out. There is deliberately no second implementation — the pill drifting
 * to the far-left edge came from it being positioned by different code with no clamp, so
 * "both rotation methods use the same positioning function" is enforced by there only being
 * one function to use.
 *
 * Sits just above the object, flipping below when that would clip the top of the screen.
 */
export function pillPlacement(bounds: Rect, pill: Size, viewport: Size): { left: number; top: number } {
  const above = bounds.top - TOOLBAR_GAP_PX - pill.height;
  const top = above >= VIEWPORT_MARGIN_PX ? above : bounds.top + bounds.height + TOOLBAR_GAP_PX;
  return {
    left: clamp(bounds.left + bounds.width / 2 - pill.width / 2, VIEWPORT_MARGIN_PX, Math.max(VIEWPORT_MARGIN_PX, viewport.width - pill.width - VIEWPORT_MARGIN_PX)),
    top: clamp(top, VIEWPORT_MARGIN_PX, Math.max(VIEWPORT_MARGIN_PX, viewport.height - pill.height - VIEWPORT_MARGIN_PX)),
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * The rotation readout shown while a rotate gesture is live (§2).
 *
 * Normalised to (-180, 180] so a creator sees `-32°` rather than `328°`, and rendered with
 * a true minus sign rather than a hyphen.
 */
export function rotationReadout(deg: number): string {
  let d = Math.round(deg) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return `${d < 0 ? "−" : ""}${Math.abs(d)}°`;
}
