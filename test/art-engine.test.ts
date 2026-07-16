import { describe, it, expect } from "vitest";
import { computeFingerprint, paletteDistance, averageFingerprints, buildProfile, type PixelSource } from "../lib/art-engine/fingerprint";
import { validateStyle } from "../lib/art-engine/validator";
import { FALLBACK_FINGERPRINT, FALLBACK_PROFILE } from "../lib/art-engine/official";

/** Build a solid RGBA patch, optionally with a specular (pure white) fraction. */
function patch(w: number, h: number, rgb: [number, number, number], whiteFrac = 0): PixelSource {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const white = i / (w * h) < whiteFrac;
    data[i * 4] = white ? 255 : rgb[0];
    data[i * 4 + 1] = white ? 255 : rgb[1];
    data[i * 4 + 2] = white ? 255 : rgb[2];
    data[i * 4 + 3] = 255;
  }
  return { data, width: w, height: h };
}

describe("art-engine fingerprint", () => {
  it("measures a warm matte patch as matte, warm, pure", () => {
    const fp = computeFingerprint(patch(20, 20, [200, 180, 150]));
    expect(fp.matteness).toBeCloseTo(1, 1);
    expect(fp.warmth).toBeGreaterThan(0); // r > b
    expect(fp.purity).toBeCloseTo(1, 1);
    expect(fp.coverage).toBeCloseTo(1, 1);
    expect(fp.palette.length).toBeGreaterThan(0);
  });

  it("detects gloss + pure white as low matteness/purity", () => {
    const fp = computeFingerprint(patch(20, 20, [200, 180, 150], 0.5));
    expect(fp.matteness).toBeLessThan(0.6);
    expect(fp.purity).toBeLessThan(0.6);
  });

  it("empty (all transparent) yields a safe neutral fingerprint", () => {
    const fp = computeFingerprint({ data: new Uint8ClampedArray(4 * 16), width: 4, height: 4 });
    expect(fp.coverage).toBe(0);
    expect(fp.matteness).toBe(1);
  });

  it("paletteDistance is 0 for identical, positive for different", () => {
    expect(paletteDistance([[100, 100, 100]], [[100, 100, 100]])).toBe(0);
    expect(paletteDistance([[255, 0, 0]], [[0, 0, 255]])).toBeGreaterThan(0.3);
  });

  it("averageFingerprints blends numeric fields", () => {
    const a = computeFingerprint(patch(10, 10, [200, 180, 150]));
    const b = computeFingerprint(patch(10, 10, [180, 160, 140]));
    const avg = averageFingerprints([a, b]);
    expect(avg.value).toBeCloseTo((a.value + b.value) / 2, 5);
  });

  it("buildProfile widens tolerance when the library varies", () => {
    const tight = buildProfile([FALLBACK_FINGERPRINT]);
    const varied = buildProfile([
      { ...FALLBACK_FINGERPRINT, coverage: 0.2 },
      { ...FALLBACK_FINGERPRINT, coverage: 0.6 },
    ]);
    expect(varied.tol.coverage).toBeGreaterThan(tight.tol.coverage);
  });
});

describe("art-engine style validator (the gate)", () => {
  it("passes an asset identical to the official mean", () => {
    const r = validateStyle(FALLBACK_FINGERPRINT, FALLBACK_PROFILE);
    expect(r.pass).toBe(true);
    expect(r.score).toBeGreaterThan(0.95);
    expect(r.failures).toHaveLength(0);
  });

  it("scores official-like assets high once tolerances come from the library spread", () => {
    // simulate a varied official library, then a member should still pass comfortably
    const members = [
      { ...FALLBACK_FINGERPRINT, coverage: 0.25, warmth: 0.03 },
      { ...FALLBACK_FINGERPRINT, coverage: 0.55, warmth: 0.11 },
      { ...FALLBACK_FINGERPRINT, coverage: 0.4, warmth: 0.07 },
    ];
    const profile = buildProfile(members);
    const r = validateStyle(members[0], profile);
    expect(r.pass).toBe(true);
    expect(r.score).toBeGreaterThan(0.8);
  });

  it("fails a glossy, pure-white, oversaturated candidate on critical dims", () => {
    const bad = computeFingerprint(patch(20, 20, [10, 40, 255], 0.5)); // saturated blue + gloss
    const r = validateStyle(bad, FALLBACK_PROFILE);
    expect(r.pass).toBe(false);
    expect(r.failures.length).toBeGreaterThan(0);
  });

  it("reports every named dimension", () => {
    const r = validateStyle(FALLBACK_FINGERPRINT, FALLBACK_PROFILE);
    const keys = r.dims.map((d) => d.key);
    for (const k of ["palette", "saturation", "lighting", "surface", "softness", "proportion", "purity"]) {
      expect(keys).toContain(k);
    }
  });
});
