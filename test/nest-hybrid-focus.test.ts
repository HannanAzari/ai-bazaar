import { describe, expect, it } from "vitest";
import { validateEditorDocument } from "@/lib/nest-editor-types";
import { serializeEditorDocument } from "@/lib/nest-editor";
import { saveDraft, loadDraft, clearDraft, importDocumentJson } from "@/lib/nest-editor-storage";
import type { NestFocusArea } from "@/lib/nest-focus-types";
import {
  cropLocalRectToScene,
  detailSurfaceIdOf,
  focusTargetTypeOf,
  IDENTITY_ZOOM_TRANSFORM,
  migrateFocusArea,
  resolveFocusNavigation,
  resolveZoomInteraction,
  validateCropBounds,
  validateDetailScene,
  validateFocusArea,
  validateSceneGraph,
  zoomChildrenActive,
  zoomRegionChildren,
  zoomTransform,
  focusTransitionDurationMs,
} from "@/lib/nest-focus-scenes";
import {
  auditFocusResolution,
  auditZoomBackground,
  recommendStrategy,
  resolutionVerdict,
  selectFocusImageSource,
} from "@/lib/nest-focus-resolution";
import {
  goldenLivingNestHybrid,
  studioNestHybrid,
  studioBookshelfZoomArea,
  studioDeskSurface,
  GOLDEN_TV_ZOOM_AREA_ID,
  GOLDEN_FRAME_ZOOM_AREA_ID,
  STUDIO_BOOKSHELF_ZOOM_AREA_ID,
  STUDIO_DESK_SURFACE_ID,
} from "@/lib/fixtures/golden-hybrid-focus";
import type { NestAssetHotspot } from "@/lib/nest-hotspot-types";
import type { EditableNestObject } from "@/lib/nest-editor-types";

const baseFa = (over: Partial<NestFocusArea> = {}): NestFocusArea => ({
  id: "focus-1",
  name: "Region",
  sourceSceneId: "main",
  targetSceneId: "detail-1",
  bounds: { x: 0.3, y: 0.4, width: 0.3, height: 0.2 },
  shape: "rect",
  trigger: "tap",
  transition: "fade_zoom",
  enabled: true,
  ...over,
});

// ── Migration & target type ────────────────────────────────────────────────────
describe("hybrid target type & migration", () => {
  it("1. an existing M7C detail target migrates to detail_surface", () => {
    const old = baseFa(); // no targetType, has targetSceneId
    expect(focusTargetTypeOf(old)).toBe("detail_surface");
    const migrated = migrateFocusArea(old);
    expect(migrated.targetType).toBe("detail_surface");
    expect(migrated.detailSurfaceId).toBe("detail-1");
    expect(detailSurfaceIdOf(old)).toBe("detail-1");
  });
  it("infers zoom_region from a zoomRegion payload", () => {
    const z = baseFa({ targetSceneId: "", zoomRegion: { cropBounds: { x: 0.1, y: 0.1, width: 0.4, height: 0.4 } } });
    expect(focusTargetTypeOf(z)).toBe("zoom_region");
  });
});

// ── Validation ───────────────────────────────────────────────────────────────
describe("hybrid validation", () => {
  it("2. a zoom_region requires crop bounds", () => {
    const noCrop = baseFa({ targetType: "zoom_region", targetSceneId: "" });
    expect(validateFocusArea(noCrop).some((e) => /zoomRegion|cropBounds/.test(e))).toBe(true);
    const ok = baseFa({ targetType: "zoom_region", targetSceneId: "", zoomRegion: { cropBounds: { x: 0.1, y: 0.1, width: 0.4, height: 0.4 } } });
    expect(validateFocusArea(ok)).toEqual([]);
  });
  it("3. a detail_surface requires a detailSurfaceId / targetSceneId", () => {
    const missing = baseFa({ targetType: "detail_surface", targetSceneId: "", detailSurfaceId: "" });
    expect(validateFocusArea(missing).some((e) => /detail_surface requires/.test(e))).toBe(true);
  });
  it("4. crop bounds validate within 0..1", () => {
    expect(validateCropBounds({ x: 0.8, y: 0.2, width: 0.4, height: 0.2 }, "at").some((e) => /leave the scene/.test(e))).toBe(true);
    expect(validateCropBounds({ x: -0.1, y: 0.2, width: 0.4, height: 0.2 }, "at").some((e) => /outside \[0,1\]/.test(e))).toBe(true);
    expect(validateCropBounds({ x: 0.1, y: 0.1, width: 0.4, height: 0.4 }, "at")).toEqual([]);
  });
});

