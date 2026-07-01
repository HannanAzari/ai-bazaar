import { describe, expect, it } from "vitest";
import {
  contentTypeOf,
  objectSurfacesWithContent,
  resolveObjectSurfaces,
  setObjectSurfaceContent,
  setSurfaceContentOnObject,
  surfaceAccepts,
  validateSurfaceContent,
} from "@/lib/nest-surfaces";
import { predefinedSurfacesForAsset, SURFACE_CATALOG } from "@/lib/nest-surface-catalog";
import { createEditorDocumentFromTemplate, duplicateObject, serializeEditorDocument } from "@/lib/nest-editor";
import { importDocumentJson } from "@/lib/nest-editor-storage";
import { createHistory, pushHistory, redoHistory, undoHistory } from "@/lib/nest-editor-history";
import { GOLDEN_LIVING_NEST_ASSETS_BY_ID, GOLDEN_LIVING_NEST_COMPOSED, GOLDEN_LIVING_NEST_TEMPLATE } from "@/lib/fixtures/golden-living-nest";
import { ensureFocusChildScene, focusBoundsOf, getDetailScene, setDetailSceneObjects } from "@/lib/nest-focus-scenes";
import { childToParentRect, projectChildObjectsToMain } from "@/lib/nest-focus-projection";
import { goldenLivingNestHybrid, GOLDEN_TV_ZOOM_AREA_ID } from "@/lib/fixtures/golden-hybrid-focus";
import type { EditableNestDocument, EditableNestObject } from "@/lib/nest-editor-types";
import type { SurfaceContent } from "@/lib/nest-surface-types";

const NOW = "2026-07-01T00:00:00.000Z";
const IMG: SurfaceContent = { kind: "image", src: "data:image/png;base64,AAAA", source: "upload", fit: "cover" };
const QUOTE: SurfaceContent = { kind: "text", text: "Dream big", variant: "quote" };

const freshDoc = () => createEditorDocumentFromTemplate({ template: GOLDEN_LIVING_NEST_TEMPLATE, composed: GOLDEN_LIVING_NEST_COMPOSED });
const findByAsset = (doc: EditableNestDocument, assetId: string) => doc.objects.find((o) => o.assetId === assetId)!;

describe("M8 — editable surface data + resolution", () => {
  it("catalog surfaces are asset-local rectangles inside [0,1] (clip-safe)", () => {
    for (const defs of Object.values(SURFACE_CATALOG)) {
      for (const d of defs) {
        expect(d.bounds.x).toBeGreaterThanOrEqual(0);
        expect(d.bounds.y).toBeGreaterThanOrEqual(0);
        expect(d.bounds.x + d.bounds.width).toBeLessThanOrEqual(1 + 1e-9);
        expect(d.bounds.y + d.bounds.height).toBeLessThanOrEqual(1 + 1e-9);
        expect(d.acceptedContentTypes.length).toBeGreaterThan(0);
      }
    }
  });

  it("1. image surface: TV screen resolves + holds an uploaded image", () => {
    const tv = findByAsset(freshDoc(), "ast-tv");
    expect(resolveObjectSurfaces(tv).map((s) => s.id)).toEqual(["tv-screen"]);
    const withImg = setSurfaceContentOnObject(tv, "tv-screen", IMG);
    const resolved = resolveObjectSurfaces(withImg);
    expect(resolved[0].content).toEqual(IMG);
    expect(objectSurfacesWithContent(withImg)).toHaveLength(1);
    expect(contentTypeOf(IMG)).toBe("uploaded_image");
  });

  it("2. text surface: a quote can be placed on the frame (a framed quote)", () => {
    const frame = findByAsset(freshDoc(), "ast-framed-photo");
    const withText = setSurfaceContentOnObject(frame, "frame-photo", QUOTE);
    expect(resolveObjectSurfaces(withText).find((s) => s.id === "frame-photo")!.content).toEqual(QUOTE);
  });

  it("acceptance: a surface rejects content it does not accept (TV screen ≠ text)", () => {
    const tv = findByAsset(freshDoc(), "ast-tv");
    expect(surfaceAccepts(predefinedSurfacesForAsset("ast-tv")[0], QUOTE)).toBe(false);
    expect(setSurfaceContentOnObject(tv, "tv-screen", QUOTE)).toBe(tv); // unchanged
  });

  it("clearing content drops the surfaces field entirely; validation catches empties", () => {
    const frame = setSurfaceContentOnObject(findByAsset(freshDoc(), "ast-framed-photo"), "frame-photo", IMG);
    expect(frame.surfaces).toBeTruthy();
    const cleared = setSurfaceContentOnObject(frame, "frame-photo", undefined);
    expect(cleared.surfaces).toBeUndefined();
    expect(validateSurfaceContent({ kind: "text", text: "  " })).not.toHaveLength(0);
    expect(validateSurfaceContent(IMG)).toHaveLength(0);
  });
});

