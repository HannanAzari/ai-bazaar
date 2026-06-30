import { describe, expect, it } from "vitest";
import {
  GOLDEN_LIVING_NEST_ASSETS,
  GOLDEN_LIVING_NEST_ASSETS_BY_ID,
  GOLDEN_LIVING_NEST_COMPOSED,
  GOLDEN_LIVING_NEST_TEMPLATE,
} from "@/lib/fixtures/golden-living-nest";
import { createEditorDocumentFromTemplate, moveObject, placeOnSupport } from "@/lib/nest-editor";
import type { EditableNestDocument, EditableNestObject } from "@/lib/nest-editor-types";
import { NEST_EDITOR_VERSION } from "@/lib/nest-editor-types";
import {
  candidateIdsAt,
  hitTestCandidates,
  nextSelection,
  TAP_CYCLE_MOVE_THRESHOLD,
  type TapCycleState,
} from "@/lib/nest-editor-hit-testing";
import { EDITOR_TOUCH_TARGETS, minObjectTapNormalized } from "@/lib/nest-editor-touch-targets";
import { visibleRect } from "@/lib/nest-visual-bounds";
import { predefinedHotspotsForInstance } from "@/lib/nest-hotspot-catalog";
import {
  buildCalibration,
  calibrationFor,
  DEFAULT_CALIBRATION,
  isValidCalibration,
  validateCalibration,
} from "@/lib/nest-asset-calibration";
import { searchAssets, getFavourites, toggleFavourite, pushRecent, getRecent } from "@/lib/nest-editor-asset-index";
import {
  BOTTOM_SHEET_SNAP_POINTS,
  SNAP_VISIBLE_FRACTION,
  allowedSnaps,
  nextSnap,
  resolveDragRelease,
  sheetTransition,
  shouldDismiss,
} from "@/lib/nest-bottom-sheet";
import { supportCandidates } from "@/lib/nest-placement";
import { placementWarnings } from "@/lib/nest-placement";
import { overlapAdvisories } from "@/lib/nest-overlap-advisories";
import { createHistory, pushHistory, undoHistory, redoHistory } from "@/lib/nest-editor-history";

const A = GOLDEN_LIVING_NEST_ASSETS_BY_ID;
const base = (): EditableNestDocument =>
  createEditorDocumentFromTemplate({ template: GOLDEN_LIVING_NEST_TEMPLATE, composed: GOLDEN_LIVING_NEST_COMPOSED });

const mk = (
  instanceId: string,
  assetId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: number,
  extra: Partial<EditableNestObject> = {},
): EditableNestObject => ({ instanceId, assetId, x, y, width, height, anchor: { x: x + width / 2, y: y + height }, plane: "floor", zIndex, ...extra });

const docWith = (objects: EditableNestObject[]): EditableNestDocument => ({
  version: NEST_EDITOR_VERSION,
  id: "doc-test",
  name: "Test",
  backgroundId: "bg",
  backgroundImageUrl: "/bg.png",
  aspectRatio: "3:4",
  objects,
  createdAt: "2026-06-30T00:00:00.000Z",
  updatedAt: "2026-06-30T00:00:00.000Z",
});

// Three concentric overlapping objects all containing (0.5, 0.5): books (z9) on a
// coffee table (z5) on a rug (z0).
const overlapStack = () => [
  mk("rug", "ast-rug", 0.3, 0.3, 0.4, 0.4, 0),
  mk("table", "ast-coffee-table", 0.4, 0.4, 0.2, 0.2, 5),
  mk("books", "ast-stacked-books", 0.45, 0.45, 0.12, 0.12, 9),
];
const P = { x: 0.5, y: 0.5 };

