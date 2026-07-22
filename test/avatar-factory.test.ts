import { describe, expect, it } from "vitest";
import { buildAvatarPrompt, scoreAvatarDna, AVATAR_GEN_SIZE } from "@/lib/avatar-factory/avatar-dna";
import { estimateAvatarCost, AVATAR_REFERENCE_COST, AVATAR_GENERATION_COST, type AvatarSpec } from "@/lib/avatar-factory/translator";

const baseSpec: AvatarSpec = {
  displayName: "Test User",
  styleIntensity: "balanced",
  outfitCategory: "smart-casual",
  clothingPalette: "warm neutrals",
  hair: "short dark hair",
  accessories: ["glasses"],
  expression: "gentle smile",
  bodyProportionFamily: "standard",
  canonicalPose: "idle-standing",
  transparency: true,
  intendedUses: ["profile", "editor"],
  privacyScope: "private-user",
  estimatedCostUsd: estimateAvatarCost(),
  moderation: { ok: true, note: "" },
  generationSubject: "a person in smart-casual clothes standing with arms relaxed",
};

describe("Avatar cost", () => {
  it("splits reference + generation and totals them", () => {
    expect(estimateAvatarCost()).toBe(Math.round((AVATAR_REFERENCE_COST + AVATAR_GENERATION_COST) * 100) / 100);
    expect(estimateAvatarCost()).toBeGreaterThan(0);
  });
});

describe("Avatar DNA prompt", () => {
  it("commands full-body, transparent, single person, and forbids anatomy defects", () => {
    const { positive, negative } = buildAvatarPrompt(baseSpec);
    expect(positive).toMatch(/full-body/i);
    expect(positive).toMatch(/transparent background/i);
    expect(negative).toMatch(/extra fingers/);
    expect(negative).toMatch(/multiple people/);
    expect(negative).toMatch(/room|background scene/);
  });
  it("targets a full-body portrait size", () => {
    expect(AVATAR_GEN_SIZE).toBe("1024x1536");
  });
});

describe("scoreAvatarDna", () => {
  it("passes a clean, private, idle-standing spec", () => {
    const { score, checks } = scoreAvatarDna(baseSpec);
    expect(score).toBe(1);
    expect(checks.every((c) => c.ok)).toBe(true);
  });
  it("flags a sensitive-attribute leak in the description", () => {
    const leak: AvatarSpec = { ...baseSpec, generationSubject: "a 34 years old religious person" };
    expect(scoreAvatarDna(leak).checks.find((c) => c.label === "No sensitive attributes")!.ok).toBe(false);
  });
  it("flags a non-idle pose (v1 only allows idle-standing)", () => {
    const seated: AvatarSpec = { ...baseSpec, canonicalPose: "seated" };
    expect(scoreAvatarDna(seated).checks.find((c) => c.label === "Idle-standing pose")!.ok).toBe(false);
  });
  it("flags moderation failure before generation", () => {
    const unsafe: AvatarSpec = { ...baseSpec, moderation: { ok: false, note: "no" } };
    expect(scoreAvatarDna(unsafe).checks.find((c) => c.label === "Safe")!.ok).toBe(false);
  });
});
