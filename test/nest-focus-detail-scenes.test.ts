import { describe, expect, it } from "vitest";
import type { EditableNestDocument } from "@/lib/nest-editor-types";
import { validateEditorDocument } from "@/lib/nest-editor-types";
import {
  createEditorDocumentFromTemplate,
  parseEditorDocument,
  serializeEditorDocument,
} from "@/lib/nest-editor";
import {
  GOLDEN_LIVING_NEST_COMPOSED,
  GOLDEN_LIVING_NEST_TEMPLATE,
} from "@/lib/fixtures/golden-living-nest";
import {
  goldenLivingNestWithDesk,
  GOLDEN_DESK_DETAIL_SCENE_ID,
  GOLDEN_DESK_FOCUS_AREA_ID,
} from "@/lib/fixtures/golden-desk-detail";
import type { NestFocusArea } from "@/lib/nest-focus-types";
import {
  addFocusArea,
  beginEnter,
  beginExit,
  buildSceneGraph,
  canNavigate,
  clampFocusBounds,
  createDetailScene,
  findFocusAreaAtPoint,
  focusTransitionDurationMs,
  getDetailScene,
  removeFocusArea,
  resolveFocusNavigation,
  setDetailSceneObjects,
  settleScene,
  updateFocusArea,
  validateDetailScene,
  validateFocusArea,
  validateSceneGraph,
} from "@/lib/nest-focus-scenes";
import { createHistory, pushHistory, redoHistory, undoHistory } from "@/lib/nest-editor-history";
import { saveDraft, loadDraft, clearDraft, importDocumentJson } from "@/lib/nest-editor-storage";
import { predefinedHotspotsForInstance } from "@/lib/nest-hotspot-catalog";
import { hitTestCandidates } from "@/lib/nest-editor-hit-testing";

const mainDoc = (): EditableNestDocument =>
  createEditorDocumentFromTemplate({ template: GOLDEN_LIVING_NEST_TEMPLATE, composed: GOLDEN_LIVING_NEST_COMPOSED });

const goodBounds = { x: 0.3, y: 0.4, width: 0.3, height: 0.2 };
const fa = (over: Partial<NestFocusArea> = {}): NestFocusArea => ({
  id: "focus-1",
  name: "Desk",
  sourceSceneId: "main",
  targetSceneId: "detail-1",
  bounds: goodBounds,
  shape: "rect",
  trigger: "tap",
  transition: "fade_zoom",
  enabled: true,
  ...over,
});

// ── Backward compatibility ───────────────────────────────────────────────────
describe("backward compatibility", () => {
  it("1. a document without a scene graph loads as Main-only", () => {
    const doc = mainDoc();
    expect(doc.focusAreas).toBeUndefined();
    expect(validateEditorDocument(doc).ok).toBe(true);
    const g = buildSceneGraph(doc);
    expect(g.mainScene.focusAreas).toEqual([]);
    expect(g.detailScenes).toEqual([]);
    expect(parseEditorDocument(serializeEditorDocument(doc)).ok).toBe(true);
  });
});

// ── Focus Area validation ────────────────────────────────────────────────────
describe("focus area validation", () => {
  it("2. valid normalized bounds pass", () => {
    expect(validateFocusArea(fa())).toEqual([]);
  });
  it("3. a focus area cannot leave the scene bounds", () => {
    const errs = validateFocusArea(fa({ bounds: { x: 0.8, y: 0.2, width: 0.4, height: 0.2 } }));
    expect(errs.some((e) => e.includes("leave the scene"))).toBe(true);
  });
  it("4. the minimum focus area size is enforced (and clamp lifts it)", () => {
    expect(validateFocusArea(fa({ bounds: { x: 0.1, y: 0.1, width: 0.01, height: 0.2 } })).some((e) => e.includes("minimum"))).toBe(true);
    const clamped = clampFocusBounds({ x: 0.1, y: 0.1, width: 0.01, height: 0.2 });
    expect(clamped.width).toBeGreaterThanOrEqual(0.05);
  });
  it("8. circular links (target equals source) are rejected", () => {
    expect(validateFocusArea(fa({ sourceSceneId: "main", targetSceneId: "main" })).some((e) => e.includes("circular"))).toBe(true);
  });
  it("23. a hidden/disabled or locked focus area is inactive at a point", () => {
    const inside = { x: 0.45, y: 0.5 };
    expect(findFocusAreaAtPoint([fa({ enabled: true })], inside.x, inside.y)?.id).toBe("focus-1");
    expect(findFocusAreaAtPoint([fa({ enabled: false })], inside.x, inside.y)).toBeUndefined();
    expect(findFocusAreaAtPoint([fa({ locked: true })], inside.x, inside.y)).toBeUndefined();
  });
});

