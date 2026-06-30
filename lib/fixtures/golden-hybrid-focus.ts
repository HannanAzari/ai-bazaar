// ── Golden Hybrid Focus — M7C.1 proof fixtures ──────────────────────────────
//
// The proof targets for the hybrid Focus system: **Zoom Region** (enlarge a crop of the
// existing scene) and **Detail Surface** (a separately authored close-up). Built
// ENTIRELY from existing approved assets — no new artwork.
//
// HONEST FIXTURE SHAPE (see docs/nest-hybrid-focus-v1.md). The current Main Golden
// Living Nest contains a media wall, a frame, a sofa, a coffee table, a lamp, a plant
// and an avatar — but **no bookshelf and no desk**. Per the sprint's own rule (a trigger
// must sit over a present object; test #28), the fixtures split into TWO coherent mains:
//
//   • goldenLivingNestHybrid()  — the real Golden Living Nest with a TV Console Zoom
//                                 and a Frame Zoom over their REAL objects. Never links
//                                 to an absent desk/bookshelf.
//   • studioNestHybrid()        — an example Workspace Nest that genuinely contains the
//                                 parked bookshelf + desk, hosting a Bookshelf Zoom and a
//                                 (tight tabletop) Desk Detail Surface over real objects.
//
// Between them every M7C.1 prototype — Bookshelf Zoom, TV Zoom, Frame Zoom, Desk Detail
// Surface, plus a Zoom-Region child object — is demonstrated against a legitimate trigger.

import { createEditorDocumentFromTemplate } from "@/lib/nest-editor";
import {
  GOLDEN_LIVING_NEST_COMPOSED,
  GOLDEN_LIVING_NEST_TEMPLATE,
} from "@/lib/fixtures/golden-living-nest";
import type { EditableNestDocument, EditableNestObject } from "@/lib/nest-editor-types";
import { predefinedHotspotsForInstance } from "@/lib/nest-hotspot-catalog";
import type { NestAssetHotspot } from "@/lib/nest-hotspot-types";
import type { NestDetailScene, NestFocusArea } from "@/lib/nest-focus-types";

const T = "2026-06-30T00:00:00.000Z";

// Stable ids.
export const GOLDEN_TV_ZOOM_AREA_ID = "zoom-tv";
export const GOLDEN_FRAME_ZOOM_AREA_ID = "zoom-frame";
export const STUDIO_NEST_ID = "studio-nest-hybrid";
export const STUDIO_BOOKSHELF_ZOOM_AREA_ID = "zoom-bookshelf";
export const STUDIO_DESK_FOCUS_AREA_ID = "focus-desk-surface";
export const STUDIO_DESK_SURFACE_ID = "detail-desk-surface";

// ── TV Console Zoom (Golden Living Nest) ───────────────────────────────────────
//
// Crops the media wall (slot-media ≈ {0.259,0.422,0.482,0.233}) with enough surrounding
// context that the visitor still reads "living room". The TV's own screen hotspot carries
// through the zoom (it lives on the object), so no child hotspots are invented.
export function goldenTvZoomArea(mainSceneId: string): NestFocusArea {
  return {
    id: GOLDEN_TV_ZOOM_AREA_ID,
    name: "TV & media",
    sourceSceneId: mainSceneId,
    targetSceneId: "",
    targetType: "zoom_region",
    // Trigger (M7C.2): tight to the TV + LEFT console, clear of the avatar (x≥0.575,
    // foreground) and the side plant (x≥0.73) so the Focus Area owns the tap cleanly.
    bounds: { x: 0.26, y: 0.41, width: 0.3, height: 0.23 },
    // V1 (M7C.4): one fixed-ratio (normalized-square = 3:4 on screen) rectangle. TV +
    // console + modest context; right edge ≈0.595 keeps the avatar body (≥0.62) + plant out.
    focusBounds: { x: 0.135, y: 0.31, width: 0.46, height: 0.46 },
    shape: "rect",
    trigger: "tap",
    transition: "smooth_zoom",
    zoomRegion: {
      // Creator-authored crop (M7C.3): ~square normalized aspect so it COVERS the 3:4
      // focused frame without clipping the TV horizontally. Includes the TV + console +
      // modest wall/floor context; ends left of the avatar body (≈0.62) and the plant.
      cropBounds: { x: 0.135, y: 0.3, width: 0.44, height: 0.44 },
      cropSource: "creator_authored",
      maxScale: 3,
      resolutionStrategy: "reuse_source",
      imageSources: { standardUrl: GOLDEN_LIVING_NEST_TEMPLATE.backgroundImageUrl },
    },
    enabled: true,
    previewHint: "Explore media setup",
    ariaLabel: "Explore the TV and media console",
  };
}

