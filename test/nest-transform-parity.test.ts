import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { boxTransform, placementStyle } from "@/lib/nest-geometry";
import { editableObjectsToPlacements } from "@/lib/nest-editor-bridge";
import type { EditableNestObject } from "@/lib/nest-editor-types";

// ── M26-F §2 — ONE transform contract: Edit === Preview ──────────────────────
//
// THE BUG THIS EXISTS FOR, and it is worth stating exactly, because it defeated two
// rounds of "verified" testing:
//
//   `.editor-piece { animation: piece-in … both; }` with
//   `@keyframes piece-in { to { transform: scale(1); } }`
//
// ran on the very element that carries the object's rotation and mirror. A CSS animation
// outranks an inline style in the cascade, and `animation-fill-mode: both` keeps the final
// keyframe applied forever — so Edit permanently rendered `scale(1)` and silently discarded
// every rotation and flip. Preview uses a different component with no such animation, which
// is why the two disagreed and why Mirror "worked" everywhere except where the creator was
// looking.
//
// It survived earlier testing because those checks read `element.style.transform` — the
// inline attribute that had just been written — instead of `getComputedStyle().transform`,
// which is what the human actually sees. Asserting the value you just set proves nothing.

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const canvas = read("components", "nest", "editor", "editor-canvas.tsx");

const objectAt = (over: Partial<EditableNestObject> = {}): EditableNestObject =>
  ({
    instanceId: "o1",
    assetId: "ast-lr-sofa-boucle",
    x: 0.2,
    y: 0.6,
    width: 0.3,
    height: 0.2,
    anchor: { x: 0.35, y: 0.8 },
    plane: "floor",
    zIndex: 4,
    ...over,
  }) as EditableNestObject;

describe("§2 — Edit and Preview cannot disagree about a transform", () => {
  const cases: Array<[string, Partial<EditableNestObject>]> = [
    ["nothing set", {}],
    ["mirrored", { flipX: true }],
    ["rotated", { rotation: 37 }],
    ["rotated AND mirrored", { rotation: 37, flipX: true }],
    ["negative rotation", { rotation: -128.5 }],
    ["rotation of exactly 0 is not a transform", { rotation: 0 }],
    ["a full turn", { rotation: 360 }],
  ];

  for (const [name, over] of cases) {
    it(`${name}: the editor string and the preview string are byte-identical`, () => {
      const o = objectAt(over);
      // Edit renders `boxTransform(o)`; Preview renders `placementStyle(placement)`, which
      // is `boxTransform` over the SAME object converted through the publish path.
      const [placement] = editableObjectsToPlacements([o]);
      expect(placementStyle(placement, 0).transform).toBe(boxTransform(o));
    });
  }

  it("the publish conversion preserves rotation and flip exactly", () => {
    // If the conversion dropped either, Edit and Preview would agree with each other and
    // both be wrong — so this is asserted on the VALUES, not just on string equality.
    const o = objectAt({ rotation: -42.25, flipX: true });
    const [p] = editableObjectsToPlacements([o]);
    expect(p.rotation).toBe(-42.25);
    expect(p.flipX).toBe(true);
    expect(placementStyle(p, 0).transform).toBe("rotate(-42.25deg) scaleX(-1)");
  });

  it("rotate always precedes scaleX — order is part of the contract", () => {
    // `scaleX(-1) rotate(θ)` and `rotate(θ) scaleX(-1)` are DIFFERENT transforms. Four
    // hand-written copies of this string is exactly how an order difference sneaks in.
    expect(boxTransform({ rotation: 30, flipX: true })).toBe("rotate(30deg) scaleX(-1)");
  });

  it("x/y/width/height/z come from the same conversion too", () => {
    const o = objectAt({ rotation: 12, flipX: true });
    const [p] = editableObjectsToPlacements([o]);
    const style = placementStyle(p, 0);
    expect(style.left).toBe(`${o.x * 100}%`);
    expect(style.top).toBe(`${o.y * 100}%`);
    expect(style.width).toBe(`${o.width * 100}%`);
    expect(style.zIndex).toBe(o.zIndex);
    expect(style.transformOrigin).toBe("center");
  });
});

// ── The structural guards that would have caught it ──────────────────────────

describe("§2 — nobody rebuilds the transform string by hand", () => {
  const consumers = [
    ["components", "nest", "editor", "editor-canvas.tsx"],
    ["components", "nest", "app-shell", "nest-runtime.tsx"],
    ["components", "nest", "inherited-interaction-layer.tsx"],
    ["components", "nest", "projected-focus-children.tsx"],
  ];

  for (const path of consumers) {
    it(`${path[path.length - 1]} calls boxTransform instead of composing its own`, () => {
      const src = read(...path);
      expect(src).toContain("boxTransform");
      // The hand-rolled shape that used to live in all four.
      expect(src).not.toMatch(/rotation \? `rotate\(\$\{[a-z]*\.rotation\}deg\)`/);
    });
  }
});

describe("§2 — no animation may overwrite an object's transform", () => {
  it("the element carrying the object transform is never animated", () => {
    // THE ROOT CAUSE. `.editor-piece` holds the inline rotation/mirror; an animation on it
    // wins the cascade and `fill-mode: both` makes that permanent.
    const rule = canvas.slice(canvas.indexOf(".editor-piece {"), canvas.indexOf("\n.editor-piece-in"));
    expect(rule).not.toContain("animation");
  });

  it("the pop-in lives on an inner wrapper that carries no object transform", () => {
    expect(canvas).toContain(".editor-piece-in { animation: piece-in");
    expect(canvas).toContain('<span className="editor-piece-in absolute inset-0 block">');
  });

  it("reduced-motion disables the wrapper's animation, not the object's transform", () => {
    expect(canvas).toContain("@media (prefers-reduced-motion: reduce) { .editor-piece-in { animation: none; } }");
  });
});

// ── §1 — rotation has to be REACHABLE to be testable ─────────────────────────

describe("§1 — movable objects can actually rotate", () => {
  it("rotation is allowed on the assets a creator actually places", async () => {
    const { EDITOR_GUARDRAILS } = await import("@/lib/nest-editor-policy");
    // `rotateObject()` silently no-ops when the guardrail says no, so a policy of `false`
    // made the two-finger gesture look broken on a real device rather than restricted.
    for (const slot of ["media", "sofa", "table", "lamp", "plant", "shelf", "seat", "desk"] as const) {
      expect(EDITOR_GUARDRAILS[slot]?.allowRotation).toBe(true);
    }
  });

  it("architectural wall fixtures still do not rotate", async () => {
    const { EDITOR_GUARDRAILS } = await import("@/lib/nest-editor-policy");
    // A tilted window reads as a rendering fault, not a choice.
    expect(EDITOR_GUARDRAILS.window?.allowRotation).toBe(false);
    expect(EDITOR_GUARDRAILS.pinboard?.allowRotation).toBe(false);
  });

  it("the object toolbar clears the rotate handle", async () => {
    // Enabling rotation everywhere put a rotate handle on every selection, and at the old
    // constant 14px gap it landed on top of Mirror and swallowed its taps.
    // M26-P replaced the hard-coded offset with `toolbarPlacement(…, hasRotateControl)`,
    // which reserves the clearance AND clamps to the viewport. Same guarantee, computed.
    const selection = read("components", "nest", "editor", "screen-space-selection.tsx");
    expect(selection).toContain("rotatable && !object.locked");
    expect(selection).toContain("toolbarPlacement(");
  });
});
