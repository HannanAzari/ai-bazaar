import { describe, expect, it } from "vitest";
import type { EditableNestObject } from "@/lib/nest-editor-types";
import type { NestAssetHotspot } from "@/lib/nest-hotspot-types";
import type { NestFocusArea } from "@/lib/nest-focus-types";
import {
  canEnterFocus,
  canExitFocus,
  canInteractInFocus,
  cropBoundsOf,
  focusEntryBegin,
  focusEntrySettle,
  focusExitBegin,
  focusExitSettle,
  recommendCrop,
  resolveMainScenePointerAction,
  resolveZoomInteraction,
  selectDiscoveryHint,
  triggerBoundsOf,
  validateFocusArea,
  zoomChildrenActive,
} from "@/lib/nest-focus-scenes";
import {
  goldenLivingNestHybrid,
  studioNestHybrid,
  GOLDEN_TV_ZOOM_AREA_ID,
  GOLDEN_FRAME_ZOOM_AREA_ID,
  STUDIO_BOOKSHELF_ZOOM_AREA_ID,
} from "@/lib/fixtures/golden-hybrid-focus";

// Helpers
const hotspot = (over: Partial<NestAssetHotspot> = {}): NestAssetHotspot => ({
  id: "h1",
  name: "Screen",
  semantic: "video",
  shape: { type: "rect", x: 0.2, y: 0.2, width: 0.5, height: 0.5 },
  enabled: true,
  ...over,
});
const objectWith = (hotspots: NestAssetHotspot[], over: Partial<EditableNestObject> = {}): EditableNestObject => ({
  instanceId: "obj-1",
  assetId: "ast-tv",
  x: 0.3,
  y: 0.4,
  width: 0.4,
  height: 0.3,
  anchor: { x: 0.5, y: 0.7 },
  plane: "floor",
  zIndex: 2,
  hotspots,
  ...over,
});
const fa = (over: Partial<NestFocusArea> = {}): NestFocusArea => ({
  id: "focus-1",
  name: "Region",
  sourceSceneId: "main",
  targetSceneId: "",
  targetType: "zoom_region",
  bounds: { x: 0.3, y: 0.4, width: 0.4, height: 0.3 },
  shape: "rect",
  trigger: "tap",
  transition: "smooth_zoom",
  zoomRegion: { cropBounds: { x: 0.2, y: 0.3, width: 0.6, height: 0.5 } },
  enabled: true,
  ...over,
});

// ── Focus-first priority (Phase 1/3) ─────────────────────────────────────────
describe("focus-first Main resolution", () => {
  const point = { x: 0.5, y: 0.5 }; // inside both the focus area and the object hotspot
  it("1. a Main Focus Area wins over an overlapping object hotspot", () => {
    const res = resolveMainScenePointerAction({ point, focusAreas: [fa()], objects: [objectWith([hotspot()])] });
    expect(res).toEqual({ type: "focus", focusAreaId: "focus-1" });
  });
  it("2. the whole-object interaction does not fire under a Focus Area", () => {
    const res = resolveMainScenePointerAction({ point, focusAreas: [fa()], objects: [objectWith([])] });
    expect(res.type).toBe("focus");
  });
  it("13. a disabled Focus Area does not intercept the hotspot", () => {
    const res = resolveMainScenePointerAction({ point, focusAreas: [fa({ enabled: false })], objects: [objectWith([hotspot()])] });
    expect(res).toMatchObject({ type: "hotspot", objectId: "obj-1", hotspotId: "h1" });
  });
  it("a point on no focus area falls back to the object hotspot then the object", () => {
    const far = { x: 0.05, y: 0.05 };
    expect(resolveMainScenePointerAction({ point: far, focusAreas: [fa()], objects: [objectWith([hotspot()])] }).type).toBe("none");
    const onObj = { x: 0.5, y: 0.5 };
    expect(resolveMainScenePointerAction({ point: onObj, focusAreas: [], objects: [objectWith([])] })).toMatchObject({ type: "object", objectId: "obj-1" });
  });
  it("11. overlapping Focus Areas resolve the smallest first (V1 focusBounds)", () => {
    const big = fa({ id: "big", focusBounds: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 } });
    const small = fa({ id: "small", focusBounds: { x: 0.4, y: 0.4, width: 0.2, height: 0.2 } });
    const res = resolveMainScenePointerAction({ point: { x: 0.5, y: 0.5 }, focusAreas: [big, small], objects: [] });
    expect(res).toEqual({ type: "focus", focusAreaId: "small" });
  });
  it("12. equal Focus Areas use a stable id tie-break (and priority overrides)", () => {
    const a = fa({ id: "aaa", focusBounds: { x: 0.3, y: 0.3, width: 0.4, height: 0.4 } });
    const b = fa({ id: "bbb", focusBounds: { x: 0.3, y: 0.3, width: 0.4, height: 0.4 } });
    expect(resolveMainScenePointerAction({ point: { x: 0.5, y: 0.5 }, focusAreas: [b, a], objects: [] })).toEqual({ type: "focus", focusAreaId: "aaa" });
    const hi = fa({ id: "bbb", priority: 10, focusBounds: { x: 0.3, y: 0.3, width: 0.4, height: 0.4 } });
    expect(resolveMainScenePointerAction({ point: { x: 0.5, y: 0.5 }, focusAreas: [a, hi], objects: [] })).toEqual({ type: "focus", focusAreaId: "bbb" });
  });
});

