import { describe, expect, it } from "vitest";
import { editableObjectsToPlacements } from "@/lib/nest-editor-bridge";
import { hasExplicitBox, placementBox } from "@/lib/nest-geometry";
import { rowToPlacement } from "@/lib/nest/supabase-nest-repo";
import type { EditableNestObject } from "@/lib/nest-editor-types";
import type { NestPlacement } from "@/lib/nest-document-types";

// ── M24 §1 — Editor → Publish → Viewer must replay, not reconstruct ──────────
//
// The founder's report: objects moved, resized, changed layer and sometimes disappeared
// between the editor and the published Nest.
//
// Cause: `editableObjectsToPlacements` stored only `scale` (derived from width) and threw
// HEIGHT AWAY. `placementBox()` then re-derived height from the asset catalogue's aspect
// ratio and anchored the object with `y = p.y - h` — so a wrong height also produced a
// wrong position, and an unresolvable asset (ratio defaulting to 1:1) drifted furthest.
//
// The invariant these tests defend: the box the creator approved is the box a visitor sees.

/** The full editor → DB row → viewer trip, exactly as publish performs it. */
function roundTrip(o: EditableNestObject): NestPlacement {
  const placement = editableObjectsToPlacements([o])[0];
  // Mirror `placementToRow` in the repo, then read it back with the real reader.
  return rowToPlacement({
    id: placement.id,
    nest_id: "nest-1",
    asset_id: placement.assetId,
    x: placement.x,
    y: placement.y,
    scale: placement.scale ?? null,
    rotation: placement.rotation ?? 0,
    z_index: placement.zIndex ?? 1,
    w: placement.w ?? null,
    h: placement.h ?? null,
    flip_x: placement.flipX ?? false,
    overlay: placement.overlay ?? null,
    interaction: placement.interaction ?? null,
    label: placement.label ?? null,
    link_url: placement.linkUrl ?? null,
  });
}

const object = (over: Partial<EditableNestObject> = {}): EditableNestObject => ({
  instanceId: "obj-1",
  assetId: "ast-sofa-beta",
  x: 0.212,
  y: 0.431,
  width: 0.337,
  height: 0.259,
  anchor: { x: 0.38, y: 0.69 },
  plane: "floor",
  zIndex: 4,
  ...over,
});

describe("the approved box survives publish", () => {
  it("replays position and size EXACTLY, to the pixel", () => {
    const o = object();
    const box = placementBox(roundTrip(o));
    expect(box.x).toBeCloseTo(o.x, 10);
    expect(box.y).toBeCloseTo(o.y, 10);
    expect(box.w).toBeCloseTo(o.width, 10);
    expect(box.h).toBeCloseTo(o.height, 10);
  });

  it("does not re-derive height from the asset catalogue", () => {
    // A deliberately non-catalogue aspect: the old code would have replaced this height
    // with (w / ratio) × 0.75 and shifted the object's top by the difference.
    const o = object({ width: 0.4, height: 0.12 });
    const box = placementBox(roundTrip(o));
    expect(box.h).toBeCloseTo(0.12, 10);
    expect(box.y).toBeCloseTo(o.y, 10);
  });

  it("holds for an asset that is NOT in the library at all", () => {
    // This is the worst pre-M24 case: resolveAsset() → undefined → ratio 1:1 → maximum
    // drift, and NestPreview dropped the object entirely.
    const o = object({ assetId: "ast-from-asset-factory-not-in-fixtures" });
    const box = placementBox(roundTrip(o));
    expect(box.x).toBeCloseTo(o.x, 10);
    expect(box.y).toBeCloseTo(o.y, 10);
    expect(box.w).toBeCloseTo(o.width, 10);
    expect(box.h).toBeCloseTo(o.height, 10);
  });

  it("preserves rotation, mirroring and z-order", () => {
    const o = object({ rotation: 23.5, flipX: true, zIndex: 9 });
    const box = placementBox(roundTrip(o));
    expect(box.rotation).toBe(23.5);
    expect(box.flipX).toBe(true);
    expect(box.zIndex).toBe(9);
  });

  it("keeps two overlapping objects in their authored order", () => {
    const back = placementBox(roundTrip(object({ instanceId: "a", zIndex: 2 })));
    const front = placementBox(roundTrip(object({ instanceId: "b", zIndex: 7 })));
    expect(front.zIndex).toBeGreaterThan(back.zIndex);
  });

  it("replays a text overlay's own box unchanged", () => {
    const o = object({
      instanceId: "ov-1",
      assetId: "overlay:text",
      x: 0.07,
      y: 0.05,
      width: 0.55,
      height: 0.13,
      plane: "foreground",
      overlay: { kind: "text", text: "hello", align: "center" },
    });
    const p = roundTrip(o);
    const box = placementBox(p);
    expect(p.overlay).toEqual({ kind: "text", text: "hello", align: "center" });
    expect(box.x).toBeCloseTo(0.07, 10);
    expect(box.w).toBeCloseTo(0.55, 10);
    expect(box.h).toBeCloseTo(0.13, 10);
  });

  it("carries interaction configuration through to the visitor", () => {
    const o = object({
      interactionId: "open_link",
      hotspots: [
        {
          id: "hs-1",
          name: "Screen",
          semantic: "custom_link",
          shape: { type: "rect", x: 0.1, y: 0.1, width: 0.4, height: 0.3 },
          enabled: true,
          authoringMode: "predefined",
        },
      ],
    });
    const p = roundTrip(o);
    expect(p.interaction?.interactionId).toBe("open_link");
    expect(p.interaction?.hotspots).toHaveLength(1);
  });

  it("marks new placements as carrying an explicit box", () => {
    expect(hasExplicitBox(roundTrip(object()))).toBe(true);
  });
});

