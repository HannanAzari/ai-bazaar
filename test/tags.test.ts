import { describe, it, expect } from "vitest";
import { normalizeTag, parseTags } from "@/lib/tags";

describe("normalizeTag", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(normalizeTag("Slow Living")).toBe("slow-living");
  });
  it("strips trailing punctuation", () => {
    expect(normalizeTag("Painting!!!")).toBe("painting");
  });
  it("trims leading and trailing separators", () => {
    expect(normalizeTag("  --art-- ")).toBe("art");
  });
  it("collapses non-alphanumeric runs", () => {
    expect(normalizeTag("a / b")).toBe("a-b");
  });
  it("caps length at 32 chars", () => {
    expect(normalizeTag("a".repeat(50)).length).toBe(32);
  });
});

describe("parseTags", () => {
  it("splits, normalizes, and dedupes", () => {
    expect(parseTags("painting, Portrait, painting")).toEqual(["painting", "portrait"]);
  });
  it("ignores blank entries", () => {
    expect(parseTags(" , , art")).toEqual(["art"]);
  });
});