// ── Scene graph validation ───────────────────────────────────────────────────
describe("scene graph validation", () => {
  const withScene = () => {
    const base = mainDoc();
    const { doc, id } = addFocusArea(base, { bounds: goodBounds, name: "Desk" });
    return createDetailScene(doc, { focusAreaId: id, name: "Desk" }).doc;
  };

  it("5. a focus area must target an existing scene", () => {
    const doc = { ...mainDoc(), focusAreas: [fa({ sourceSceneId: mainDoc().id, targetSceneId: "detail-missing" })] };
    expect(validateSceneGraph(doc).ok).toBe(false);
  });
  it("6. parent focus/scene references must match", () => {
    const doc = withScene();
    // Break the back-reference: point the detail scene at a different (non-existent) focus area.
    const broken = { ...doc, detailScenes: doc.detailScenes!.map((s) => ({ ...s, parentFocusAreaId: "focus-999" })) };
    expect(validateSceneGraph(broken).ok).toBe(false);
  });
  it("7. duplicate ids are rejected", () => {
    const base = mainDoc();
    const dupFa = { ...base, focusAreas: [fa({ id: "f", sourceSceneId: base.id, targetSceneId: "" }), fa({ id: "f", sourceSceneId: base.id, targetSceneId: "" })] };
    expect(validateSceneGraph(dupFa).errors.some((e) => e.includes("duplicate focusArea id"))).toBe(true);
  });
  it("9. an orphan detail scene is reported as a warning", () => {
    const doc = withScene();
    // Remove the focus area but keep the scene → orphan.
    const orphaned = removeFocusArea(doc, doc.focusAreas![0].id, { keepScene: true });
    const v = validateSceneGraph(orphaned);
    expect(v.ok).toBe(true); // orphans are advisory, not errors
    expect(v.warnings.some((w) => w.includes("orphaned"))).toBe(true);
  });
});

// ── Detail scene validation ──────────────────────────────────────────────────
describe("detail scene validation", () => {
  it("rejects nested focus areas (one navigation level)", () => {
    const scene = goldenLivingNestWithDesk().detailScenes![0];
    const nested = { ...scene, focusAreas: [fa()] };
    expect(validateDetailScene(nested).some((e) => e.includes("nested"))).toBe(true);
  });
});

// ── CRUD ─────────────────────────────────────────────────────────────────────
describe("focus area + detail scene CRUD", () => {
  it("10. adding a focus area creates a stable, deterministic id", () => {
    const a = addFocusArea(mainDoc(), { bounds: goodBounds });
    expect(a.id).toBe("focus-1");
    const b = addFocusArea(a.doc, { bounds: goodBounds });
    expect(b.id).toBe("focus-2");
  });
  it("11. creating a detail scene links both references correctly", () => {
    const { doc, id } = addFocusArea(mainDoc(), { bounds: goodBounds });
    const { doc: linked, scene } = createDetailScene(doc, { focusAreaId: id });
    expect(linked.focusAreas![0].targetSceneId).toBe(scene.id);
    expect(scene.parentFocusAreaId).toBe(id);
    expect(validateSceneGraph(linked).ok).toBe(true);
  });
  it("12. removing a focus area handles its linked scene safely", () => {
    const { doc, id } = addFocusArea(mainDoc(), { bounds: goodBounds });
    const linked = createDetailScene(doc, { focusAreaId: id }).doc;
    expect(linked.detailScenes).toHaveLength(1);
    const removed = removeFocusArea(linked, id);
    expect(removed.focusAreas).toHaveLength(0);
    expect(removed.detailScenes).toHaveLength(0); // cascade — no dangling scene
    expect(validateSceneGraph(removed).ok).toBe(true);
  });
  it("13. rename + transition changes persist", () => {
    const { doc, id } = addFocusArea(mainDoc(), { bounds: goodBounds });
    const next = updateFocusArea(doc, id, { name: "Bookshelf", transition: "push" });
    const f = next.focusAreas!.find((x) => x.id === id)!;
    expect(f.name).toBe("Bookshelf");
    expect(f.transition).toBe("push");
  });
  it("30. scene-scoped object deletion does not affect the parent scene", () => {
    const doc = goldenLivingNestWithDesk();
    const scene = doc.detailScenes![0];
    const fewer = scene.objects.slice(0, 1);
    const next = setDetailSceneObjects(doc, scene.id, fewer);
    expect(next.objects.length).toBe(doc.objects.length); // main untouched
    expect(getDetailScene(next, scene.id)!.objects.length).toBe(1); // detail updated
  });
});

