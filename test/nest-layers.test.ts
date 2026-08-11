import { readFileSync } from "node:fs";
import { join } from "node:path";
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

  it("keeps toasts on top of everything INSIDE a page", () => {
    // M27B-3B narrowed this from "on top of everything". Two surfaces are not inside a page:
    // the editor shell and the media player are `fixed inset-0` and cover the app whole.
    const inPage = ["room", "objects", "hotspots", "scrim", "chrome", "nav", "drawer", "modal", "toast"] as const;
    expect(LAYER.toast).toBe(Math.max(...inPage.map((k) => LAYER[k])));
  });

  it("names the two app-covering surfaces rather than letting them escape the file", () => {
    // The ORIGINAL version of this test asserted `value <= 80` for every layer and passed —
    // while the editor sat at a bare `z-[110]` that this file had never heard of. The cap was
    // enforcing the hierarchy on the layers that had opted in, which is the one place it was
    // not needed. The media player rendered underneath that shell in Preview as a result.
    //
    // So the invariant is stated the other way round: everything that covers the app is IN
    // here, in order. The player is last because it must be reachable from the editor too.
    expect(LAYER.editor).toBeGreaterThan(LAYER.toast);
    expect(LAYER.player).toBeGreaterThan(LAYER.editor);
  });

  it("exposes a Tailwind class per layer, as complete literals the scanner can see", () => {
    for (const key of Object.keys(LAYER) as (keyof typeof LAYER)[]) {
      expect(z[key]).toMatch(/^z-(\d+|\[\d+\])$/);
    }
  });

  it("no z-[9999] escape hatch — the surfaces that stack the highest USE this file", () => {
    // Enforced where it actually failed: on the two full-screen surfaces themselves.
    const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
    const editor = read("components", "nest", "editor", "nest-editor.tsx");
    const player = read("components", "nest", "app-shell", "nest-media-player.tsx");
    expect(editor).toContain("fixed inset-0 ${z.editor}");
    expect(editor).not.toContain("fixed inset-0 z-[110]");
    expect(player).toContain("zIndex: LAYER.player");
    // …and no layer is a number nobody can find later.
    for (const value of Object.values(LAYER)) expect(value).toBeLessThanOrEqual(LAYER.player);
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