// ── Resolution audit ───────────────────────────────────────────────────────────
describe("resolution audit math", () => {
  const audit = auditFocusResolution({
    sceneId: "s",
    regionId: "r",
    sourceWidth: 1000,
    sourceHeight: 1000,
    cropFractionX: 0.5,
    cropFractionY: 0.5,
    targetDisplayWidth: 500,
    targetDisplayHeight: 500,
  });
  it("5. crop pixels are computed correctly", () => {
    expect(audit.cropPixelWidth).toBe(500);
    expect(audit.cropPixelHeight).toBe(500);
  });
  it("6. the enlargement ratio is correct", () => {
    // 500 display px / 500 source px = 1.0×
    expect(audit.scaleX).toBe(1);
    expect(audit.scaleY).toBe(1);
  });
  it("7. source-pixels-per-display-pixel is correct (and DPR-aware)", () => {
    expect(audit.sourcePixelsPerDisplayPixel).toBe(1);
    const hd = auditFocusResolution({ sceneId: "s", regionId: "r", sourceWidth: 1000, sourceHeight: 1000, cropFractionX: 0.5, cropFractionY: 0.5, targetDisplayWidth: 500, targetDisplayHeight: 500, devicePixelRatio: 3 });
    expect(hd.sourcePixelsPerDisplayPixel).toBeCloseTo(1 / 3, 3);
  });
  it("8. the verdict policy is deterministic", () => {
    expect(resolutionVerdict(1.2)).toBe("excellent");
    expect(resolutionVerdict(0.8)).toBe("acceptable");
    expect(resolutionVerdict(0.5)).toBe("soft");
    expect(resolutionVerdict(0.2)).toBe("unusable");
    expect(resolutionVerdict(1.2)).toBe(resolutionVerdict(1.2));
  });
  it("9. the standard source is selected when sufficient", () => {
    expect(recommendStrategy({ verdict: "excellent" })).toBe("reuse_source");
    expect(recommendStrategy({ verdict: "acceptable" })).toBe("reuse_source");
  });
  it("10. a high-resolution variant is selected when soft and hi-res exists", () => {
    expect(recommendStrategy({ verdict: "soft", hasHighRes: true })).toBe("load_high_res_variant");
    expect(recommendStrategy({ verdict: "soft", childAssetsSharper: true })).toBe("reuse_source_with_child_assets");
  });
  it("11. a Detail Surface is selected for a perspective mismatch", () => {
    expect(recommendStrategy({ verdict: "excellent", perspectiveMismatch: true })).toBe("use_detail_surface");
  });
  it("the real prototype background crops are not worse than soft", () => {
    for (const crop of [
      { x: 0.16, y: 0.34, width: 0.66, height: 0.34 }, // TV
      { x: 0.08, y: 0.06, width: 0.36, height: 0.32 }, // frame
      { x: 0.02, y: 0.12, width: 0.42, height: 0.74 }, // bookshelf
    ]) {
      const a = auditZoomBackground({ sceneId: "s", regionId: "r", crop, viewportWidth: 1280 });
      expect(["excellent", "acceptable"]).toContain(a.verdict);
    }
  });
});

