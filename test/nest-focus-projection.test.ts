import { describe, expect, it } from "vitest";
import {
  childToParentRect,
  inheritedBindingKey,
  inheritedObjectId,
  intersectRect,
  isInheritedObjectId,
  parentToChildPoint,
  parentToChildRect,
  parseInheritedObjectId,
  projectChildObjectsToMain,
  rectsIntersect,
  resolveInheritedFocusObjects,
  resolveInheritedHotspotBinding,
  setChildProjectionPolicy,
  setInheritedHotspotBinding,
  shouldProjectChild,
} from "@/lib/nest-focus-projection";
import { cinematicFocusTransformCss, ensureFocusChildScene, focusBoundsOf, getDetailScene, setDetailSceneObjects } from "@/lib/nest-focus-scenes";
import { serializeEditorDocument } from "@/lib/nest-editor";
import { importDocumentJson } from "@/lib/nest-editor-storage";
import { goldenLivingNestHybrid, GOLDEN_TV_ZOOM_AREA_ID } from "@/lib/fixtures/golden-hybrid-focus";
import type { EditableNestObject } from "@/lib/nest-editor-types";
import type { NestDetailScene, NestFocusBounds } from "@/lib/nest-focus-types";

const NOW = "2026-07-01T00:00:00.000Z";
const FOCUS: NestFocusBounds = { x: 0.3, y: 0.3, width: 0.4, height: 0.4 };

const obj = (id: string, p: Partial<EditableNestObject> = {}): EditableNestObject => ({
  instanceId: id,
  assetId: "ast-stacked-books",
  x: 0.4, y: 0.4, width: 0.2, height: 0.15,
  anchor: { x: 0.5, y: 1 },
  plane: "front_wall",
  zIndex: 5,
  ...p,
});

// Build a Main doc + a TV Focus Scene with one native child "books" object.
function tvFocusDoc(books?: EditableNestObject) {
  const doc0 = goldenLivingNestHybrid();
  const { doc, childSceneId } = ensureFocusChildScene(doc0, GOLDEN_TV_ZOOM_AREA_ID, NOW);
  const withChild = books ? setDetailSceneObjects(doc, childSceneId, [books], NOW) : doc;
  return { doc: withChild, childSceneId, focus: focusBoundsOf(doc.focusAreas!.find((f) => f.id === GOLDEN_TV_ZOOM_AREA_ID)!) };
}

describe("M7C.8 — shared focus transform", () => {
  it("2. parent↔child rect mapping is an exact inverse", () => {
    const child: NestFocusBounds = { x: 0.25, y: 0.5, width: 0.5, height: 0.25 };
    const parent = childToParentRect(child, FOCUS);
    expect(parentToChildRect(parent, FOCUS)).toEqual(child);
  });
  it("agrees with the renderer's cinematic crop transform", () => {
    // The cinematic transform scales the parent by 1/focus.width and shifts focus.origin→0.
    const t = cinematicFocusTransformCss(FOCUS);
    const scale = +t.transform.match(/scale\(([0-9.]+)\)/)![1];
    expect(scale).toBeCloseTo(1 / FOCUS.width, 5);
    // A parent point at the focus origin lands at child-local 0; at the far corner → 1.
    expect(parentToChildPoint({ x: FOCUS.x, y: FOCUS.y }, FOCUS)).toEqual({ x: 0, y: 0 });
    expect(parentToChildPoint({ x: FOCUS.x + FOCUS.width, y: FOCUS.y + FOCUS.height }, FOCUS)).toEqual({ x: 1, y: 1 });
  });
  it("3. intersection + clipping", () => {
    expect(rectsIntersect(FOCUS, { x: 0.5, y: 0.5, width: 0.3, height: 0.3 })).toBe(true);
    expect(rectsIntersect(FOCUS, { x: 0.8, y: 0.8, width: 0.1, height: 0.1 })).toBe(false);
    expect(intersectRect(FOCUS, { x: 0.5, y: 0.5, width: 0.4, height: 0.4 })).toEqual({ x: 0.5, y: 0.5, width: 0.2, height: 0.2 });
    expect(intersectRect(FOCUS, { x: 0.9, y: 0.9, width: 0.1, height: 0.1 })).toBeNull();
  });
  it("stable inherited identity round-trips and never collides", () => {
    expect(parseInheritedObjectId(inheritedObjectId("obj-7"))).toBe("obj-7");
    expect(isInheritedObjectId("obj-7")).toBe(false);
    expect(parseInheritedObjectId("obj-7")).toBeNull();
  });
});

