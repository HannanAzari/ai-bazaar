import { describe, it, expect } from "vitest";
import { clusterForeground, detailMaskOf } from "../lib/identity/extract";
import { alphaIoU } from "../lib/identity/validator";

/** Build an RGBA image; `fn(x,y)` returns [r,g,b,a]. */
function img(w: number, h: number, fn: (x: number, y: number) => [number, number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b, a] = fn(x, y);
    const i = (y * w + x) * 4;
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
  }
  return { data, width: w, height: h };
}

describe("identity — colour clustering", () => {
  it("finds a cream body + a black handle, both critical", () => {
    // left half cream, right quarter black (the 'handle'), full alpha
    const im = img(40, 40, (x) => (x > 30 ? [20, 18, 16, 255] : [245, 238, 220, 255]));
    const clusters = clusterForeground(im.data, im.width, im.height);
    expect(clusters.length).toBeGreaterThanOrEqual(2);
    const black = clusters.find((c) => c.rgb[0] < 60);
    const cream = clusters.find((c) => c.rgb[0] > 200);
    expect(black?.critical).toBe(true); // dark → critical (must survive)
    expect(cream?.critical).toBe(true); // very light → critical
    // the black handle sits on the right
    expect(black!.bbox.x).toBeGreaterThan(0.6);
  });

  it("ignores transparent pixels", () => {
    const im = img(20, 20, (x) => (x < 10 ? [200, 150, 100, 255] : [0, 0, 0, 0]));
    const clusters = clusterForeground(im.data, im.width, im.height);
    expect(clusters.length).toBe(1);
    expect(clusters[0].coverage).toBeCloseTo(1, 1); // only opaque pixels count
  });
});

describe("identity — graphics/lettering detection", () => {
  it("detects dark marks sitting on a light surface", () => {
    // light body with a dark cross in the middle (lettering-like)
    const im = img(30, 30, (x, y) => {
      const mark = (x >= 13 && x <= 16) || (y >= 13 && y <= 16);
      return mark ? [20, 20, 20, 255] : [240, 232, 210, 255];
    });
    const { coverage } = detailMaskOf(im.data, im.width, im.height);
    expect(coverage).toBeGreaterThan(0.01);
  });

  it("finds no lettering on a plain surface", () => {
    const im = img(30, 30, () => [240, 232, 210, 255]);
    const { coverage } = detailMaskOf(im.data, im.width, im.height);
    expect(coverage).toBe(0);
  });
});

describe("identity — silhouette IoU", () => {
  it("is 1 for identical, low for shifted", () => {
    const a = new Uint8ClampedArray(100);
    const b = new Uint8ClampedArray(100);
    for (let i = 20; i < 60; i++) { a[i] = 255; b[i] = 255; }
    expect(alphaIoU(a, b)).toBeCloseTo(1);
    const c = new Uint8ClampedArray(100);
    for (let i = 60; i < 100; i++) c[i] = 255; // disjoint
    expect(alphaIoU(a, c)).toBe(0);
  });
});
