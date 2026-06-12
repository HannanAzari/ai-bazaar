import { describe, it, expect } from "vitest";
import { timeAgo, formatCount } from "@/lib/utils";

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

describe("timeAgo", () => {
  it("reads recent times as just now", () => {
    expect(timeAgo(ago(10_000))).toBe("just now");
  });
  it("formats minutes", () => {
    expect(timeAgo(ago(5 * 60_000))).toBe("5m ago");
  });
  it("formats hours", () => {
    expect(timeAgo(ago(3 * 3_600_000))).toBe("3h ago");
  });
  it("formats days", () => {
    expect(timeAgo(ago(2 * 86_400_000))).toBe("2d ago");
  });
});

describe("formatCount", () => {
  it("compacts large numbers", () => {
    expect(formatCount(8921)).toBe("8.9K");
  });
});
