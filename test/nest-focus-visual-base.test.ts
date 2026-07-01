import { describe, expect, it } from "vitest";
import {
  childSceneIdOf,
  ensureFocusChildScene,
  focusBoundsOf,
  getDetailScene,
  mainSceneId,
  resolveFocusSceneBase,
  setDetailSceneObjects,
} from "@/lib/nest-focus-scenes";
import { goldenLivingNestHybrid, GOLDEN_TV_ZOOM_AREA_ID } from "@/lib/fixtures/golden-hybrid-focus";
import type { EditableNestObject } from "@/lib/nest-editor-types";

// ── M7C.7 — the child Focus Scene's PERMANENT parent-crop visual base ──────────
//
// These cover the renderer DECISION (which scene/crop the editor + visitor render as the
// base), not just scene-graph plumbing: the editor and the visitor must resolve the SAME
// parent scene + focus rectangle, the base must never be the generic empty room, and a
// broken parent must yield an explicit (resolvable-as-error) state rather than a blank room.
// The pixel-level transparency fix (the child overlay must not paint its own opaque
// gradient over the base) is proven in the mandated browser verification, since the test
// runner is Node-only and cannot compute CSS.

const NOW = "2026-07-01T00:00:00.000Z";

const stack = (id: string): EditableNestObject => ({
  instanceId: id,
  assetId: "ast-stacked-books",
  x: 0.42,
  y: 0.46,
  width: 0.16,
  height: 0.12,
  rotation: 0,
  flipX: false,
  zIndex: 5,
  plane: "front_wall",
  anchor: { x: 0.5, y: 1 },
});

describe("M7C.7 — child Focus Scene visual base", () => {
  it("1+2. a parent_crop child resolves its parent scene and the correct focus area", () => {
    const doc0 = goldenLivingNestHybrid();
    const { doc, childSceneId } = ensureFocusChildScene(doc0, GOLDEN_TV_ZOOM_AREA_ID, NOW);
    const base = resolveFocusSceneBase(doc, childSceneId)!;
    expect(base).toBeTruthy();
    expect(base.parentSceneId).toBe(mainSceneId(doc));
    const child = getDetailScene(doc, childSceneId)!;
    expect(child.parentFocusAreaId).toBe(GOLDEN_TV_ZOOM_AREA_ID);
    expect(base.parentObjects).toBe(doc.objects); // the parent's real objects, not an empty set
  });

  it("3. the base focusBounds equals the focus area's focusBounds (edit == preview)", () => {
    const doc0 = goldenLivingNestHybrid();
    const { doc, childSceneId } = ensureFocusChildScene(doc0, GOLDEN_TV_ZOOM_AREA_ID, NOW);
    const fa = doc.focusAreas!.find((f) => f.id === GOLDEN_TV_ZOOM_AREA_ID)!;
    const base = resolveFocusSceneBase(doc, childSceneId)!;
    // The editor (resolveFocusSceneBase) and the visitor (focusBoundsOf) read the SAME rect.
    expect(base.focusBounds).toEqual(focusBoundsOf(fa));
  });

  it("4. the base is NOT the generic empty room — the Main scene has no parent-crop base", () => {
    const doc = goldenLivingNestHybrid();
    expect(resolveFocusSceneBase(doc, mainSceneId(doc))).toBeUndefined();
    expect(resolveFocusSceneBase(doc, "")).toBeUndefined();
  });

  it("5+6. the parent-crop base persists for both edit and preview (same input ⇒ same base)", () => {
    const doc0 = goldenLivingNestHybrid();
    const { doc, childSceneId } = ensureFocusChildScene(doc0, GOLDEN_TV_ZOOM_AREA_ID, NOW);
    const a = resolveFocusSceneBase(doc, childSceneId)!;
    const b = resolveFocusSceneBase(doc, childSceneId)!;
    expect(a.parentSceneId).toBe(b.parentSceneId);
    expect(a.focusBounds).toEqual(b.focusBounds);
    expect(a.parentObjects).toBe(b.parentObjects);
  });

  it("11. child-only objects live on the child scene, never on the Main scene", () => {
    const doc0 = goldenLivingNestHybrid();
    const { doc: entered, childSceneId } = ensureFocusChildScene(doc0, GOLDEN_TV_ZOOM_AREA_ID, NOW);
    const mainObjectCount = entered.objects.length;
    const doc = setDetailSceneObjects(entered, childSceneId, [stack("child-books")], NOW);
    const child = getDetailScene(doc, childSceneId)!;
    expect(child.objects.map((o) => o.instanceId)).toContain("child-books");
    // The Main scene is untouched — the proof object is NOT in the parent objects.
    expect(doc.objects.length).toBe(mainObjectCount);
    expect(doc.objects.map((o) => o.instanceId)).not.toContain("child-books");
    // And the base still renders the PARENT objects (read-only), not the child's.
    const base = resolveFocusSceneBase(doc, childSceneId)!;
    expect(base.parentObjects.map((o) => o.instanceId)).not.toContain("child-books");
  });

  it("13+14. re-entry / reload resolves the SAME child scene and base (idempotent)", () => {
    const doc0 = goldenLivingNestHybrid();
    const first = ensureFocusChildScene(doc0, GOLDEN_TV_ZOOM_AREA_ID, NOW);
    const withChild = setDetailSceneObjects(first.doc, first.childSceneId, [stack("keep-me")], NOW);
    // Re-enter: no new scene, same id, child content preserved.
    const again = ensureFocusChildScene(withChild, GOLDEN_TV_ZOOM_AREA_ID, NOW);
    expect(again.childSceneId).toBe(first.childSceneId);
    expect(again.doc.detailScenes!.length).toBe(withChild.detailScenes!.length);
    expect(getDetailScene(again.doc, again.childSceneId)!.objects.map((o) => o.instanceId)).toContain("keep-me");
    const fa = again.doc.focusAreas!.find((f) => f.id === GOLDEN_TV_ZOOM_AREA_ID)!;
    expect(childSceneIdOf(fa)).toBe(first.childSceneId);
  });

  it("15. a broken parent reference resolves to no base (error state), never a blank room", () => {
    const doc0 = goldenLivingNestHybrid();
    const { doc, childSceneId } = ensureFocusChildScene(doc0, GOLDEN_TV_ZOOM_AREA_ID, NOW);
    // Corrupt the parent pointer to a non-existent scene.
    const broken = {
      ...doc,
      detailScenes: doc.detailScenes!.map((s) =>
        s.id === childSceneId && s.backgroundSource?.type === "parent_crop"
          ? { ...s, backgroundSource: { ...s.backgroundSource, parentSceneId: "scene-does-not-exist" } }
          : s,
      ),
    };
    expect(resolveFocusSceneBase(broken, childSceneId)).toBeUndefined();
  });

  it("an image-backed detail surface keeps its own background (no parent crop)", () => {
    const doc0 = goldenLivingNestHybrid();
    const { doc, childSceneId } = ensureFocusChildScene(doc0, GOLDEN_TV_ZOOM_AREA_ID, NOW);
    const imageBacked = {
      ...doc,
      detailScenes: doc.detailScenes!.map((s) =>
        s.id === childSceneId
          ? { ...s, sceneType: "detail_surface" as const, backgroundSource: { type: "image" as const, imageUrl: "/x.png" } }
          : s,
      ),
    };
    expect(resolveFocusSceneBase(imageBacked, childSceneId)).toBeUndefined();
  });
});
