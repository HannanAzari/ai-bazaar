import { describe, expect, it } from "vitest";
import { buildNestPrompt, scoreNestDna, NEST_GEN_SIZE, NEST_EDITOR_ASPECT } from "@/lib/nest-factory/nest-dna";
import { estimateNestCost, NEST_CAMERA_DNA_VERSION, type NestSpec } from "@/lib/nest-factory/translator";
import { specToNestId } from "@/lib/nest-factory/founder-publish-nest";

const baseSpec: NestSpec = {
  name: "Warm Music Studio",
  category: "Music Studio",
  mood: "warm / creative / calm",
  architecturalStyle: "mid-century",
  walls: "front-left-right",
  floorMaterial: "matte warm timber",
  ceiling: "flat soft-white ceiling",
  windows: "large left-side window, soft daylight",
  palette: "warm neutrals — oat, clay",
  lighting: "evening indirect key",
  timeOfDay: "evening",
  architecturalDetails: ["acoustic wall panels"],
  recommendedAssetTags: ["instrument", "audio"],
  compatibilityVersion: NEST_CAMERA_DNA_VERSION,
  estimatedCostUsd: estimateNestCost(),
  brandNeutral: { ok: true, note: "" },
  moderation: { ok: true, note: "" },
  generationSubject: "an empty warm music studio with a large back wall and wooden floor",
};

describe("Nest DNA prompt", () => {
  it("commands architecture-only and forbids furniture/people/text", () => {
    const { positive, negative } = buildNestPrompt(baseSpec);
    expect(positive).toMatch(/empty/i);
    expect(positive).toMatch(/Music Studio/);
    expect(negative).toMatch(/furniture/);
    expect(negative).toMatch(/people|person/);
    expect(negative).toMatch(/text|logos/);
  });

  it("targets the canonical portrait size + editor aspect", () => {
    expect(NEST_GEN_SIZE).toBe("1024x1536");
    expect(NEST_EDITOR_ASPECT).toBe("3:4");
  });
});

describe("scoreNestDna", () => {
  it("scores a clean spec 1.0", () => {
    const { score, checks } = scoreNestDna(baseSpec);
    expect(score).toBe(1);
    expect(checks.every((c) => c.ok)).toBe(true);
  });

  it("flags furniture leaking into the subject", () => {
    const dirty: NestSpec = { ...baseSpec, generationSubject: "a room with a big sofa and a desk" };
    const { score, checks } = scoreNestDna(dirty);
    expect(score).toBeLessThan(1);
    expect(checks.find((c) => c.label.startsWith("Empty"))!.ok).toBe(false);
  });

  it("flags a non-canonical camera", () => {
    const off: NestSpec = { ...baseSpec, compatibilityVersion: "some-other-cam" };
    expect(scoreNestDna(off).checks.find((c) => c.label === "Canonical camera")!.ok).toBe(false);
  });

  it("flags moderation failure", () => {
    const unsafe: NestSpec = { ...baseSpec, moderation: { ok: false, note: "nope" } };
    expect(scoreNestDna(unsafe).checks.find((c) => c.label === "Safe")!.ok).toBe(false);
  });
});

describe("specToNestId", () => {
  it("makes a stable nest- id from the name", () => {
    expect(specToNestId(baseSpec)).toBe("nest-warm-music-studio-v1");
  });
  it("falls back for an empty name", () => {
    expect(specToNestId({ ...baseSpec, name: "!!!" })).toBe("nest-nest-v1");
  });
});
