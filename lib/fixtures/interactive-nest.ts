// ── M24E — the deterministic interactive test Nest ───────────────────────────
//
// The fixture the sprint brief specifies, as data rather than as a click-path:
//
//   • one main scene
//   • one Focus region
//   • two books inside the focused scene
//   • one TV with an image assigned to its screen Surface
//   • a YouTube URL bound to the screen as its tap action
//
// It exists so Focus and Surface can be exercised end-to-end without first authoring a
// Nest by hand, and so a regression in either is reproducible in one place. It uses REAL
// catalogue asset ids and the real `tv-screen` surface definition, so what it proves is
// what a creator gets — not what a synthetic asset would do.
//
// Pure data. No React, no I/O.

import { NEST_SCENE_VERSION, type NestDocument } from "@/lib/nest-document-types";
import type { EditableNestObject } from "@/lib/nest-editor-types";
import type { NestAssetHotspot } from "@/lib/nest-hotspot-types";

/** A real, safe, well-known video — the tap action under test. */
export const INTERACTIVE_NEST_VIDEO_URL = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";

/** A 1×1 amber PNG. Tiny and inline, so the fixture needs no network and no fixture file. */
const SCREEN_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const tvScreenHotspot: NestAssetHotspot = {
  id: "tv-1-screen",
  name: "TV screen",
  semantic: "video",
  // Matches the `tv-screen` surface rectangle in SURFACE_CATALOG exactly, so the tap
  // target sits on the picture rather than beside it.
  shape: { type: "rect", x: 0.2, y: 0.11, width: 0.6, height: 0.48 },
  enabled: true,
  authoringMode: "predefined",
  ariaLabel: "TV screen — play video",
  binding: { type: "video", url: INTERACTIVE_NEST_VIDEO_URL, label: "the film" },
};

const book = (n: number, x: number): EditableNestObject => ({
  instanceId: `book-${n}`,
  assetId: "ast-stacked-books",
  x,
  y: 0.44,
  width: 0.22,
  height: 0.16,
  anchor: { x: x + 0.11, y: 0.6 },
  plane: "floor",
  zIndex: n,
});

/** The canonical published document — exactly what a visitor would be served. */
export const INTERACTIVE_TEST_NEST: NestDocument = {
  id: "nest-m24e",
  backgroundId: "bg-creator-loft",
  title: "Interaction test Nest",
  visibility: "public",
  createdAt: "2026-08-05T00:00:00.000Z",
  updatedAt: "2026-08-05T00:00:00.000Z",
  placements: [
    {
      id: "sofa-1",
      assetId: "ast-lr-sofa-boucle",
      x: 0.06, y: 0.56, w: 0.46, h: 0.22,
      zIndex: 1,
      interaction: { plane: "floor", contactShadow: true },
    },
    {
      id: "tv-1",
      assetId: "ast-tv",
      x: 0.3, y: 0.26, w: 0.44, h: 0.24,
      zIndex: 3,
      interaction: {
        plane: "floor",
        hotspots: [tvScreenHotspot],
        surfaces: { "tv-screen": { kind: "image", src: SCREEN_IMAGE, fit: "cover" } },
      },
    },
    {
      id: "shelf-1",
      assetId: "ast-bookshelf",
      x: 0.62, y: 0.34, w: 0.3, h: 0.4,
      zIndex: 2,
      interaction: { plane: "floor", contactShadow: true },
    },
  ],
  scene: {
    version: NEST_SCENE_VERSION,
    focusAreas: [
      {
        id: "focus-1",
        name: "The shelf",
        sourceSceneId: "nest-m24e",
        targetSceneId: "scene-shelf",
        childSceneId: "scene-shelf",
        // The single creator-authored rectangle: both the tap target and the camera crop.
        bounds: { x: 0.6, y: 0.32, width: 0.34, height: 0.34 },
        focusBounds: { x: 0.6, y: 0.32, width: 0.34, height: 0.34 },
        shape: "rect",
        trigger: "tap",
        transition: "fade_zoom",
        enabled: true,
        previewHint: "Explore the shelf",
      },
    ],
    detailScenes: [
      {
        id: "scene-shelf",
        name: "The shelf",
        kind: "detail",
        sceneType: "focus",
        backgroundSource: { type: "parent_crop", parentSceneId: "nest-m24e", focusBounds: { x: 0.6, y: 0.32, width: 0.34, height: 0.34 } },
        parentSceneId: "nest-m24e",
        parentFocusAreaId: "focus-1",
        viewport: { aspectRatio: "3:4" },
        // The two books. Their coordinates are in the FOCUSED view's own 0..1 space.
        objects: [book(1, 0.16), book(2, 0.54)],
        createdAt: "2026-08-05T00:00:00.000Z",
        updatedAt: "2026-08-05T00:00:00.000Z",
      },
    ],
  },
};
