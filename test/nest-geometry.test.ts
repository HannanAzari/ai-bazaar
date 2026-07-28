import { describe, expect, it } from "vitest";
import { CANONICAL_TEST_NEST } from "@/lib/fixtures/canonical-nest";
import { boxTransform, inPaintOrder, placementBox, placementStyle, scaleFromWidth, widthFromScale } from "@/lib/nest-geometry";
import { editableObjectsToPlacements, nestDocumentToEditable } from "@/lib/nest-editor-bridge";
import type { NestPlacement } from "@/lib/nest-document-types";

// M23A — the whole point: ONE geometry, so a Nest looks the same in the editor, on a Profile
// card, in the feed, in search and at full screen.

const byId = (id: string): NestPlacement =>
  CANONICAL_TEST_NEST.placements.find((p) => p.id === id)!;

describe("canonical width formula", () => {
  it("is the editor's rule (scale * 0.5), not the preview's old scale * 55", () => {
    expect(widthFromScale(0.4)).toBeCloseTo(0.2, 5);
    expect(widthFromScale(1.0)).toBeCloseTo(0.5, 5);
    // the removed preview formula would have produced 0.4*55 = 22% and 55%
    expect(widthFromScale(0.4)).not.toBeCloseTo(0.22, 3);
  });

  it("clamps to the editor's bounds", () => {
    expect(widthFromScale(0.001)).toBeCloseTo(0.06, 5); // floor
    expect(widthFromScale(99)).toBeCloseTo(0.7, 5); // ceiling
  });

  it("round-trips with scaleFromWidth", () => {
    for (const s of [0.2, 0.4, 0.8, 1.2]) {
      expect(scaleFromWidth(widthFromScale(s))).toBeCloseTo(s, 5);
    }
  });
});

describe("anchoring", () => {
  it("anchors an ASSET by its base centre (feet on the floor)", () => {
    const p = byId("p-small");
    const b = placementBox(p);
    // box is centred horizontally on x, and its BOTTOM sits at y
    expect(b.x + b.w / 2).toBeCloseTo(p.x, 5);
    expect(b.y + b.h).toBeCloseTo(p.y, 5);
  });

  it("anchors an OVERLAY by its box top-left, using its own w/h", () => {
    const p = byId("p-text");
    const b = placementBox(p);
    expect(b.x).toBeCloseTo(p.x, 5);
    expect(b.y).toBeCloseTo(p.y, 5);
    expect(b.w).toBeCloseTo(p.w!, 5);
    expect(b.h).toBeCloseTo(p.h!, 5);
  });
});

describe("properties that used to be lost", () => {
  it("keeps rotation", () => {
    expect(placementBox(byId("p-rotated")).rotation).toBe(18);
    expect(boxTransform({ rotation: 18, flipX: false })).toBe("rotate(18deg)");
  });

  it("keeps horizontal mirroring", () => {
    expect(placementBox(byId("p-flipped")).flipX).toBe(true);
    expect(boxTransform({ rotation: 0, flipX: true })).toBe("scaleX(-1)");
    expect(boxTransform({ rotation: 18, flipX: true })).toBe("rotate(18deg) scaleX(-1)");
  });

  it("emits an explicit height (the preview used to omit it entirely)", () => {
    const style = placementStyle(byId("p-large"));
    expect(style.height).toMatch(/%$/);
    expect(parseFloat(String(style.height))).toBeGreaterThan(0);
  });

  it("does NOT drop overlays — they produce a real box", () => {
    for (const id of ["p-text", "p-image"]) {
      const b = placementBox(byId(id));
      expect(b.w).toBeGreaterThan(0);
      expect(b.h).toBeGreaterThan(0);
    }
  });
});

describe("paint order", () => {
  it("sorts by z-index so overlapping objects stack as the creator arranged them", () => {
    const ordered = inPaintOrder(CANONICAL_TEST_NEST.placements).map((p) => p.id);
    expect(ordered.indexOf("p-under")).toBeLessThan(ordered.indexOf("p-over"));
    expect(ordered[ordered.length - 1]).toBe("p-image"); // highest zIndex paints last
  });

  it("is stable for equal z-indexes", () => {
    const a: NestPlacement[] = [
      { id: "a", assetId: "ast-tv", x: 0.5, y: 0.5, zIndex: 1 },
      { id: "b", assetId: "ast-tv", x: 0.5, y: 0.5, zIndex: 1 },
    ];
    expect(inPaintOrder(a).map((p) => p.id)).toEqual(["a", "b"]);
  });
});

describe("editor ⇄ document round-trip preserves the composition", () => {
  it("survives placement → editor object → placement", () => {
    const editable = nestDocumentToEditable(CANONICAL_TEST_NEST);
    const back = editableObjectsToPlacements(editable.objects);

    // rotation, mirroring and overlay content all come back
    const rotated = back.find((p) => p.rotation === 18);
    expect(rotated).toBeTruthy();
    const flipped = back.find((p) => p.flipX);
    expect(flipped).toBeTruthy();
    const text = back.find((p) => p.overlay?.kind === "text");
    expect(text?.overlay).toMatchObject({ kind: "text", text: "Welcome home" });
    const image = back.find((p) => p.overlay?.kind === "image");
    expect(image?.overlay).toMatchObject({ kind: "image" });
  });

  it("keeps an asset's geometry stable across the round-trip", () => {
    const editable = nestDocumentToEditable(CANONICAL_TEST_NEST);
    const back = editableObjectsToPlacements(editable.objects);
    const before = byId("p-small");
    const after = back.find((p) => p.id === "p-small")!;
    expect(after.x).toBeCloseTo(before.x, 2);
    expect(after.y).toBeCloseTo(before.y, 2);
    expect(after.scale).toBeCloseTo(before.scale!, 2);
    // and the box the two produce is the same
    expect(placementBox(after).w).toBeCloseTo(placementBox(before).w, 3);
  });
});