// ── Frame Zoom (Golden Living Nest) ────────────────────────────────────────────
//
// A small wall object becoming a larger interaction surface. Tests the upper limit of
// the current image resolution; the frame's photo→gallery hotspot carries through.
export function goldenFrameZoomArea(mainSceneId: string): NestFocusArea {
  return {
    id: GOLDEN_FRAME_ZOOM_AREA_ID,
    name: "Framed photo",
    sourceSceneId: mainSceneId,
    targetSceneId: "",
    targetType: "zoom_region",
    // Trigger: tight around the wall frame (slot ≈ {0.18,0.15,0.157,0.1135}) with touch
    // padding. Crop (M7C.2): tightened from the old wall-heavy {0.08,0.06,0.36,0.32} to a
    // frame-centred crop with only modest wall context (matches recommendCrop(frame)).
    bounds: { x: 0.15, y: 0.12, width: 0.23, height: 0.18 },
    // V1 fixed-ratio rectangle centred on the frame — full frame, limited wall, no TV.
    focusBounds: { x: 0.11, y: 0.06, width: 0.3, height: 0.3 },
    shape: "rect",
    trigger: "tap",
    transition: "smooth_zoom",
    zoomRegion: {
      // Creator-authored crop (M7C.3): a ~square crop centred on the frame so it fills
      // the 3:4 focused frame with the picture as the hero and only modest wall context.
      cropBounds: { x: 0.13, y: 0.08, width: 0.26, height: 0.26 },
      cropSource: "creator_authored",
      maxScale: 4,
      resolutionStrategy: "reuse_source",
      imageSources: { standardUrl: GOLDEN_LIVING_NEST_TEMPLATE.backgroundImageUrl },
    },
    enabled: true,
    previewHint: "Explore photo",
    ariaLabel: "Explore the framed photo",
  };
}

/**
 * The Main Golden Living Nest with the TV + Frame Zoom Regions. No detail scenes and no
 * trigger over an absent object — this is the honest visitor-facing hybrid proof.
 */
export function goldenLivingNestHybrid(): EditableNestDocument {
  const base = createEditorDocumentFromTemplate({ template: GOLDEN_LIVING_NEST_TEMPLATE, composed: GOLDEN_LIVING_NEST_COMPOSED });
  const mainId = base.id;
  return {
    ...base,
    focusAreas: [goldenTvZoomArea(mainId), goldenFrameZoomArea(mainId)],
    detailScenes: [],
  };
}

// ── Studio (Workspace) Nest — contains a real bookshelf + desk ─────────────────

/** The workspace objects: a tall bookshelf (left) + a writing desk (centre-right). */
function studioObjects(): EditableNestObject[] {
  return [
    {
      instanceId: "bookshelf-1",
      assetId: "ast-bookshelf",
      x: 0.06,
      y: 0.16,
      width: 0.3,
      height: 0.68,
      anchor: { x: 0.21, y: 0.84 },
      plane: "floor",
      zIndex: 2,
      contactShadow: true,
      // Ships upper/middle/lower shelf hotspots — they carry through the zoom.
      hotspots: predefinedHotspotsForInstance("ast-bookshelf", "bookshelf-1").map((h) =>
        h.name === "Middle shelf"
          ? { ...h, binding: { type: "gallery" as const, url: "https://example.com/creator/gallery", label: "On the shelf" } }
          : { ...h, binding: { type: "article" as const, url: "https://example.com/creator/reading", label: "Reading list" } },
      ),
    },
    {
      instanceId: "desk-1",
      assetId: "ast-desk",
      x: 0.42,
      y: 0.5,
      width: 0.5,
      height: 0.34,
      anchor: { x: 0.67, y: 0.84 },
      plane: "floor",
      zIndex: 3,
      contactShadow: true,
      hotspots: deskHotspots("desk-1"),
    },
  ];
}

