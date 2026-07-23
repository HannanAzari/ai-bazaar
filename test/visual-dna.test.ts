import { describe, expect, it } from "vitest";
import { VISUAL_DNA_VERSION, visualDnaFragment } from "@/lib/visual-dna";
import { buildAvatarPrompt } from "@/lib/avatar-factory/avatar-dna";
import { buildNestPrompt } from "@/lib/nest-factory/nest-dna";
import type { AvatarSpec } from "@/lib/avatar-factory/translator";
import type { NestSpec } from "@/lib/nest-factory/translator";

const avatar: AvatarSpec = {
  displayName: "A", styleIntensity: "balanced", outfitCategory: "casual", clothingPalette: "warm",
  hair: "short", accessories: [], expression: "gentle smile", bodyProportionFamily: "standard",
  canonicalPose: "idle-standing", transparency: true, intendedUses: ["profile"], privacyScope: "private-user",
  estimatedCostUsd: 0.45, moderation: { ok: true, note: "" }, generationSubject: "a person standing",
};
const nest: NestSpec = {
  name: "Studio", category: "Creator Studio", mood: "warm", architecturalStyle: "warm minimal",
  walls: "front-left-right", floorMaterial: "matte timber", ceiling: "flat", windows: "one side",
  palette: "warm neutrals", lighting: "soft key", timeOfDay: "day", architecturalDetails: [],
  recommendedAssetTags: [], compatibilityVersion: "front-facing-v1", estimatedCostUsd: 0.19,
  brandNeutral: { ok: true, note: "" }, moderation: { ok: true, note: "" }, generationSubject: "an empty studio",
};

describe("Nestudio Visual DNA v1 — one world", () => {
  it("the shared fragment carries the version + premium-3D + matte language", () => {
    const f = visualDnaFragment();
    expect(f).toContain(VISUAL_DNA_VERSION);
    expect(f).toMatch(/premium stylised 3D/i);
    expect(f).toMatch(/matte premium materials/i);
  });

  it("the AVATAR prompt includes the shared Visual DNA", () => {
    expect(buildAvatarPrompt(avatar).positive).toContain(VISUAL_DNA_VERSION);
  });

  it("the EMPTY NEST prompt includes the same shared Visual DNA", () => {
    expect(buildNestPrompt(nest).positive).toContain(VISUAL_DNA_VERSION);
  });

  it("avatar negatives inherit the shared anti-flat-vector guards", () => {
    expect(buildAvatarPrompt(avatar).negative).toMatch(/flat vector/);
  });
});