// ── Phase 1 — overlap-aware hit testing ──────────────────────────────────────
describe("overlap hit testing", () => {
  it("1. returns all overlapping visible objects under the point", () => {
    const ids = candidateIdsAt(overlapStack(), A, P);
    expect(ids).toContain("books");
    expect(ids).toContain("table");
    expect(ids).toContain("rug");
    expect(ids).toHaveLength(3);
  });

  it("2. excludes hidden objects", () => {
    const objs = overlapStack();
    objs[1] = { ...objs[1], hidden: true };
    const ids = candidateIdsAt(objs, A, P);
    expect(ids).not.toContain("table");
    expect(ids).toEqual(["books", "rug"]);
  });

  it("3. sorts deterministically, topmost (highest z) first", () => {
    const once = candidateIdsAt(overlapStack(), A, P);
    const twice = candidateIdsAt(overlapStack(), A, P);
    expect(once).toEqual(twice);
    expect(once).toEqual(["books", "table", "rug"]);
  });

  it("4. first tap selects the topmost candidate", () => {
    const cands = hitTestCandidates(overlapStack(), A, P);
    const r = nextSelection(undefined, cands, P, 1000);
    expect(r.selectedId).toBe("books");
    expect(r.cycled).toBe(false);
  });

  it("5. repeated tap cycles to the next candidate underneath", () => {
    const cands = hitTestCandidates(overlapStack(), A, P);
    const r1 = nextSelection(undefined, cands, P, 1000);
    const r2 = nextSelection(r1.state, cands, P, 1100);
    expect(r2.selectedId).toBe("table");
    expect(r2.cycled).toBe(true);
  });

  it("6. the cycle wraps back to the first", () => {
    const cands = hitTestCandidates(overlapStack(), A, P);
    let s: TapCycleState | undefined;
    const seq: (string | undefined)[] = [];
    for (let i = 0; i < 4; i++) {
      const r = nextSelection(s, cands, P, 1000 + i * 50);
      seq.push(r.selectedId);
      s = r.state;
    }
    expect(seq).toEqual(["books", "table", "rug", "books"]);
  });

  it("7. resets the cycle when the pointer moves beyond the threshold", () => {
    const cands = hitTestCandidates(overlapStack(), A, P);
    const r1 = nextSelection(undefined, cands, P, 1000); // books
    const moved = { x: P.x + TAP_CYCLE_MOVE_THRESHOLD + 0.01, y: P.y };
    const cands2 = hitTestCandidates(overlapStack(), A, moved);
    const r2 = nextSelection(r1.state, cands2, moved, 1100);
    expect(r2.cycled).toBe(false);
    expect(r2.selectedId).toBe("books"); // back to topmost
  });

  it("8. resets the cycle after the timeout", () => {
    const cands = hitTestCandidates(overlapStack(), A, P);
    const r1 = nextSelection(undefined, cands, P, 1000);
    const r2 = nextSelection(r1.state, cands, P, 1000 + 5000);
    expect(r2.cycled).toBe(false);
    expect(r2.selectedId).toBe("books");
  });

  it("9. uses visible-content bounds, not the full PNG box", () => {
    // A point inside the books' PNG box but outside its visible art (left padding).
    const objs = overlapStack();
    const pt = { x: 0.452, y: 0.5 }; // books box starts at 0.45; visible art starts ~0.458
    const tight = { width: 0, height: 0 };
    const ids = candidateIdsAt(objs, A, pt, { minTap: tight });
    expect(ids).not.toContain("books"); // excluded by visible bounds
    expect(ids).toContain("table"); // the table (full bounds) still hits
  });

  it("10. minimum touch padding makes a tiny object selectable", () => {
    const tiny = [mk("tiny", "ast-stacked-books", 0.8, 0.8, 0.02, 0.02, 1)];
    const near = { x: 0.85, y: 0.81 }; // just outside the ~0.02 art, inside the tap padding
    expect(candidateIdsAt(tiny, A, near)).toContain("tiny"); // default padding
    expect(candidateIdsAt(tiny, A, near, { minTap: { width: 0, height: 0 } })).not.toContain("tiny");
  });

  it("11. the touch padding never alters the reported visible size", () => {
    const tiny = mk("tiny", "ast-stacked-books", 0.8, 0.8, 0.02, 0.02, 1);
    const [c] = hitTestCandidates([tiny], A, { x: 0.81, y: 0.81 });
    const vis = visibleRect(tiny, tiny.assetId);
    expect(c.visibleArea).toBeCloseTo(vis.width * vis.height, 6);
    const pad = minObjectTapNormalized(undefined);
    expect(c.visibleArea).toBeLessThan(pad.width * pad.height); // padded ≠ visible
  });
});