/** The desk's calibrated hotspots, bound to real safe links + a disabled mic placeholder. */
function deskHotspots(instanceId: string): NestAssetHotspot[] {
  const predefined = predefinedHotspotsForInstance("ast-desk", instanceId).map((h) => {
    if (h.name === "Laptop") return { ...h, binding: { type: "website" as const, url: "https://example.com/creator", label: "My website" } };
    if (h.name === "Notebook") return { ...h, binding: { type: "article" as const, url: "https://example.com/creator/notes", label: "Field notes" } };
    return h; // Desk lamp → ambience (internal action)
  });
  const mic: NestAssetHotspot = {
    id: `${instanceId}-mic`,
    name: "Microphone (coming soon)",
    semantic: "podcast",
    shape: { type: "rect", x: 0.29, y: 0.16, width: 0.11, height: 0.16 },
    enabled: false,
    authoringMode: "custom",
    ariaLabel: "Microphone — podcast coming soon",
    notes: "Reserved podcast region — not yet available; no microphone art is invented.",
  };
  return [...predefined, mic];
}

// ── Bookshelf Zoom (Studio) ────────────────────────────────────────────────────
//
// True crop zoom over the bookshelf object. The object's shelf hotspots carry through;
// a SEPARATE child book object (crop-local) demonstrates Zoom-Region child objects
// (Phase 9) — inactive in the main view, active once focused.
export function studioBookshelfZoomArea(mainSceneId: string): NestFocusArea {
  const childBook: EditableNestObject = {
    instanceId: "shelf-book-1",
    assetId: "ast-stacked-books",
    // Crop-LOCAL coordinates (0..1 inside the crop): a small stack on the middle shelf.
    x: 0.46,
    y: 0.52,
    width: 0.16,
    height: 0.1,
    anchor: { x: 0.54, y: 0.62 },
    plane: "floor",
    zIndex: 9,
    contactShadow: false,
    hotspots: predefinedHotspotsForInstance("ast-stacked-books", "shelf-book-1").map((h) => ({
      ...h,
      binding: { type: "article" as const, url: "https://example.com/creator/featured", label: "Featured read" },
    })),
  };
  return {
    id: STUDIO_BOOKSHELF_ZOOM_AREA_ID,
    name: "Bookshelf",
    sourceSceneId: mainSceneId,
    targetSceneId: "",
    targetType: "zoom_region",
    bounds: { x: 0.04, y: 0.16, width: 0.34, height: 0.68 },
    // V1 fixed-ratio rectangle over the bookshelf; right edge 0.40 < desk (0.42) excludes
    // the desk. Shows the upper/middle shelf section (a tall narrow shelf can't fully fit a
    // 3:4 square without including the desk — documented).
    focusBounds: { x: 0.0, y: 0.22, width: 0.4, height: 0.4 },
    shape: "rect",
    trigger: "tap",
    transition: "smooth_zoom",
    zoomRegion: {
      // Creator-authored crop (M7C.3): the bookshelf column, kept LEFT of the desk
      // (desk starts x≈0.42) so no unrelated desk content is included. Tall to support
      // the upper/middle/lower shelves.
      cropBounds: { x: 0.01, y: 0.12, width: 0.4, height: 0.78 },
      cropSource: "creator_authored",
      maxScale: 2.5,
      resolutionStrategy: "reuse_source",
      imageSources: { standardUrl: GOLDEN_LIVING_NEST_TEMPLATE.backgroundImageUrl },
      childObjects: [childBook],
    },
    enabled: true,
    previewHint: "Explore bookshelf",
    ariaLabel: "Zoom into the bookshelf",
  };
}

