import { describe, expect, it } from "vitest";
import {
  GOLDEN_LIVING_NEST_ASSETS_BY_ID,
  GOLDEN_LIVING_NEST_COMPOSED,
  GOLDEN_LIVING_NEST_TEMPLATE,
} from "@/lib/fixtures/golden-living-nest";
import {
  createEditorDocumentFromTemplate,
  duplicateObject,
  editorDocumentToStage,
  flipObject,
  moveObject,
  parseEditorDocument,
  removeObject,
  resizeObject,
  rotateObject,
  serializeEditorDocument,
  setObjectHotspots,
} from "@/lib/nest-editor";
import { validateEditorDocument } from "@/lib/nest-editor-types";
import type { EditableNestDocument } from "@/lib/nest-editor-types";
import {
  addHotspot,
  clampShape,
  duplicateHotspot,
  findHotspotAtPoint,
  moveHotspot,
  resizeHotspot,
  shapeContainsPoint,
  updateHotspot,
  validateBinding,
  validateBindingUrl,
} from "@/lib/nest-hotspots";
import { hasPredefinedHotspots, predefinedHotspotsForInstance } from "@/lib/nest-hotspot-catalog";
import { createHistory, pushHistory, redoHistory, undoHistory } from "@/lib/nest-editor-history";
import type { NestAssetHotspot } from "@/lib/nest-hotspot-types";

const A = GOLDEN_LIVING_NEST_ASSETS_BY_ID;
const base = (): EditableNestDocument =>
  createEditorDocumentFromTemplate({ template: GOLDEN_LIVING_NEST_TEMPLATE, composed: GOLDEN_LIVING_NEST_COMPOSED });
const obj = (d: EditableNestDocument, id: string) => d.objects.find((o) => o.instanceId === id)!;

// 1. Existing documents without hotspots remain valid
describe("backward compatibility", () => {
  it("validates a document whose objects have no hotspots", () => {
    const d = base();
    d.objects = d.objects.map((o) => { const c = { ...o }; delete c.hotspots; return c; });
    expect(validateEditorDocument(d).ok).toBe(true);
  });
});

// 2. Predefined hotspots attach to matching assets
describe("predefined catalog", () => {
  it("attaches predefined hotspots to matching assets, none to others", () => {
    const d = base();
    expect(obj(d, "slot-media").hotspots?.length).toBe(1);
    expect(obj(d, "slot-avatar").hotspots?.length).toBe(1);
    expect(obj(d, "slot-sofa").hotspots).toBeUndefined();
    expect(hasPredefinedHotspots("ast-tv")).toBe(true);
    expect(hasPredefinedHotspots("ast-sofa")).toBe(false);
  });
});

// 3 + 4 + 5. Normalized, in-bounds, min size
describe("geometry", () => {
  it("keeps predefined hotspots inside 0..1", () => {
    const hs = predefinedHotspotsForInstance("ast-desk", "d1");
    for (const h of hs) {
      expect(h.shape.x).toBeGreaterThanOrEqual(0);
      expect(h.shape.y).toBeGreaterThanOrEqual(0);
      expect(h.shape.x + h.shape.width).toBeLessThanOrEqual(1.0001);
      expect(h.shape.y + h.shape.height).toBeLessThanOrEqual(1.0001);
    }
  });
  it("clamps a shape that leaves bounds and enforces the minimum size", () => {
    const s = clampShape({ type: "rect", x: 0.95, y: -0.2, width: 0.4, height: 0.01 });
    expect(s.x + s.width).toBeLessThanOrEqual(1.0001);
    expect(s.y).toBeGreaterThanOrEqual(0);
    expect(s.height).toBeGreaterThanOrEqual(0.06 - 1e-9);
  });
});

// 6. Locked hotspot rejects move/resize
describe("locked hotspot", () => {
  it("rejects move and resize while locked", () => {
    let hs: NestAssetHotspot[] = predefinedHotspotsForInstance("ast-tv", "t1");
    hs = updateHotspot(hs, "t1-screen", { locked: true });
    const before = hs[0].shape;
    expect(moveHotspot(hs, "t1-screen", 0.2, 0)[0].shape).toEqual(before);
    expect(resizeHotspot(hs, "t1-screen", 0.9, 0.9)[0].shape).toEqual(before);
  });
});

