// ── M25 — the benchmark Nest ─────────────────────────────────────────────────
//
// The deterministic test Nest the sprint specifies, as data rather than a click-path:
// interactive objects, a non-interactive one, TINY objects to prove free zoom, overlapping
// assets, an image sticker and a text overlay.
//
// It uses REAL catalogue asset ids and REAL surface definitions, so what it proves is what
// a creator gets. Where the brief names an asset the library does not have (speaker,
// console, curtain, standalone laptop) the capability is declared and unit-tested in
// `lib/nest-asset-interaction.ts` but CANNOT appear here — there is no art. Putting a
// placeholder box in the benchmark and calling it a speaker would be the kind of claim
// this project has spent five sprints removing.

import { NEST_SCENE_VERSION, type NestDocument } from "@/lib/nest-document-types";

export const BENCHMARK_VIDEO_URL = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";
export const BENCHMARK_SITE_URL = "https://nestudio.example.com/portfolio";

/** A 1×1 warm PNG. Inline, so the fixture needs no network and no fixture file. */
const TINY_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export const INTERACTIVE_TEST_NEST: NestDocument = {
  id: "nest-m25",
  backgroundId: "bg-creator-loft",
  title: "Interaction benchmark",
  visibility: "public",
  createdAt: "2026-08-05T00:00:00.000Z",
  updatedAt: "2026-08-05T00:00:00.000Z",
  placements: [
    // ── scenery ──────────────────────────────────────────────────────────────
    { id: "sofa", assetId: "ast-lr-sofa-boucle", x: 0.04, y: 0.58, w: 0.44, h: 0.21, zIndex: 2, interaction: { plane: "floor", contactShadow: true } },
    // Overlapping the sofa on purpose: the tap resolver must pick the higher z-index.
    { id: "table", assetId: "ast-lr-table-oak-round", x: 0.3, y: 0.66, w: 0.26, h: 0.14, zIndex: 5, interaction: { plane: "floor", contactShadow: true } },
    { id: "shelf", assetId: "ast-bookshelf", x: 0.66, y: 0.3, w: 0.28, h: 0.42, zIndex: 3, interaction: { plane: "floor", contactShadow: true } },

    // ── a NON-interactive object: it must simply do nothing when tapped ──────
    { id: "plant", assetId: "ast-potted-plant", x: 0.03, y: 0.46, w: 0.13, h: 0.2, zIndex: 4, interaction: { plane: "floor" } },

    // ── TV: off → on, screen carries a YouTube connection ────────────────────
    {
      id: "tv",
      assetId: "ast-tv",
      x: 0.28, y: 0.24, w: 0.34, h: 0.19,
      zIndex: 6,
      interaction: {
        plane: "floor",
        asset: {
          initialState: "off",
          connection: { kind: "youtube", url: BENCHMARK_VIDEO_URL, thumbnailUrl: TINY_IMAGE, label: "the film" },
        },
      },
    },

    // ── Lamp: pure local light, no link ──────────────────────────────────────
    {
      id: "lamp",
      assetId: "ast-floor-lamp",
      x: 0.52, y: 0.4, w: 0.13, h: 0.32,
      zIndex: 7,
      interaction: { plane: "floor", contactShadow: true, asset: { initialState: "off" } },
    },

    // ── Desk + laptop: closed → open, opens a website ────────────────────────
    {
      id: "desk",
      assetId: "ast-desk",
      x: 0.02, y: 0.28, w: 0.26, h: 0.18,
      zIndex: 6,
      interaction: {
        plane: "floor",
        asset: {
          initialState: "closed",
          connection: { kind: "website", url: BENCHMARK_SITE_URL, thumbnailUrl: TINY_IMAGE, label: "my portfolio" },
        },
      },
    },

    // ── TINY books on the shelf. ~2% of the room wide — the free-zoom case. ──
    // At 1× on a 375px phone these are ~8px. They must still be tappable (the invisible
    // minimum touch target) and must stay sharp and correctly placed at 5×.
    {
      id: "book-a",
      assetId: "ast-stacked-books",
      x: 0.695, y: 0.365, w: 0.035, h: 0.024,
      zIndex: 8,
      interaction: { asset: { initialState: "closed", connection: { kind: "website", url: "https://example.com/diary", label: "my diary" } } },
    },
    { id: "book-b", assetId: "ast-stacked-books", x: 0.742, y: 0.365, w: 0.03, h: 0.022, zIndex: 8, interaction: {} },

    // ── A tiny object somewhere unusual: a framed photo high on the wall ─────
    {
      id: "tiny-frame",
      assetId: "ast-framed-photo",
      x: 0.17, y: 0.12, w: 0.045, h: 0.045,
      zIndex: 9,
      interaction: {
        plane: "front_wall",
        asset: { initialState: "shown", connection: { kind: "image", url: TINY_IMAGE, thumbnailUrl: TINY_IMAGE, label: "a photo" } },
      },
    },

    // ── Creator overlays ─────────────────────────────────────────────────────
    { id: "sticker", assetId: "overlay:image", x: 0.06, y: 0.06, w: 0.1, h: 0.1, zIndex: 10, overlay: { kind: "image", src: TINY_IMAGE }, interaction: { plane: "foreground" } },
    { id: "caption", assetId: "overlay:text", x: 0.34, y: 0.86, w: 0.34, h: 0.06, zIndex: 10, overlay: { kind: "text", text: "welcome in" }, interaction: { plane: "foreground" } },
  ],
  // No focus regions: M25 §P7 — a new Nest never needs one. Legacy playback is covered by
  // `LEGACY_FOCUS_NEST` below.
  scene: { version: NEST_SCENE_VERSION },
};

/**
 * A pre-M25 Nest with a Focus region, kept so the compatibility path stays tested.
 * Existing published Nests look like this and must keep opening and playing.
 */
export const LEGACY_FOCUS_NEST: NestDocument = {
  id: "nest-legacy",
  backgroundId: "bg-creator-loft",
  title: "Legacy Focus Nest",
  visibility: "public",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  placements: [{ id: "shelf", assetId: "ast-bookshelf", x: 0.62, y: 0.34, w: 0.3, h: 0.4, zIndex: 2 }],
  scene: {
    version: NEST_SCENE_VERSION,
    focusAreas: [
      {
        id: "focus-1",
        name: "The shelf",
        sourceSceneId: "nest-legacy",
        targetSceneId: "scene-shelf",
        childSceneId: "scene-shelf",
        bounds: { x: 0.6, y: 0.32, width: 0.34, height: 0.34 },
        focusBounds: { x: 0.6, y: 0.32, width: 0.34, height: 0.34 },
        shape: "rect",
        trigger: "tap",
        transition: "fade_zoom",
        enabled: true,
      },
    ],
    detailScenes: [
      {
        id: "scene-shelf",
        name: "The shelf",
        kind: "detail",
        sceneType: "focus",
        parentSceneId: "nest-legacy",
        parentFocusAreaId: "focus-1",
        viewport: { aspectRatio: "3:4" },
        objects: [
          {
            instanceId: "legacy-book",
            assetId: "ast-stacked-books",
            x: 0.3, y: 0.42, width: 0.22, height: 0.16,
            anchor: { x: 0.41, y: 0.58 },
            plane: "floor",
            zIndex: 1,
          },
        ],
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    ],
  },
};
