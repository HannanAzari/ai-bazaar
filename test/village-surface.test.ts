import { describe, it, expect } from "vitest";
import {
  DEFAULT_SURFACE_CONFIG,
  projectSurface,
  clamp,
  wrapAngle,
  applyInertia,
  clampVelocity,
  type SurfaceCamera,
  type SurfaceViewport,
} from "../lib/village-surface";

const config = DEFAULT_SURFACE_CONFIG;
const viewport: SurfaceViewport = { width: 390, height: 780 };
const camera: SurfaceCamera = { longitude: 0, tilt: 0 };

describe("clamp / wrapAngle", () => {
  it("clamps", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
  it("wraps angles into (-π, π]", () => {
    expect(wrapAngle(0)).toBeCloseTo(0);
    expect(wrapAngle(Math.PI * 2)).toBeCloseTo(0);
    expect(wrapAngle(Math.PI * 3)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-Math.PI * 1.5)).toBeCloseTo(Math.PI * 0.5);
  });
});

describe("front / back occlusion", () => {
  it("a point facing the camera (front, a=0) is visible", () => {
    const p = projectSurface({ longitude: 0, latitude: 0 }, camera, viewport, config);
    expect(p.visible).toBe(true);
    expect(p.normalZ).toBeGreaterThan(0);
  });

  it("a point on the far side of the world (a=π) is HIDDEN behind the earth", () => {
    const p = projectSurface({ longitude: Math.PI, latitude: 0 }, camera, viewport, config);
    expect(p.visible).toBe(false);
    expect(p.normalZ).toBeLessThanOrEqual(0);
    expect(p.opacity).toBe(0);
  });

  it("hides (does not merely fade) every back-hemisphere longitude", () => {
    // Sweep the whole ring; back-facing points must be invisible, never a faint ghost.
    for (let lon = -Math.PI; lon <= Math.PI; lon += 0.2) {
      const p = projectSurface({ longitude: lon, latitude: 0.1 }, camera, viewport, config);
      if (p.normalZ <= 0) {
        expect(p.visible).toBe(false);
        expect(p.opacity).toBe(0);
      }
    }
  });
});

describe("the limb (horizon)", () => {
  it("a point right at the limb (normalZ ≈ 0) is on the verge of hidden", () => {
    // Find a longitude where normalZ crosses zero by scanning.
    let crossed = false;
    let prev = projectSurface({ longitude: 0, latitude: 0.1 }, camera, viewport, config).normalZ;
    for (let lon = 0.02; lon < Math.PI; lon += 0.02) {
      const nz = projectSurface({ longitude: lon, latitude: 0.1 }, camera, viewport, config).normalZ;
      if (prev > 0 && nz <= 0) {
        crossed = true;
        break;
      }
      prev = nz;
    }
    expect(crossed).toBe(true);
  });

  it("every projected point lands inside the terrain disc (radius R)", () => {
    const cx = viewport.width / 2;
    const cy = viewport.height * config.centerYFraction;
    for (let lon = -Math.PI; lon <= Math.PI; lon += 0.3) {
      for (let lat = -0.4; lat <= 0.7; lat += 0.2) {
        const p = projectSurface({ longitude: lon, latitude: lat }, camera, viewport, config);
        const dx = (p.x - cx) / config.radius;
        // x is exactly x0 (|x0| ≤ 1); y is scaled by latExaggeration, so test x only.
        expect(Math.abs(dx)).toBeLessThanOrEqual(1.0001);
        // y never below the disc's bottom nor above its top by more than exaggeration.
        expect(p.y).toBeLessThanOrEqual(cy + config.radius * config.latExaggeration + 0.001);
      }
    }
  });
});

describe("rotation wraps objects around the world", () => {
  it("an object hidden at the back becomes visible after rotating ~half turn", () => {
    const at = (lon: number) => projectSurface({ longitude: Math.PI, latitude: 0 }, { longitude: lon, tilt: 0 }, viewport, config);
    expect(at(0).visible).toBe(false); // object at lon=π, camera at 0 → back
    expect(at(Math.PI).visible).toBe(true); // rotate camera to face it → front
  });

  it("rotating the camera moves an object's screen x (it slides across)", () => {
    const p0 = projectSurface({ longitude: 0.3, latitude: 0.1 }, { longitude: 0, tilt: 0 }, viewport, config);
    const p1 = projectSurface({ longitude: 0.3, latitude: 0.1 }, { longitude: 0.15, tilt: 0 }, viewport, config);
    expect(p0.x).not.toBeCloseTo(p1.x);
  });
});

describe("scale + depth", () => {
  it("a front-facing point is larger than one near the limb", () => {
    const front = projectSurface({ longitude: 0, latitude: 0 }, camera, viewport, config);
    const nearLimb = projectSurface({ longitude: 1.3, latitude: 0 }, camera, viewport, config);
    expect(front.scale).toBeGreaterThan(nearLimb.scale);
  });

  it("scale stays within [minScale, maxScale]", () => {
    for (let lon = -Math.PI; lon <= Math.PI; lon += 0.15) {
      const p = projectSurface({ longitude: lon, latitude: 0.2 }, camera, viewport, config);
      expect(p.scale).toBeGreaterThanOrEqual(config.minScale);
      expect(p.scale).toBeLessThanOrEqual(config.maxScale);
    }
  });

  it("nearer (higher normalZ) gets a higher zIndex", () => {
    const front = projectSurface({ longitude: 0, latitude: 0 }, camera, viewport, config);
    const side = projectSurface({ longitude: 1.2, latitude: 0 }, camera, viewport, config);
    expect(front.zIndex).toBeGreaterThan(side.zIndex);
    expect(Number.isInteger(front.zIndex)).toBe(true);
  });
});

describe("inertia helpers", () => {
  it("applyInertia decays by friction", () => {
    expect(applyInertia({ x: 1, y: -2 }, 0.5)).toEqual({ x: 0.5, y: -1 });
  });
  it("clampVelocity caps magnitude, preserves direction, handles zero", () => {
    const v = clampVelocity({ x: 0.3, y: 0 }, 0.1);
    expect(v.x).toBeCloseTo(0.1);
    expect(clampVelocity({ x: 0, y: 0 }, 0.1)).toEqual({ x: 0, y: 0 });
  });
});
