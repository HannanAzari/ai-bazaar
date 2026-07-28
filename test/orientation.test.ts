import { describe, it, expect } from "vitest";
import { measurePoseFromAlpha, validatePose, POSE_TOLERANCE } from "@/lib/asset-pipeline/orientation";

// Pose-as-geometry: a front-facing (symmetric) silhouette must pass; a silhouette rotated
// into a three-quarter (asymmetric / lopsided) must fail. Built on synthetic alpha masks.

function makeAlpha(w: number, h: number, fill: (x: number, y: number) => boolean): Uint8ClampedArray {
  const a = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[y * w + x] = fill(x, y) ? 255 : 0;
  return a;
}

describe("orientation / pose measurement", () => {
  it("a centred symmetric block reads as near-perfectly symmetric and passes", () => {
    const w = 100, h = 100;
    const a = makeAlpha(w, h, (x, y) => x >= 30 && x < 70 && y >= 30 && y < 70);
    const m = measurePoseFromAlpha(a, w, h);
    expect(m.symmetry).toBeGreaterThan(0.98);
    expect(m.heavierSide).toBe("balanced");
    expect(validatePose(m).ok).toBe(true);
  });

  it("a symmetric trapezoid (front-facing, wider at the base) still passes", () => {
    const w = 100, h = 100;
    // widens toward the bottom but stays left-right symmetric about x=50
    const a = makeAlpha(w, h, (x, y) => {
      if (y < 30 || y >= 80) return false;
      const halfW = 15 + (y - 30) * 0.3;
      return Math.abs(x - 50) <= halfW;
    });
    const m = measurePoseFromAlpha(a, w, h);
    expect(m.symmetry).toBeGreaterThan(0.95);
    expect(validatePose(m).ok).toBe(true);
  });

  it("a right-skewed parallelogram (rotated into a three-quarter) fails the tolerance", () => {
    const w = 120, h = 100;
    // each row shifts right with y → a sheared silhouette, like a rotated object
    const a = makeAlpha(w, h, (x, y) => {
      if (y < 20 || y >= 80) return false;
      const shift = (y - 20) * 0.8;
      return x >= 20 + shift && x < 55 + shift;
    });
    const m = measurePoseFromAlpha(a, w, h);
    expect(m.symmetry).toBeLessThan(POSE_TOLERANCE.minSymmetry);
    expect(validatePose(m).ok).toBe(false);
    expect(validatePose(m).reason).toMatch(/rotated too far|lopsided/);
  });

  it("a one-sided silhouette (mirror-asymmetric) is flagged as out of tolerance", () => {
    const w = 100, h = 100;
    // a right-heavy wedge: solid on the right, tapering away to the left → not mirror-symmetric
    const a = makeAlpha(w, h, (x, y) => {
      if (y < 30 || y >= 70) return false;
      // left edge marches inward with y; right edge fixed → asymmetric silhouette
      return x >= 30 + (y - 30) && x < 80;
    });
    const m = measurePoseFromAlpha(a, w, h);
    expect(m.symmetry).toBeLessThan(POSE_TOLERANCE.minSymmetry);
    expect(m.heavierSide).not.toBe("balanced");
    expect(validatePose(m).ok).toBe(false);
  });

  it("returns an empty measure for a blank frame", () => {
    const m = measurePoseFromAlpha(new Uint8ClampedArray(100 * 100), 100, 100);
    expect(m.symmetry).toBe(0);
    expect(m.coverage).toBe(0);
  });
});
