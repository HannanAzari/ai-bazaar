import { describe, it, expect } from "vitest";
import {
  STYLE_FAMILIES,
  STYLE_FAMILY_IDS,
  DEFAULT_STYLE_FAMILY,
  NESTUDIO_V2,
  getStyleFamily,
  isStyleFamily,
  buildStyledPrompt,
  buildStyledPromptPair,
  styleLabel,
  styleMasterPreview,
} from "@/lib/styles";
import { MASTER_PROMPT, NEGATIVE_PROMPT } from "@/lib/prompts";
import { obeysNestudioSpecs } from "@/lib/nestudio-spec";

describe("nestudio master style v2", () => {
  it("defines exactly one locked identity (the experiments are retired)", () => {
    expect(STYLE_FAMILY_IDS).toEqual(["nestudio_v2"]);
    expect(STYLE_FAMILIES).toHaveLength(1);
    expect(DEFAULT_STYLE_FAMILY).toBe("nestudio_v2");
    expect(NESTUDIO_V2.id).toBe("nestudio_v2");
    expect(styleLabel("nestudio_v2")).toBe("Nestudio V2");
  });

  it("guards + resolves style ids (unknown falls back to nestudio_v2)", () => {
    expect(isStyleFamily("nestudio_v2")).toBe(true);
    expect(isStyleFamily("royal_match")).toBe(false);
    expect(isStyleFamily("nope")).toBe(false);
    expect(getStyleFamily("nope").id).toBe("nestudio_v2");
  });

  it("builds a prompt that keeps the shared master spine + subject", () => {
    const p = buildStyledPrompt("chair", "nestudio_v2", { subject: "accent chair" });
    expect(p.startsWith(MASTER_PROMPT)).toBe(true);
    expect(p).toContain("accent chair");
    expect(p).toContain("Scandinavian"); // the DNA identity layer
  });

  it("never re-opens a banned door (obeys camera + object specs)", () => {
    const p = buildStyledPrompt("sofa", "nestudio_v2");
    expect(obeysNestudioSpecs(p)).toBe(true);
  });

  it("pairs carry the universal negative prompt + resolved style id", () => {
    const pair = buildStyledPromptPair("lamp", "anything");
    expect(pair.styleId).toBe("nestudio_v2");
    expect(pair.negativePrompt).toBe(NEGATIVE_PROMPT);
  });

  it("master preview is subject-less and carries the Nestudio DNA (V3.5)", () => {
    const preview = styleMasterPreview("nestudio_v2");
    expect(preview.startsWith(MASTER_PROMPT)).toBe(true);
    expect(preview).toContain("Scandinavian");
    expect(preview).toContain("warm cozy palette");
  });

  it("the style descriptors no longer steer toward generic catalog furniture (V3.5)", () => {
    const p = buildStyledPrompt("sofa", "nestudio_v2");
    expect(p).toContain("Scandinavian");
    expect(p).toContain("soft rounded geometry");
    expect(p.toLowerCase()).not.toContain("neutral premium palette");
  });
});
