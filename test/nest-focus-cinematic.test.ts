import { describe, expect, it } from "vitest";
import { MIN_FOCUS_AREA_SIZE } from "@/lib/nest-focus-types";
import type { NestFocusArea, NestFocusBounds } from "@/lib/nest-focus-types";
import type { EditableNestDocument } from "@/lib/nest-editor-types";
import { serializeEditorDocument } from "@/lib/nest-editor";
import { saveDraft, loadDraft, clearDraft, importDocumentJson } from "@/lib/nest-editor-storage";
import { createHistory, pushHistory, redoHistory, undoHistory } from "@/lib/nest-editor-history";
import {
  canInteractInFocus,
  cinematicFocusTransform,
  cinematicFocusTransformCss,
  cropBoundsOf,
  fitRectToAspectRatio,
  focusBoundsOf,
  focusEntryBegin,
  focusExitBegin,
  IDENTITY_FOCUS_TRANSFORM,
  moveRectInsideBounds,
  normalizeLegacyFocusArea,
  resizeRectWithLockedAspect,
  resolveMainScenePointerAction,
  resolveZoomInteraction,
  triggerBoundsOf,
  updateFocusArea,
} from "@/lib/nest-focus-scenes";
import {
  goldenLivingNestHybrid,
  studioNestHybrid,
  GOLDEN_TV_ZOOM_AREA_ID,
  STUDIO_BOOKSHELF_ZOOM_AREA_ID,
} from "@/lib/fixtures/golden-hybrid-focus";

const sq = (b: NestFocusBounds) => Math.abs(b.width - b.height) < 1e-6;
const baseFa = (over: Partial<NestFocusArea> = {}): NestFocusArea => ({
  id: "focus-1",
  name: "Region",
  sourceSceneId: "main",
  targetSceneId: "",
  targetType: "zoom_region",
  bounds: { x: 0.3, y: 0.4, width: 0.4, height: 0.3 },
  shape: "rect",
  trigger: "tap",
  transition: "cinematic_zoom",
  enabled: true,
  ...over,
});

// ── Fixed ratio (Phase 1/3) ──────────────────────────────────────────────────
describe("fixed-ratio focus rectangle", () => {
  it("1. fixture focus bounds hold the locked ratio (normalized square)", () => {
    for (const f of [...goldenLivingNestHybrid().focusAreas!, ...studioNestHybrid().focusAreas!]) {
      expect(sq(focusBoundsOf(f))).toBe(true);
    }
  });
  it("2. a corner resize preserves the ratio", () => {
    const r = resizeRectWithLockedAspect({ x: 0.3, y: 0.3, width: 0.2, height: 0.2 }, { dirX: 1, dirY: 1 }, { x: 0.7, y: 0.55 });
    expect(sq(r)).toBe(true);
  });
  it("3. a move preserves the dimensions", () => {
    const start = { x: 0.2, y: 0.2, width: 0.3, height: 0.3 };
    const moved = moveRectInsideBounds(start, 0.1, 0.15);
    expect(moved.width).toBeCloseTo(0.3, 6);
    expect(moved.height).toBeCloseTo(0.3, 6);
  });
  it("4-7. each corner resize anchors the opposite corner", () => {
    const rect = { x: 0.3, y: 0.3, width: 0.2, height: 0.2 };
    // bottom-right drag → top-left anchored
    const br = resizeRectWithLockedAspect(rect, { dirX: 1, dirY: 1 }, { x: 0.8, y: 0.7 });
    expect([br.x, br.y]).toEqual([rect.x, rect.y]);
    // top-left drag → bottom-right anchored
    const tl = resizeRectWithLockedAspect(rect, { dirX: -1, dirY: -1 }, { x: 0.15, y: 0.1 });
    expect(tl.x + tl.width).toBeCloseTo(rect.x + rect.width, 5);
    expect(tl.y + tl.height).toBeCloseTo(rect.y + rect.height, 5);
    // top-right drag → bottom-left anchored
    const tr = resizeRectWithLockedAspect(rect, { dirX: 1, dirY: -1 }, { x: 0.75, y: 0.1 });
    expect(tr.x).toBeCloseTo(rect.x, 5);
    expect(tr.y + tr.height).toBeCloseTo(rect.y + rect.height, 5);
    // bottom-left drag → top-right anchored
    const bl = resizeRectWithLockedAspect(rect, { dirX: -1, dirY: 1 }, { x: 0.1, y: 0.8 });
    expect(bl.x + bl.width).toBeCloseTo(rect.x + rect.width, 5);
    expect(bl.y).toBeCloseTo(rect.y, 5);
  });
  it("8. the minimum size is enforced", () => {
    const r = resizeRectWithLockedAspect({ x: 0.4, y: 0.4, width: 0.2, height: 0.2 }, { dirX: 1, dirY: 1 }, { x: 0.401, y: 0.401 });
    expect(r.width).toBeGreaterThanOrEqual(MIN_FOCUS_AREA_SIZE - 1e-9);
    expect(fitRectToAspectRatio({ x: 0.5, y: 0.5, width: 0.001, height: 0.001 }).width).toBeGreaterThanOrEqual(MIN_FOCUS_AREA_SIZE - 1e-9);
  });
  it("9. rectangles stay inside the scene (move + resize + fit)", () => {
    const m = moveRectInsideBounds({ x: 0.8, y: 0.8, width: 0.3, height: 0.3 }, 0.5, 0.5);
    expect(m.x + m.width).toBeLessThanOrEqual(1.0001);
    expect(m.y + m.height).toBeLessThanOrEqual(1.0001);
    const r = resizeRectWithLockedAspect({ x: 0.7, y: 0.7, width: 0.2, height: 0.2 }, { dirX: 1, dirY: 1 }, { x: 1.5, y: 1.5 });
    expect(r.x + r.width).toBeLessThanOrEqual(1.0001);
    const f = fitRectToAspectRatio({ x: 0.9, y: 0.9, width: 0.4, height: 0.4 });
    expect(f.x + f.width).toBeLessThanOrEqual(1.0001);
  });
});

