import { describe, it, expect } from "vitest";
import { maskArea, maskBBox, iou, borderFraction, scaleMaskNearest, pointInMask } from "../lib/segmentation/mask-utils";
import type { SegMask } from "../lib/segmentation/types";

// helper: build a mask with a filled rectangle
function rectMask(w: number, h: number, rx: number, ry: number, rw: number, rh: number): SegMask {
  const data = new Uint8ClampedArray(w * h);
  for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) data[y * w + x] = 255;
  return { width: w, height: h, data };
}

describe("segmentation mask utils", () => {
  it("maskArea counts foreground pixels", () => {
    expect(maskArea(rectMask(10, 10, 2, 2, 3, 4))).toBe(12);
  });

  it("maskBBox is tight around the region", () => {
    expect(maskBBox(rectMask(10, 10, 2, 3, 4, 2))).toEqual({ x: 2, y: 3, w: 4, h: 2 });
    expect(maskBBox({ width: 4, height: 4, data: new Uint8ClampedArray(16) })).toBeNull();
  });

  it("iou is 1 for identical, 0 for disjoint", () => {
    const a = rectMask(10, 10, 1, 1, 4, 4);
    const b = rectMask(10, 10, 1, 1, 4, 4);
    const c = rectMask(10, 10, 6, 6, 3, 3);
    expect(iou(a, b)).toBeCloseTo(1);
    expect(iou(a, c)).toBe(0);
  });

  it("borderFraction flags a background mask (touches all edges)", () => {
    const full = rectMask(8, 8, 0, 0, 8, 8);
    expect(borderFraction(full)).toBeGreaterThan(0);
    const inner = rectMask(8, 8, 3, 3, 2, 2); // no border pixels
    expect(borderFraction(inner)).toBe(0);
  });

  it("scaleMaskNearest doubles dimensions and preserves coverage roughly", () => {
    const m = rectMask(4, 4, 1, 1, 2, 2);
    const up = scaleMaskNearest(m, 8, 8);
    expect(up.width).toBe(8);
    expect(up.height).toBe(8);
    expect(maskArea(up)).toBe(16); // 2x2 → 4x4 block
  });

  it("pointInMask tests normalized coordinates", () => {
    const m = rectMask(10, 10, 4, 4, 2, 2);
    expect(pointInMask(m, 0.45, 0.45)).toBe(true);
    expect(pointInMask(m, 0.05, 0.05)).toBe(false);
  });
});
