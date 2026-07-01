import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  GOLDEN_LIVING_NEST_ASSETS_BY_ID,
  GOLDEN_LIVING_NEST_COMPOSED,
  GOLDEN_LIVING_NEST_TEMPLATE,
} from "@/lib/fixtures/golden-living-nest";
import { visibleRect } from "@/lib/nest-visual-bounds";
import {
  addObject,
  createEditorDocumentFromTemplate,
  editorDocumentToStage,
  moveObject,
  parseEditorDocument,
  removeObject,
  reorderObject,
  resizeObject,
  serializeEditorDocument,
  setObjectProps,
} from "@/lib/nest-editor";
import { validateEditorDocument } from "@/lib/nest-editor-types";
import { importDocumentJson, saveDraft, loadDraft, draftKey, type StorageLike } from "@/lib/nest-editor-storage";
import {
  canRedo,
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
} from "@/lib/nest-editor-history";
import { planeBand } from "@/lib/nest-editor-policy";
import type { EditableNestDocument } from "@/lib/nest-editor-types";

const A = GOLDEN_LIVING_NEST_ASSETS_BY_ID;
const baseDoc = (): EditableNestDocument =>
  createEditorDocumentFromTemplate({ template: GOLDEN_LIVING_NEST_TEMPLATE, composed: GOLDEN_LIVING_NEST_COMPOSED });

const obj = (doc: EditableNestDocument, id: string) => doc.objects.find((o) => o.instanceId === id)!;

// 1. Fixture → valid editor document
describe("conversion", () => {
  it("converts the Golden Living Nest into a valid editor document", () => {
    const doc = baseDoc();
    const v = validateEditorDocument(doc);
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual([]);
    expect(doc.objects).toHaveLength(GOLDEN_LIVING_NEST_COMPOSED.slotAssignments.length);
  });

  // 18. Same input → same document
  it("is deterministic (same input ⇒ identical document)", () => {
    expect(serializeEditorDocument(baseDoc())).toBe(serializeEditorDocument(baseDoc()));
  });
});

// 2. Serialize/parse round trip
describe("serialize / parse", () => {
  it("round-trips stably", () => {
    const doc = baseDoc();
    const json = serializeEditorDocument(doc);
    const parsed = parseEditorDocument(json);
    expect(parsed.ok).toBe(true);
    expect(serializeEditorDocument(parsed.doc!)).toBe(json);
  });
});

// 3 + 4. Move updates normalized coords + clamps
describe("moveObject", () => {
  it("updates normalized coordinates by the delta", () => {
    const doc = baseDoc();
    const before = obj(doc, "slot-sofa");
    const after = obj(moveObject(doc, "slot-sofa", 0.05, -0.02, A), "slot-sofa");
    expect(after.x).toBeCloseTo(before.x + 0.05, 3);
  });

  it("keeps the VISIBLE content on-canvas (padded PNG may sit partly off)", () => {
    const doc = baseDoc();
    const after = obj(moveObject(doc, "slot-avatar", 5, 0, A), "slot-avatar");
    // M7B.1: clamping uses visual-content bounds, so the avatar's transparent padding
    // may extend past the edge but its visible body stays on-canvas.
    const vis = visibleRect(after, after.assetId);
    expect(vis.x).toBeGreaterThanOrEqual(-0.06);
    expect(vis.x + vis.width).toBeLessThanOrEqual(1.06);
  });

  // 5. Floor-plane constraint
  it("keeps a floor object on the floor (anchor within floor band)", () => {
    const doc = baseDoc();
    const after = obj(moveObject(doc, "slot-sofa", 0, -0.6, A), "slot-sofa");
    expect(after.anchor.y).toBeGreaterThanOrEqual(planeBand("floor").minY - 0.001);
  });

  // 6. Wall-plane constraint
  it("keeps a wall object on the wall (anchor within wall band)", () => {
    const doc = baseDoc();
    const after = obj(moveObject(doc, "slot-frame", 0, 0.8, A), "slot-frame");
    expect(after.anchor.y).toBeLessThanOrEqual(planeBand("front_wall").maxY + 0.001);
  });

  // 12. Lock prevents movement
  it("does not move a locked object", () => {
    let doc = setObjectProps(baseDoc(), "slot-sofa", { locked: true }, A);
    const before = obj(doc, "slot-sofa");
    doc = moveObject(doc, "slot-sofa", 0.2, 0.1, A);
    const after = obj(doc, "slot-sofa");
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
  });
});

// 7 + 8. Resize preserves aspect + respects min/max
describe("resizeObject", () => {
  it("preserves the source aspect ratio (no distortion)", () => {
    const doc = baseDoc();
    const before = obj(doc, "slot-media");
    const ratio0 = before.height / before.width;
    const after = obj(resizeObject(doc, "slot-media", 0.4, A), "slot-media");
    expect(after.height / after.width).toBeCloseTo(ratio0, 3); // 4-dp rounding only
  });

  it("clamps to the asset min/max width", () => {
    const doc = baseDoc();
    const big = obj(resizeObject(doc, "slot-media", 0.95, A), "slot-media");
    expect(big.width).toBeLessThanOrEqual(0.62 + 0.0001); // media maxWidth
    const small = obj(resizeObject(doc, "slot-media", 0.01, A), "slot-media");
    expect(small.width).toBeGreaterThanOrEqual(0.3 - 0.0001); // media minWidth
  });
});

