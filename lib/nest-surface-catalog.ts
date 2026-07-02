// ── Nestudio V2 — predefined surface catalog (M8, Phase 3) ──────────────────
//
// WHERE each asset's editable surfaces live (asset-local 0..1 within the object box). No
// artwork is generated here — only metadata describing the region. Bounds are aligned to
// the existing art: the TV surface = the same `screenRect` the renderer already uses; the
// frame surface = the photo aperture inside the moulding; etc. Assets not listed here have
// no editable surface (backward-compatible).
//
// NOTE: pinboard / poster / laptop-as-standalone artwork does not ship in the V1 asset set.
// Their catalog entries (`ast-pinboard`) are defined so they render the moment such art
// lands; today the Laptop surface is provided on the desk's laptop region (`ast-desk`).

import type { EditableSurfaceDef } from "@/lib/nest-surface-types";

export const SURFACE_CATALOG: Record<string, EditableSurfaceDef[]> = {
  // TV screen — the same normalized screen rect the renderer lights up.
  "ast-tv": [
    { id: "tv-screen", name: "TV screen", type: "image", bounds: { x: 0.2, y: 0.11, width: 0.6, height: 0.48 }, acceptedContentTypes: ["uploaded_image", "url_thumbnail"], cornerRadiusPx: 4 },
  ],
  // Framed photo — the photo aperture inside the frame moulding. Accepts a photo, OR a
  // short text (a framed quote/goal), OR a sticker.
  "ast-framed-photo": [
    { id: "frame-photo", name: "Photo", type: "image", bounds: { x: 0.18, y: 0.18, width: 0.64, height: 0.64 }, acceptedContentTypes: ["uploaded_image", "url_thumbnail", "text", "emoji"], cornerRadiusPx: 2 },
  ],
  // Book cover — the visible face of the stacked books.
  "ast-stacked-books": [
    { id: "book-cover", name: "Book cover", type: "image", bounds: { x: 0.14, y: 0.16, width: 0.72, height: 0.66 }, acceptedContentTypes: ["uploaded_image", "text"], cornerRadiusPx: 2 },
  ],
  // Laptop screen — the desk cut-out's laptop region.
  "ast-desk": [
    { id: "laptop-screen", name: "Laptop screen", type: "image", bounds: { x: 0.42, y: 0.29, width: 0.18, height: 0.14 }, acceptedContentTypes: ["uploaded_image", "url_thumbnail"], cornerRadiusPx: 2 },
  ],
  // Pinboard — a board accepting notes / stickers / images. Catalog-ready for when the
  // pinboard cut-out ships; no art in V1 so it does not render yet.
  "ast-pinboard": [
    { id: "pinboard-board", name: "Board", type: "collage", bounds: { x: 0.08, y: 0.08, width: 0.84, height: 0.84 }, acceptedContentTypes: ["text", "emoji", "uploaded_image", "sticker_asset"], cornerRadiusPx: 6 },
  ],
};

// M13 (Task 4A): runtime-registered surfaces. Production assets declare their own
// editable surfaces (`ProductionAsset.editableSurfaces`); the editor bridge converts +
// registers them here so `predefinedSurfacesForAsset` resolves surfaces for curated
// assets that aren't in the static SURFACE_CATALOG. The static catalog always wins.
const RUNTIME_SURFACES: Record<string, EditableSurfaceDef[]> = {};

/** Register an asset type's editable surfaces at runtime (idempotent per id). No-op for empty. */
export function registerAssetSurfaces(assetId: string, defs: EditableSurfaceDef[]): void {
  if (defs.length) RUNTIME_SURFACES[assetId] = defs;
}

/** The predefined surface definitions for an asset type (static catalog first). */
export function predefinedSurfacesForAsset(assetId: string): EditableSurfaceDef[] {
  return SURFACE_CATALOG[assetId] ?? RUNTIME_SURFACES[assetId] ?? [];
}

/** Whether an asset type declares any editable surface (static or runtime-registered). */
export function assetHasSurfaces(assetId: string): boolean {
  return predefinedSurfacesForAsset(assetId).length > 0;
}
