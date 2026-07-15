import { describe, it, expect } from "vitest";
import {
  NESTUDIO_ASSET_DNA,
  ASSET_DNA_VERSION,
  buildAssetDnaPrompt,
  BENCHMARK_DIMENSIONS,
  BENCHMARK_MAX_SCORE,
} from "../lib/asset-dna";

describe("Nestudio Asset DNA — the constant", () => {
  it("is versioned and pins the immutable camera to the lock", () => {
    expect(NESTUDIO_ASSET_DNA.version).toBe(ASSET_DNA_VERSION);
    expect(NESTUDIO_ASSET_DNA.camera.heightCm).toBe(180);
    expect(NESTUDIO_ASSET_DNA.camera.tiltDeg).toBe(10);
    // never eye-level, never isometric
    expect(NESTUDIO_ASSET_DNA.camera.clause.toLowerCase()).toContain("slightly elevated");
    expect(NESTUDIO_ASSET_DNA.camera.clause.toLowerCase()).toContain("never eye-level");
    expect(NESTUDIO_ASSET_DNA.camera.clause.toLowerCase()).toContain("never isometric");
  });

  it("bakes NO shadow into the asset (engine composites cool-plum)", () => {
    expect(NESTUDIO_ASSET_DNA.shadow.baked).toBe(false);
    expect(NESTUDIO_ASSET_DNA.shadow.contactHex).toBe("#46365a");
    expect(NESTUDIO_ASSET_DNA.shadow.clause.toLowerCase()).toContain("no drawn shadow");
  });

  it("keeps exactly one accent and true object colour", () => {
    expect(NESTUDIO_ASSET_DNA.colour.accentsMax).toBe(1);
    expect(NESTUDIO_ASSET_DNA.colour.clause.toLowerCase()).toContain("true colours");
  });

  it("exports a square transparent PNG at the studio size", () => {
    expect(NESTUDIO_ASSET_DNA.export.size).toBe(640);
    expect(NESTUDIO_ASSET_DNA.export.mime).toBe("image/png");
  });
});

describe("buildAssetDnaPrompt — assembled from the DNA, not hand-written", () => {
  it("carries the subject, reinterpretation intent, and DNA constraints", () => {
    const p = buildAssetDnaPrompt("coffee mug");
    expect(p.dnaVersion).toBe(ASSET_DNA_VERSION);
    expect(p.positive.toLowerCase()).toContain("coffee mug");
    // reinterpret, don't reproduce
    expect(p.positive.toLowerCase()).toContain("rebuilt from scratch");
    expect(p.positive.toLowerCase()).toContain("not look like a photograph");
    // DNA fields present
    expect(p.positive.toLowerCase()).toContain("matte");
    expect(p.positive.toLowerCase()).toContain("10 degree");
    expect(p.positive.toLowerCase()).toContain("transparency");
  });

  it("forbids the photo-cutout / gloss / isometric failure modes in the negative", () => {
    const p = buildAssetDnaPrompt("mug");
    const neg = p.negative.toLowerCase();
    for (const bad of ["photo cutout", "glossy", "isometric", "eye-level", "checkerboard", "baked shadow"]) {
      expect(neg).toContain(bad);
    }
  });

  it("appends an optional user note verbatim without replacing DNA", () => {
    const p = buildAssetDnaPrompt("mug", "a little chipped on the rim");
    expect(p.positive).toContain("a little chipped on the rim");
    expect(p.positive.toLowerCase()).toContain("matte"); // DNA still there
  });

  it("falls back to a safe subject when empty", () => {
    const p = buildAssetDnaPrompt("");
    expect(p.positive.toLowerCase()).toContain("home object");
  });
});

describe("benchmark scorecard", () => {
  it("has 10 dimensions and a max of 20", () => {
    expect(BENCHMARK_DIMENSIONS).toHaveLength(10);
    expect(BENCHMARK_MAX_SCORE).toBe(20);
    // the reinterpretation dimension must exist — it's the one furniture@6 failed
    expect(BENCHMARK_DIMENSIONS.some((d) => d.key === "reinterpretation")).toBe(true);
  });
});