// 7. Add hotspot stable id
describe("add/duplicate hotspot", () => {
  it("creates a stable, unique id", () => {
    const r = addHotspot([], { name: "X", semantic: "website", shape: { type: "rect", x: 0.1, y: 0.1, width: 0.2, height: 0.2 }, idBase: "hs-website" });
    expect(r.id).toBe("hs-website-1");
    const r2 = addHotspot(r.hotspots, { name: "Y", semantic: "website", shape: { type: "rect", x: 0.3, y: 0.3, width: 0.2, height: 0.2 }, idBase: "hs-website" });
    expect(r2.id).toBe("hs-website-2");
  });
  it("duplicates a hotspot with a new unique id + offset", () => {
    const hs = predefinedHotspotsForInstance("ast-desk", "d1");
    const r = duplicateHotspot(hs, "d1-laptop");
    expect(r.id).not.toBe("d1-laptop");
    expect(new Set(r.hotspots.map((h) => h.id)).size).toBe(r.hotspots.length);
  });
});

// 8. Duplicate asset → unique hotspot ids
describe("duplicate asset", () => {
  it("regenerates hotspot ids uniquely for the new instance", () => {
    const { doc, instanceId } = duplicateObject(base(), "slot-media", A);
    const orig = obj(base(), "slot-media").hotspots!.map((h) => h.id);
    const dup = obj(doc, instanceId!).hotspots!.map((h) => h.id);
    expect(dup.every((id) => !orig.includes(id))).toBe(true);
    const all = doc.objects.flatMap((o) => o.hotspots ?? []).map((h) => h.id);
    expect(new Set(all).size).toBe(all.length);
  });
});

// 9. Delete asset removes its hotspots
describe("delete asset", () => {
  it("removes the asset and its hotspots together", () => {
    const d = removeObject(base(), "slot-media");
    expect(d.objects.find((o) => o.instanceId === "slot-media")).toBeUndefined();
    expect(d.objects.flatMap((o) => o.hotspots ?? []).some((h) => h.id.startsWith("slot-media"))).toBe(false);
  });
});

// 10. Serialize/parse preserves hotspots
describe("serialize/parse", () => {
  it("round-trips hotspots stably", () => {
    const json = serializeEditorDocument(base());
    const parsed = parseEditorDocument(json);
    expect(parsed.ok).toBe(true);
    expect(serializeEditorDocument(parsed.doc!)).toBe(json);
    expect(parsed.doc!.objects.find((o) => o.instanceId === "slot-media")!.hotspots!.length).toBe(1);
  });
});

// 11. Invalid hotspot import rejected
describe("invalid import", () => {
  it("rejects a document with a malformed hotspot", () => {
    const d = base();
    d.objects.find((o) => o.instanceId === "slot-media")!.hotspots = [
      { id: "", name: "bad", semantic: "video", shape: { type: "rect", x: 0.5, y: 0.5, width: 0.9, height: 0.9 }, enabled: true } as NestAssetHotspot,
    ];
    const parsed = parseEditorDocument(JSON.stringify(d));
    expect(parsed.ok).toBe(false);
  });
});

// 12. Unsafe URL protocols rejected
describe("url safety", () => {
  it("rejects javascript: and other unsafe schemes; accepts http(s)", () => {
    expect(validateBindingUrl("javascript:alert(1)").ok).toBe(false);
    expect(validateBindingUrl("data:text/html,<x>").ok).toBe(false);
    expect(validateBindingUrl("https://example.com").ok).toBe(true);
    expect(validateBindingUrl("not a url").ok).toBe(false);
  });
});

// 13. Internal binding works without URL
describe("internal binding", () => {
  it("allows ambience/animation/profile without a URL", () => {
    expect(validateBinding({ type: "ambience" })).toEqual([]);
    expect(validateBinding({ type: "animation" })).toEqual([]);
    expect(validateBinding({ type: "profile" })).toEqual([]);
    expect(validateBinding({ type: "website" }).length).toBeGreaterThan(0); // url required
  });
});

// 14. TV screen hotspot excludes the whole console
describe("tv screen hotspot", () => {
  it("targets only the screen, not the full console", () => {
    const screen = predefinedHotspotsForInstance("ast-tv", "t")[0].shape;
    expect(screen.width).toBeLessThan(1);
    expect(screen.height).toBeLessThan(0.6);
    expect(shapeContainsPoint(screen, 0.5, 0.3)).toBe(true); // on the screen
    expect(shapeContainsPoint(screen, 0.5, 0.9)).toBe(false); // down on the console
  });
});

// 15. Plant leaves hotspot excludes the pot
describe("plant leaves hotspot", () => {
  it("covers the leaves but not the pot region", () => {
    const leaves = predefinedHotspotsForInstance("ast-side-plant", "p")[0].shape;
    expect(shapeContainsPoint(leaves, 0.5, 0.25)).toBe(true); // leaves
    expect(shapeContainsPoint(leaves, 0.5, 0.85)).toBe(false); // pot
  });
});

