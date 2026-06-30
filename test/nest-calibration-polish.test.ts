import { describe, expect, it } from "vitest";
import {
  GOLDEN_LIVING_NEST_ASSETS_BY_ID,
  GOLDEN_LIVING_NEST_COMPOSED,
  GOLDEN_LIVING_NEST_TEMPLATE,
} from "@/lib/fixtures/golden-living-nest";
import { createEditorDocumentFromTemplate, flipObject, moveObject, rotateObject } from "@/lib/nest-editor";
import type { EditableNestDocument } from "@/lib/nest-editor-types";
import {
  ASSET_VISUAL_METADATA,
  validateVisualBounds,
  visibleRect,
  visualBoundsFor,
} from "@/lib/nest-visual-bounds";
import { hasPredefinedHotspots, predefinedHotspotsForInstance } from "@/lib/nest-hotspot-catalog";
import { addHotspot, shapeContainsPoint } from "@/lib/nest-hotspots";
import { canFlipX, canRotate, editorWarnings, flipStatus } from "@/lib/nest-editor-policy";
import {
  GOLDEN_LIVING_NEST_OCCUPIED_ZONES,
  occupiedZoneConflicts,
  placementWarnings,
  supportRuleForAsset,
} from "@/lib/nest-placement";
import { computeAlignment } from "@/lib/nest-align";
import { can } from "@/lib/nest-editor-roles";
import { computeFitZoom, viewShowsFullScene } from "@/lib/nest-editor-view";
import type { NormalizedRect } from "@/lib/nest-types";

const A = GOLDEN_LIVING_NEST_ASSETS_BY_ID;
const base = (): EditableNestDocument =>
  createEditorDocumentFromTemplate({ template: GOLDEN_LIVING_NEST_TEMPLATE, composed: GOLDEN_LIVING_NEST_COMPOSED });
const obj = (d: EditableNestDocument, id: string) => d.objects.find((o) => o.instanceId === id)!;

// 1 + 2. Visual bounds validate; missing falls back to full
describe("visual bounds", () => {
  it("all authored visual bounds are inside 0..1", () => {
    for (const meta of Object.values(ASSET_VISUAL_METADATA)) {
      expect(validateVisualBounds(meta.visualBounds)).toEqual([]);
    }
  });
  it("falls back to full image bounds when absent", () => {
    expect(visualBoundsFor("ast-sofa")).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });
  // 3. Selection/visible rect uses visual bounds
  it("computes a visible rect inset by visual bounds", () => {
    const o = obj(base(), "slot-avatar");
    const vis = visibleRect(o, "ast-avatar");
    expect(vis.width).toBeLessThan(o.width); // 5. padded avatar → smaller than image
    expect(vis.x).toBeGreaterThan(o.x);
  });
});

// 4 + 13. Movement uses visual bounds; hard boundary keeps visible on-canvas
describe("movement constraints", () => {
  it("keeps visible content on-canvas while allowing padding off (hard boundary)", () => {
    const after = obj(moveObject(base(), "slot-avatar", 9, 9, A), "slot-avatar");
    const vis = visibleRect(after, after.assetId);
    expect(vis.x + vis.width).toBeLessThanOrEqual(1.06);
    expect(vis.y + vis.height).toBeLessThanOrEqual(1.06);
    expect(vis.x).toBeGreaterThanOrEqual(-0.06);
  });
  // 12. Soft boundary warns but allows placement
  it("warns near the edge but still moves the object", () => {
    const moved = moveObject(base(), "slot-lamp", -0.4, 0, A);
    const o = obj(moved, "slot-lamp");
    expect(o.x).toBeLessThan(obj(base(), "slot-lamp").x); // it moved
    const w = editorWarnings(moved.objects, A);
    expect(w.some((x) => x.instanceId === "slot-lamp" && x.kind === "boundary")).toBe(true);
  });
});

// 6 + 7 + 8 + 9. Hotspot calibration
describe("recalibrated hotspots", () => {
  it("TV screen hotspot is the calibrated screen region (excludes console)", () => {
    const s = predefinedHotspotsForInstance("ast-tv", "t")[0].shape;
    expect(s).toMatchObject({ x: 0.2, y: 0.11, width: 0.6, height: 0.48 });
    expect(shapeContainsPoint(s, 0.45, 0.3)).toBe(true);
    expect(shapeContainsPoint(s, 0.45, 0.85)).toBe(false); // console
  });
  it("plant leaves hotspot excludes the pot", () => {
    const s = predefinedHotspotsForInstance("ast-side-plant", "p")[0].shape;
    expect(shapeContainsPoint(s, 0.5, 0.3)).toBe(true);
    expect(shapeContainsPoint(s, 0.5, 0.85)).toBe(false);
  });
  it("frame photo hotspot sits inside the wooden border", () => {
    const s = predefinedHotspotsForInstance("ast-framed-photo", "f")[0].shape;
    expect(s.x).toBeGreaterThanOrEqual(0.15);
    expect(s.x + s.width).toBeLessThanOrEqual(0.85);
  });
  it("bookshelf has predefined shelf hotspots", () => {
    expect(hasPredefinedHotspots("ast-bookshelf")).toBe(true);
    const hs = predefinedHotspotsForInstance("ast-bookshelf", "b");
    expect(hs.map((h) => h.name)).toEqual(["Upper shelf", "Middle shelf", "Lower shelf"]);
  });
});

// 10. Asset without hotspots offers an add path
describe("add-region path", () => {
  it("a hotspot-less asset can receive a custom region", () => {
    expect(hasPredefinedHotspots("ast-sofa")).toBe(false);
    const r = addHotspot([], { name: "New region", semantic: "website", shape: { type: "rect", x: 0.4, y: 0.4, width: 0.2, height: 0.2 } });
    expect(r.hotspots).toHaveLength(1);
  });
});