// ── Migration (Phase 2) ──────────────────────────────────────────────────────
describe("legacy migration to focusBounds", () => {
  it("10. a legacy cropBounds migrates to a fixed-ratio focusBounds (centre preserved)", () => {
    const legacy = baseFa({ focusBounds: undefined, zoomRegion: { cropBounds: { x: 0.2, y: 0.3, width: 0.5, height: 0.3 } } });
    const fb = focusBoundsOf(legacy);
    expect(sq(fb)).toBe(true);
    // centre preserved
    expect(fb.x + fb.width / 2).toBeCloseTo(0.2 + 0.25, 2);
    expect(fb.y + fb.height / 2).toBeCloseTo(0.3 + 0.15, 2);
  });
  it("11. a legacy trigger (bounds) is used when there is no crop", () => {
    const legacy = baseFa({ focusBounds: undefined, zoomRegion: undefined, bounds: { x: 0.25, y: 0.25, width: 0.4, height: 0.2 } });
    const fb = focusBoundsOf(legacy);
    expect(sq(fb)).toBe(true);
    const norm = normalizeLegacyFocusArea(legacy);
    expect(norm.focusBounds).toEqual(fb);
    expect(norm.bounds).toEqual(legacy.bounds); // legacy data not destroyed
  });
});

// ── Cinematic transform (Phase 5) ────────────────────────────────────────────
describe("cinematic transform", () => {
  const VP = { viewportWidth: 360, viewportHeight: 480 };
  const fb = { x: 0.2, y: 0.3, width: 0.4, height: 0.4 };
  const t = cinematicFocusTransform({ ...VP, focusBounds: fb });
  const mapX = (nx: number) => nx * VP.viewportWidth * t.scale + t.translateX;
  const mapY = (ny: number) => ny * VP.viewportHeight * t.scale + t.translateY;
  it("12. maps the focus LEFT edge to the viewport left", () => expect(mapX(fb.x)).toBeCloseTo(0, 3));
  it("13. maps the focus TOP edge to the viewport top", () => expect(mapY(fb.y)).toBeCloseTo(0, 3));
  it("14. maps the focus RIGHT edge to the viewport right", () => expect(mapX(fb.x + fb.width)).toBeCloseTo(VP.viewportWidth, 2));
  it("15. maps the focus BOTTOM edge to the viewport bottom", () => expect(mapY(fb.y + fb.height)).toBeCloseTo(VP.viewportHeight, 2));
  it("16. the full-scene rect is the identity (restored on exit)", () => {
    const id = cinematicFocusTransform({ ...VP, focusBounds: { x: 0, y: 0, width: 1, height: 1 } });
    expect(id).toEqual(IDENTITY_FOCUS_TRANSFORM);
  });
  it("17 + 19. the same identity transform = Main (one stage, not duplicated)", () => {
    // focusBounds undefined ⇒ the navigator passes no transform ⇒ the SAME stage at rest.
    const css = cinematicFocusTransformCss({ x: 0, y: 0, width: 1, height: 1 });
    expect(css.transform).toBe("translate(0%, 0%) scale(1)");
  });
  it("28 + 35. the transform is deterministic + motion-independent (editor preview == visitor)", () => {
    expect(cinematicFocusTransform({ ...VP, focusBounds: fb })).toEqual(t);
    // CSS form has no animation term — reduced motion only drops the CSS transition.
    expect(cinematicFocusTransformCss(fb).transformOrigin).toBe("0 0");
  });
});

