import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  focusCameraTransform,
  focusObjectsInPaintOrder,
  placementIsInteractive,
  resolveFocusRegions,
  resolvePlacementSurfaces,
} from "@/lib/nest-scene";
import { registerAssetSurfaces } from "@/lib/nest-surface-catalog";
import { cinematicFocusTransformCss, focusBoundsOf } from "@/lib/nest-focus-scenes";
import type { NestDocument, NestPlacement } from "@/lib/nest-document-types";
import type { EditableNestObject } from "@/lib/nest-editor-types";

// ── M24D §1 — visitors REPLAY focus and surfaces, they don't just store them ─
//
// M24C made the data survive. This covers the runtime that reads it: focus regions
// resolve to a camera move, focus children resolve to objects, and surface content
// resolves from the placement alone — with no editor state anywhere in the path, which is
// exactly what let a visitor render none of it before.

const PLANT: EditableNestObject = {
  instanceId: "the-plant",
  assetId: "ast-plant-beta",
  x: 0.3, y: 0.35, width: 0.2, height: 0.3,
  anchor: { x: 0.4, y: 0.65 },
  plane: "floor",
  zIndex: 2,
};

const doc = (over: Partial<NestDocument> = {}): NestDocument => ({
  id: "nest-1",
  backgroundId: "bg-creator-loft",
  title: "My Living Room",
  visibility: "public",
  placements: [],
  createdAt: "",
  updatedAt: "",
  scene: {
    version: 1,
    focusAreas: [
      {
        id: "focus-1",
        name: "The shelf",
        sourceSceneId: "nest-1",
        targetSceneId: "scene-1",
        bounds: { x: 0.25, y: 0.2, width: 0.4, height: 0.3 },
      },
    ],
    detailScenes: [
      {
        id: "scene-1",
        name: "The shelf",
        kind: "detail",
        parentSceneId: "nest-1",
        parentFocusAreaId: "focus-1",
        objects: [PLANT],
      },
    ],
  },
  ...over,
}) as NestDocument;

describe("focus regions resolve for a visitor", () => {
  it("resolves the region and its child scene from the document alone", () => {
    const [focus] = resolveFocusRegions(doc());
    expect(focus.area.id).toBe("focus-1");
    expect(focus.scene?.id).toBe("scene-1");
  });

  it("carries the focused plant — the regression fixture", () => {
    const [focus] = resolveFocusRegions(doc());
    expect(focus.objects.map((o) => o.instanceId)).toContain("the-plant");
  });

  it("keeps the plant's exact geometry", () => {
    const [focus] = resolveFocusRegions(doc());
    const plant = focus.objects[0];
    expect({ x: plant.x, y: plant.y, width: plant.width, height: plant.height }).toEqual({
      x: 0.3, y: 0.35, width: 0.2, height: 0.3,
    });
  });

  it("still resolves a zoom-only region with no child scene", () => {
    // Dropping it would silently discard creator intent.
    const d = doc();
    d.scene!.detailScenes = [];
    const [focus] = resolveFocusRegions(d);
    expect(focus.area.id).toBe("focus-1");
    expect(focus.objects).toEqual([]);
  });

  it("matches a scene by parent focus id when target ids disagree", () => {
    const d = doc();
    d.scene!.focusAreas![0].targetSceneId = "stale-id";
    expect(resolveFocusRegions(d)[0].scene?.id).toBe("scene-1");
  });

  it("returns nothing for a document with no focus regions", () => {
    expect(resolveFocusRegions(doc({ scene: undefined }))).toEqual([]);
  });

  it("M24E — the crop is the CANONICAL focus rectangle, not the legacy trigger box", () => {
    // `bounds` is the pre-M7C.4 trigger box; `focusBounds` is the rectangle the creator
    // actually drags in focus-editor-overlay.tsx. Reading `bounds` framed a different
    // region from the one the creator drew.
    const [focus] = resolveFocusRegions(doc());
    expect(focus.crop).toEqual(focusBoundsOf(doc().scene!.focusAreas![0]));
  });

  it("M24E — an authored focusBounds wins over the legacy bounds", () => {
    const d = doc();
    d.scene!.focusAreas![0].focusBounds = { x: 0.5, y: 0.5, width: 0.25, height: 0.25 };
    expect(resolveFocusRegions(d)[0].crop).toEqual({ x: 0.5, y: 0.5, width: 0.25, height: 0.25 });
  });

  it("M24E — matches the child scene by childSceneId (how the editor links them)", () => {
    // `ensureFocusChildScene` writes `childSceneId` when the creator first steps inside a
    // region to place things in it. Matching only `targetSceneId` missed exactly those.
    const d = doc();
    d.scene!.focusAreas![0].targetSceneId = "";
    d.scene!.focusAreas![0].childSceneId = "scene-1";
    d.scene!.detailScenes![0].parentFocusAreaId = "someone-else";
    expect(resolveFocusRegions(d)[0].objects.map((o) => o.instanceId)).toContain("the-plant");
  });
});

describe("the camera is one transform over the whole scene", () => {
  it("scales so the crop exactly fills the stage", () => {
    const [focus] = resolveFocusRegions(doc());
    const cam = focusCameraTransform(focus.crop);
    expect(cam.scale).toBeCloseTo(1 / focus.crop.width, 6);
  });

  it("is the SAME transform the editor's focused view uses", () => {
    // M24E — this used to be a second implementation (centre-origin scale) that only
    // agreed with the editor for a perfectly centred crop. It now delegates, so the
    // creator's focused view and the visitor's cannot drift.
    const [focus] = resolveFocusRegions(doc());
    const cam = focusCameraTransform(focus.crop);
    const canonical = cinematicFocusTransformCss(focus.crop);
    expect({ transform: cam.transform, transformOrigin: cam.transformOrigin }).toEqual(canonical);
    expect(cam.transformOrigin).toBe("0 0");
  });

  it("never inverts or collapses on a degenerate crop", () => {
    const cam = focusCameraTransform({ x: 0, y: 0, width: 0.02, height: 0.02 });
    expect(cam.scale).toBeGreaterThan(1);
    expect(Number.isFinite(cam.scale)).toBe(true);
  });
});