// ── Phase 2 — long-press layer picker ────────────────────────────────────────
describe("layer picker source", () => {
  it("12. lists all overlapping candidates for the picker", () => {
    const ids = candidateIdsAt(overlapStack(), A, P);
    expect(ids.length).toBe(3);
  });
  it("13. orders the picker by effective z-order (topmost first)", () => {
    expect(candidateIdsAt(overlapStack(), A, P)).toEqual(["books", "table", "rug"]);
  });
  it("14. the underneath object is reachable as a distinct selection", () => {
    const ids = candidateIdsAt(overlapStack(), A, P);
    expect(ids[2]).toBe("rug"); // picking the last entry selects the bottom object
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── Phase 3/4 — touch targets + transform frame ──────────────────────────────
describe("touch targets and transform frame", () => {
  it("15. the rotate handle sits a constant gap outside the frame, ≥ a touch size", () => {
    expect(EDITOR_TOUCH_TARGETS.rotateHandleGapPx).toBeGreaterThan(0);
    expect(EDITOR_TOUCH_TARGETS.minimumRotateHandlePx).toBeGreaterThanOrEqual(32);
    expect(EDITOR_TOUCH_TARGETS.minimumResizeHandlePx).toBeGreaterThanOrEqual(32);
  });
  it("16. a small asset still drags from its body (move op works at tiny size)", () => {
    const d = docWith([mk("tiny", "ast-stacked-books", 0.4, 0.4, 0.05, 0.04, 1)]);
    const moved = moveObject(d, "tiny", 0.1, 0.05, A);
    const o = moved.objects.find((x) => x.instanceId === "tiny")!;
    expect(o.x).toBeGreaterThan(0.4);
  });
});

// ── Phase 5 — bookshelf hotspot calibration ──────────────────────────────────
describe("bookshelf hotspot calibration", () => {
  it("17. the upper-shelf hotspot falls within the visible upper shelf (not the cap)", () => {
    const hs = predefinedHotspotsForInstance("ast-bookshelf", "b");
    const upper = hs.find((h) => h.name === "Upper shelf")!.shape;
    expect(upper.y).toBeGreaterThanOrEqual(0.12); // below the top cap (~0.12)
    expect(upper.y).toBeLessThan(0.32);
    expect(upper.y + upper.height).toBeLessThanOrEqual(0.34);
    // regions stay ordered and non-overlapping
    const mid = hs.find((h) => h.name === "Middle shelf")!.shape;
    expect(upper.y + upper.height).toBeLessThanOrEqual(mid.y);
  });
});

// ── Phase 6 — calibration package ────────────────────────────────────────────
describe("asset calibration package", () => {
  it("18. every library asset's calibration validates", () => {
    for (const asset of GOLDEN_LIVING_NEST_ASSETS) {
      const c = buildCalibration(asset, asset.id);
      expect(validateCalibration(c)).toEqual([]);
    }
    // a hand-authored record also validates
    expect(isValidCalibration({ assetId: "x", visualBounds: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 }, rotationPolicy: { allowed: true, min: -90, max: 90 }, productionStatus: "approved" })).toBe(true);
    // a malformed record is rejected
    expect(validateCalibration({ assetId: "bad", defaultScale: -1, productionStatus: "nope" as never }).length).toBeGreaterThan(0);
  });
  it("19. a missing calibration uses the safe fallback", () => {
    const c = buildCalibration(undefined, "ast-unknown");
    expect(c).toEqual({ assetId: "ast-unknown", ...DEFAULT_CALIBRATION });
    expect(isValidCalibration(c)).toBe(true);
    expect(calibrationFor("ast-unknown", A).productionStatus).toBe("placeholder");
  });
});

// ── Phase 7 — compact library: hidden names, working search ───────────────────
describe("asset library information hierarchy", () => {
  it("20. names are preserved for accessibility/search even when hidden on tiles", () => {
    // The tile's accessible name is the asset name; search resolves the same name.
    for (const a of GOLDEN_LIVING_NEST_ASSETS) expect(a.name.length).toBeGreaterThan(0);
    const lamp = searchAssets(GOLDEN_LIVING_NEST_ASSETS, "Floor Lamp");
    expect(lamp.map((a) => a.id)).toContain("ast-floor-lamp");
  });
  it("21. search still finds assets by name, category and tags", () => {
    const byName = searchAssets(GOLDEN_LIVING_NEST_ASSETS, "sofa");
    expect(byName.map((a) => a.id)).toContain("ast-sofa");
    const byTag = searchAssets(GOLDEN_LIVING_NEST_ASSETS, "books");
    expect(byTag.map((a) => a.id)).toContain("ast-stacked-books");
    const byCategory = searchAssets(GOLDEN_LIVING_NEST_ASSETS, "seating");
    expect(byCategory.map((a) => a.id)).toContain("ast-sofa");
  });
});

// ── Phase 8/9/10 — reusable bottom sheet ─────────────────────────────────────
describe("bottom sheet snap behaviour", () => {
  it("22. supports collapsed / half / expanded with ascending visible fractions", () => {
    expect(BOTTOM_SHEET_SNAP_POINTS).toEqual(["collapsed", "half", "expanded"]);
    expect(SNAP_VISIBLE_FRACTION.collapsed).toBeLessThan(SNAP_VISIBLE_FRACTION.half);
    expect(SNAP_VISIBLE_FRACTION.half).toBeLessThan(SNAP_VISIBLE_FRACTION.expanded);
    expect(allowedSnaps(["collapsed", "expanded"])).toEqual(["collapsed", "expanded"]);
    expect(nextSnap("collapsed", BOTTOM_SHEET_SNAP_POINTS)).toBe("half");
    expect(nextSnap("expanded", BOTTOM_SHEET_SNAP_POINTS)).toBe("collapsed");
  });
  it("23. a dismissible sheet closes on outside tap / hard swipe-down; a non-dismissible one does not", () => {
    expect(shouldDismiss("backdrop", true)).toBe(true);
    expect(shouldDismiss("backdrop", false)).toBe(false);
    const closed = resolveDragRelease({ startSnap: "collapsed", dragPx: 400, parentH: 800, allowed: BOTTOM_SHEET_SNAP_POINTS, dismissible: true });
    expect(closed).toEqual({ close: true });
    const kept = resolveDragRelease({ startSnap: "collapsed", dragPx: 400, parentH: 800, allowed: BOTTOM_SHEET_SNAP_POINTS, dismissible: false });
    expect(kept).toEqual({ close: false, snap: "collapsed" });
  });
  it("24. Escape always closes (regardless of dismissible)", () => {
    expect(shouldDismiss("escape", true)).toBe(true);
    expect(shouldDismiss("escape", false)).toBe(true);
  });
  it("25. reduced motion disables the spring transition", () => {
    expect(sheetTransition(true, false)).toBe("none");
    expect(sheetTransition(false, true)).toBe("none"); // also none while dragging
    expect(sheetTransition(false, false)).toContain("cubic-bezier");
  });
  it("26. Recent/Favourites context persists (the searchable state behind the tabs)", () => {
    // Backed by the namespaced localStorage shim — survives drawer open/close + snaps.
    toggleFavourite("ast-tv");
    expect(getFavourites()).toContain("ast-tv");
    toggleFavourite("ast-tv");
    expect(getFavourites()).not.toContain("ast-tv");
    pushRecent("ast-sofa");
    expect(getRecent()[0]).toBe("ast-sofa");
  });
});

// ── Phase 10 — connect sheet preserves unsaved form ──────────────────────────
describe("connect sheet form safety", () => {
  it("27. snapping the sheet never mutates hotspots, so unsaved input cannot be lost", () => {
    // Snap math is pure UI state; it touches no document data. Resolving a drag returns
    // only a snap/close decision — never a hotspot or document change.
    const r = resolveDragRelease({ startSnap: "half", dragPx: -200, parentH: 800, allowed: BOTTOM_SHEET_SNAP_POINTS, dismissible: true });
    expect(r).toEqual({ close: false, snap: "expanded" });
    expect("hotspots" in r).toBe(false);
  });
});

// ── Phase 11 — support-surface suggestions ───────────────────────────────────
describe("support suggestions", () => {
  it("28. ranks support candidates deterministically (more overlap first)", () => {
    const objs = [
      mk("books", "ast-stacked-books", 0.45, 0.5, 0.08, 0.06, 9),
      mk("tableA", "ast-coffee-table", 0.42, 0.6, 0.18, 0.1, 5),
      mk("tableB", "ast-coffee-table", 0.5, 0.62, 0.18, 0.1, 4),
    ];
    const books = objs[0];
    const once = supportCandidates(books, objs, A);
    const twice = supportCandidates(books, objs, A);
    expect(once).toEqual(twice);
    expect(once[0].instanceId).toBe("tableA");
  });
  it("29. accepting a suggestion moves the object onto the support (clears the warning)", () => {
    const d = docWith([
      mk("table", "ast-coffee-table", 0.4, 0.6, 0.2, 0.12, 5),
      mk("books", "ast-stacked-books", 0.1, 0.2, 0.08, 0.05, 9),
    ]);
    expect(placementWarnings(d.objects, A).some((w) => w.instanceId === "books" && w.kind === "support")).toBe(true);
    const placed = placeOnSupport(d, "books", "table", A);
    expect(placementWarnings(placed.objects, A).some((w) => w.instanceId === "books" && w.kind === "support")).toBe(false);
  });
  it("30. support placement is undoable / redoable", () => {
    const d = docWith([
      mk("table", "ast-coffee-table", 0.4, 0.6, 0.2, 0.12, 5),
      mk("books", "ast-stacked-books", 0.1, 0.2, 0.08, 0.05, 9),
    ]);
    const placed = placeOnSupport(d, "books", "table", A);
    let h = createHistory(d, 50);
    h = pushHistory(h, placed);
    const undone = undoHistory(h);
    expect(undone.present).toEqual(d);
    const redone = redoHistory(undone);
    expect(redone.present).toEqual(placed);
  });
});

// ── Phase 12 — overlap advisories ────────────────────────────────────────────
describe("overlap advisories", () => {
  it("31. the avatar standing inside tall furniture fires an advisory", () => {
    const objs = [
      mk("shelf", "ast-bookshelf", 0.4, 0.3, 0.2, 0.5, 3),
      mk("avatar", "ast-avatar", 0.42, 0.32, 0.18, 0.45, 6),
    ];
    const adv = overlapAdvisories(objs, A);
    expect(adv.some((a) => a.kind === "avatar-furniture" && a.instanceId === "avatar")).toBe(true);
  });
  it("32. normal/intentional layouts produce no advisory noise", () => {
    // The default Golden Living Nest composition is clean.
    expect(overlapAdvisories(base().objects, A)).toEqual([]);
    // Books intentionally resting on a table is not flagged.
    const supported = [
      mk("table", "ast-coffee-table", 0.4, 0.55, 0.2, 0.12, 5),
      mk("books", "ast-stacked-books", 0.45, 0.5, 0.1, 0.07, 9),
    ];
    expect(overlapAdvisories(supported, A)).toEqual([]);
  });
});

// ── Phase 14 (33–35) — existing behaviour intact (full suite also runs) ──────
describe("existing behaviour intact", () => {
  it("33. existing editor ops still work (move is clamped + pure)", () => {
    const d = base();
    const before = d.objects.find((o) => o.instanceId === "slot-avatar")!;
    const moved = moveObject(d, "slot-avatar", 0.02, 0, A);
    expect(moved).not.toBe(d);
    expect(moved.objects.find((o) => o.instanceId === "slot-avatar")!.x).not.toBe(before.x);
  });
  it("34. existing hotspot catalog shapes are unchanged (TV screen)", () => {
    const s = predefinedHotspotsForInstance("ast-tv", "t")[0].shape;
    expect(s).toMatchObject({ x: 0.2, y: 0.11, width: 0.6, height: 0.48 });
  });
  it("35. existing visual-bounds behaviour is unchanged (avatar inset)", () => {
    const o = mk("av", "ast-avatar", 0, 0, 1, 1, 0);
    const vis = visibleRect(o, "ast-avatar");
    expect(vis.x).toBeCloseTo(0.168, 3);
    expect(vis.width).toBeCloseTo(0.664, 3);
  });
});
