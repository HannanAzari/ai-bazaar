import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROTATE_CLEARANCE_PX, rotatedAabb, rotationReadout, toolbarPlacement, TOOLBAR_GAP_PX, VIEWPORT_MARGIN_PX } from "@/lib/nest-editor-chrome";

// ── M26-P — Text parity, lighter chrome, a toolbar that stays on the phone ───
//
// THE TEXT DIVERGENCE, exactly: selecting a Text or Sticker called
// `setOverlaySheetOpen(true)`, and `hideChrome` is true whenever that sheet is open. So an
// overlay never received a selection frame, resize handles, a rotate control or a toolbar —
// no Duplicate, Layer, Mirror, Lock or Delete. It was the one object type whose SELECTION
// was indistinguishable from EDITING, and the sheet it opened then covered the room the
// creator needed to tap to escape it. Gestures worked the whole time, which is why it
// looked like a rendering fault rather than a state-machine one.

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const editor = read("components", "nest", "editor", "nest-editor.tsx");
const canvas = read("components", "nest", "editor", "editor-canvas.tsx");
const selection = read("components", "nest", "editor", "screen-space-selection.tsx");

const PHONE = { width: 375, height: 812 };
const BAR = { width: 198, height: 46 };

// ── §3 — the toolbar follows the object and never leaves the viewport ────────

describe("§3 — toolbar placement", () => {
  const mid = { left: 120, top: 400, width: 120, height: 90 };

  it("sits just above the object by default", () => {
    const p = toolbarPlacement(mid, BAR, PHONE);
    expect(p.side).toBe("above");
    expect(mid.top - (p.top + BAR.height)).toBe(TOOLBAR_GAP_PX);
  });

  it("is centred on the object", () => {
    const p = toolbarPlacement(mid, BAR, PHONE);
    expect(p.left + BAR.width / 2).toBeCloseTo(mid.left + mid.width / 2, 6);
  });

  it("flips below when there is no room above", () => {
    const p = toolbarPlacement({ ...mid, top: 10 }, BAR, PHONE);
    expect(p.side).toBe("below");
    expect(p.top).toBe(10 + mid.height + TOOLBAR_GAP_PX);
  });

  it("stays above when NEITHER side fits — clamped, not flung off-screen", () => {
    // A near-full-height object. Something has to give; leaving the bar half off the top
    // is worse than overlapping the object slightly.
    const p = toolbarPlacement({ left: 20, top: 4, width: 300, height: 800 }, BAR, PHONE);
    expect(p.top).toBeGreaterThanOrEqual(VIEWPORT_MARGIN_PX);
    expect(p.top + BAR.height).toBeLessThanOrEqual(PHONE.height - VIEWPORT_MARGIN_PX);
  });

  it("clamps to the left margin", () => {
    expect(toolbarPlacement({ ...mid, left: -80 }, BAR, PHONE).left).toBe(VIEWPORT_MARGIN_PX);
  });

  it("clamps to the right margin", () => {
    const p = toolbarPlacement({ ...mid, left: 360 }, BAR, PHONE);
    expect(p.left + BAR.width).toBe(PHONE.width - VIEWPORT_MARGIN_PX);
  });

  it("reserves room for the rotate control so the two cannot collide", () => {
    const withRotate = toolbarPlacement(mid, BAR, PHONE, true);
    const without = toolbarPlacement(mid, BAR, PHONE, false);
    expect(without.top - withRotate.top).toBe(ROTATE_CLEARANCE_PX);
  });

  it("never leaves the viewport, wherever the object is", () => {
    for (const left of [-400, -50, 0, 180, 360, 900]) {
      for (const top of [-300, -20, 0, 400, 800, 1200]) {
        const p = toolbarPlacement({ left, top, width: 120, height: 90 }, BAR, PHONE, true);
        expect(p.left).toBeGreaterThanOrEqual(VIEWPORT_MARGIN_PX);
        expect(p.left + BAR.width).toBeLessThanOrEqual(PHONE.width - VIEWPORT_MARGIN_PX);
        expect(p.top).toBeGreaterThanOrEqual(VIEWPORT_MARGIN_PX);
        expect(p.top + BAR.height).toBeLessThanOrEqual(PHONE.height - VIEWPORT_MARGIN_PX);
      }
    }
  });
});

// ── §2 — the outline follows the object's real rotated extent ────────────────

describe("§2 — rotated bounds", () => {
  const box = { left: 100, top: 100, width: 100, height: 50 };

  it("an unrotated box is its own bounds", () => {
    expect(rotatedAabb(box, 0)).toEqual(box);
  });

  it("a 90° turn swaps width and height about the same centre", () => {
    const r = rotatedAabb(box, 90);
    expect(r.width).toBeCloseTo(50, 6);
    expect(r.height).toBeCloseTo(100, 6);
    expect(r.left + r.width / 2).toBeCloseTo(box.left + box.width / 2, 6);
    expect(r.top + r.height / 2).toBeCloseTo(box.top + box.height / 2, 6);
  });

  it("a 45° turn is genuinely LARGER — which is why the toolbar used to overlap", () => {
    const r = rotatedAabb(box, 45);
    expect(r.width).toBeGreaterThan(box.width);
    expect(r.height).toBeGreaterThan(box.height);
  });

  it("direction of rotation does not change the extent", () => {
    expect(rotatedAabb(box, 30)).toEqual(rotatedAabb(box, -30));
  });
});