// ── Fixture taps resolve to focus, not content (Phase 4/5/6) ─────────────────
describe("fixture Main taps enter focus first", () => {
  const center = (b: { x: number; y: number; width: number; height: number }) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
  it("4. a Main TV tap resolves to the TV Focus (not the video hotspot)", () => {
    const doc = goldenLivingNestHybrid();
    const tv = doc.focusAreas!.find((f) => f.id === GOLDEN_TV_ZOOM_AREA_ID)!;
    const res = resolveMainScenePointerAction({ point: center(tv.bounds), focusAreas: doc.focusAreas!, objects: doc.objects });
    expect(res).toEqual({ type: "focus", focusAreaId: GOLDEN_TV_ZOOM_AREA_ID });
  });
  it("7. a Main frame tap resolves to the Frame Focus", () => {
    const doc = goldenLivingNestHybrid();
    const frame = doc.focusAreas!.find((f) => f.id === GOLDEN_FRAME_ZOOM_AREA_ID)!;
    const res = resolveMainScenePointerAction({ point: center(frame.bounds), focusAreas: doc.focusAreas!, objects: doc.objects });
    expect(res).toEqual({ type: "focus", focusAreaId: GOLDEN_FRAME_ZOOM_AREA_ID });
  });
  it("9. a Main bookshelf tap resolves to the Bookshelf Focus", () => {
    const doc = studioNestHybrid();
    const shelf = doc.focusAreas!.find((f) => f.id === STUDIO_BOOKSHELF_ZOOM_AREA_ID)!;
    const res = resolveMainScenePointerAction({ point: center(shelf.bounds), focusAreas: doc.focusAreas!, objects: doc.objects });
    expect(res).toEqual({ type: "focus", focusAreaId: STUDIO_BOOKSHELF_ZOOM_AREA_ID });
  });
  it("7b. the TV Focus trigger excludes the avatar and the plant", () => {
    const doc = goldenLivingNestHybrid();
    const tv = doc.focusAreas!.find((f) => f.id === GOLDEN_TV_ZOOM_AREA_ID)!;
    const avatar = doc.objects.find((o) => o.assetId === "ast-avatar")!;
    const plant = doc.objects.find((o) => o.assetId === "ast-side-plant")!;
    // trigger right edge is left of both the avatar's and the plant's left edge
    expect(tv.bounds.x + tv.bounds.width).toBeLessThanOrEqual(avatar.x);
    expect(tv.bounds.x + tv.bounds.width).toBeLessThanOrEqual(plant.x);
  });
});

// ── Inside-zoom priority (Phase 0/3) ─────────────────────────────────────────
describe("inside-zoom interaction priority", () => {
  const child = (over: Partial<NestAssetHotspot> = {}) => hotspot({ id: "child", name: "Note", ...over });
  const parent = (over: Partial<NestAssetHotspot> = {}) => hotspot({ id: "screen", name: "TV Screen", ...over });
  it("3 + 5. a focused child/parent hotspot fires after entry", () => {
    const r1 = resolveZoomInteraction({ point: { x: 0.4, y: 0.4 }, childHotspots: [child()], childObjects: [], parentHotspots: [parent()] });
    expect(r1.kind).toBe("child_hotspot");
    const r2 = resolveZoomInteraction({ point: { x: 0.4, y: 0.4 }, childHotspots: [], childObjects: [], parentHotspots: [parent()] });
    expect(r2.kind).toBe("parent_hotspot");
  });
  it("6. a console/background tap does not open the video", () => {
    const r = resolveZoomInteraction({ point: { x: 0.95, y: 0.95 }, childHotspots: [], childObjects: [], parentHotspots: [parent()] });
    expect(r.kind).toBe("background");
  });
  it("8. a focused image tap resolves to the gallery hotspot", () => {
    const gallery = parent({ id: "photo", name: "Photo", semantic: "gallery" });
    const r = resolveZoomInteraction({ point: { x: 0.4, y: 0.4 }, childHotspots: [], childObjects: [], parentHotspots: [gallery] });
    expect(r).toMatchObject({ kind: "parent_hotspot", hotspot: { semantic: "gallery" } });
  });
  it("10. a focused shelf region resolves to a shelf interaction", () => {
    const shelf = parent({ id: "upper", name: "Upper shelf", semantic: "article" });
    const r = resolveZoomInteraction({ point: { x: 0.4, y: 0.4 }, childHotspots: [], childObjects: [], parentHotspots: [shelf] });
    expect(r).toMatchObject({ kind: "parent_hotspot", hotspot: { name: "Upper shelf" } });
  });
});

