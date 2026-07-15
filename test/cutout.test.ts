import { describe, it, expect } from "vitest";
import { pointsAlongStroke, clampBrush, displayToSource, CUTOUT_DEFAULTS } from "../lib/cutout";

describe("cutout pure helpers", () => {
  describe("pointsAlongStroke", () => {
    it("stamps evenly along the segment and always lands on the end", () => {
      const pts = pointsAlongStroke({ x: 0, y: 0 }, { x: 10, y: 0 }, 5);
      expect(pts[pts.length - 1]).toEqual({ x: 10, y: 0 });
      // ~2 steps at spacing 5 over length 10
      expect(pts.length).toBe(2);
      expect(pts[0]).toEqual({ x: 5, y: 0 });
    });

    it("returns a single point for a zero-length stroke", () => {
      const pts = pointsAlongStroke({ x: 3, y: 4 }, { x: 3, y: 4 }, 8);
      expect(pts).toEqual([{ x: 3, y: 4 }]);
    });

    it("never uses a spacing below 1px", () => {
      const pts = pointsAlongStroke({ x: 0, y: 0 }, { x: 4, y: 0 }, 0);
      expect(pts.length).toBe(4); // spacing clamped to 1
    });
  });

  describe("clampBrush", () => {
    it("clamps into the configured range and rounds", () => {
      expect(clampBrush(1)).toBe(CUTOUT_DEFAULTS.minBrush);
      expect(clampBrush(9999)).toBe(CUTOUT_DEFAULTS.maxBrush);
      expect(clampBrush(20.6)).toBe(21);
    });
  });

  describe("displayToSource", () => {
    it("inverts object-contain letterboxing (wide view, square image)", () => {
      // 200x100 view, 100x100 image → scale 1, drawn 100x100 centered at x-offset 50
      const p = displayToSource({ x: 100, y: 50 }, { width: 200, height: 100 }, { width: 100, height: 100 });
      expect(p.x).toBeCloseTo(50);
      expect(p.y).toBeCloseTo(50);
    });

    it("maps a corner tap back to source origin", () => {
      // 100x200 view, 100x100 image → scale 1, centered vertically offset 50
      const p = displayToSource({ x: 0, y: 50 }, { width: 100, height: 200 }, { width: 100, height: 100 });
      expect(p.x).toBeCloseTo(0);
      expect(p.y).toBeCloseTo(0);
    });
  });
});