describe("M7C.8 Part A — inherited parent objects", () => {
  it("1+3. parent objects intersecting the Focus Area surface as inherited proxies", () => {
    const { doc, childSceneId } = tvFocusDoc();
    const inh = resolveInheritedFocusObjects(doc, childSceneId);
    expect(inh.length).toBeGreaterThan(0);
    // Every inherited object's child bounds equal the parent box mapped by the focus transform.
    const focus = focusBoundsOf(doc.focusAreas!.find((f) => f.id === GOLDEN_TV_ZOOM_AREA_ID)!);
    for (const o of inh) {
      const parent = doc.objects.find((p) => p.instanceId === o.parentObjectId)!;
      expect(o.childBounds).toEqual(parentToChildRect({ x: parent.x, y: parent.y, width: parent.width, height: parent.height }, focus));
    }
  });
  it("4. inherited objects are read-only", () => {
    const { doc, childSceneId } = tvFocusDoc();
    for (const o of resolveInheritedFocusObjects(doc, childSceneId)) {
      expect(o.locked).toBe(true);
      expect(o.inherited).toBe(true);
    }
  });
  it("3b. inherited hotspots keep their asset-local geometry (alignment preserved)", () => {
    const { doc, childSceneId } = tvFocusDoc();
    const inh = resolveInheritedFocusObjects(doc, childSceneId);
    const withHs = inh.find((o) => o.hotspots.length > 0);
    expect(withHs).toBeTruthy();
    const parent = doc.objects.find((p) => p.instanceId === withHs!.parentObjectId)!;
    expect(withHs!.hotspots.map((h) => h.shape)).toEqual((parent.hotspots ?? []).map((h) => h.shape));
  });
  it("5+6. child binding override beats parent; absent override falls back to parent", () => {
    const { doc, childSceneId } = tvFocusDoc();
    const inh = resolveInheritedFocusObjects(doc, childSceneId);
    const target = inh.find((o) => o.hotspots.length > 0)!;
    const hs = target.hotspots[0];
    const scene0 = getDetailScene(doc, childSceneId);
    // Fallback first.
    expect(resolveInheritedHotspotBinding(scene0, target.parentObjectId, doc.objects.find((p) => p.instanceId === target.parentObjectId)!.hotspots![0]))
      .toEqual(doc.objects.find((p) => p.instanceId === target.parentObjectId)!.hotspots![0].binding);
    // Override.
    const override = { type: hs.semantic, url: "https://example.com/child", label: "Child link" };
    const doc2 = setInheritedHotspotBinding(doc, childSceneId, target.parentObjectId, hs.id, override, NOW);
    const scene2 = getDetailScene(doc2, childSceneId)!;
    expect(scene2.inheritedBindings![inheritedBindingKey(target.parentObjectId, hs.id)]).toEqual(override);
    const inh2 = resolveInheritedFocusObjects(doc2, childSceneId);
    expect(inh2.find((o) => o.parentObjectId === target.parentObjectId)!.hotspots.find((h) => h.id === hs.id)!.binding).toEqual(override);
    // Clearing restores the parent binding.
    const doc3 = setInheritedHotspotBinding(doc2, childSceneId, target.parentObjectId, hs.id, undefined, NOW);
    expect(getDetailScene(doc3, childSceneId)!.inheritedBindings![inheritedBindingKey(target.parentObjectId, hs.id)]).toBeUndefined();
  });
  it("16. no parent artwork is duplicated — inherited proxies carry no native child entry", () => {
    const { doc, childSceneId } = tvFocusDoc(obj("books-1"));
    const inh = resolveInheritedFocusObjects(doc, childSceneId);
    const child = getDetailScene(doc, childSceneId)!;
    // Inherited ids are all derived; none equals a native child object id.
    expect(inh.every((o) => isInheritedObjectId(o.derivedId))).toBe(true);
    expect(inh.some((o) => o.parentObjectId === "books-1")).toBe(false);
    expect(child.objects.map((o) => o.instanceId)).toEqual(["books-1"]);
  });
});