// ── Trigger vs crop (Phase 3) ────────────────────────────────────────────────
describe("trigger vs crop bounds", () => {
  it("14. trigger and crop bounds validate independently", () => {
    const badCrop = fa({ zoomRegion: { cropBounds: { x: 0.8, y: 0.2, width: 0.4, height: 0.2 } } });
    const errs = validateFocusArea(badCrop);
    expect(errs.some((e) => /cropBounds leave the scene/.test(e))).toBe(true);
    expect(errs.some((e) => /bounds\.(x|width)/.test(e))).toBe(false); // trigger is fine
    expect(validateFocusArea(fa())).toEqual([]);
  });
  it("15. V1 unifies trigger and crop into one focusBounds (M7C.4)", () => {
    const tv = goldenLivingNestHybrid().focusAreas!.find((f) => f.id === GOLDEN_TV_ZOOM_AREA_ID)!;
    // The trigger/crop split is retired: both accessors resolve to the single rectangle.
    expect(cropBoundsOf(tv)).toEqual(triggerBoundsOf(tv));
    expect(cropBoundsOf(tv)).toEqual(tv.focusBounds);
  });
});

// ── Recommended crop (Phase 13) ──────────────────────────────────────────────
describe("recommended crop helper", () => {
  const frame = { x: 0.18, y: 0.15, width: 0.157, height: 0.1135 };
  const media = { x: 0.259, y: 0.422, width: 0.482, height: 0.233 };
  it("16. a recommended frame crop is deterministic", () => {
    expect(recommendCrop(frame, "frame")).toEqual(recommendCrop(frame, "frame"));
  });
  it("17. a recommended TV crop includes console context (larger than the subject)", () => {
    const c = recommendCrop(media, "media");
    expect(c.width).toBeGreaterThan(media.width);
    expect(c.height).toBeGreaterThan(media.height);
  });
  it("18. a recommended crop stays within the scene bounds and contains the subject", () => {
    for (const [b, cat] of [[frame, "frame"], [media, "media"]] as const) {
      const c = recommendCrop(b, cat);
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + c.width).toBeLessThanOrEqual(1.0001);
      expect(c.y + c.height).toBeLessThanOrEqual(1.0001);
      expect(c.x).toBeLessThanOrEqual(b.x + 1e-6);
      expect(c.x + c.width).toBeGreaterThanOrEqual(b.x + b.width - 1e-6);
    }
  });
});

// ── Interaction-state protection (Phase 10/11) ───────────────────────────────
describe("interaction-state protection", () => {
  it("19. rapid taps create exactly one focus entry", () => {
    const once = focusEntryBegin("main_idle");
    expect(once).toBe("entering_focus");
    expect(focusEntryBegin(once)).toBe("entering_focus"); // second tap is a no-op
    expect(canEnterFocus(once)).toBe(false);
  });
  it("20. parent interactions are suppressed during the transition", () => {
    expect(canInteractInFocus("entering_focus")).toBe(false);
    expect(canInteractInFocus("focused_idle")).toBe(true);
  });
  it("21. child hotspots are disabled until the transition completes", () => {
    expect(zoomChildrenActive({ inZoomScene: true, transitioning: true })).toBe(false);
    expect(zoomChildrenActive({ inZoomScene: true, transitioning: false })).toBe(true);
    expect(focusEntrySettle("entering_focus")).toBe("focused_idle");
  });
  it("22. Back exits the focus state only when focused", () => {
    expect(canExitFocus("focused_idle")).toBe(true);
    expect(focusExitBegin("focused_idle")).toBe("exiting_focus");
    expect(focusExitBegin("main_idle")).toBe("main_idle"); // nothing to exit
  });
  it("23. exiting restores the Main interaction state", () => {
    expect(focusExitSettle("exiting_focus")).toBe("main_idle");
    expect(canEnterFocus(focusExitSettle("exiting_focus"))).toBe(true);
  });
});

// ── Discovery hints + CTA removal (Phase 7/8) ────────────────────────────────
describe("discovery hints and CTA removal", () => {
  const areas = goldenLivingNestHybrid().focusAreas!;
  it("24. no fixture uses a persistent 'Zoom to…' style CTA label", () => {
    for (const doc of [goldenLivingNestHybrid(), studioNestHybrid()]) {
      for (const f of doc.focusAreas ?? []) expect(/zoom to|sit at/i.test(f.previewHint ?? "")).toBe(false);
    }
  });
  it("26. a discovery hint appears only on first visit, for the primary area only", () => {
    const first = selectDiscoveryHint(areas, { hasFocusedOnce: false, reducedMotion: false });
    expect(first.focusAreaId).toBe(areas[0].id);
    expect(selectDiscoveryHint(areas, { hasFocusedOnce: true, reducedMotion: false }).focusAreaId).toBeUndefined();
  });
  it("27. a reduced-motion hint is non-animated", () => {
    expect(selectDiscoveryHint(areas, { hasFocusedOnce: false, reducedMotion: true }).animated).toBe(false);
    expect(selectDiscoveryHint(areas, { hasFocusedOnce: false, reducedMotion: false }).animated).toBe(true);
  });
});