describe("M8 — geometry independence + duplicate + persistence", () => {
  it("move/resize/rotate/flip do NOT change surface content (asset-local)", () => {
    const tv0 = setSurfaceContentOnObject(findByAsset(freshDoc(), "ast-tv"), "tv-screen", IMG);
    const moved: EditableNestObject = { ...tv0, x: tv0.x + 0.1, y: tv0.y - 0.05, width: tv0.width * 1.4, height: tv0.height * 0.8, rotation: 33, flipX: true };
    expect(moved.surfaces).toEqual(tv0.surfaces);
    expect(resolveObjectSurfaces(moved)[0].content).toEqual(IMG);
  });

  it("duplicate copies the surfaces onto the new instance", () => {
    const doc0 = freshDoc();
    const tv = findByAsset(doc0, "ast-tv");
    const doc = setObjectSurfaceContent(doc0, tv.instanceId, "tv-screen", IMG);
    const { doc: dup, instanceId } = duplicateObject(doc, tv.instanceId, GOLDEN_LIVING_NEST_ASSETS_BY_ID);
    expect(instanceId).toBeTruthy();
    expect(dup.objects.find((o) => o.instanceId === instanceId)!.surfaces).toEqual({ "tv-screen": IMG });
  });

  it("6. export → import preserves surfaces; undo/redo preserves them too", () => {
    const doc0 = freshDoc();
    const frame = findByAsset(doc0, "ast-framed-photo");
    const doc = setObjectSurfaceContent(doc0, frame.instanceId, "frame-photo", QUOTE);
    // export/import round-trip
    const round = importDocumentJson(serializeEditorDocument(doc));
    expect(round.ok).toBe(true);
    expect(round.doc!.objects.find((o) => o.assetId === "ast-framed-photo")!.surfaces).toEqual({ "frame-photo": QUOTE });
    // undo/redo
    let h = createHistory(doc0, 50);
    h = pushHistory(h, doc);
    expect(h.present.objects.find((o) => o.assetId === "ast-framed-photo")!.surfaces).toEqual({ "frame-photo": QUOTE });
    h = undoHistory(h);
    expect(h.present.objects.find((o) => o.assetId === "ast-framed-photo")!.surfaces).toBeUndefined();
    h = redoHistory(h);
    expect(h.present.objects.find((o) => o.assetId === "ast-framed-photo")!.surfaces).toEqual({ "frame-photo": QUOTE });
  });
});

describe("M8 — surfaces survive Focus (projection)", () => {
  it("4+7. a child object's surface projects into Main at the mapped position", () => {
    const doc0 = goldenLivingNestHybrid();
    const { doc: entered, childSceneId } = ensureFocusChildScene(doc0, GOLDEN_TV_ZOOM_AREA_ID, NOW);
    const book: EditableNestObject = {
      instanceId: "child-book", assetId: "ast-stacked-books", x: 0.4, y: 0.5, width: 0.2, height: 0.14,
      anchor: { x: 0.5, y: 1 }, plane: "front_wall", zIndex: 5, surfaces: { "book-cover": IMG },
    };
    const doc = setDetailSceneObjects(entered, childSceneId, [book], NOW);
    const proj = projectChildObjectsToMain(doc);
    expect(proj).toHaveLength(1);
    // The projection carries the surfaces so Main shows the same personalization.
    expect(proj[0].surfaces).toEqual({ "book-cover": IMG });
    const focus = focusBoundsOf(doc.focusAreas!.find((f) => f.id === GOLDEN_TV_ZOOM_AREA_ID)!);
    expect(proj[0].parentBounds).toEqual(childToParentRect({ x: 0.4, y: 0.5, width: 0.2, height: 0.14 }, focus));
    // And re-entering the child scene still has the editable object + surface (identity intact).
    expect(getDetailScene(doc, childSceneId)!.objects[0].surfaces).toEqual({ "book-cover": IMG });
  });

  it("24. existing documents with no surfaces stay valid (backward compatible)", () => {
    const doc = goldenLivingNestHybrid();
    expect(doc.objects.every((o) => o.surfaces === undefined)).toBe(true);
    expect(resolveObjectSurfaces(doc.objects[0]).every((s) => s.content === undefined)).toBe(true);
  });
});
