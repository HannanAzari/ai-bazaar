import { describe, it, expect } from "vitest";
import {
  STYLE_FAMILIES,
  STYLE_FAMILY_IDS,
  DEFAULT_STYLE_FAMILY,
  getStyleFamily,
  isStyleFamily,
  buildStyledPrompt,
  buildStyledPromptPair,
  styleMasterPreview,
} from "@/lib/styles";
import { MASTER_PROMPT, NEGATIVE_PROMPT } from "@/lib/prompts";

describe("style families", () => {
  it("defines the three comparison identities", () => {
    expect(STYLE_FAMILY_IDS).toEqual(["royal_match", "modern_designer", "clash"]);
    expect(STYLE_FAMILIES).toHaveLength(3);
    expect(DEFAULT_STYLE_FAMILY).toBe("royal_match");
  });

  it("guards + resolves style ids (unknown falls back)", () => {
    expect(isStyleFamily("clash")).toBe(true);
    expect(isStyleFamily("nope")).toBe(false);
    expect(getStyleFamily("nope").id).toBe("royal_match");
  });

  it("every family prompt keeps the shared master spine but differs by descriptors", () => {
    const prompts = STYLE_FAMILY_IDS.map((id) => buildStyledPrompt("chair", id, { subject: "accent chair" }));
    expect(prompts.every((p) => p.startsWith(MASTER_PROMPT))).toBe(true);
    expect(prompts.every((p) => p.includes("accent chair"))).toBe(true);
    // All three are distinct (different style descriptors/tokens).
    expect(new Set(prompts).size).toBe(3);
  });

  it("injects family-specific tokens", () => {
    expect(buildStyledPrompt("sofa", "royal_match")).toContain("glossy");
    expect(buildStyledPrompt("sofa", "modern_designer")).toContain("minimalist");
    expect(buildStyledPrompt("sofa", "clash")).toContain("chunky");
  });

  it("pairs carry the universal negative prompt + resolved style id", () => {
    const pair = buildStyledPromptPair("lamp", "clash");
    expect(pair.styleId).toBe("clash");
    expect(pair.negativePrompt).toBe(NEGATIVE_PROMPT);
    expect(pair.prompt).toContain("chunky");
  });

  it("master preview is subject-less and style-specific", () => {
    const preview = styleMasterPreview("modern_designer");
    expect(preview.startsWith(MASTER_PROMPT)).toBe(true);
    expect(preview).toContain("minimalist");
  });
});
