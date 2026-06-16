import { describe, it, expect } from "vitest";
import {
  MASTER_PROMPT,
  NEGATIVE_PROMPT,
  STYLE_TOKENS,
  CATEGORY_PROMPTS,
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

  it("negative prompt forbids the banned styles", () => {
    for (const banned of ["photorealistic", "white background", "harsh neon", "random perspective"]) {
      expect(NEGATIVE_PROMPT).toContain(banned);
    }
  });

  it("has a category prompt for every category", () => {
    for (const c of ALL_CATEGORIES) {
      expect(CATEGORY_PROMPTS[c]).toBeTruthy();
    }
  });
});