// ── Desk Detail Surface (Studio) — PROVISIONAL (M7C.2 Phase 9) ─────────────────
//
// ⚠️ PROVISIONAL / internal only. A focused close-up built from the existing desk + books
// + frame assets — structurally useful but NOT the final composition. It is only linked
// from the Studio Nest, where a desk is visibly present; it is never linked from the
// Living Nest. The FINAL Desk Surface requires a dedicated approved scene background
// (20–30° downward angle, desktop filling the viewport, minimal wall, no full-room floor;
// slots for laptop/notebook/phone/lamp/mic/cup) — see docs/nest-hybrid-focus-v1.md. That
// background is NOT generated here, and the surface is deliberately NOT "fixed" by further
// cropping the current room. The desk fills most of the viewport so little wall shows.
export function studioDeskSurface(parentSceneId: string, parentFocusAreaId: string): NestDetailScene {
  const objects: EditableNestObject[] = [
    {
      // The writing desk — enlarged to fill the close-up (≈90% width, anchored low).
      instanceId: "surface-desk-1",
      assetId: "ast-desk",
      x: 0.05,
      y: 0.34,
      width: 0.9,
      height: 0.56,
      anchor: { x: 0.5, y: 0.9 },
      plane: "floor",
      zIndex: 2,
      contactShadow: true,
      hotspots: deskHotspots("surface-desk-1"),
    },
    {
      // A framed photo standing low on the desk (not high on an empty wall) → gallery.
      instanceId: "surface-frame-1",
      assetId: "ast-framed-photo",
      x: 0.66,
      y: 0.2,
      width: 0.2,
      height: 0.145,
      anchor: { x: 0.76, y: 0.345 },
      plane: "front_wall",
      zIndex: 1,
      contactShadow: false,
      hotspots: predefinedHotspotsForInstance("ast-framed-photo", "surface-frame-1").map((h) => ({
        ...h,
        binding: { type: "gallery" as const, url: "https://example.com/creator/gallery", label: "Recent work" },
      })),
    },
    {
      // Stacked books resting on the desk → article.
      instanceId: "surface-books-1",
      assetId: "ast-stacked-books",
      x: 0.12,
      y: 0.34,
      width: 0.16,
      height: 0.1,
      anchor: { x: 0.2, y: 0.44 },
      plane: "floor",
      zIndex: 3,
      contactShadow: false,
      hotspots: predefinedHotspotsForInstance("ast-stacked-books", "surface-books-1").map((h) => ({
        ...h,
        binding: { type: "article" as const, url: "https://example.com/creator/reading", label: "Reading list" },
      })),
    },
  ];

  return {
    id: STUDIO_DESK_SURFACE_ID,
    name: "Desk",
    kind: "detail",
    parentSceneId,
    parentFocusAreaId,
    backgroundImageUrl: GOLDEN_LIVING_NEST_TEMPLATE.backgroundImageUrl,
    viewport: { aspectRatio: "3:4", contentScale: 1 },
    objects,
    ambiencePresetId: "warm_day",
    createdAt: T,
    updatedAt: T,
  };
}

/** The Desk Focus Area (detail_surface) over the REAL desk object in the studio. */
export function studioDeskFocusArea(mainSceneId: string): NestFocusArea {
  return {
    id: STUDIO_DESK_FOCUS_AREA_ID,
    name: "Desk",
    sourceSceneId: mainSceneId,
    targetSceneId: STUDIO_DESK_SURFACE_ID,
    targetType: "detail_surface",
    detailSurfaceId: STUDIO_DESK_SURFACE_ID,
    // Over the desk object (x0.42,y0.5,w0.5,h0.34).
    bounds: { x: 0.42, y: 0.5, width: 0.5, height: 0.34 },
    // V1 fixed-ratio tap rectangle over the desk (detail surfaces remain separate arch).
    focusBounds: { x: 0.47, y: 0.47, width: 0.4, height: 0.4 },
    shape: "rect",
    trigger: "tap",
    transition: "fade_zoom",
    enabled: true,
    previewHint: "Explore desk",
    ariaLabel: "Open the desk workspace surface",
  };
}

/**
 * The example Studio (Workspace) Nest: a real bookshelf + desk, with a Bookshelf Zoom
 * Region and a Desk Detail Surface — every trigger over a present object.
 */
export function studioNestHybrid(): EditableNestDocument {
  const base = createEditorDocumentFromTemplate({ template: GOLDEN_LIVING_NEST_TEMPLATE, composed: GOLDEN_LIVING_NEST_COMPOSED });
  const mainId = STUDIO_NEST_ID;
  return {
    ...base,
    id: mainId,
    name: "Studio Workspace Nest",
    objects: studioObjects(),
    focusAreas: [studioBookshelfZoomArea(mainId), studioDeskFocusArea(mainId)],
    detailScenes: [studioDeskSurface(mainId, STUDIO_DESK_FOCUS_AREA_ID)],
  };
}
