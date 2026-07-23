import { describe, expect, it } from "vitest";
import { applyFamilyDefaults, estimateCost, type NestudioSpec } from "@/lib/asset-pipeline/translator";

function spec(over: Partial<NestudioSpec>): NestudioSpec {
  return {
    name: "Object", objectClass: "Story", tags: [], materials: ["polymer"],
    canonicalPose: "front", visualRole: "Supporting", interaction: "static", surface: "none",
    placement: "floor", estimatedCostUsd: estimateCost(false),
    brandNeutral: { ok: true, note: "" }, moderation: { ok: true, note: "" },
    generationSubject: "", ...over,
  };
}

describe("applyFamilyDefaults", () => {
  it("a guitar becomes Identity + PLAY (never Story/static)", () => {
    const { spec: out, matched } = applyFamilyDefaults(spec({ name: "Acoustic Guitar", generationSubject: "a warm acoustic guitar" }));
    expect(matched).toBe("musical-instrument");
    expect(out.objectClass).toBe("Identity");
    expect(out.interaction).toBe("PLAY");
    expect(out.surface).toBe("player");
    expect(out.placement).toBe("floor-or-surface");
  });

  it("matches instrument via tags even if the LLM said static", () => {
    const out = applyFamilyDefaults(spec({ name: "My Six-String", tags: ["electric guitar"], objectClass: "Story", interaction: "static" }));
    expect(out.spec.interaction).toBe("PLAY");
    expect(out.spec.objectClass).toBe("Identity");
  });

  it("a TV/laptop becomes Portal + SCREEN", () => {
    expect(applyFamilyDefaults(spec({ name: "Laptop" })).spec).toMatchObject({ objectClass: "Portal", interaction: "SCREEN" });
    expect(applyFamilyDefaults(spec({ name: "Television" })).spec).toMatchObject({ objectClass: "Portal", interaction: "SCREEN" });
  });

  it("a camera becomes Identity + DISPLAY + gallery", () => {
    expect(applyFamilyDefaults(spec({ name: "Vintage Camera" })).spec).toMatchObject({ objectClass: "Identity", interaction: "DISPLAY", surface: "gallery" });
  });

  it("a turntable/speaker becomes Portal + PLAY", () => {
    expect(applyFamilyDefaults(spec({ name: "Record Player" })).spec).toMatchObject({ objectClass: "Portal", interaction: "PLAY", surface: "player" });
  });

  it("leaves an unknown object untouched (matched null)", () => {
    const { spec: out, matched } = applyFamilyDefaults(spec({ name: "Ceramic Vase", generationSubject: "a matte ceramic vase" }));
    expect(matched).toBeNull();
    expect(out.objectClass).toBe("Story");
    expect(out.interaction).toBe("static");
  });
});
