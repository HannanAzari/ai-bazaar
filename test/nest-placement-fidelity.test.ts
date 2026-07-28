import { describe, expect, it } from "vitest";
import { editableObjectsToPlacements } from "@/lib/nest-editor-bridge";
import { rowToPlacement } from "@/lib/nest/supabase-nest-repo";
import type { EditableNestObject } from "@/lib/nest-editor-types";

// ── M23B §4 — the composition must survive the round trip ────────────────────
//
// The old Supabase path wrote `rotation: 0` hard-coded, never read rotation back, and had
// no columns for overlays, w/h or flipX — so publishing through it LOST creator work.
// These tests assert the specific things that used to be dropped.
//
// `placementToRow` is module-private, so the row shape is reconstructed here exactly as
// the repo builds it, and `rowToPlacement` (the read path) is exercised for real.

function asRow(p: ReturnType<typeof editableObjectsToPlacements>[number], index = 0) {
  return {
    id: p.id,
    nest_id: "nest-1",
    asset_id: p.assetId,
    x: p.x,
    y: p.y,
    scale: p.scale ?? null,
    rotation: p.rotation ?? 0,
    z_index: p.zIndex ?? index + 1,
    w: p.w ?? null,
    h: p.h ?? null,
    flip_x: p.flipX ?? false,
    overlay: p.overlay ?? null,
    interaction: p.interaction ?? null,
    label: p.label ?? null,
    link_url: p.linkUrl ?? null,
  };
}

const roundTrip = (o: EditableNestObject) => rowToPlacement(asRow(editableObjectsToPlacements([o])[0]));

describe("placement fidelity: editor → row → placement", () => {
  it("preserves rotation (was hard-coded to 0 on write and never read back)", () => {
    const p = roundTrip({
      instanceId: "obj-1",
      assetId: "ast-laptop-v1-certified",
      x: 0.3, y: 0.4, width: 0.2, height: 0.2,
      anchor: { x: 0.4, y: 0.6 },
      plane: "floor",
      zIndex: 3,
      rotation: 17.5,
    });
    expect(p.rotation).toBe(17.5);
  });

  it("preserves flipX, so a mirrored object stays mirrored after publish", () => {
    const p = roundTrip({
      instanceId: "obj-2",
      assetId: "ast-sofa-beta",
      x: 0.1, y: 0.2, width: 0.3, height: 0.25,
      anchor: { x: 0.25, y: 0.45 },
      plane: "floor",
      zIndex: 1,
      flipX: true,
    });
    expect(p.flipX).toBe(true);
  });

  it("preserves a text overlay with its own box (previously unstorable)", () => {
    const p = roundTrip({
      instanceId: "ov-1",
      assetId: "overlay:text",
      x: 0.12, y: 0.08, width: 0.4, height: 0.15,
      anchor: { x: 0.32, y: 0.155 },
      plane: "foreground",
      zIndex: 9,
      overlay: { kind: "text", text: "hello", color: "#fff", align: "center" },
    });
    expect(p.overlay).toEqual({ kind: "text", text: "hello", color: "#fff", align: "center" });
    expect(p.w).toBeCloseTo(0.4);
    expect(p.h).toBeCloseTo(0.15);
    expect(p.x).toBeCloseTo(0.12);
    expect(p.y).toBeCloseTo(0.08);
  });

  it("preserves z-order", () => {
    const p = roundTrip({
      instanceId: "obj-3",
      assetId: "ast-plant-beta",
      x: 0.5, y: 0.5, width: 0.1, height: 0.1,
      anchor: { x: 0.55, y: 0.6 },
      plane: "floor",
      zIndex: 42,
    });
    expect(p.zIndex).toBe(42);
  });

  it("preserves interaction configuration — hotspots, bindings, surfaces, lock, plane", () => {
    const p = roundTrip({
      instanceId: "obj-4",
      assetId: "ast-bookshelf-beta",
      x: 0.2, y: 0.3, width: 0.2, height: 0.4,
      anchor: { x: 0.3, y: 0.7 },
      plane: "front_wall",
      zIndex: 2,
      interactionId: "open_gallery",
      locked: true,
      variantId: "v2",
      hotspots: [
        {
          id: "hs-1",
          name: "Shelf",
          semantic: "custom_link",
          shape: { type: "rect", x: 0.1, y: 0.1, width: 0.3, height: 0.2 },
          enabled: true,
          authoringMode: "predefined",
        },
      ],
    });
    expect(p.interaction?.interactionId).toBe("open_gallery");
    expect(p.interaction?.locked).toBe(true);
    expect(p.interaction?.variantId).toBe("v2");
    expect(p.interaction?.plane).toBe("front_wall");
    expect(p.interaction?.hotspots).toHaveLength(1);
    expect(p.interaction?.hotspots?.[0].id).toBe("hs-1");
  });

  it("omits an empty interaction bag rather than storing {}", () => {
    const p = roundTrip({
      instanceId: "obj-5",
      assetId: "ast-plant-beta",
      x: 0.5, y: 0.9, width: 0.1, height: 0.1,
      anchor: { x: 0.55, y: 1 },
      plane: "floor",
      zIndex: 1,
    });
    // `plane` is always present on an editor object, so the bag carries it and nothing else.
    expect(p.interaction).toEqual({ plane: "floor" });
  });
});
