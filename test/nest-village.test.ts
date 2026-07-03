import { describe, expect, it } from "vitest";
import {
  axialToPixel,
  buildVillage,
  hexSpiral,
  houseIndex,
  neighborHouse,
  neighborOf,
  villageFromCreators,
} from "@/lib/nest-village";
import { deriveHouse } from "@/lib/nest-house";

describe("hexSpiral", () => {
  it("produces the requested count of unique cells starting at center", () => {
    const cells = hexSpiral(20);
    expect(cells).toHaveLength(20);
    expect(cells[0]).toEqual({ q: 0, r: 0 });
    const keys = new Set(cells.map((c) => `${c.q},${c.r}`));
    expect(keys.size).toBe(20);
  });
  it("is deterministic", () => {
    expect(hexSpiral(12)).toEqual(hexSpiral(12));
  });
});

describe("axialToPixel", () => {
  it("keeps the center near origin and is deterministic", () => {
    const a = axialToPixel({ q: 0, r: 0 }, 80, 1234);
    const b = axialToPixel({ q: 0, r: 0 }, 80, 1234);
    expect(a).toEqual(b);
    expect(Math.abs(a.x)).toBeLessThan(80);
    expect(Math.abs(a.y)).toBeLessThan(80);
  });
});

describe("neighborHouse", () => {
  it("is deterministic and generated (not real)", () => {
    const a = neighborHouse(3);
    const b = neighborHouse(3);
    expect(a).toEqual(b);
    expect(a.isReal).toBe(false);
    expect(a.name).toBeTruthy();
    expect(a.style.wall).toMatch(/^#/);
  });
});

describe("buildVillage", () => {
  const real = [
    deriveHouse({ creator: { id: "u1", username: "hannan", displayName: "Hannan" }, persona: "Writer" }),
    deriveHouse({ creator: { id: "u2", username: "ivy", displayName: "Ivy" }, persona: "Gamer" }),
  ];

  it("places real houses first and fills to the target count", () => {
    const v = buildVillage(real, { targetCount: 20 });
    expect(v.houses).toHaveLength(20);
    expect(v.houses[0].id).toBe("hannan");
    expect(v.houses[1].id).toBe("ivy");
    expect(v.houses.filter((h) => h.isReal)).toHaveLength(2);
    expect(v.houses.filter((h) => !h.isReal)).toHaveLength(18);
  });

  it("never drops real houses even below the target", () => {
    const many = Array.from({ length: 25 }, (_, i) => deriveHouse({ creator: { username: `c${i}` } }));
    const v = buildVillage(many, { targetCount: 20 });
    expect(v.houses).toHaveLength(25);
    expect(v.houses.filter((h) => h.isReal)).toHaveLength(25);
  });

  it("gives every house a positive position within the board", () => {
    const v = buildVillage(real);
    for (const h of v.houses) {
      expect(h.x).toBeGreaterThan(0);
      expect(h.y).toBeGreaterThan(0);
      expect(h.x).toBeLessThanOrEqual(v.width);
      expect(h.y).toBeLessThanOrEqual(v.height);
    }
  });

  it("is deterministic", () => {
    expect(buildVillage(real)).toEqual(buildVillage(real));
  });
});

describe("villageFromCreators", () => {
  it("builds a village directly from creators", () => {
    const v = villageFromCreators([{ creator: { username: "hannan" }, persona: "Creator" }], { targetCount: 6 });
    expect(v.houses).toHaveLength(6);
    expect(v.houses[0].handle).toBe("hannan");
  });
});

describe("navigation", () => {
  const v = buildVillage([deriveHouse({ creator: { username: "hannan" } })], { targetCount: 5 });

  it("finds a house by id", () => {
    expect(houseIndex(v, "hannan")).toBe(0);
    expect(houseIndex(v, "nope")).toBe(-1);
  });

  it("wraps next/previous around the village", () => {
    const first = v.houses[0].id;
    const last = v.houses[v.houses.length - 1].id;
    expect(neighborOf(v, first, -1)?.id).toBe(last);
    expect(neighborOf(v, last, 1)?.id).toBe(first);
    expect(neighborOf(v, first, 1)?.id).toBe(v.houses[1].id);
  });

  it("falls back to the first house for an unknown id", () => {
    expect(neighborOf(v, "nope", 1)?.id).toBe(v.houses[0].id);
  });
});