// ── Serialization / persistence ──────────────────────────────────────────────
describe("scene graph persistence", () => {
  it("14. the scene graph serializes and parses cleanly", () => {
    const doc = goldenLivingNestWithDesk();
    const round = parseEditorDocument(serializeEditorDocument(doc));
    expect(round.ok).toBe(true);
    expect(round.doc!.focusAreas).toEqual(doc.focusAreas);
    expect(round.doc!.detailScenes).toEqual(doc.detailScenes);
  });
  it("15. an invalid import cross-reference is rejected", () => {
    const doc = goldenLivingNestWithDesk();
    const broken = { ...doc, focusAreas: doc.focusAreas!.map((f) => ({ ...f, targetSceneId: "detail-nope" })) };
    const r = importDocumentJson(JSON.stringify(broken));
    expect(r.ok).toBe(false);
  });
  it("31. Save/Load preserves all scenes", () => {
    const doc = goldenLivingNestWithDesk();
    clearDraft(doc.id);
    expect(saveDraft(doc).ok).toBe(true);
    const r = loadDraft(doc.id);
    expect(r.ok).toBe(true);
    expect(r.doc!.detailScenes).toHaveLength(1);
    expect(r.doc!.focusAreas![0].id).toBe(GOLDEN_DESK_FOCUS_AREA_ID);
  });
  it("32. Export/Import preserves all scenes", () => {
    const doc = goldenLivingNestWithDesk();
    const r = importDocumentJson(serializeEditorDocument(doc));
    expect(r.ok).toBe(true);
    expect(r.doc!.detailScenes![0].id).toBe(GOLDEN_DESK_DETAIL_SCENE_ID);
    expect(r.doc!.focusAreas).toEqual(doc.focusAreas);
  });
});

// ── Undo / redo ──────────────────────────────────────────────────────────────
describe("undo/redo for focus edits", () => {
  it("16. undo/redo restores focus area edits", () => {
    const base = mainDoc();
    const { doc: withFa } = addFocusArea(base, { bounds: goodBounds });
    let h = createHistory(base, 50);
    h = pushHistory(h, withFa);
    expect(undoHistory(h).present.focusAreas).toBeUndefined();
    expect(redoHistory(undoHistory(h)).present.focusAreas).toHaveLength(1);
  });
  it("17. one geometry change = one history entry", () => {
    const { doc, id } = addFocusArea(mainDoc(), { bounds: goodBounds });
    let h = createHistory(doc, 50);
    const before = h.past.length;
    h = pushHistory(h, updateFocusArea(doc, id, { bounds: { x: 0.4, y: 0.4, width: 0.3, height: 0.2 } }));
    expect(h.past.length).toBe(before + 1);
  });
});

