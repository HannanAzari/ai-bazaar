// ── Golden Desk Detail Scene — M7C proof fixture ────────────────────────────
//
// The proof target for M7C: a close-up desk/workspace Detail Scene reachable from a
// Focus Area on the Golden Living Nest, built entirely from EXISTING approved assets
// (no new artwork). The current `ast-desk` art is composite, so — per the sprint — the
// scene is an honest STRUCTURED composition: the writing desk (carrying its calibrated
// laptop / notebook / desk-lamp hotspots) plus an independent framed photo (→ gallery)
// and stacked books (→ article), with one clearly-marked UNAVAILABLE microphone region
// (no mic art is invented). It reuses the same warm background language but is a
// close-up workspace, not the whole room enlarged.
//
// Interactions demonstrated:
//   laptop → website · notebook → article · desk lamp → ambience · photo → gallery ·
//   books → article · microphone → podcast (disabled, "coming soon").

import {
  createEditorDocumentFromTemplate,
} from "@/lib/nest-editor";
import {
  GOLDEN_LIVING_NEST_COMPOSED,
  GOLDEN_LIVING_NEST_TEMPLATE,
} from "@/lib/fixtures/golden-living-nest";
import type { EditableNestDocument, EditableNestObject } from "@/lib/nest-editor-types";
import { predefinedHotspotsForInstance } from "@/lib/nest-hotspot-catalog";
import type { NestAssetHotspot } from "@/lib/nest-hotspot-types";
import type { NestDetailScene, NestFocusArea } from "@/lib/nest-focus-types";

const T = "2026-06-30T00:00:00.000Z";

export const GOLDEN_DESK_DETAIL_SCENE_ID = "detail-desk";
export const GOLDEN_DESK_FOCUS_AREA_ID = "focus-desk";

/** The desk's calibrated hotspots, bound to real safe links + the disabled mic placeholder. */
function deskHotspots(instanceId: string): NestAssetHotspot[] {
  const predefined = predefinedHotspotsForInstance("ast-desk", instanceId).map((h) => {
    if (h.name === "Laptop") return { ...h, binding: { type: "website" as const, url: "https://example.com/creator", label: "My website" } };
    if (h.name === "Notebook") return { ...h, binding: { type: "article" as const, url: "https://example.com/creator/notes", label: "Field notes" } };
    return h; // Desk lamp → ambience is an internal action (no link needed)
  });
  // One honest placeholder: a podcast/microphone region that is NOT yet available. It is
  // disabled and carries no invented art — only a clearly-marked region for the future.
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

/** Build the Golden Desk Detail Scene for a given parent (main) scene + focus area. */
export function goldenDeskDetailScene(parentSceneId: string, parentFocusAreaId: string): NestDetailScene {
  const objects: EditableNestObject[] = [
    {
      // The writing desk — the close-up centrepiece, enlarged to fill the scene.
      instanceId: "desk-1",
      assetId: "ast-desk",
      x: 0.1,
      y: 0.44,
      width: 0.8,
      height: 0.42,
      anchor: { x: 0.5, y: 0.86 },
      plane: "floor",
      zIndex: 2,
      interactionId: undefined,
      contactShadow: true,
      hotspots: deskHotspots("desk-1"),
    },
    {
      // Framed photo on the wall above the desk → gallery (its predefined photo hotspot, bound).
      instanceId: "frame-1",
      assetId: "ast-framed-photo",
      x: 0.6,
      y: 0.08,
      width: 0.24,
      height: 0.174,
      anchor: { x: 0.72, y: 0.254 },
      plane: "front_wall",
      zIndex: 1,
      contactShadow: false,
      hotspots: predefinedHotspotsForInstance("ast-framed-photo", "frame-1").map((h) => ({
        ...h,
        binding: { type: "gallery" as const, url: "https://example.com/creator/gallery", label: "Recent work" },
      })),
    },
    {
      // Stacked books resting on the desk → article (its predefined hotspot, bound).
      instanceId: "books-1",
      assetId: "ast-stacked-books",
      x: 0.16,
      y: 0.4,
      width: 0.14,
      height: 0.08,
      anchor: { x: 0.23, y: 0.48 },
      plane: "floor",
      zIndex: 3,
      contactShadow: false,
      hotspots: predefinedHotspotsForInstance("ast-stacked-books", "books-1").map((h) => ({
        ...h,
        binding: { type: "article" as const, url: "https://example.com/creator/reading", label: "Reading list" },
      })),
    },
  ];

  return {
    id: GOLDEN_DESK_DETAIL_SCENE_ID,
    name: "Desk",
    kind: "detail",
    parentSceneId,
    parentFocusAreaId,
    backgroundImageUrl: GOLDEN_LIVING_NEST_TEMPLATE.backgroundImageUrl,
    viewport: { aspectRatio: "3:4" },
    objects,
    ambiencePresetId: "warm_day",
    createdAt: T,
    updatedAt: T,
  };
}

/** The desk Focus Area on the Main Nest (over the coffee-table / desk region). */
export function goldenDeskFocusArea(mainSceneId: string): NestFocusArea {
  return {
    id: GOLDEN_DESK_FOCUS_AREA_ID,
    name: "Desk",
    sourceSceneId: mainSceneId,
    targetSceneId: GOLDEN_DESK_DETAIL_SCENE_ID,
    // Over the coffee-table surface; clear of the avatar (≈x>0.61) and most of the sofa.
    bounds: { x: 0.3, y: 0.74, width: 0.32, height: 0.2 },
    shape: "rect",
    trigger: "tap",
    transition: "fade_zoom",
    enabled: true,
    previewHint: "Explore desk",
    ariaLabel: "Explore desk — open the workspace detail scene",
  };
}

/**
 * The Golden Living Nest editor document augmented with the desk Focus Area + the
 * linked Golden Desk Detail Scene. This is the visitor/editor proof document.
 */
export function goldenLivingNestWithDesk(): EditableNestDocument {
  const base = createEditorDocumentFromTemplate({ template: GOLDEN_LIVING_NEST_TEMPLATE, composed: GOLDEN_LIVING_NEST_COMPOSED });
  const mainId = base.id;
  return {
    ...base,
    focusAreas: [goldenDeskFocusArea(mainId)],
    detailScenes: [goldenDeskDetailScene(mainId, GOLDEN_DESK_FOCUS_AREA_ID)],
  };
}