describe("surfaces resolve from the placement alone", () => {
  const TV = "ast-tv-m24d";
  registerAssetSurfaces(TV, [
    { id: "tv-screen", name: "Screen", type: "image", bounds: { x: 0.1, y: 0.12, width: 0.8, height: 0.6 }, acceptedContentTypes: ["uploaded_image"] },
  ]);

  const withScreen: NestPlacement = {
    id: "p-tv", assetId: TV, x: 0.2, y: 0.3, w: 0.4, h: 0.25,
    interaction: { surfaces: { "tv-screen": { kind: "image", src: "data:image/png;base64,iVBORw0KGgo=", fit: "cover" } } },
  };

  it("returns the assigned content with its object-local geometry", () => {
    const [surface] = resolvePlacementSurfaces(withScreen);
    expect(surface.id).toBe("tv-screen");
    expect(surface.bounds).toEqual({ x: 0.1, y: 0.12, width: 0.8, height: 0.6 });
    expect(surface.content).toMatchObject({ kind: "image" });
  });

  it("needs no editor state — a visitor has everything from the document", () => {
    // The only inputs are the placement and the asset catalogue.
    expect(resolvePlacementSurfaces(withScreen)).toHaveLength(1);
  });

  it("returns nothing when the creator assigned no content", () => {
    expect(resolvePlacementSurfaces({ id: "p", assetId: TV, x: 0, y: 0 })).toEqual([]);
  });

  it("ignores content for a surface the asset does not declare", () => {
    const stale: NestPlacement = {
      id: "p", assetId: TV, x: 0, y: 0,
      interaction: { surfaces: { "removed-surface": { kind: "text", text: "hi" } } },
    };
    expect(resolvePlacementSurfaces(stale)).toEqual([]);
  });

  it("supports text and sticker surfaces too", () => {
    const FRAME = "ast-frame-m24d";
    registerAssetSurfaces(FRAME, [
      { id: "photo", name: "Photo", type: "image", bounds: { x: 0, y: 0, width: 1, height: 1 }, acceptedContentTypes: ["text"] },
    ]);
    const p: NestPlacement = { id: "p", assetId: FRAME, x: 0, y: 0, interaction: { surfaces: { photo: { kind: "text", text: "Hello" } } } };
    expect(resolvePlacementSurfaces(p)[0].content).toEqual({ kind: "text", text: "Hello" });
  });
});

describe("interaction detection", () => {
  it("recognises a link, an interaction id and hotspots", () => {
    expect(placementIsInteractive({ id: "a", assetId: "x", x: 0, y: 0, linkUrl: "https://example.com" })).toBe(true);
    expect(placementIsInteractive({ id: "b", assetId: "x", x: 0, y: 0, interaction: { interactionId: "play_video" } })).toBe(true);
    expect(placementIsInteractive({ id: "c", assetId: "x", x: 0, y: 0 })).toBe(false);
  });
});

describe("focus children paint in authored order", () => {
  it("sorts by z-index", () => {
    const objs = [
      { ...PLANT, instanceId: "front", zIndex: 9 },
      { ...PLANT, instanceId: "back", zIndex: 1 },
    ];
    expect(focusObjectsInPaintOrder(objs).map((o) => o.instanceId)).toEqual(["back", "front"]);
  });
});

describe("one runtime, and the surround is not a blurred image", () => {
  const src = readFileSync(join(process.cwd(), "components", "nest", "app-shell", "nest-runtime.tsx"), "utf8");

  it("Preview and visitor share the focus state machine", () => {
    expect(src).toContain("resolveFocusRegions");
    expect(src).toContain("focusCameraTransform");
    expect(src).toContain("setFocusId");
  });

  it("renders surface content in the same component", () => {
    expect(src).toContain("resolvePlacementSurfaces");
    expect(src).toContain("SurfaceContentView");
  });

  it("gives visitors a way back out of a focus", () => {
    expect(src).toContain("Back to the room");
  });

  it("§2 — the enlarged blurred background is GONE", () => {
    expect(src).not.toContain("blur-2xl");
    expect(src).not.toContain("scale-125");
  });

  it("§2 — the surround is one deliberate stage with gradient, glow and vignette", () => {
    // M26A moved this out of the runtime into the reusable <NestStage>, so the same
    // environment can wrap the editor, Preview, the visitor and a Home card.
    expect(src).toContain("<NestStage");
    const stage = readFileSync(join(process.cwd(), "components", "nest", "nest-stage.tsx"), "utf8");
    expect(stage).toContain("radial-gradient");
    expect(stage).toContain("linear-gradient");
  });

  it("§2 — the stage is ONE deliberate pair of themes, not a colour per room", () => {
    // M26A: deriving a hue per background id gave a different colour behind every Nest —
    // green, beige, near-black — which is what read as unrelated bands. A gallery does not
    // repaint its walls per painting.
    const stage = readFileSync(join(process.cwd(), "components", "nest", "nest-stage.tsx"), "utf8");
    expect(stage).not.toContain("charCodeAt"); // no per-room hash
    expect(stage).toContain("const DARK = {");
    expect(stage).toContain("const LIGHT = {");
  });
});
