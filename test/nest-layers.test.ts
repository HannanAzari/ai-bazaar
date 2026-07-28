import { describe, expect, it } from "vitest";
import { BOTTOM_NAV_CLEARANCE, LAYER, safeBottom, safeTop, z } from "@/lib/nest-layers";

// M23B §8 — the layering hierarchy is a contract, not a habit. These tests fail if someone
// reintroduces an ordering bug the founder screenshots already caught once.
describe("layer hierarchy", () => {
  it("orders every layer strictly, room → toast", () => {
    const order = ["room", "objects", "hotspots", "scrim", "chrome", "nav", "drawer", "modal", "toast"] as const;
    const values = order.map((k) => LAYER[k]);
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  it("puts in-room chrome above placed objects (the creator pill vs furniture bug)", () => {
    expect(LAYER.chrome).toBeGreaterThan(LAYER.objects);
    expect(LAYER.chrome).toBeGreaterThan(LAYER.hotspots);
  });

  it("puts drawers above the bottom navigation (the nav-through-a-sheet bug)", () => {
    expect(LAYER.drawer).toBeGreaterThan(LAYER.nav);
  });

  it("puts modals above drawers — the auth gate opens FROM the comment sheet", () => {
    expect(LAYER.modal).toBeGreaterThan(LAYER.drawer);
  });

  it("keeps toasts on top of everything", () => {
    expect(LAYER.toast).toBe(Math.max(...Object.values(LAYER)));
  });

  it("exposes a Tailwind class per layer, as complete literals the scanner can see", () => {
    for (const key of Object.keys(LAYER) as (keyof typeof LAYER)[]) {
      expect(z[key]).toMatch(/^z-(\d+|\[\d+\])$/);
    }
  });

  it("keeps nothing above the toast layer — no z-[9999] escape hatch", () => {
    for (const value of Object.values(LAYER)) expect(value).toBeLessThanOrEqual(80);
  });
});

describe("safe areas", () => {
  it("always applies a minimum, so a device without insets still has breathing room", () => {
    expect(safeTop()).toBe("max(env(safe-area-inset-top), 0.75rem)");
    expect(safeBottom()).toBe("max(env(safe-area-inset-bottom), 1.25rem)");
    expect(safeTop("2rem")).toContain("2rem");
  });

  it("reserves the bottom nav's height plus the device inset", () => {
    expect(BOTTOM_NAV_CLEARANCE).toContain("env(safe-area-inset-bottom)");
    expect(BOTTOM_NAV_CLEARANCE).toContain("4.75rem");
  });
});