// ── Zoom transform geometry ─────────────────────────────────────────────────────
describe("zoom transform", () => {
  it("12. the transform centres the crop", () => {
    const t = zoomTransform({ x: 0.2, y: 0.1, width: 0.4, height: 0.6 });
    // crop centre = (0.4, 0.4) → translate (0.5-0.4)*100 = 10%, (0.5-0.4)*100 = 10%
    expect(t.translateXPct).toBeCloseTo(10, 3);
    expect(t.translateYPct).toBeCloseTo(10, 3);
    expect(t.transformOrigin).toBe("40% 40%");
  });
  it("13. the scale is uniform (preserves aspect ratio)", () => {
    const t = zoomTransform({ x: 0.2, y: 0.1, width: 0.4, height: 0.6 });
    expect(t.scale).toBeCloseTo(1 / 0.6, 3); // 1 / max(width,height)
    expect(typeof t.scale).toBe("number"); // single uniform scalar, not per-axis
  });
  it("13b. maxScale caps the enlargement", () => {
    expect(zoomTransform({ x: 0.4, y: 0.4, width: 0.1, height: 0.1 }, 3).scale).toBe(3);
  });
  it("14. the reverse (identity) transform restores the Main scene", () => {
    expect(IDENTITY_ZOOM_TRANSFORM).toEqual({ scale: 1, translateXPct: 0, translateYPct: 0, transformOrigin: "50% 50%" });
  });
  it("15. reduced motion uses a shorter (fade) transition", () => {
    expect(focusTransitionDurationMs(true)).toBeLessThan(focusTransitionDurationMs(false));
  });
});

// ── Fixtures validate ────────────────────────────────────────────────────────
describe("hybrid fixtures validate", () => {
  it("16. the bookshelf zoom fixture validates", () => {
    const doc = studioNestHybrid();
    expect(validateFocusArea(studioBookshelfZoomArea(doc.id))).toEqual([]);
    expect(validateSceneGraph(doc).ok).toBe(true);
  });
  it("17. the TV console zoom fixture validates", () => {
    const doc = goldenLivingNestHybrid();
    const tv = doc.focusAreas!.find((f) => f.id === GOLDEN_TV_ZOOM_AREA_ID)!;
    expect(validateFocusArea(tv)).toEqual([]);
    expect(validateSceneGraph(doc).ok).toBe(true);
  });
  it("18. the frame zoom fixture validates", () => {
    const doc = goldenLivingNestHybrid();
    const frame = doc.focusAreas!.find((f) => f.id === GOLDEN_FRAME_ZOOM_AREA_ID)!;
    expect(validateFocusArea(frame)).toEqual([]);
  });
  it("19. the desk Detail Surface fixture validates", () => {
    const doc = studioNestHybrid();
    expect(validateEditorDocument(doc).ok).toBe(true);
    const surface = studioDeskSurface(doc.id, "focus-desk-surface");
    expect(validateDetailScene(surface)).toEqual([]);
    const names = surface.objects.flatMap((o) => (o.hotspots ?? []).map((h) => h.name));
    expect(names).toEqual(expect.arrayContaining(["Laptop", "Notebook", "Desk lamp", "Photo", "Books"]));
  });
});

// ── Child objects (Phase 9) ─────────────────────────────────────────────────────
describe("zoom region child objects", () => {
  const area = studioBookshelfZoomArea("main");
  it("20. child object coordinates are region-local and map into the scene", () => {
    const { objects } = zoomRegionChildren(area);
    expect(objects).toHaveLength(1);
    const o = objects[0];
    for (const k of ["x", "y", "width", "height"] as const) {
      expect(o[k]).toBeGreaterThanOrEqual(0);
      expect(o[k]).toBeLessThanOrEqual(1);
    }
    const crop = area.zoomRegion!.cropBounds;
    const mapped = cropLocalRectToScene({ x: o.x, y: o.y, width: o.width, height: o.height }, crop);
    expect(mapped.x).toBeCloseTo(crop.x + o.x * crop.width, 3);
    expect(mapped.width).toBeCloseTo(o.width * crop.width, 3);
  });
  it("21. child objects are inactive before focus", () => {
    expect(zoomChildrenActive({ inZoomScene: false, transitioning: false })).toBe(false);
  });
  it("22. child objects are active after focus (and not mid-transition)", () => {
    expect(zoomChildrenActive({ inZoomScene: true, transitioning: false })).toBe(true);
    expect(zoomChildrenActive({ inZoomScene: true, transitioning: true })).toBe(false);
  });
});

