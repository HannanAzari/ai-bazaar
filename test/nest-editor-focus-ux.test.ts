import { describe, expect, it } from "vitest";
import { EDITOR_LAYERS } from "@/lib/nest-editor-layers";
import { capabilitiesFor } from "@/lib/nest-editor-roles";
import { serializeEditorDocument } from "@/lib/nest-editor";
import { saveDraft, loadDraft, clearDraft, importDocumentJson } from "@/lib/nest-editor-storage";
import { createHistory, pushHistory, undoHistory } from "@/lib/nest-editor-history";
import {
  addFocusArea,
  fitRectToAspectRatio,
  focusBoundsOf,
  nextFocusAreaName,
  removeFocusArea,
  updateFocusArea,
} from "@/lib/nest-focus-scenes";
import { goldenLivingNestHybrid, GOLDEN_TV_ZOOM_AREA_ID } from "@/lib/fixtures/golden-hybrid-focus";

const sq = (b: { width: number; height: number }) => Math.abs(b.width - b.height) < 1e-6;
const DEFAULT = fitRectToAspectRatio({ x: 0.34, y: 0.34, width: 0.32, height: 0.32 });

// ── Layer model (Phase 1) ────────────────────────────────────────────────────
describe("editor layer model", () => {
  it("1. focus overlay (regions) is below the drawer", () => {
    expect(EDITOR_LAYERS.focusRegions).toBeLessThan(EDITOR_LAYERS.drawer);
  });
  it("2. selected handles are below the drawer", () => {
    expect(EDITOR_LAYERS.selectedFocus).toBeLessThan(EDITOR_LAYERS.drawer);
  });
  it("3. the drawer backdrop is above the focus overlays (masks the canvas beneath)", () => {
    expect(EDITOR_LAYERS.drawerBackdrop).toBeGreaterThan(EDITOR_LAYERS.selectedFocus);
    expect(EDITOR_LAYERS.drawer).toBeGreaterThan(EDITOR_LAYERS.drawerBackdrop);
  });
  it("the layer map is strictly increasing in the documented order", () => {
    const order = [
      EDITOR_LAYERS.scene,
      EDITOR_LAYERS.assets,
      EDITOR_LAYERS.focusRegions,
      EDITOR_LAYERS.selectedFocus,
      EDITOR_LAYERS.contextualActions,
      EDITOR_LAYERS.drawerBackdrop,
      EDITOR_LAYERS.drawer,
      EDITOR_LAYERS.topToolbar,
    ];
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]);
  });
});

// ── Creator vs Template/Internal controls (Phase 5/12) ───────────────────────
describe("creator vs template controls", () => {
  it("15-17. Creator mode hides advanced controls (Enabled/Lock/Reset/Hint)", () => {
    // The FocusSheet gates Enabled/Lock/Reset/Hint behind `advanced = caps.showPrecision`.
    expect(capabilitiesFor("creator").showPrecision).toBe(false);
  });
  it("18. Template/Internal mode may show them", () => {
    expect(capabilitiesFor("template_author").showPrecision).toBe(true);
    expect(capabilitiesFor("internal").showPrecision).toBe(true);
  });
});

// ── Add / name / ratio (Phase 4/8) ───────────────────────────────────────────
describe("add focus area flow", () => {
  it("20. a new area gets an automatic sequential name", () => {
    const doc = goldenLivingNestHybrid();
    expect(nextFocusAreaName(doc.focusAreas ?? [])).toBe(`Focus area ${doc.focusAreas!.length + 1}`);
    expect(nextFocusAreaName([])).toBe("Focus area 1");
  });
  it("21. a new area keeps the fixed (square) ratio", () => {
    const doc = goldenLivingNestHybrid();
    const name = nextFocusAreaName(doc.focusAreas ?? []);
    const { doc: next, id } = addFocusArea(doc, { bounds: DEFAULT, shape: "rect", name, previewHint: `Explore ${name}` });
    const withFocus = updateFocusArea(next, id, { targetType: "zoom_region", focusBounds: DEFAULT });
    const fa = withFocus.focusAreas!.find((f) => f.id === id)!;
    expect(fa.name).toBe(name);
    expect(sq(focusBoundsOf(fa))).toBe(true);
  });
});

// ── Rename / delete / undo (Phase 6/14) ──────────────────────────────────────
describe("rename, delete, undo", () => {
  it("22. rename persists (name + derived hint)", () => {
    const doc = goldenLivingNestHybrid();
    const next = updateFocusArea(doc, GOLDEN_TV_ZOOM_AREA_ID, { name: "Telly", previewHint: "Explore Telly" });
    const fa = next.focusAreas!.find((f) => f.id === GOLDEN_TV_ZOOM_AREA_ID)!;
    expect(fa.name).toBe("Telly");
    expect(fa.previewHint).toBe("Explore Telly");
  });
  it("23 + 24. delete removes the area; undo restores it", () => {
    const base = goldenLivingNestHybrid();
    const removed = removeFocusArea(base, GOLDEN_TV_ZOOM_AREA_ID);
    expect(removed.focusAreas!.some((f) => f.id === GOLDEN_TV_ZOOM_AREA_ID)).toBe(false);
    let h = createHistory(base, 50);
    h = pushHistory(h, removed);
    expect(undoHistory(h).present.focusAreas!.some((f) => f.id === GOLDEN_TV_ZOOM_AREA_ID)).toBe(true);
  });
});

// ── Persistence (Phase 14) ───────────────────────────────────────────────────
describe("name + bounds persistence", () => {
  it("25. Save/Load preserves name + focusBounds", () => {
    const doc = goldenLivingNestHybrid();
    clearDraft(doc.id);
    expect(saveDraft(doc).ok).toBe(true);
    const fa = loadDraft(doc.id).doc!.focusAreas!.find((f) => f.id === GOLDEN_TV_ZOOM_AREA_ID)!;
    const src = doc.focusAreas!.find((f) => f.id === GOLDEN_TV_ZOOM_AREA_ID)!;
    expect(fa.name).toBe(src.name);
    expect(fa.focusBounds).toEqual(src.focusBounds);
  });
  it("26. Export/Import preserves name + focusBounds", () => {
    const doc = goldenLivingNestHybrid();
    const r = importDocumentJson(serializeEditorDocument(doc));
    expect(r.ok).toBe(true);
    expect(r.doc!.focusAreas).toEqual(doc.focusAreas);
  });
});
