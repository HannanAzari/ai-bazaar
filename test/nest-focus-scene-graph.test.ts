import { describe, expect, it } from "vitest";
import { MAX_FOCUS_DEPTH } from "@/lib/nest-focus-types";
import type { NestFocusArea } from "@/lib/nest-focus-types";
import { serializeEditorDocument } from "@/lib/nest-editor";
import { saveDraft, loadDraft, clearDraft, importDocumentJson } from "@/lib/nest-editor-storage";
import { createHistory, pushHistory, undoHistory } from "@/lib/nest-editor-history";
import {
  canEnterEditorScene,
  canExitEditorScene,
  childSceneIdOf,
  documentSceneDepth,
  editorSceneDepth,
  enterEditorScene,
  ensureFocusChildScene,
  exitEditorScene,
  focusAreaHasContent,
  getDetailScene,
  getEditorScene,
  isVisitableFocusArea,
  migrateDocumentToSceneGraph,
  parentEditorScene,
  removeFocusArea,
  rootEditorSceneContext,
  setDetailSceneObjects,
  validateSceneGraph,
} from "@/lib/nest-focus-scenes";
import { goldenLivingNestHybrid, GOLDEN_TV_ZOOM_AREA_ID } from "@/lib/fixtures/golden-hybrid-focus";

const NOW = "2026-07-01T00:00:00.000Z";

// ── Data model (Phase 18) ────────────────────────────────────────────────────
describe("scene graph data model", () => {
  it("1 + 3. the root scene view exposes the Main objects + a valid root id", () => {
    const doc = goldenLivingNestHybrid();
    const root = getEditorScene(doc, "");
    expect(root.sceneType).toBe("main");
    expect(root.id).toBe(doc.id);
    expect(root.objects).toBe(doc.objects);
    expect(root.focusAreas.length).toBe(doc.focusAreas!.length);
  });
  it("2 + 4 + 5. a Focus Area gets a deterministic child scene linked both ways", () => {
    const doc = goldenLivingNestHybrid();
    const { doc: next, childSceneId } = ensureFocusChildScene(doc, GOLDEN_TV_ZOOM_AREA_ID, NOW);
    expect(childSceneId).toBe("detail-1");
    const child = getDetailScene(next, childSceneId)!;
    expect(child).toBeTruthy();
    expect(child.sceneType).toBe("focus");
    expect(child.backgroundSource?.type).toBe("parent_crop");
    expect(child.parentSceneId).toBe(next.id);
    expect(child.parentFocusAreaId).toBe(GOLDEN_TV_ZOOM_AREA_ID);
    const fa = next.focusAreas!.find((f) => f.id === GOLDEN_TV_ZOOM_AREA_ID)!;
    expect(childSceneIdOf(fa)).toBe(childSceneId);
  });
  it("ensureFocusChildScene is idempotent", () => {
    const doc = goldenLivingNestHybrid();
    const a = ensureFocusChildScene(doc, GOLDEN_TV_ZOOM_AREA_ID, NOW);
    const b = ensureFocusChildScene(a.doc, GOLDEN_TV_ZOOM_AREA_ID, NOW);
    expect(b.childSceneId).toBe(a.childSceneId);
    expect(b.doc.detailScenes!.length).toBe(a.doc.detailScenes!.length);
  });
  it("6. migrate gives every Focus Area a child scene; the graph validates", () => {
    const doc = migrateDocumentToSceneGraph(goldenLivingNestHybrid(), NOW);
    for (const fa of doc.focusAreas!) {
      expect(getDetailScene(doc, childSceneIdOf(fa))).toBeTruthy();
    }
    expect(validateSceneGraph(doc).ok).toBe(true);
  });
  it("7. depth follows the parent chain without cycling", () => {
    const { doc, childSceneId } = ensureFocusChildScene(goldenLivingNestHybrid(), GOLDEN_TV_ZOOM_AREA_ID, NOW);
    expect(documentSceneDepth(doc, doc.id)).toBe(0);
    expect(documentSceneDepth(doc, childSceneId)).toBe(1);
  });
  it("8. max nesting depth is enforced in the scene stack", () => {
    let ctx = rootEditorSceneContext();
    for (let i = 0; i < MAX_FOCUS_DEPTH; i++) ctx = enterEditorScene(ctx, `s${i}`);
    expect(editorSceneDepth(ctx)).toBe(MAX_FOCUS_DEPTH);
    expect(canEnterEditorScene(ctx)).toBe(false);
    expect(enterEditorScene(ctx, "too-deep")).toEqual(ctx); // capped
  });
});

// ── Scene stack (pure) ───────────────────────────────────────────────────────
describe("editor scene stack", () => {
  it("enter pushes, exit pops back to the parent", () => {
    const root = rootEditorSceneContext();
    expect(canExitEditorScene(root)).toBe(false);
    const inChild = enterEditorScene(root, "focus-tv");
    expect(inChild.activeSceneId).toBe("focus-tv");
    expect(inChild.sceneStack).toEqual(["", "focus-tv"]);
    expect(parentEditorScene(inChild)).toBe("");
    expect(canExitEditorScene(inChild)).toBe(true);
    expect(exitEditorScene(inChild)).toEqual(root);
  });
  it("rapid enters do not duplicate the stack past the limit", () => {
    let ctx = rootEditorSceneContext();
    ctx = enterEditorScene(ctx, "a");
    ctx = enterEditorScene(ctx, "b");
    ctx = enterEditorScene(ctx, "c");
    ctx = enterEditorScene(ctx, "d"); // depth would be 4 > MAX(3) → capped
    expect(ctx.sceneStack).toEqual(["", "a", "b", "c"]);
  });
});

