import { describe, it, expect } from "vitest";
import {
  MATERIALS,
  buildMaterialBlock,
  usesStyleRefs,
  styleRefFamilyFor,
  hasGlassSurface,
  type ObjectMaterial,
} from "@/lib/asset-pipeline/materials";
import {
  CALIBRATION_BATCH,
  objectsNeedingInput,
  objectsReady,
  materialCoverage,
} from "@/lib/asset-pipeline/calibration";

// Sprint 1 — the material system is the fix for the "wooden furniture" failure.
// Two guarantees are load-bearing:
//   1. A cool/technical material reads AS ITSELF and actively forbids the wooden look.
//   2. Only warm organic materials pull the (warm-wood) style references.

describe("material vocabulary", () => {
  it("a cool metal reads cool and forbids the wooden-antique failure", () => {
    const { block, negativeAdds } = buildMaterialBlock({ primary: "matte-metal" });
    expect(block).toMatch(/MATERIAL — TRUE TO THE OBJECT/);
    expect(block).toMatch(/warmth lives in the LIGHT/i);
    expect(block).toMatch(/brushed or anodised matte metal|cool neutral/i);
    // the exact failure mode is named in the negative
    expect(negativeAdds).toContain("wooden");
    expect(negativeAdds).toEqual(expect.arrayContaining(["warm beige", "antique"]));
  });

  it("a screen reads as a solid dark switched-off panel, never white or transparent", () => {
    const { block, negativeAdds } = buildMaterialBlock({ primary: "screen" });
    expect(block).toMatch(/switched-OFF|off, dark screen/i);
    // Gen-5/6 fix: a blank/white source screen must render dark & solid, not a transparent hole
    expect(negativeAdds).toEqual(expect.arrayContaining(["white screen", "transparent screen"]));
  });

  it("timber still looks warm — the original good look is preserved", () => {
    const { block } = buildMaterialBlock({ primary: "timber" });
    expect(block).toMatch(/timber|wood/i);
    expect(usesStyleRefs({ primary: "timber" })).toBe(true);
  });

  it("names accent materials on their own parts (a metal body + a glass lens)", () => {
    const camera: ObjectMaterial = {
      primary: "matte-metal",
      accents: [{ family: "glass", part: "the lens" }],
    };
    const { block } = buildMaterialBlock(camera);
    expect(block).toMatch(/the lens:/);
    expect(block).toMatch(/translucent|glass/i);
  });

  it("falls back to a neutral block that does NOT force warm wood", () => {
    const { block, negativeAdds } = buildMaterialBlock(null);
    expect(block).toMatch(/honour the object's own real material/i);
    expect(block).toMatch(/warmth lives only in the light/i);
    expect(negativeAdds).toEqual([]); // neutral adds no material-specific negatives
  });

  it("attaches warm-wood style refs ONLY for warm organic materials", () => {
    expect(usesStyleRefs({ primary: "matte-metal" })).toBe(false);
    expect(usesStyleRefs({ primary: "screen" })).toBe(false);
    expect(usesStyleRefs({ primary: "glass" })).toBe(false);
    expect(usesStyleRefs({ primary: "polymer" })).toBe(false);
    expect(usesStyleRefs({ primary: "rubber" })).toBe(false);
    expect(usesStyleRefs({ primary: "fabric" })).toBe(true);
    expect(usesStyleRefs({ primary: "timber" })).toBe(true);
    expect(usesStyleRefs({ primary: "greenery" })).toBe(true);
    // decided by the PRIMARY only — a metal camera with a glass lens still gets none
    expect(styleRefFamilyFor({ primary: "matte-metal", accents: [{ family: "glass", part: "lens" }] })).toBe("none");
  });

  it("detects screen/glass surfaces so cleanup fills their transparent hole (Gen-6 fix)", () => {
    // a laptop = metal body + screen accent → needs the enclosed-hole fill
    expect(hasGlassSurface({ primary: "matte-metal", accents: [{ family: "screen", part: "display" }] })).toBe(true);
    expect(hasGlassSurface({ primary: "screen" })).toBe(true);
    expect(hasGlassSurface({ primary: "timber", accents: [{ family: "glass", part: "glazing" }] })).toBe(true);
    // a plain metal/fabric object has no glass hole to fill — must never be touched
    expect(hasGlassSurface({ primary: "matte-metal" })).toBe(false);
    expect(hasGlassSurface({ primary: "fabric" })).toBe(false);
    expect(hasGlassSurface(null)).toBe(false);
  });

  it("every family has a surface, palette and style-ref decision", () => {
    for (const spec of Object.values(MATERIALS)) {
      expect(spec.surface.length).toBeGreaterThan(10);
      expect(spec.palette.length).toBeGreaterThan(5);
      expect(["warm-soft", "none"]).toContain(spec.styleRef);
    }
  });
});

describe("calibration batch", () => {
  it("is exactly ten hero objects — we are NOT scaling", () => {
    expect(CALIBRATION_BATCH).toHaveLength(10);
  });

  it("exercises the whole material vocabulary (metal, screen, glass, fabric, timber, greenery…)", () => {
    const cov = materialCoverage();
    expect(cov).toEqual(
      expect.arrayContaining(["matte-metal", "screen", "glass", "polymer", "timber", "paper", "fabric", "ceramic", "rubber", "greenery"]),
    );
  });

  it("flags the objects still missing a reference (laptop + camera now wired; camera from the Reference Studio)", () => {
    const missing = objectsNeedingInput().map((o) => o.id).sort();
    expect(missing).toEqual(["rug", "vinyl-player"]);
    expect(objectsReady()).toHaveLength(8);
  });
});
