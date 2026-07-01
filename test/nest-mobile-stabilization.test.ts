import { describe, expect, it } from "vitest";
import { resolveBindingSave } from "@/lib/nest-hotspots";
import { contextToolbarPlacement } from "@/lib/nest-editor-toolbar";
import { guardrailForAsset } from "@/lib/nest-editor-policy";
import { visualBoundsFor } from "@/lib/nest-visual-bounds";
import { FOCUS_SOURCE_DIMENSIONS } from "@/lib/nest-focus-resolution";
import { predefinedHotspotsForInstance } from "@/lib/nest-hotspot-catalog";
import { GOLDEN_LIVING_NEST_ASSETS_BY_ID } from "@/lib/fixtures/golden-living-nest";
import { ensureFocusChildScene, focusBoundsOf, getDetailScene, setDetailSceneObjects } from "@/lib/nest-focus-scenes";
import { childToParentRect, projectChildObjectsToMain } from "@/lib/nest-focus-projection";
import { goldenLivingNestHybrid, GOLDEN_TV_ZOOM_AREA_ID } from "@/lib/fixtures/golden-hybrid-focus";
import type { NestAssetHotspot } from "@/lib/nest-hotspot-types";
import type { EditableNestObject } from "@/lib/nest-editor-types";

const NOW = "2026-07-01T00:00:00.000Z";