// ── Interaction + state (Phase 8/10/14) ──────────────────────────────────────
describe("interaction & transition state", () => {
  it("20. a Main first tap enters focus", () => {
    const doc = goldenLivingNestHybrid();
    const tv = doc.focusAreas!.find((f) => f.id === GOLDEN_TV_ZOOM_AREA_ID)!;
    const c = focusBoundsOf(tv);
    const res = resolveMainScenePointerAction({ point: { x: c.x + c.width / 2, y: c.y + c.height / 2 }, focusAreas: doc.focusAreas!, objects: doc.objects });
    expect(res).toEqual({ type: "focus", focusAreaId: GOLDEN_TV_ZOOM_AREA_ID });
  });
  it("21 + 23. content cannot fire during the transition; rapid taps = one entry", () => {
    expect(canInteractInFocus("entering_focus")).toBe(false);
    const once = focusEntryBegin("main_idle");
    expect(once).toBe("entering_focus");
    expect(focusEntryBegin(once)).toBe("entering_focus"); // second rapid tap is a no-op
  });
  it("22. a focused second tap fires a hotspot", () => {
    const r = resolveZoomInteraction({ point: { x: 0.5, y: 0.4 }, childHotspots: [], childObjects: [], parentHotspots: [{ id: "s", name: "TV Screen", semantic: "video", shape: { type: "rect", x: 0.2, y: 0.2, width: 0.6, height: 0.5 }, enabled: true }] });
    expect(r).toMatchObject({ kind: "parent_hotspot", hotspot: { semantic: "video" } });
  });
  it("24. browser Back exits the focus state", () => {
    expect(focusExitBegin("focused_idle")).toBe("exiting_focus");
  });
});

// ── History & persistence (Phase 14) ─────────────────────────────────────────
describe("focusBounds history & persistence", () => {
  const editBounds = (doc: EditableNestDocument, fb: NestFocusBounds) =>
    updateFocusArea(doc, GOLDEN_TV_ZOOM_AREA_ID, { focusBounds: fb });
  it("29 + 30. one move/resize commit = one history entry", () => {
    const base = goldenLivingNestHybrid();
    let h = createHistory(base, 50);
    const n0 = h.past.length;
    h = pushHistory(h, editBounds(base, { x: 0.2, y: 0.2, width: 0.4, height: 0.4 }));
    expect(h.past.length).toBe(n0 + 1);
  });
  it("33. undo/redo restores the focus bounds", () => {
    const base = goldenLivingNestHybrid();
    const before = focusBoundsOf(base.focusAreas!.find((f) => f.id === GOLDEN_TV_ZOOM_AREA_ID)!);
    const edited = editBounds(base, { x: 0.05, y: 0.05, width: 0.5, height: 0.5 });
    let h = createHistory(base, 50);
    h = pushHistory(h, edited);
    expect(focusBoundsOf(undoHistory(h).present.focusAreas!.find((f) => f.id === GOLDEN_TV_ZOOM_AREA_ID)!)).toEqual(before);
    expect(focusBoundsOf(redoHistory(undoHistory(h)).present.focusAreas!.find((f) => f.id === GOLDEN_TV_ZOOM_AREA_ID)!)).toEqual({ x: 0.05, y: 0.05, width: 0.5, height: 0.5 });
  });
  it("31. Save/Load preserves focusBounds", () => {
    const doc = studioNestHybrid();
    clearDraft(doc.id);
    expect(saveDraft(doc).ok).toBe(true);
    const r = loadDraft(doc.id);
    const fb = r.doc!.focusAreas!.find((f) => f.id === STUDIO_BOOKSHELF_ZOOM_AREA_ID)!.focusBounds;
    expect(fb).toEqual({ x: 0.0, y: 0.22, width: 0.4, height: 0.4 });
  });
  it("32. Export/Import preserves focusBounds", () => {
    const doc = goldenLivingNestHybrid();
    const r = importDocumentJson(serializeEditorDocument(doc));
    expect(r.ok).toBe(true);
    expect(r.doc!.focusAreas).toEqual(doc.focusAreas);
  });
});

// ── V1 unification ───────────────────────────────────────────────────────────
describe("V1 single rectangle", () => {
  it("trigger and crop accessors both resolve to focusBounds", () => {
    const tv = goldenLivingNestHybrid().focusAreas!.find((f) => f.id === GOLDEN_TV_ZOOM_AREA_ID)!;
    expect(triggerBoundsOf(tv)).toEqual(cropBoundsOf(tv));
    expect(triggerBoundsOf(tv)).toEqual(tv.focusBounds);
  });
});
