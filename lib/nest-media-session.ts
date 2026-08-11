// ── M27B-3A1 — which photo a visitor is looking at ───────────────────────────
//
// SESSION state, never document state. A visitor swiping a frame is a fact about their
// visit; the creator's `contents[]` order and their chosen starting item are the facts
// about the Nest (D-34). Nothing here is ever written to Supabase.
//
// ── WHAT THIS MODULE DELIBERATELY DOES NOT DO ────────────────────────────────
//
// The abandoned M27B-3A attempt put a phase machine here that mapped every object onto
// `off` / `on`. That was wrong and would have shipped a visible bug: a Framed Photo's
// catalogue state is `shown`, so setting it to `"on"` would make `visualStateOf` return
// undefined, `showsScreen` false, and THE FRAME WOULD GO BLANK the moment anyone tapped it.
//
// The lesson is that two different things were being conflated:
//
//     asset visual state — what the OBJECT looks like (`shown`, `off`, `on`, `closed`…),
//                          owned by the catalogue, different per asset;
//     content index      — WHICH of the creator's items is on display, owned by the
//                          session, identical for every asset.
//
// This module owns only the second. It never names a visual state, so it cannot invent one
// an asset does not have.
//
// Pure: no React, no DOM.

/**
 * The next item in a list, wrapping at both ends.
 *
 * Wraparound is deliberate: with three photos in a frame, a swipe that does nothing at the
 * end reads as broken at exactly the moment a visitor is exploring.
 */
export function nextContentIndex(current: number, count: number, direction: 1 | -1): number {
  if (count <= 1) return 0;
  const i = Number.isFinite(current) ? Math.trunc(current) : 0;
  return (((i + direction) % count) + count) % count;
}

/** How far a finger must travel across an aperture before it counts as a swipe. */
export const SWIPE_THRESHOLD_PX = 24;

/**
 * What a finger's travel means: `1` = next, `-1` = previous, `null` = not a swipe.
 *
 * Two conditions, both required:
 *
 *   • far enough — a tap that wobbles must not change the photo;
 *   • dominantly horizontal (`|dx| > |dy|`) — inside an aperture only a few dozen pixels
 *     tall, a diagonal drag is far more likely to be someone starting a vertical page
 *     gesture than a deliberate swipe, and guessing wrong would steal their scroll.
 *
 * Dragging LEFT reveals the NEXT item, as every photo viewer behaves.
 */
export function swipeIntent(dx: number, dy: number): 1 | -1 | null {
  if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) <= Math.abs(dy)) return null;
  return dx < 0 ? 1 : -1;
}

/** Keep a session index inside a list that may have shrunk since it was set. */
export function clampContentIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  const i = Number.isFinite(index) ? Math.trunc(index) : 0;
  return Math.min(Math.max(i, 0), count - 1);
}