describe("M7C.8 Part B — child → Main projection", () => {
  it("7+20. a child object projects into Main at the mapped, clipped position", () => {
    const { doc, focus } = tvFocusDoc(obj("books-1", { x: 0.4, y: 0.5, width: 0.2, height: 0.15 }));
    const proj = projectChildObjectsToMain(doc);
    expect(proj.length).toBe(1);
    expect(proj[0].instanceId).toBe("books-1");
    const expected = childToParentRect({ x: 0.4, y: 0.5, width: 0.2, height: 0.15 }, focus);
    expect(proj[0].parentBounds).toEqual(expected);
    expect(proj[0].focusAreaId).toBe(GOLDEN_TV_ZOOM_AREA_ID);
  });
  it("8. projection updates after a move", () => {
    const a = projectChildObjectsToMain(tvFocusDoc(obj("b", { x: 0.2, y: 0.2 })).doc)[0];
    const b = projectChildObjectsToMain(tvFocusDoc(obj("b", { x: 0.6, y: 0.2 })).doc)[0];
    expect(b.parentBounds.x).toBeGreaterThan(a.parentBounds.x);
  });
  it("9. projection updates after a resize", () => {
    const a = projectChildObjectsToMain(tvFocusDoc(obj("b", { width: 0.2 })).doc)[0];
    const b = projectChildObjectsToMain(tvFocusDoc(obj("b", { width: 0.4 })).doc)[0];
    expect(b.parentBounds.width).toBeGreaterThan(a.parentBounds.width);
  });
  it("10. projection preserves rotation + flip", () => {
    const p = projectChildObjectsToMain(tvFocusDoc(obj("b", { rotation: 30, flipX: true })).doc)[0];
    expect(p.rotation).toBe(30);
    expect(p.flipX).toBe(true);
  });
  it("11. a hidden or opted-out child does not project; deleting removes it", () => {
    expect(projectChildObjectsToMain(tvFocusDoc(obj("b", { hidden: true })).doc)).toHaveLength(0);
    expect(projectChildObjectsToMain(tvFocusDoc(obj("b", { projection: { showInParent: false } })).doc)).toHaveLength(0);
    expect(projectChildObjectsToMain(tvFocusDoc().doc)).toHaveLength(0); // none added/deleted
  });
  it("12. projection is clipped to the Focus Area (cannot spill outside)", () => {
    const { doc, focus } = tvFocusDoc(obj("b", { x: 0.8, y: 0.1, width: 0.5, height: 0.2 })); // extends past viewport right edge
    const p = projectChildObjectsToMain(doc)[0];
    expect(p.parentBounds.x + p.parentBounds.width).toBeLessThanOrEqual(focus.x + focus.width + 1e-9);
  });
  it("policy: preview_only hides from the editor Main but shows in the visitor", () => {
    const d = tvFocusDoc(obj("b", { projection: { showInParent: true, parentVisibility: "preview_only" } })).doc;
    expect(projectChildObjectsToMain(d, { mode: "editor" })).toHaveLength(0);
    expect(projectChildObjectsToMain(d, { mode: "visitor" })).toHaveLength(1);
    expect(shouldProjectChild(obj("b"), "editor")).toBe(true);
  });
  it("9b. projected objects paint above Main objects", () => {
    const p = projectChildObjectsToMain(tvFocusDoc(obj("b")).doc)[0];
    const maxMainZ = Math.max(...tvFocusDoc().doc.objects.map((o) => o.zIndex));
    expect(p.zIndex).toBeGreaterThan(maxMainZ);
  });
  it("setChildProjectionPolicy writes onto the owning child object only", () => {
    const { doc, childSceneId } = tvFocusDoc(obj("b"));
    const next = setChildProjectionPolicy(doc, childSceneId, "b", { showInParent: false }, NOW);
    expect(getDetailScene(next, childSceneId)!.objects[0].projection).toEqual({ showInParent: false });
  });
});

describe("M7C.8 — robustness & compatibility", () => {
  it("22. only one nesting level projects — a depth-2 scene is ignored", () => {
    const { doc, childSceneId } = tvFocusDoc(obj("b"));
    // Forge a grandchild scene whose parent is the child (depth 2).
    const grand: NestDetailScene = {
      id: "detail-grand", name: "Grand", kind: "detail", sceneType: "focus",
      backgroundSource: { type: "parent_crop", parentSceneId: childSceneId, focusBounds: FOCUS },
      parentSceneId: childSceneId, parentFocusAreaId: "x",
      viewport: { aspectRatio: "3:4" }, objects: [obj("gc")], createdAt: NOW, updatedAt: NOW,
    };
    const doc2 = { ...doc, detailScenes: [...doc.detailScenes!, grand] };
    const proj = projectChildObjectsToMain(doc2);
    expect(proj.map((p) => p.instanceId)).toContain("b");
    expect(proj.map((p) => p.instanceId)).not.toContain("gc"); // grandchild does not project to Main
  });
  it("23. broken parent / focus references fail safely (no throw, no projection)", () => {
    const { doc, childSceneId } = tvFocusDoc(obj("b"));
    const broken = {
      ...doc,
      detailScenes: doc.detailScenes!.map((s) =>
        s.id === childSceneId ? { ...s, backgroundSource: { type: "parent_crop" as const, parentSceneId: "ghost", focusBounds: FOCUS } } : s,
      ),
    };
    expect(resolveInheritedFocusObjects(broken, childSceneId)).toEqual([]);
    // parent "ghost" !== main ⇒ not projected (one-level/Main-parent rule).
    expect(projectChildObjectsToMain(broken)).toEqual([]);
  });
  it("24+17+18. existing non-Focus docs are compatible; new fields survive export/import", () => {
    const plain = goldenLivingNestHybrid();
    expect(projectChildObjectsToMain(plain)).toEqual([]);
    const { doc, childSceneId } = tvFocusDoc(obj("b", { projection: { showInParent: true } }));
    const docWithOverride = setInheritedHotspotBinding(doc, childSceneId, doc.objects[0].instanceId, "noop", { type: "video", url: "u" }, NOW);
    const round = importDocumentJson(serializeEditorDocument(docWithOverride));
    expect(round.ok).toBe(true);
    const child = getDetailScene(round.doc!, childSceneId)!;
    expect(child.objects[0].projection).toEqual({ showInParent: true });
    expect(child.inheritedBindings).toBeTruthy();
    // And projection still resolves after the round-trip.
    expect(projectChildObjectsToMain(round.doc!).map((p) => p.instanceId)).toContain("b");
  });
});