// 9. Add creates a stable unique instance
describe("addObject", () => {
  it("creates stable, unique, deterministic instance ids", () => {
    const r1 = addObject(baseDoc(), A["ast-floor-lamp"]);
    const r2 = addObject(r1.doc, A["ast-floor-lamp"]);
    expect(r1.instanceId).toBe("ast-floor-lamp-1");
    expect(r2.instanceId).toBe("ast-floor-lamp-2");
    // fixture already has one ast-floor-lamp (slot-lamp) + 2 added = 3
    expect(r2.doc.objects.filter((o) => o.assetId === "ast-floor-lamp")).toHaveLength(3);
    // deterministic
    expect(addObject(baseDoc(), A["ast-floor-lamp"]).instanceId).toBe("ast-floor-lamp-1");
  });

  it("places a new object at a deterministic in-bounds default (no random)", () => {
    const { doc, instanceId } = addObject(baseDoc(), A["ast-floor-lamp"]);
    const o = obj(doc, instanceId);
    expect(o.x).toBeGreaterThanOrEqual(0);
    expect(o.x + o.width).toBeLessThanOrEqual(1.0001);
    expect(o.plane).toBe("floor");
  });
});

// 10. Remove deletes only the requested instance
describe("removeObject", () => {
  it("removes only the requested instance", () => {
    const doc = baseDoc();
    const next = removeObject(doc, "slot-plant");
    expect(next.objects.find((o) => o.instanceId === "slot-plant")).toBeUndefined();
    expect(next.objects).toHaveLength(doc.objects.length - 1);
  });
});

// 11. Z-order deterministic
describe("reorderObject", () => {
  it("produces deterministic repacked integer z-indices", () => {
    const doc = baseDoc();
    const front = reorderObject(doc, "slot-sofa", "front");
    const zs = [...front.objects].map((o) => o.zIndex).sort((a, b) => a - b);
    expect(zs).toEqual(zs.map((_, i) => i)); // 0..n-1 packed
    const sofa = obj(front, "slot-sofa");
    expect(sofa.zIndex).toBe(front.objects.length - 1); // top
    // determinism
    expect(serializeEditorDocument(reorderObject(doc, "slot-sofa", "front"))).toBe(serializeEditorDocument(front));
    const back = reorderObject(doc, "slot-sofa", "back");
    expect(obj(back, "slot-sofa").zIndex).toBe(0);
  });
});

// 13. Hidden objects excluded from preview
describe("editorDocumentToStage", () => {
  it("excludes hidden objects from the rendered stage", () => {
    const doc = setObjectProps(baseDoc(), "slot-sofa", { hidden: true }, A);
    const { template, composed } = editorDocumentToStage(doc, A, GOLDEN_LIVING_NEST_TEMPLATE);
    expect(template.slots.find((s) => s.id === "slot-sofa")).toBeUndefined();
    expect(composed.slotAssignments.find((s) => s.slotId === "slot-sofa")).toBeUndefined();
    expect(template.slots).toHaveLength(doc.objects.length - 1);
  });
});

// 14 + 15 + 16. History
describe("history", () => {
  it("undo/redo restores prior and next states", () => {
    const h0 = createHistory("a");
    const h1 = pushHistory(h0, "b");
    expect(h1.past).toHaveLength(1);
    const u = undoHistory(h1);
    expect(u.present).toBe("a");
    const r = redoHistory(u);
    expect(r.present).toBe("b");
  });

  it("one gesture = one history entry", () => {
    const h = pushHistory(createHistory("a"), "b");
    expect(h.past).toHaveLength(1); // a single push, not many
  });

  it("redo stack clears after a new action", () => {
    let h = pushHistory(createHistory("a"), "b");
    h = undoHistory(h); // present a, future [b]
    expect(canRedo(h)).toBe(true);
    h = pushHistory(h, "c"); // new action
    expect(canRedo(h)).toBe(false);
    expect(h.future).toEqual([]);
  });

  it("bounds the past stack to its limit", () => {
    let h = createHistory(0, 3);
    for (let i = 1; i <= 10; i++) h = pushHistory(h, i);
    expect(h.past.length).toBeLessThanOrEqual(3);
    expect(h.present).toBe(10);
  });
});

// 17. Invalid imported JSON rejected + storage round trip
describe("storage / import", () => {
  it("rejects invalid JSON and invalid documents", () => {
    expect(importDocumentJson("{not json").ok).toBe(false);
    expect(importDocumentJson(JSON.stringify({ version: 2 })).ok).toBe(false);
    expect(importDocumentJson(JSON.stringify({ hello: "world" })).ok).toBe(false);
  });

  it("saves and loads a draft via an injected storage", () => {
    const mem = new Map<string, string>();
    const storage: StorageLike = {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => void mem.set(k, v),
      removeItem: (k) => void mem.delete(k),
    };
    const doc = baseDoc();
    const saved = saveDraft(doc, storage);
    expect(saved.ok).toBe(true);
    expect(saved.key).toBe(draftKey(doc.id));
    const loaded = loadDraft(doc.id, storage);
    expect(loaded.ok).toBe(true);
    expect(serializeEditorDocument(loaded.doc!)).toBe(serializeEditorDocument(doc));
  });

  it("reports a clear error when no draft exists", () => {
    const storage: StorageLike = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    expect(loadDraft("missing", storage).ok).toBe(false);
  });
});

// 19. No Math.random in placement core
describe("purity (static scan)", () => {
  it("uses no Math.random in the editor core or policy", () => {
    for (const f of ["../lib/nest-editor.ts", "../lib/nest-editor-policy.ts"]) {
      const src = readFileSync(fileURLToPath(new URL(f, import.meta.url)), "utf8");
      expect(/Math\.random\s*\(/.test(src)).toBe(false);
      expect(/Date\.now\s*\(/.test(src)).toBe(false);
    }
  });
});
