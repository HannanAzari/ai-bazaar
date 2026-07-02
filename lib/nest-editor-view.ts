// ── Nestudio V2 — editor viewport (M7B.1) ───────────────────────────────────
//
// The editor canvas is height-driven and aspect-locked, so at the fit zoom the WHOLE
// 3:4 room (including the side-wall slivers) is visible without scrolling. This is the
// authoring viewport only — it never changes manifest coordinates, and is distinct
// from the future visitor Focus-Area / detail-scene zoom (not built here).

/** The zoom at which the full scene fits the editing viewport. */
export const FIT_ZOOM = 1;
export const MIN_ZOOM = 0.6;
export const MAX_ZOOM = 1.6;

/** The fit-view zoom — shows the complete room including side walls. */
export function computeFitZoom(): number {
  return FIT_ZOOM;
}

/** Whether the full scene is visible at a given zoom (≤ fit shows everything). */
export function viewShowsFullScene(zoom: number): boolean {
  return zoom <= FIT_ZOOM + 1e-9;
}

export function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +z.toFixed(2)));
}
