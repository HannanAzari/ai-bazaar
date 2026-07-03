import { describe, it, expect } from "vitest";
import { formatCount } from "@/lib/nest-engagement";

describe("formatCount", () => {
  it("compacts thousands", () => {
    expect(formatCount(42)).toBe("42");
    expect(formatCount(999)).toBe("999");
    expect(formatCount(1200)).toBe("1.2k");
    expect(formatCount(5000)).toBe("5k");
  });
});