describe("a deterministic fixture Nest round-trips whole", () => {
  // The §1 fixture: wall object, floor object, avatar, rotated, flipped, two overlapping
  // with distinct z-index, a text overlay, an image overlay, and an interactive object.
  const SCENE: EditableNestObject[] = [
    object({ instanceId: "wall-frame", assetId: "ast-frame", plane: "front_wall", x: 0.15, y: 0.12, width: 0.2, height: 0.15, zIndex: 1 }),
    object({ instanceId: "floor-sofa", assetId: "ast-sofa-beta", x: 0.1, y: 0.6, width: 0.42, height: 0.24, zIndex: 3 }),
    object({ instanceId: "avatar", assetId: "ast-avatar", x: 0.55, y: 0.45, width: 0.14, height: 0.38, zIndex: 5 }),
    object({ instanceId: "rotated", assetId: "ast-plant-beta", x: 0.8, y: 0.62, width: 0.12, height: 0.2, rotation: 14, zIndex: 4 }),
    object({ instanceId: "flipped", assetId: "ast-lamp", x: 0.02, y: 0.5, width: 0.1, height: 0.22, flipX: true, zIndex: 2 }),
    object({ instanceId: "overlap-back", assetId: "ast-table", x: 0.3, y: 0.66, width: 0.25, height: 0.14, zIndex: 6 }),
    object({ instanceId: "overlap-front", assetId: "ast-mug", x: 0.36, y: 0.62, width: 0.07, height: 0.07, zIndex: 7 }),
    object({ instanceId: "text", assetId: "overlay:text", x: 0.06, y: 0.04, width: 0.5, height: 0.1, plane: "foreground", zIndex: 8, overlay: { kind: "text", text: "Welcome" } }),
    object({ instanceId: "image", assetId: "overlay:image", x: 0.62, y: 0.05, width: 0.3, height: 0.18, plane: "foreground", zIndex: 9, overlay: { kind: "image", src: "data:image/png;base64,iVBORw0KGgo=" } }),
    object({ instanceId: "tv", assetId: "ast-tv", x: 0.4, y: 0.28, width: 0.3, height: 0.18, zIndex: 10, interactionId: "play_video" }),
  ];

  it("every object survives — none are dropped", () => {
    const placements = editableObjectsToPlacements(SCENE);
    expect(placements).toHaveLength(SCENE.length);
    expect(placements.map((p) => p.id)).toEqual(SCENE.map((o) => o.instanceId));
  });

  it("every object lands on exactly the box it was authored with", () => {
    for (const o of SCENE) {
      const box = placementBox(roundTrip(o));
      expect({ id: o.instanceId, x: +box.x.toFixed(6), y: +box.y.toFixed(6), w: +box.w.toFixed(6), h: +box.h.toFixed(6) }).toEqual({
        id: o.instanceId,
        x: +o.x.toFixed(6),
        y: +o.y.toFixed(6),
        w: +o.width.toFixed(6),
        h: +o.height.toFixed(6),
      });
    }
  });

  it("paint order matches the authored z-indexes", () => {
    const placements = editableObjectsToPlacements(SCENE).map((p, i) => placementBox(p, i));
    expect(placements.map((b) => b.zIndex)).toEqual(SCENE.map((o) => o.zIndex));
  });
});