// ── Interaction priority (Phase 13) ─────────────────────────────────────────────
describe("interaction priority", () => {
  const hotspot: NestAssetHotspot = { id: "h", name: "Spine", semantic: "article", shape: { type: "rect", x: 0.1, y: 0.1, width: 0.3, height: 0.3 }, enabled: true };
  const obj: EditableNestObject = { instanceId: "o", assetId: "ast-stacked-books", x: 0.5, y: 0.5, width: 0.3, height: 0.3, anchor: { x: 0.65, y: 0.8 }, plane: "floor", zIndex: 1 };
  it("23. child hotspot → child object → background is deterministic", () => {
    expect(resolveZoomInteraction({ point: { x: 0.2, y: 0.2 }, childHotspots: [hotspot], childObjects: [obj] }).kind).toBe("child_hotspot");
    expect(resolveZoomInteraction({ point: { x: 0.6, y: 0.6 }, childHotspots: [hotspot], childObjects: [obj] }).kind).toBe("child_object");
    expect(resolveZoomInteraction({ point: { x: 0.95, y: 0.95 }, childHotspots: [hotspot], childObjects: [obj] }).kind).toBe("background");
  });
  it("24 + 25. a main hotspot wins over a Focus Area (no double fire)", () => {
    const fa = baseFa();
    expect(resolveFocusNavigation({ point: { x: 0.45, y: 0.5 }, focusAreas: [fa], hotspotHit: true }).kind).toBe("hotspot");
    expect(resolveFocusNavigation({ point: { x: 0.45, y: 0.5 }, focusAreas: [fa], hotspotHit: false }).kind).toBe("focus");
  });
});

// ── Progressive hi-res (Phase 12) ───────────────────────────────────────────────
describe("progressive high-resolution sources", () => {
  it("26. the standard source is preserved until hi-res loads", () => {
    expect(selectFocusImageSource({ standardUrl: "a.png", highResolutionUrl: "b.png" }, false)).toBe("a.png");
    expect(selectFocusImageSource({ standardUrl: "a.png", highResolutionUrl: "b.png" }, true)).toBe("b.png");
  });
  it("27. a missing/failed hi-res keeps the standard source", () => {
    expect(selectFocusImageSource({ standardUrl: "a.png" }, true)).toBe("a.png");
    expect(selectFocusImageSource(undefined, true)).toBeUndefined();
  });
});

// ── Honest fixture shape (Phase 14 / DoD #7) ────────────────────────────────────
describe("honest fixtures", () => {
  it("28. the Main living-nest hybrid never links to an absent desk/bookshelf", () => {
    const doc = goldenLivingNestHybrid();
    expect(doc.detailScenes).toEqual([]);
    expect(doc.objects.some((o) => o.assetId === "ast-desk" || o.assetId === "ast-bookshelf")).toBe(false);
    for (const fa of doc.focusAreas ?? []) {
      expect(focusTargetTypeOf(fa)).toBe("zoom_region"); // only real-object zoom regions
      expect(/desk|bookshelf/i.test(fa.name)).toBe(false);
    }
    // The desk surface only exists where a real desk object exists (the studio).
    const studio = studioNestHybrid();
    expect(studio.objects.some((o) => o.assetId === "ast-desk")).toBe(true);
    expect(studio.detailScenes!.some((s) => s.id === STUDIO_DESK_SURFACE_ID)).toBe(true);
  });
});

// ── Persistence ────────────────────────────────────────────────────────────────
describe("hybrid persistence", () => {
  it("29. Save/Load preserves hybrid focus targets", () => {
    const doc = studioNestHybrid();
    clearDraft(doc.id);
    expect(saveDraft(doc).ok).toBe(true);
    const r = loadDraft(doc.id);
    expect(r.ok).toBe(true);
    const bookshelf = r.doc!.focusAreas!.find((f) => f.id === STUDIO_BOOKSHELF_ZOOM_AREA_ID)!;
    expect(bookshelf.targetType).toBe("zoom_region");
    expect(bookshelf.zoomRegion!.cropBounds.width).toBeCloseTo(0.4, 3); // M7C.3 recalibrated crop
    expect(bookshelf.zoomRegion!.cropSource).toBe("creator_authored");
    expect(bookshelf.zoomRegion!.childObjects).toHaveLength(1);
  });
  it("30. Export/Import preserves hybrid focus targets", () => {
    const doc = studioNestHybrid();
    const r = importDocumentJson(serializeEditorDocument(doc));
    expect(r.ok).toBe(true);
    expect(r.doc!.focusAreas).toEqual(doc.focusAreas);
    expect(r.doc!.detailScenes).toEqual(doc.detailScenes);
  });
});
