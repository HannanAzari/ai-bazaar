import { describe, expect, it } from "vitest";
import {
  GOLDEN_LIVING_NEST_ASSETS,
  GOLDEN_LIVING_NEST_ASSETS_BY_ID,
  GOLDEN_LIVING_NEST_COMPOSED,
  GOLDEN_LIVING_NEST_TEMPLATE,
} from "@/lib/fixtures/golden-living-nest";
import {
  createEditorDocumentFromTemplate,
  duplicateObject,
  flipObject,
  moveObject,
  resizeObject,
  rotateObject,
  setObjectProps,
  removeObject,
} from "@/lib/nest-editor";
import type { EditableNestDocument } from "@/lib/nest-editor-types";
import { createHistory, pushHistory, undoHistory } from "@/lib/nest-editor-history";
import {
  applyRecent,
  classifyAsset,
  getFavourites,
  searchAssets,
  toggleFavourite,
} from "@/lib/nest-editor-asset-index";
import type { StorageLike } from "@/lib/nest-editor-storage";

const A = GOLDEN_LIVING_NEST_ASSETS_BY_ID;
const base = (): EditableNestDocument =>
  createEditorDocumentFromTemplate({ template: GOLDEN_LIVING_NEST_TEMPLATE, composed: GOLDEN_LIVING_NEST_COMPOSED });
const obj = (d: EditableNestDocument, id: string) => d.objects.find((o) => o.instanceId === id)!;

const memStorage = (): StorageLike => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};

// 1 + 2. Rotation obeys policy
describe("rotation policy", () => {
  it("rotates a rug (allowed) within its range", () => {
    const d = rotateObject(base(), "slot-rug", 30, A);
    expect(obj(d, "slot-rug").rotation).toBe(30);
  });
  it("clamps rug rotation to the permitted range", () => {
    const d = rotateObject(base(), "slot-rug", 400, A);
    expect(obj(d, "slot-rug").rotation).toBe(180);
  });
  it("leaves a disallowed-rotation object (sofa) unchanged", () => {
    const d = rotateObject(base(), "slot-sofa", 45, A);
    expect(obj(d, "slot-sofa").rotation).toBeUndefined();
  });
  it("constrains a frame to its tight range", () => {
    const d = rotateObject(base(), "slot-frame", 90, A);
    expect(obj(d, "slot-frame").rotation).toBe(15);
  });
});

// 3. Flip obeys policy
describe("flip policy", () => {
  it("flips a rug (allowed)", () => {
    expect(obj(flipObject(base(), "slot-rug", A), "slot-rug").flipX).toBe(true);
  });
  it("does not flip the avatar (disallowed)", () => {
    expect(obj(flipObject(base(), "slot-avatar", A), "slot-avatar").flipX).toBeUndefined();
  });
});

// 4 + 5. Duplicate
describe("duplicate", () => {
  it("creates a new stable, unique instance id", () => {
    const { doc, instanceId } = duplicateObject(base(), "slot-sofa", A);
    expect(instanceId).toBe("ast-sofa-1");
    expect(doc.objects.filter((o) => o.assetId === "ast-sofa")).toHaveLength(2);
  });
  it("offsets deterministically and re-clamps", () => {
    const d0 = base();
    const before = obj(d0, "slot-plant");
    const { doc, instanceId } = duplicateObject(d0, "slot-plant", A);
    const dup = obj(doc, instanceId!);
    expect(dup.x).toBeCloseTo(Math.min(1 - before.width, before.x + 0.04), 3);
    // deterministic
    expect(duplicateObject(base(), "slot-plant", A).doc.objects.length).toBe(doc.objects.length);
  });
});

// 6. Recent deterministic
describe("recent", () => {
  it("moves a re-used id to the front, dedups, caps", () => {
    let r: string[] = [];
    r = applyRecent(r, "a");
    r = applyRecent(r, "b");
    r = applyRecent(r, "a");
    expect(r).toEqual(["a", "b"]);
  });
});

// 7. Favourites persist through serialization
describe("favourites", () => {
  it("persists through storage (JSON) and round-trips", () => {
    const s = memStorage();
    toggleFavourite("ast-rug", s);
    toggleFavourite("ast-tv", s);
    expect(getFavourites(s).sort()).toEqual(["ast-rug", "ast-tv"]);
    toggleFavourite("ast-rug", s); // un-favourite
    expect(getFavourites(s)).toEqual(["ast-tv"]);
  });
});

// 8 + 9 + 10. Search
describe("search", () => {
  it("matches by name", () => {
    const r = searchAssets(GOLDEN_LIVING_NEST_ASSETS, "sofa");
    expect(r.some((a) => a.id === "ast-sofa")).toBe(true);
  });
  it("matches by tag", () => {
    const r = searchAssets(GOLDEN_LIVING_NEST_ASSETS, "greenery");
    expect(r.some((a) => a.id === "ast-side-plant")).toBe(true);
  });
  it("matches by child category", () => {
    const r = searchAssets(GOLDEN_LIVING_NEST_ASSETS, "coffee-tables");
    expect(r.some((a) => a.id === "ast-coffee-table")).toBe(true);
  });
  it("classifies into category + child", () => {
    expect(classifyAsset(A["ast-sofa"])).toEqual({ category: "seating", childCategory: "sofas" });
    expect(classifyAsset(A["ast-rug"])).toEqual({ category: "floor" });
  });
});

// 12. Locked rejects move/resize/rotation
describe("locked object", () => {
  it("rejects move, resize, and rotation while locked", () => {
    const d = setObjectProps(base(), "slot-rug", { locked: true }, A);
    const b = obj(d, "slot-rug");
    expect(obj(moveObject(d, "slot-rug", 0.2, 0, A), "slot-rug").x).toBe(b.x);
    expect(obj(resizeObject(d, "slot-rug", 0.8, A), "slot-rug").width).toBe(b.width);
    expect(obj(rotateObject(d, "slot-rug", 30, A), "slot-rug").rotation).toBeUndefined();
  });
});

// 13. Pinch transform preserves aspect (pinch maps to a proportional resize)
describe("pinch / proportional resize", () => {
  it("preserves aspect ratio", () => {
    const d = base();
    const r0 = obj(d, "slot-media").height / obj(d, "slot-media").width;
    const after = obj(resizeObject(d, "slot-media", 0.55, A), "slot-media");
    expect(after.height / after.width).toBeCloseTo(r0, 3);
  });
});

// 14 + 15. History: one entry per gesture + delete is undoable
describe("history", () => {
  it("commits one entry per completed gesture", () => {
    const h = pushHistory(createHistory(base()), moveObject(base(), "slot-sofa", 0.05, 0, A));
    expect(h.past).toHaveLength(1);
  });
  it("makes a contextual delete undoable", () => {
    const d0 = base();
    const h0 = createHistory(d0);
    const h1 = pushHistory(h0, removeObject(d0, "slot-plant"));
    expect(h1.present.objects.some((o) => o.instanceId === "slot-plant")).toBe(false);
    const u = undoHistory(h1);
    expect(u.present.objects.some((o) => o.instanceId === "slot-plant")).toBe(true);
  });
});

// 17. Advanced data remains available in the manifest (just hidden in normal UI)
describe("advanced data availability", () => {
  it("keeps technical fields on every object", () => {
    const o = base().objects[0];
    expect(o).toHaveProperty("x");
    expect(o).toHaveProperty("anchor");
    expect(o).toHaveProperty("zIndex");
    expect(o).toHaveProperty("plane");
  });
});
