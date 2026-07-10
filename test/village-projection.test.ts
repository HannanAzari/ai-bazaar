import { describe, it, expect } from "vitest";
import {
  DEFAULT_PROJECTION_CONFIG,
  clamp,
  wrapDeltaX,
  projectItem,
  projectAll,
  applyInertia,
  clampVelocity,
  stepCamera,
  dragToVelocity,
  type VillageWorldItem,
  type Camera,
  type Viewport,
} from "../lib/village-projection";

const config = DEFAULT_PROJECTION_CONFIG;
const viewport: Viewport = { width: 1000, height: 800 };
const originCamera: Camera = { x: 0, y: 0 };

function item(partial: Partial<VillageWorldItem> & { id: string }): VillageWorldItem {
  return {
    worldX: 0,
    worldY: 0,
    kind: "house",
    ...partial,
  };
}

describe("clamp", () => {
  it("passes through values inside the range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it("clamps to the lower and upper bounds", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });
});

describe("wrapDeltaX (shortest signed delta on a cylinder)", () => {
  const W = config.WORLD_WIDTH; // 2000

  it("returns a small NEGATIVE delta for an item just past the right edge", () => {
    // Item near the far right of the world, camera at 0.
    // Shortest path is a short hop to the LEFT → negative delta.
    const delta = wrapDeltaX(1990, 0, W);
    expect(delta).toBeCloseTo(-10);
    expect(delta).toBeLessThan(0);
    expect(Math.abs(delta)).toBeLessThan(W / 2);
  });

  it("returns a small POSITIVE delta wrapping across the seam", () => {
    // Camera near the right edge, item just past the seam at x=10.
    const delta = wrapDeltaX(10, 1990, W);
    expect(delta).toBeCloseTo(20);
    expect(delta).toBeGreaterThan(0);
  });

  it("places a just-past-right-edge item to the LEFT of screen center", () => {
    const projected = projectItem(item({ id: "wrap", worldX: 1990 }), originCamera, viewport, config);
    expect(projected.screenX).toBeLessThan(viewport.width / 2);
  });
});

describe("scale vs depth", () => {
  it("a foreground (near) item is larger than a horizon (far) item", () => {
    // Large positive relativeY = foreground/closest; near-zero = horizon.
    const near = projectItem(item({ id: "near", worldY: 500 }), originCamera, viewport, config);
    const horizon = projectItem(item({ id: "far", worldY: -500 }), originCamera, viewport, config);
    expect(near.scale).toBeGreaterThan(horizon.scale);
  });

  it("keeps scale within [minScale, maxScale] across the whole depth range", () => {
    for (let wy = -config.WORLD_HEIGHT; wy <= config.WORLD_HEIGHT; wy += 50) {
      const p = projectItem(item({ id: `s${wy}`, worldY: wy }), originCamera, viewport, config);
      expect(p.scale).toBeGreaterThanOrEqual(config.minScale);
      expect(p.scale).toBeLessThanOrEqual(config.maxScale);
    }
  });
});

describe("visibility", () => {
  it("is true for an item near the center", () => {
    const p = projectItem(item({ id: "center", worldX: 0, worldY: 100 }), originCamera, viewport, config);
    expect(p.visible).toBe(true);
  });

  it("is false for an item outside the visibility radius", () => {
    // visibilityRadius = 850, still < WORLD_WIDTH/2 (1000) so it does not wrap short.
    const p = projectItem(
      item({ id: "outside", worldX: config.visibilityRadius + 50 }),
      originCamera,
      viewport,
      config,
    );
    expect(p.visible).toBe(false);
  });
});

describe("opacity and blur bounds", () => {
  it("keeps opacity within [0,1] and blur >= 0 across the world", () => {
    for (let wx = -1000; wx <= 1000; wx += 100) {
      for (let wy = -600; wy <= 600; wy += 150) {
        const p = projectItem(item({ id: `o${wx}_${wy}`, worldX: wx, worldY: wy }), originCamera, viewport, config);
        expect(p.opacity).toBeGreaterThanOrEqual(0);
        expect(p.opacity).toBeLessThanOrEqual(1);
        expect(p.blur).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("zIndex ordering", () => {
  it("gives a foreground item a higher zIndex than a background item", () => {
    const background = projectItem(item({ id: "bg", worldY: -400 }), originCamera, viewport, config);
    const foreground = projectItem(item({ id: "fg", worldY: 400 }), originCamera, viewport, config);
    expect(foreground.zIndex).toBeGreaterThan(background.zIndex);
  });

  it("produces integer zIndex values", () => {
    const p = projectItem(item({ id: "z", worldY: 123 }), originCamera, viewport, config);
    expect(Number.isInteger(p.zIndex)).toBe(true);
  });
});

describe("projectAll", () => {
  it("returns items sorted by zIndex ascending", () => {
    const items: VillageWorldItem[] = [
      item({ id: "a", worldY: 300 }),
      item({ id: "b", worldY: -500 }),
      item({ id: "c", worldY: 100 }),
      item({ id: "d", worldY: 550 }),
      item({ id: "e", worldY: -100 }),
    ];
    const out = projectAll(items, originCamera, viewport, config);
    for (let i = 1; i < out.length; i++) {
      expect(out[i].zIndex).toBeGreaterThanOrEqual(out[i - 1].zIndex);
    }
    // Farthest item first, nearest last.
    expect(out[0].id).toBe("b");
    expect(out[out.length - 1].id).toBe("d");
  });
});

describe("inertia / physics helpers", () => {
  it("applyInertia decays velocity by the friction factor", () => {
    expect(applyInertia({ x: 10, y: -20 }, 0.9)).toEqual({ x: 9, y: -18 });
  });

  it("clampVelocity leaves sub-max velocities untouched", () => {
    expect(clampVelocity({ x: 3, y: 4 }, 10)).toEqual({ x: 3, y: 4 }); // mag 5 <= 10
  });

  it("clampVelocity scales an over-max velocity down while preserving direction", () => {
    const v = clampVelocity({ x: 100, y: 0 }, 50);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(50);
    expect(v.x).toBeCloseTo(50);
    expect(v.y).toBeCloseTo(0);
  });

  it("clampVelocity handles the zero vector safely", () => {
    expect(clampVelocity({ x: 0, y: 0 }, 50)).toEqual({ x: 0, y: 0 });
  });

  it("stepCamera integrates position by velocity * dt", () => {
    expect(stepCamera({ x: 0, y: 0 }, { x: 5, y: 3 })).toEqual({ x: 5, y: 3 });
    expect(stepCamera({ x: 10, y: 10 }, { x: 5, y: 3 }, 2)).toEqual({ x: 20, y: 16 });
  });

  it("dragToVelocity moves the camera opposite to the drag direction", () => {
    const v = dragToVelocity(10, -4, config);
    expect(v.x).toBeCloseTo(-10 * config.sensitivity);
    expect(v.y).toBeCloseTo(4 * config.sensitivity);
  });
});