// ── Issue 1 — Connect Save decision (validate → persist → close, else stay open) ──
describe("M7C.9 #1 — Connect Save behavior", () => {
  const hs: NestAssetHotspot = { id: "h1", name: "TV Screen", semantic: "video", shape: { type: "rect", x: 0.2, y: 0.11, width: 0.6, height: 0.48 }, enabled: true };
  it("valid link → ok, binding persisted (host then closes the sheet)", () => {
    const r = resolveBindingSave({ hotspots: [hs], hotspotId: "h1", semantic: "video", url: "https://youtube.com/watch?v=x", label: "", internal: false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.hotspots.find((h) => h.id === "h1")!.binding).toEqual({ type: "video", url: "https://youtube.com/watch?v=x", label: "TV Screen" });
  });
  it("invalid link → error, sheet stays open (no ok)", () => {
    const r = resolveBindingSave({ hotspots: [hs], hotspotId: "h1", semantic: "video", url: "not a url", label: "", internal: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeTruthy();
  });
  it("built-in action with no link → ok (no link required)", () => {
    const action: NestAssetHotspot = { ...hs, id: "h2", semantic: "profile" };
    const r = resolveBindingSave({ hotspots: [action], hotspotId: "h2", semantic: "profile", url: "", label: "", internal: true });
    expect(r.ok).toBe(true);
  });
  it("built-in action WITH an invalid link → error (still validated)", () => {
    const action: NestAssetHotspot = { ...hs, id: "h2", semantic: "profile" };
    const r = resolveBindingSave({ hotspots: [action], hotspotId: "h2", semantic: "profile", url: "http://", label: "", internal: true });
    expect(r.ok).toBe(false);
  });
});

// ── Issue 2 — contextual toolbar never covers the resize/rotation handles ──
describe("M7C.9 #2 — toolbar placement", () => {
  it("ample room above + rotation handle → above, cleared past the handle", () => {
    const p = contextToolbarPlacement({ topPx: 200, bottomPx: 250, sceneHeightPx: 460, hasRotateHandle: true });
    expect(p.side).toBe("above");
    expect(p.offsetPx).toBeGreaterThanOrEqual(70); // clears the rotation handle
  });
  it("small asset near the top with a rotation handle → flips below", () => {
    const p = contextToolbarPlacement({ topPx: 40, bottomPx: 90, sceneHeightPx: 460, hasRotateHandle: true });
    expect(p.side).toBe("below");
  });
  it("no rotation handle + room above → above with a small gap", () => {
    const p = contextToolbarPlacement({ topPx: 100, bottomPx: 150, sceneHeightPx: 460, hasRotateHandle: false });
    expect(p.side).toBe("above");
    expect(p.offsetPx).toBeLessThan(20);
  });
  it("tight both sides → falls back to the side with more space", () => {
    const p = contextToolbarPlacement({ topPx: 10, bottomPx: 455, sceneHeightPx: 460, hasRotateHandle: true });
    expect(p.side).toBe("above"); // 10px above > 5px below
  });
});

// ── Issue 3 — bookshelf box aspect matches art; hotspots inside visible bounds ──
describe("M7C.9 #3 — bookshelf bounds + hotspots", () => {
  const insideUnitOf = (h: NestAssetHotspot, b: { x: number; y: number; width: number; height: number }) =>
    h.shape.x >= b.x - 1e-6 && h.shape.y >= b.y - 1e-6 && h.shape.x + h.shape.width <= b.x + b.width + 1e-6 && h.shape.y + h.shape.height <= b.y + b.height + 1e-6;

  it("bookshelf box aspect makes the on-screen box match the art aspect (no letterbox)", () => {
    const g = guardrailForAsset(GOLDEN_LIVING_NEST_ASSETS_BY_ID["ast-bookshelf"]);
    const art = FOCUS_SOURCE_DIMENSIONS["ast-bookshelf"];
    const artPixelAspect = art.width / art.height; // 535 / 1499 ≈ 0.357
    // pixelAspect = boxAspect · (sceneW/sceneH) = boxAspect · 3/4
    expect(g.boxAspect * (3 / 4)).toBeCloseTo(artPixelAspect, 2);
  });
  it("every bookshelf shelf hotspot sits inside the visible art bounds (not the padding)", () => {
    const vb = visualBoundsFor("ast-bookshelf");
    const hotspots = predefinedHotspotsForInstance("ast-bookshelf", "bs-1");
    expect(hotspots.length).toBeGreaterThan(0);
    for (const h of hotspots) expect(insideUnitOf(h, vb)).toBe(true);
  });
  it("calibrated assets share the boxAspect·(3/4) ≈ art-aspect invariant (regression guard)", () => {
    const cases: [string, string][] = [
      ["ast-tv", "ast-tv"],
      ["ast-framed-photo", "ast-framed-photo"],
      ["ast-floor-lamp", "ast-floor-lamp"],
      ["ast-side-plant", "ast-side-plant"],
      ["ast-bookshelf", "ast-bookshelf"],
    ];
    for (const [assetId, dimId] of cases) {
      const g = guardrailForAsset(GOLDEN_LIVING_NEST_ASSETS_BY_ID[assetId]);
      const d = FOCUS_SOURCE_DIMENSIONS[dimId];
      expect(g.boxAspect * (3 / 4)).toBeCloseTo(d.width / d.height, 1);
    }
  });
});

// ── Issue 4 — child asset added in focus is projected into Main after return ──
describe("M7C.9 #4 — projection reliability after add-in-focus", () => {
  const books = (id: string): EditableNestObject => ({
    instanceId: id, assetId: "ast-stacked-books", x: 0.4, y: 0.55, width: 0.2, height: 0.14,
    anchor: { x: 0.5, y: 1 }, plane: "front_wall", zIndex: 5,
  });
  it("add asset in focus → return to Main → projection exists immediately at the mapped position", () => {
    const doc0 = goldenLivingNestHybrid();
    // Enter the TV focus area (creates the child scene), then add a child asset.
    const { doc: entered, childSceneId } = ensureFocusChildScene(doc0, GOLDEN_TV_ZOOM_AREA_ID, NOW);
    const doc = setDetailSceneObjects(entered, childSceneId, [books("b1")], NOW);
    // Back on Main, projection derives directly from the doc (no stale state).
    const proj = projectChildObjectsToMain(doc);
    expect(proj.map((p) => p.instanceId)).toContain("b1");
    const focus = focusBoundsOf(doc.focusAreas!.find((f) => f.id === GOLDEN_TV_ZOOM_AREA_ID)!);
    expect(proj[0].parentBounds).toEqual(childToParentRect({ x: 0.4, y: 0.55, width: 0.2, height: 0.14 }, focus));
    // And it is the SAME derivation on a reload (round-trip through the stored doc).
    const reloaded = JSON.parse(JSON.stringify(getDetailScene(doc, childSceneId)));
    expect(reloaded.objects.map((o: EditableNestObject) => o.instanceId)).toContain("b1");
  });
});
