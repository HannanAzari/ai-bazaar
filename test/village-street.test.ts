import { describe, it, expect } from "vitest";
import {
  hash01,
  clamp,
  hillY,
  settlement,
  cellContent,
  visibleCellRange,
  bandCells,
  groundPath,
  roadPath,
  applyInertia,
  clampVelocity,
  type Band,
} from "../lib/village-street";

const band: Band = { id: "near", parallax: 1, baseY: 400, amp: 30, freq: 0.0016, spacing: 220, scale: 1 };

describe("hash01", () => {
  it("is deterministic and in [0,1)", () => {
    for (let n = -5; n < 50; n++) {
      const a = hash01(n, 3);
      expect(a).toBe(hash01(n, 3));
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(1);
    }
  });
  it("varies with salt", () => {
    expect(hash01(10, 1)).not.toBe(hash01(10, 2));
  });
});

describe("clamp", () => {
  it("bounds values", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});

describe("hillY", () => {
  it("is continuous — adjacent samples stay close (no cliffs)", () => {
    let prev = hillY(0, band);
    for (let x = 1; x <= 4000; x += 1) {
      const y = hillY(x, band);
      expect(Math.abs(y - prev)).toBeLessThan(2); // smooth roll, never a jump
      prev = y;
    }
  });
  it("stays within the amplitude envelope of the base", () => {
    for (let x = 0; x < 10000; x += 37) {
      const y = hillY(x, band);
      expect(y).toBeGreaterThanOrEqual(band.baseY - band.amp * 1.4);
      expect(y).toBeLessThanOrEqual(band.baseY + band.amp * 1.4);
    }
  });
});

describe("settlement density", () => {
  it("is deterministic, in [0,1], and not constant (dense + sparse stretches)", () => {
    const vals: number[] = [];
    for (let k = 0; k < 60; k++) {
      const s = settlement(k, 2);
      expect(s).toBe(settlement(k, 2));
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
      vals.push(s);
    }
    expect(Math.max(...vals) - Math.min(...vals)).toBeGreaterThan(0.4);
  });
});

describe("cellContent", () => {
  it("is deterministic and anchors items to the hill line", () => {
    const c = cellContent(12, band, 1);
    expect(c).toEqual(cellContent(12, band, 1));
    expect(c.groundY).toBeCloseTo(hillY(c.worldX, band), 5);
    expect(c.worldX).toBeGreaterThan(11 * band.spacing);
    expect(c.worldX).toBeLessThan(13 * band.spacing);
    expect(c.variant).toBeGreaterThanOrEqual(0);
    expect(c.variant).toBeLessThan(1);
  });
  it("produces a healthy mix of houses, decor and open country over a stretch", () => {
    const kinds = new Set<string>();
    let houses = 0;
    for (let k = 0; k < 120; k++) {
      const c = cellContent(k, band, 5, 0.1);
      kinds.add(c.kind);
      if (c.kind === "house") houses++;
    }
    expect(kinds.has("house")).toBe(true);
    expect(kinds.has("empty")).toBe(true);
    expect(kinds.size).toBeGreaterThanOrEqual(4); // houses + empty + several decor kinds
    expect(houses).toBeGreaterThan(5); // it's a village, not a wasteland
    expect(houses).toBeLessThan(120); // and not wall-to-wall houses
  });
});

describe("visibleCellRange + bandCells", () => {
  it("covers the viewport plus buffer and scrolls with parallax", () => {
    const r0 = visibleCellRange(0, band, 400, 200);
    expect(r0.kMin).toBeLessThanOrEqual(0);
    expect(r0.kMax * band.spacing).toBeGreaterThanOrEqual(400);
    // Moving the camera right shifts the window right.
    const r1 = visibleCellRange(2000, band, 400, 200);
    expect(r1.kMin).toBeGreaterThan(r0.kMin);
  });
  it("a far band (low parallax) scrolls slower than a near band", () => {
    const far: Band = { ...band, parallax: 0.4 };
    const nearShift = visibleCellRange(4000, band, 400, 0).kMin - visibleCellRange(0, band, 400, 0).kMin;
    const farShift = visibleCellRange(4000, far, 400, 0).kMin - visibleCellRange(0, far, 400, 0).kMin;
    expect(farShift).toBeLessThan(nearShift);
  });
  it("bandCells returns one cell per index in range", () => {
    const cells = bandCells(band, 1, -2, 3);
    expect(cells.map((c) => c.k)).toEqual([-2, -1, 0, 1, 2, 3]);
  });
});

describe("groundPath / roadPath", () => {
  it("groundPath is a closed fill spanning the range", () => {
    const d = groundPath(band, 0, 800, 900);
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d).toContain("900.0"); // reaches the floor
  });
  it("roadPath is an open polyline following the hill", () => {
    const d = roadPath(band, 0, 400, 12);
    expect(d.startsWith("M")).toBe(true);
    expect(d).not.toContain("Z");
  });
});

describe("camera physics", () => {
  it("applyInertia decays velocity", () => {
    expect(applyInertia({ x: 10, y: 4 }, 0.9)).toEqual({ x: 9, y: 3.6 });
  });
  it("clampVelocity caps magnitude and preserves direction", () => {
    const v = clampVelocity({ x: 100, y: 0 }, 40);
    expect(v.x).toBeCloseTo(40);
    expect(clampVelocity({ x: 0, y: 0 }, 40)).toEqual({ x: 0, y: 0 });
  });
});