describe("§2 — the degree readout", () => {
  it("reads out whole degrees", () => {
    expect(rotationReadout(18.4)).toBe("18°");
  });

  it("uses a real minus sign, not a hyphen", () => {
    expect(rotationReadout(-32)).toBe("−32°");
  });

  it("shows -32° rather than 328°", () => {
    expect(rotationReadout(328)).toBe("−32°");
  });

  it("normalises a full turn to zero", () => {
    expect(rotationReadout(360)).toBe("0°");
  });
});

// ── §1 — Text is a first-class object ────────────────────────────────────────

describe("§1 — selecting an overlay no longer opens its editor", () => {
  it("selection never opens the sticker sheet", () => {
    // ROOT CAUSE. `setOverlaySheetOpen(Boolean(obj?.overlay))` on select, plus
    // `hideChrome={… || overlaySheetOpen}`, is why Text had no chrome at all.
    // Compared on CODE — the comment above the fix quotes the old line verbatim.
    const code = editor.replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toContain("setOverlaySheetOpen(Boolean(obj?.overlay))");
    expect(editor).toContain("setOverlaySheetOpen(false);");
  });

  it("a SECOND tap opens it — which is what the hint copy always promised", () => {
    expect(canvas).toContain("onReselect?: (id: string) => void;");
    expect(editor).toContain("if (obj?.overlay) setOverlaySheetOpen(true);");
  });

  it("a re-tap is only reported when the gesture stayed a tap", () => {
    // Otherwise every press-and-drag of a selected sticker would open its editor.
    expect(canvas).toContain("} else if (wasTap && reselected.current) {");
    expect(canvas).toContain("props.onReselect?.(reselected.current);");
  });

  it("chrome is still suppressed while the sheet IS open", () => {
    expect(editor).toContain("hideChrome={connectFor !== null || overlaySheetOpen}");
  });
});

// ── §2 — the chrome itself ───────────────────────────────────────────────────

describe("§2 — lighter selection chrome", () => {
  it("the outline is dashed, not a heavy solid rectangle", () => {
    expect(selection).toContain("border-dashed");
    expect(selection).not.toMatch(/border-2 border-cobalt"/);
  });

  it("it rotates with the object", () => {
    expect(selection).toContain("transform: `rotate(${object.rotation}deg)`");
  });

  it("there are TWO resize handles, not four", () => {
    const block = selection.slice(selection.indexOf("data-resize-handle"), selection.indexOf("data-rotate-handle"));
    // The corner table drives how many render.
    const corners = selection.slice(selection.indexOf("[0, 0, -1]"), selection.indexOf("] as const).map"));
    expect((corners.match(/\[-?\d+, -?\d+, -?\d+\]/g) ?? []).length).toBe(2);
    expect(block).toContain("pointer-events-auto");
  });

  it("the toolbar is a SIBLING of the frame, so it never tilts with the object", () => {
    // Inside the rotated outline its text would be upside down past 90°.
    const frameEnd = selection.indexOf("data-object-toolbar");
    expect(selection.slice(frameEnd)).not.toContain("spin");
  });

  it("handles keep a constant pixel size — never a percentage of the object", () => {
    expect(selection).toContain("const HANDLE = 40;");
    expect(selection).toContain("width: HANDLE,");
  });
});

// ── §4/§5 — guidance is out of the artwork ───────────────────────────────────

describe("§4/§5 — nothing floats over the room", () => {
  it("the hint and scene label live in a real layout strip", () => {
    expect(editor).toContain('<div className="flex min-h-[30px] shrink-0 items-center gap-2 px-3 pb-1">');
  });

  it("neither is absolutely positioned over the canvas any more", () => {
    expect(editor).not.toContain('className="pointer-events-none absolute left-1/2 top-11 z-30');
    expect(editor).not.toContain('<div className="pointer-events-none absolute left-1/2 top-2 z-30 -translate-x-1/2">');
  });

  it("there is a Hint button, and it toggles both ways", () => {
    expect(editor).toContain('label={hintOpen ? "Hide hint" : "Show hint"}');
    expect(editor).toContain("setHintOpen((v) => !v)");
  });

  it("dismissing a hint cannot destroy it forever", () => {
    // `hint` is computed unconditionally now; `seenHints` only decides whether it
    // auto-appears. Fusing the two made the Hint button a one-way fuse.
    const fn = editor.slice(editor.indexOf("const hint: { k: string; text: string }"), editor.indexOf("// M8: the surface currently open"));
    expect(fn).not.toContain("seenHints");
  });
});