// 16 + 17. Move/resize asset preserves local hotspot geometry
describe("transform preserves hotspots", () => {
  it("moving the asset does not change its local hotspot coords", () => {
    const moved = moveObject(base(), "slot-media", 0.1, -0.05, A);
    expect(obj(moved, "slot-media").hotspots).toEqual(obj(base(), "slot-media").hotspots);
  });
  it("resizing the asset does not change its local hotspot geometry", () => {
    const resized = resizeObject(base(), "slot-media", 0.4, A);
    expect(obj(resized, "slot-media").hotspots).toEqual(obj(base(), "slot-media").hotspots);
  });
  // 18 + 19. Flip / rotation keep local hotspot coords (mapping is via CSS transform).
  it("flip and rotation keep hotspot local geometry stable", () => {
    const flipped = flipObject(base(), "slot-media", A);
    expect(obj(flipped, "slot-media").hotspots).toEqual(obj(base(), "slot-media").hotspots);
    const rotated = rotateObject(base(), "slot-frame", 10, A);
    expect(obj(rotated, "slot-frame").hotspots).toEqual(obj(base(), "slot-frame").hotspots);
    expect(obj(rotated, "slot-frame").rotation).toBe(10);
  });
});

// 20. Topmost overlapping hotspot deterministic
describe("hit resolution", () => {
  it("returns the topmost (last) overlapping enabled hotspot", () => {
    const hs: NestAssetHotspot[] = [
      { id: "a", name: "A", semantic: "website", shape: { type: "rect", x: 0.1, y: 0.1, width: 0.6, height: 0.6 }, enabled: true },
      { id: "b", name: "B", semantic: "website", shape: { type: "rect", x: 0.2, y: 0.2, width: 0.6, height: 0.6 }, enabled: true },
    ];
    expect(findHotspotAtPoint(hs, 0.4, 0.4)?.id).toBe("b"); // overlap → last wins
    expect(findHotspotAtPoint(hs, 0.15, 0.15)?.id).toBe("a"); // only A
  });
  // 24. Disabled hotspot inactive
  it("ignores disabled hotspots", () => {
    const hs: NestAssetHotspot[] = [{ id: "x", name: "X", semantic: "website", shape: { type: "rect", x: 0.1, y: 0.1, width: 0.6, height: 0.6 }, enabled: false }];
    expect(findHotspotAtPoint(hs, 0.3, 0.3)).toBeUndefined();
  });
});

// 21 + 23. Whole-object fallback + hidden asset
describe("stage adapter", () => {
  it("a hotspot-less asset exposes no slot hotspots (whole-object fallback)", () => {
    const { template } = editorDocumentToStage(base(), A, GOLDEN_LIVING_NEST_TEMPLATE);
    expect(template.slots.find((s) => s.id === "slot-sofa")!.hotspots).toBeUndefined();
    expect(template.slots.find((s) => s.id === "slot-media")!.hotspots!.length).toBe(1);
  });
  it("hidden assets are excluded entirely (their hotspots cannot fire)", () => {
    const d = setObjectHotspots(base(), "slot-media", obj(base(), "slot-media").hotspots!);
    d.objects.find((o) => o.instanceId === "slot-media")!.hidden = true;
    const { template } = editorDocumentToStage(d, A, GOLDEN_LIVING_NEST_TEMPLATE);
    expect(template.slots.find((s) => s.id === "slot-media")).toBeUndefined();
  });
});

// 26 + 27. Undo/redo + one entry per gesture
describe("history", () => {
  it("undo/redo restores hotspot edits", () => {
    const d0 = base();
    const edited = setObjectHotspots(d0, "slot-media", updateHotspot(obj(d0, "slot-media").hotspots!, "slot-media-screen", { name: "Renamed" }));
    const h1 = pushHistory(createHistory(d0), edited);
    expect(obj(h1.present, "slot-media").hotspots![0].name).toBe("Renamed");
    const u = undoHistory(h1);
    expect(obj(u.present, "slot-media").hotspots![0].name).toBe("TV Screen");
    expect(obj(redoHistory(u).present, "slot-media").hotspots![0].name).toBe("Renamed");
  });
  it("one hotspot gesture is one history entry", () => {
    const d0 = base();
    const next = setObjectHotspots(d0, "slot-media", moveHotspot(obj(d0, "slot-media").hotspots!, "slot-media-screen", 0.02, 0));
    expect(pushHistory(createHistory(d0), next).past).toHaveLength(1);
  });
});