// 14. Books require a supporting surface
describe("support rules", () => {
  it("books require a surface; a floating books warns", () => {
    expect(supportRuleForAsset(A["ast-stacked-books"])?.requiresSurface).toBe(true);
    // place a floating books instance on the floor with nothing under it
    const d = base();
    d.objects.push({ instanceId: "books-1", assetId: "ast-stacked-books", x: 0.05, y: 0.05, width: 0.1, height: 0.06, anchor: { x: 0.1, y: 0.11 }, plane: "floor", zIndex: 9 });
    const w = placementWarnings(d.objects, A);
    expect(w.some((x) => x.instanceId === "books-1" && x.kind === "support")).toBe(true);
  });
});

// 15. Occupied-zone warning
describe("occupied zones", () => {
  it("warns when an object covers built-in architecture", () => {
    const d = base();
    const niche = GOLDEN_LIVING_NEST_OCCUPIED_ZONES.find((z) => z.id === "zone-niche")!;
    d.objects.push({ instanceId: "shelf-1", assetId: "ast-bookshelf", x: niche.bounds.x, y: niche.bounds.y, width: 0.18, height: 0.5, anchor: { x: niche.bounds.x + 0.09, y: niche.bounds.y + 0.5 }, plane: "floor", zIndex: 9 });
    expect(occupiedZoneConflicts(obj(d, "shelf-1")).length).toBeGreaterThan(0);
    expect(placementWarnings(d.objects, A).some((w) => w.instanceId === "shelf-1" && w.kind === "occupied-zone")).toBe(true);
  });
});

// 16 + 17. Rotation policy
describe("rotation policy refinement", () => {
  it("frames and rugs rotate widely", () => {
    expect(canRotate(A["ast-framed-photo"])).toBe(true);
    expect(canRotate(A["ast-rug"])).toBe(true);
    expect(obj(rotateObject(base(), "slot-frame", 47, A), "slot-frame").rotation).toBe(47);
  });
  it("upright furniture stays unrotatable", () => {
    expect(canRotate(A["ast-sofa"])).toBe(false);
    expect(canRotate(A["ast-tv"])).toBe(false);
    expect(canRotate(A["ast-avatar"])).toBe(false);
    expect(obj(rotateObject(base(), "slot-media", 30, A), "slot-media").rotation).toBeUndefined();
  });
});

// 18. Avatar flip policy
describe("flip policy", () => {
  it("avatar flip is unavailable to creators, a warning under override", () => {
    expect(flipStatus(A["ast-avatar"], false)).toBe("unavailable");
    expect(flipStatus(A["ast-avatar"], true)).toBe("warning");
    expect(canFlipX(A["ast-avatar"], false)).toBe(false);
    expect(canFlipX(A["ast-avatar"], true)).toBe(true);
    // a normal rug is plainly available
    expect(flipStatus(A["ast-rug"], false)).toBe("available");
  });
  it("flipObject honours the override for the avatar", () => {
    expect(obj(flipObject(base(), "slot-avatar", A, false), "slot-avatar").flipX).toBeUndefined();
    expect(obj(flipObject(base(), "slot-avatar", A, true), "slot-avatar").flipX).toBe(true);
  });
});

// 19 + 20 + 21 + 22. Alignment guides
describe("smart alignment", () => {
  const rect = (x: number, y: number, w = 0.2, h = 0.2): NormalizedRect => ({ x, y, width: w, height: h });
  it("shows a centre guide within threshold", () => {
    const r = computeAlignment(rect(0.5 - 0.1 + 0.006, 0.2), []);
    expect(r.guides.some((g) => g.kind === "canvas-center" && g.axis === "x")).toBe(true);
    expect(Math.abs(r.snap.dx)).toBeGreaterThan(0); // snaps toward centre
  });
  it("shows an edge guide aligning two objects", () => {
    const other = { rect: rect(0.3, 0.4) };
    const r = computeAlignment(rect(0.3 + 0.005, 0.7), [other]);
    expect(r.guides.some((g) => g.kind === "edge" && g.axis === "x")).toBe(true);
  });
  it("is deterministic and yields no guides when far from any alignment", () => {
    // centre x 0.18, bottom y 0.23 — clear of canvas centre/thirds, floor seam, and the other rect
    const a = computeAlignment(rect(0.13, 0.13, 0.1, 0.1), [{ rect: rect(0.7, 0.7) }]);
    const b = computeAlignment(rect(0.13, 0.13, 0.1, 0.1), [{ rect: rect(0.7, 0.7) }]);
    expect(a).toEqual(b);
    expect(a.guides).toHaveLength(0);
    expect(a.snap).toEqual({ dx: 0, dy: 0 });
  });
});

// 23. Fit-view shows the full scene
describe("fit view", () => {
  it("fit zoom shows the complete room", () => {
    expect(computeFitZoom()).toBe(1);
    expect(viewShowsFullScene(1)).toBe(true);
    expect(viewShowsFullScene(1.3)).toBe(false);
  });
});

// 26 + 27. Role capabilities
describe("roles", () => {
  it("creators cannot edit raw ids; template authors can edit visual bounds", () => {
    expect(can("creator", "editRawIds")).toBe(false);
    expect(can("creator", "authorHotspots")).toBe(false);
    expect(can("template_author", "editVisualBounds")).toBe(true);
    expect(can("template_author", "authorHotspots")).toBe(true);
    expect(can("internal", "editRawIds")).toBe(true);
  });
});