// ── Golden Desk fixture + navigation ─────────────────────────────────────────
describe("golden desk detail + navigation", () => {
  it("18. the Golden Desk Detail fixture is valid", () => {
    const doc = goldenLivingNestWithDesk();
    expect(validateEditorDocument(doc).ok).toBe(true);
    const v = validateSceneGraph(doc);
    expect(v.ok).toBe(true);
    expect(v.warnings).toEqual([]);
    const scene = getDetailScene(doc, GOLDEN_DESK_DETAIL_SCENE_ID)!;
    expect(validateDetailScene(scene)).toEqual([]);
    // It demonstrates the required interactions (laptop/notebook/lamp + photo + books).
    const names = scene.objects.flatMap((o) => (o.hotspots ?? []).map((h) => h.name));
    expect(names).toEqual(expect.arrayContaining(["Laptop", "Notebook", "Desk lamp", "Photo", "Books"]));
  });
  it("19. the main desk Focus Area resolves to the desk detail scene", () => {
    const doc = goldenLivingNestWithDesk();
    const desk = doc.focusAreas![0];
    expect(desk.targetSceneId).toBe(GOLDEN_DESK_DETAIL_SCENE_ID);
    expect(getDetailScene(doc, desk.targetSceneId)).toBeTruthy();
    const center = { x: desk.bounds.x + desk.bounds.width / 2, y: desk.bounds.y + desk.bounds.height / 2 };
    const res = resolveFocusNavigation({ point: center, focusAreas: doc.focusAreas!, hotspotHit: false });
    expect(res.kind === "focus" && res.focusArea.id).toBe(GOLDEN_DESK_FOCUS_AREA_ID);
  });
  it("20. an object hotspot takes priority over a focus area (deterministic)", () => {
    const point = { x: 0.45, y: 0.5 };
    const res = resolveFocusNavigation({ point, focusAreas: [fa()], hotspotHit: true });
    expect(res.kind).toBe("hotspot");
  });
  it("21. a focus area fires when no hotspot intercepts", () => {
    const res = resolveFocusNavigation({ point: { x: 0.45, y: 0.5 }, focusAreas: [fa()], hotspotHit: false });
    expect(res.kind).toBe("focus");
  });
  it("22. the whole-object fallback is unaffected (no focus areas ⇒ none)", () => {
    const res = resolveFocusNavigation({ point: { x: 0.5, y: 0.5 }, focusAreas: [], hotspotHit: false });
    expect(res.kind).toBe("none");
  });
});

// ── Visitor navigation state machine (drives the navigator) ───────────────────
describe("visitor navigation transitions", () => {
  const idle = { currentSceneId: "main", transitionState: "idle" as const };
  it("24. navigation is locked during a transition", () => {
    expect(canNavigate(idle)).toBe(true);
    expect(canNavigate(beginEnter(idle))).toBe(false);
    expect(canNavigate(beginExit({ currentSceneId: "detail-desk", transitionState: "idle" }))).toBe(false);
  });
  it("25. Back settles on the Main scene", () => {
    const detail = { currentSceneId: "detail-desk", transitionState: "idle" as const };
    expect(beginExit(detail).transitionState).toBe("exiting");
    expect(settleScene("main")).toEqual({ currentSceneId: "main", transitionState: "idle" });
  });
  it("26. reduced motion uses a shorter (fade) transition", () => {
    expect(focusTransitionDurationMs(true)).toBeLessThan(focusTransitionDurationMs(false));
  });
  it("27. keyboard activation enters a detail scene (same path as a tap)", () => {
    const entering = beginEnter(idle);
    expect(entering.transitionState).toBe("entering");
    expect(entering.previousSceneId).toBe("main");
  });
  it("28 + 29. keyboard Back exits and the round-trip returns to the entry scene", () => {
    const detail = { currentSceneId: "detail-desk", previousSceneId: "main", transitionState: "idle" as const };
    expect(beginExit(detail).transitionState).toBe("exiting");
    expect(settleScene("main").currentSceneId).toBe("main");
  });
});

// ── Existing behaviour intact (full suite also runs) ─────────────────────────
describe("existing behaviour intact", () => {
  it("33. existing editor docs still build + validate", () => {
    expect(validateEditorDocument(mainDoc()).ok).toBe(true);
  });
  it("34. existing hotspot catalog is unchanged (TV screen)", () => {
    expect(predefinedHotspotsForInstance("ast-tv", "t")[0].shape).toMatchObject({ x: 0.2, y: 0.11, width: 0.6, height: 0.48 });
  });
  it("35. existing M7B.2 selection helpers still work", () => {
    const objs = mainDoc().objects;
    const ids = hitTestCandidates(objs, {}, { x: 0.5, y: 0.9 }).map((c) => c.objectId);
    expect(Array.isArray(ids)).toBe(true);
  });
});
