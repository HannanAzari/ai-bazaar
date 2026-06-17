import { describe, it, expect } from "vitest";
import {
  MASTER_PROMPT,
  NEGATIVE_PROMPT,
  STYLE_TOKENS,
  CATEGORY_PROMPTS,
  STYLE_NAME,
  STYLE_ID,
  buildPrompt,
  buildPromptPair,
  buildBatchPrompts,
} from "@/lib/prompts";
import { ALL_CATEGORIES } from "@/lib/types";

describe("prompt system", () => {
  it("builds a prompt that starts with the master spine and ends with style tokens", () => {
    const p = buildPrompt("chair");
    expect(p.startsWith(MASTER_PROMPT)).toBe(true);
    expect(p).toContain(CATEGORY_PROMPTS.chair);
    expect(p.endsWith(STYLE_TOKENS.join(", "))).toBe(true);
  });

  it("honours a custom subject and extra detail", () => {
    const p = buildPrompt("lamp", { subject: "a tall brass lamp", extra: "blue accents" });
    expect(p).toContain("a tall brass lamp");
    expect(p).toContain("blue accents");
    expect(p).not.toContain(CATEGORY_PROMPTS.lamp);
  });

  it("builds a positive/negative pair", () => {
    const pair = buildPromptPair("plant");
    expect(pair.category).toBe("plant");
    expect(pair.negativePrompt).toBe(NEGATIVE_PROMPT);
    expect(pair.prompt).toContain(CATEGORY_PROMPTS.plant);
  });

  it("batch builds one pair per category by default", () => {
    const batch = buildBatchPrompts();
    expect(batch).toHaveLength(ALL_CATEGORIES.length);
    expect(new Set(batch.map((b) => b.category)).size).toBe(ALL_CATEGORIES.length);
  });

  it("negative prompt forbids scenes, props, and bad rendering", () => {
    for (const banned of ["platform", "pedestal", "multiple objects", "photorealism", "random perspective", "white background", "extra decorations"]) {
      expect(NEGATIVE_PROMPT).toContain(banned);
    }
  });

  it("is the premium game identity — single isolated object, transparent, no props", () => {
    expect(STYLE_NAME).toBe("Nestudio Premium Game Style V1");
    expect(STYLE_ID).toBe("premium_game_v1");
    expect(MASTER_PROMPT).toContain("Single isolated object");
    expect(MASTER_PROMPT).toContain("Transparent PNG background");
    expect(MASTER_PROMPT).toContain("No platform");
    expect(MASTER_PROMPT).toContain("No environment");
    expect(MASTER_PROMPT).toContain("30-degree isometric");
    // The storybook identity must be gone.
    expect(MASTER_PROMPT.toLowerCase()).not.toContain("storybook");
    expect(MASTER_PROMPT.toLowerCase()).not.toContain("golden-hour");
  });

  it("every category descriptor is a single object (no extra props)", () => {
    for (const c of ALL_CATEGORIES) {
      expect(CATEGORY_PROMPTS[c]).toBeTruthy();
      expect(CATEGORY_PROMPTS[c].startsWith("a single ")).toBe(true);
    }
  });
});
