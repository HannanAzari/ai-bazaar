import { describe, it, expect } from "vitest";
import { formatCount, placeholderEngagement, placeholderSocial } from "@/lib/nest-engagement";

// M17.1 — placeholder engagement is UI-only, but must be DETERMINISTIC so counts don't
// flicker between renders (and never imply live data).
describe("placeholder engagement", () => {
  it("is deterministic for the same id", () => {
    const a = placeholderEngagement("nest-1");
    const b = placeholderEngagement("nest-1");
    expect(a).toEqual(b);
  });
  it("differs across ids and stays within sane ranges", () => {
    const a = placeholderEngagement("nest-1");
    const c = placeholderEngagement("nest-2");
    expect(a).not.toEqual(c);
    expect(a.likes).toBeGreaterThanOrEqual(0);
    expect(a.comments).toBeLessThan(40);
    expect(a.views).toBeGreaterThanOrEqual(a.likes); // views track likes + noise
  });
});

describe("placeholder social", () => {
  it("is deterministic per handle", () => {
    expect(placeholderSocial("hannan")).toEqual(placeholderSocial("hannan"));
    expect(placeholderSocial("hannan").followers).toBeLessThan(500);
  });
});

describe("formatCount", () => {
  it("compacts thousands", () => {
    expect(formatCount(42)).toBe("42");
    expect(formatCount(1200)).toBe("1.2k");
    expect(formatCount(5000)).toBe("5k");
  });
});
