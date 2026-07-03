import { describe, expect, it } from "vitest";
import { deriveHouse, houseFeatures } from "@/lib/nest-house";

describe("houseFeatures", () => {
  it("is deterministic for a seed", () => {
    expect(houseFeatures(123456)).toEqual(houseFeatures(123456));
  });

  it("returns valid values in every field", () => {
    for (let s = 0; s < 40; s++) {
      const f = houseFeatures(s * 2654435761);
      expect(["gable", "hip"]).toContain(f.roof);
      expect(["square", "round", "arch"]).toContain(f.windowShape);
      expect([1, 2]).toContain(f.windowCount);
      expect(["round", "arch", "square"]).toContain(f.door);
      expect(["flowers", "bush", "lantern", "path"]).toContain(f.garden);
      expect(typeof f.mailbox).toBe("boolean");
      expect(typeof f.chimney).toBe("boolean");
      expect([-1, 1]).toContain(f.treeSide);
    }
  });

  it("gives different creators different homes", () => {
    const a = houseFeatures(deriveHouse({ creator: { username: "hannan" } }).seed);
    const b = houseFeatures(deriveHouse({ creator: { username: "ivy" } }).seed);
    // Not asserting total inequality (fields are small enums), but the tuples differ.
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});