// ── Child-scene editing isolation (Phase 18) ─────────────────────────────────
describe("child scene object isolation", () => {
  const child = (doc = goldenLivingNestHybrid()) => ensureFocusChildScene(doc, GOLDEN_TV_ZOOM_AREA_ID, NOW);
  it("4-6. adding/removing objects in a child does not touch the Main scene", () => {
    const { doc, childSceneId } = child();
    const mainCount = doc.objects.length;
    const obj = { instanceId: "child-1", assetId: "ast-stacked-books", x: 0.4, y: 0.4, width: 0.2, height: 0.2, anchor: { x: 0.5, y: 0.6 }, plane: "floor" as const, zIndex: 1 };
    const next = setDetailSceneObjects(doc, childSceneId, [obj], NOW);
    expect(next.objects.length).toBe(mainCount); // Main untouched
    expect(getDetailScene(next, childSceneId)!.objects).toHaveLength(1);
  });
  it("8 + 12. undo Enter / undo delete restores correctly", () => {
    const base = goldenLivingNestHybrid();
    const entered = child(base).doc;
    let h = createHistory(base, 50);
    h = pushHistory(h, entered);
    expect(undoHistory(h).present.detailScenes ?? []).toHaveLength(0); // Enter undone
    // delete a populated area cascades the child scene; undo restores both
    const withObj = setDetailSceneObjects(entered, child(base).childSceneId, [{ instanceId: "o", assetId: "ast-stacked-books", x: 0.4, y: 0.4, width: 0.2, height: 0.2, anchor: { x: 0.5, y: 0.6 }, plane: "floor", zIndex: 1 }], NOW);
    expect(focusAreaHasContent(withObj, GOLDEN_TV_ZOOM_AREA_ID)).toBe(true);
    const removed = removeFocusArea(withObj, GOLDEN_TV_ZOOM_AREA_ID);
    expect(removed.focusAreas!.some((f) => f.id === GOLDEN_TV_ZOOM_AREA_ID)).toBe(false);
    let h2 = createHistory(withObj, 50);
    h2 = pushHistory(h2, removed);
    const restored = undoHistory(h2).present;
    expect(restored.focusAreas!.some((f) => f.id === GOLDEN_TV_ZOOM_AREA_ID)).toBe(true);
    expect(getDetailScene(restored, child(base).childSceneId)).toBeTruthy();
  });
});

// ── Persistence (Phase 18) ───────────────────────────────────────────────────
describe("scene graph persistence", () => {
  const populated = () => {
    const { doc, childSceneId } = ensureFocusChildScene(goldenLivingNestHybrid(), GOLDEN_TV_ZOOM_AREA_ID, NOW);
    return setDetailSceneObjects(doc, childSceneId, [{ instanceId: "child-book", assetId: "ast-stacked-books", x: 0.4, y: 0.5, width: 0.2, height: 0.15, anchor: { x: 0.5, y: 0.65 }, plane: "floor", zIndex: 1, hotspots: [{ id: "h", name: "Read", semantic: "article", shape: { type: "rect", x: 0.1, y: 0.1, width: 0.8, height: 0.8 }, enabled: true }] }], NOW);
  };
  it("1 + 3 + 4. Save/Load preserves the child scene, its objects + hotspots", () => {
    const doc = populated();
    clearDraft(doc.id);
    expect(saveDraft(doc).ok).toBe(true);
    const r = loadDraft(doc.id).doc!;
    const child = getDetailScene(r, "detail-1")!;
    expect(child.sceneType).toBe("focus");
    expect(child.objects[0].instanceId).toBe("child-book");
    expect(child.objects[0].hotspots).toHaveLength(1);
  });
  it("2. Export/Import preserves the scene graph", () => {
    const doc = populated();
    const r = importDocumentJson(serializeEditorDocument(doc));
    expect(r.ok).toBe(true);
    expect(r.doc!.detailScenes).toEqual(doc.detailScenes);
    expect(r.doc!.focusAreas).toEqual(doc.focusAreas);
  });
});

// ── Preview / visitor visibility (the release-blocker fix) ───────────────────
describe("focus area visibility (Preview/visitor)", () => {
  const editorAuthored: NestFocusArea = {
    id: "focus-9", name: "Focus area 1", sourceSceneId: "main", targetSceneId: "",
    targetType: "zoom_region", focusBounds: { x: 0.34, y: 0.34, width: 0.32, height: 0.32 },
    bounds: { x: 0.34, y: 0.34, width: 0.32, height: 0.32 }, shape: "rect",
    trigger: "tap", transition: "cinematic_zoom", enabled: true,
  };
  it("6. an editor-authored area (no zoomRegion) is visitable — the M7C.6 fix", () => {
    expect(editorAuthored.zoomRegion).toBeUndefined();
    expect(isVisitableFocusArea(editorAuthored)).toBe(true);
  });
  it("a disabled or locked area is not visitable", () => {
    expect(isVisitableFocusArea({ ...editorAuthored, enabled: false })).toBe(false);
    expect(isVisitableFocusArea({ ...editorAuthored, locked: true })).toBe(false);
  });
});
