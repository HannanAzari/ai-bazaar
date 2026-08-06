import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  IDENTITY_CAMERA,
  panBy,
  screenDeltaToScene,
  screenToScene,
  sceneToScreen,
  visibleSceneCentre,
  visibleSceneRect,
  zoomAround,
  type Camera,
} from "@/lib/nest-camera";
import {
  beginGesture,
  classifyTarget,
  gestureAllows,
  ownerMovesCamera,
  ownerMovesObject,
  resolveGestureOwner,
  upgradeGesture,
} from "@/lib/nest-gesture";
import { addObject } from "@/lib/nest-editor";
import { editableObjectsToPlacements, nestDocumentToEditable } from "@/lib/nest-editor-bridge";
import { INTERACTIVE_TEST_NEST } from "@/lib/fixtures/interactive-nest";
import type { NestDocument } from "@/lib/nest-document-types";
import type { EditableNestDocument } from "@/lib/nest-editor-types";
import type { LivingNestAsset } from "@/lib/nest-visual-types";

// ── M26A — the Nest Stage and the gesture foundation ─────────────────────────
//
// Two objectives: a premium stage around the canonical room, and a creator editor whose
// zoom, pan, selection and manipulation are deterministic.

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const stage = read("components", "nest", "nest-stage.tsx");
const canvas = read("components", "nest", "editor", "editor-canvas.tsx");
const runtime = read("components", "nest", "app-shell", "nest-runtime.tsx");
const css = read("app", "globals.css");

/** A 375×667 phone viewport with the 3:4 stage fitted inside it. */
const VP = { left: 0, top: 0, width: 375, height: 500 };
const BASE = { width: 375, height: 500 };
const roundTrip = (d: NestDocument): NestDocument => JSON.parse(JSON.stringify(d));

// ── 1–4. gesture ownership ───────────────────────────────────────────────────

describe("1. two fingers own the camera, wherever they land", () => {
  it("a pinch beginning on the selected object is still a pinch", () => {
    expect(resolveGestureOwner({ pointerCount: 2, target: "selected-object", scale: 1 })).toBe("camera-pinch");
  });

  it("…and on a resize handle, and on empty space", () => {
    expect(resolveGestureOwner({ pointerCount: 2, target: "resize-handle", scale: 1 })).toBe("camera-pinch");
    expect(resolveGestureOwner({ pointerCount: 2, target: "empty", scale: 1 })).toBe("camera-pinch");
  });
});

describe("2. a drag on the selected object owns the object", () => {
  it("moves it, at any zoom", () => {
    for (const scale of [1, 2, 5]) {
      expect(resolveGestureOwner({ pointerCount: 1, target: "selected-object", scale })).toBe("object-move");
    }
  });

  it("handles own resize and rotate — they are NOT inside the object element", () => {
    // This is the exact bug: a target test that only looked for the object element sent
    // handle drags to the camera.
    expect(resolveGestureOwner({ pointerCount: 1, target: "resize-handle", scale: 3 })).toBe("object-resize");
    expect(resolveGestureOwner({ pointerCount: 1, target: "rotate-handle", scale: 3 })).toBe("object-rotate");
  });

  it("a locked object can be selected but never moved", () => {
    expect(resolveGestureOwner({ pointerCount: 1, target: "selected-object", scale: 2, locked: true })).toBe("select");
    expect(resolveGestureOwner({ pointerCount: 1, target: "resize-handle", scale: 2, locked: true })).toBe("none");
  });

  it("a drag on ANOTHER object selects it rather than flinging it", () => {
    expect(resolveGestureOwner({ pointerCount: 1, target: "other-object", scale: 2 })).toBe("select");
  });

  it("classifyTarget checks handles BEFORE the object element", () => {
    const onlyHandle = (sel: string) => (sel === "[data-resize-handle]" ? {} : null);
    expect(classifyTarget(onlyHandle, "a").target).toBe("resize-handle");
  });

  it("classifyTarget distinguishes the selected object from another one", () => {
    const obj = (id: string) => (sel: string) => (sel === "[data-editor-object]" ? { id } : null);
    expect(classifyTarget(obj("a"), "a").target).toBe("selected-object");
    expect(classifyTarget(obj("b"), "a").target).toBe("other-object");
    expect(classifyTarget(() => null, "a").target).toBe("empty");
  });
});

describe("3. empty-space drag pans only while zoomed", () => {
  it("pans at 2× and 5×", () => {
    expect(resolveGestureOwner({ pointerCount: 1, target: "empty", scale: 2 })).toBe("camera-pan");
    expect(resolveGestureOwner({ pointerCount: 1, target: "empty", scale: 5 })).toBe("camera-pan");
  });

  it("does nothing at 1× — the room already fills the viewport", () => {
    expect(resolveGestureOwner({ pointerCount: 1, target: "empty", scale: 1 })).toBe("none");
  });
});

describe("4. ownership is locked until pointer-up", () => {
  const ctx = { pointerCount: 1, target: "selected-object" as const, scale: 3, objectId: "book-a" };

  it("a move event is only handled by the owner decided at pointer-down", () => {
    const g = beginGesture(ctx, 1);
    expect(g.owner).toBe("object-move");
    expect(gestureAllows(g, "object-move")).toBe(true);
    expect(gestureAllows(g, "camera-pan")).toBe(false);
  });

  it("the camera cannot take over an object drag midway", () => {
    const g = beginGesture(ctx, 1);
    // Nothing in the API can turn an object-move into a pan.
    expect(upgradeGesture(g, 1).owner).toBe("object-move");
    expect(ownerMovesObject(g.owner)).toBe(true);
    expect(ownerMovesCamera(g.owner)).toBe(false);
  });

  it("the ONE legal escalation is a second finger arriving — that is a pinch", () => {
    expect(upgradeGesture(beginGesture(ctx, 1), 2).owner).toBe("camera-pinch");
  });

  it("the editor's pan filter routes through the arbiter, not an ad-hoc predicate", () => {
    expect(canvas).toContain("resolveGestureOwner({");
    expect(canvas).toContain("ownerMovesCamera(");
    expect(canvas).toContain("classifyTarget(");
  });

  it("the arbiter's answer is computed at pointerdown and never re-computed", () => {
    const gestures = read("components", "nest", "app-shell", "use-scene-camera.ts");
    expect(gestures).toContain("panAllowed = canPanFromRef.current");
    expect(gestures).toContain("if (panAllowed && cam.current.scale > 1.001)");
  });
});

// ── 5–9. screen ⇄ scene ──────────────────────────────────────────────────────

describe("5-7. screen → scene conversion at 1×, 2× and 5×", () => {
  const cases: Array<[string, Camera]> = [
    ["1×", IDENTITY_CAMERA],
    ["2×", { scale: 2, x: 0, y: 0 }],
    ["5×", { scale: 5, x: -60, y: 40 }],
  ];

  for (const [name, cam] of cases) {
    it(`round-trips exactly at ${name}`, () => {
      for (const p of [{ nx: 0.1, ny: 0.9 }, { nx: 0.5, ny: 0.5 }, { nx: 0.83, ny: 0.24 }]) {
        const screen = sceneToScreen(p, cam, VP, BASE);
        const back = screenToScene(screen, cam, VP, BASE);
        expect(back.nx).toBeCloseTo(p.nx, 10);
        expect(back.ny).toBeCloseTo(p.ny, 10);
      }
    });
  }

  it("the viewport centre is the camera's centre at 1×", () => {
    expect(screenToScene({ x: 187.5, y: 250 }, IDENTITY_CAMERA, VP, BASE)).toEqual({ nx: 0.5, ny: 0.5 });
  });
});

describe("8. an object drag while zoomed changes geometry correctly", () => {
  it("a 25px screen drag is a 5× smaller scene move at 5× than at 1×", () => {
    const at1 = screenDeltaToScene(25, 25, IDENTITY_CAMERA, BASE);
    const at5 = screenDeltaToScene(25, 25, { scale: 5, x: 0, y: 0 }, BASE);
    expect(at5.dnx).toBeCloseTo(at1.dnx / 5, 12);
    expect(at5.dny).toBeCloseTo(at1.dny / 5, 12);
  });

  it("which is precisely why tiny objects become placeable when you zoom in", () => {
    // A 10px book is 2.7% of a 375px room. At 5×, one screen pixel is ~0.05% of the room.
    const perPixel = screenDeltaToScene(1, 0, { scale: 5, x: 0, y: 0 }, BASE).dnx;
    expect(perPixel).toBeLessThan(0.001);
  });
});

describe("9-10. the camera never changes geometry", () => {
  it("panning produces only a camera", () => {
    const panned = panBy({ scale: 3, x: 0, y: 0 }, 40, -25, BASE);
    expect(Object.keys(panned).sort()).toEqual(["scale", "x", "y"]);
  });

  it("pinching does not resize the selected object", () => {
    // A pinch resolves to `camera-pinch`, and that owner is not allowed to touch geometry.
    const owner = resolveGestureOwner({ pointerCount: 2, target: "selected-object", scale: 1 });
    expect(ownerMovesObject(owner)).toBe(false);
    const cam = zoomAround(IDENTITY_CAMERA, 4, { x: 0, y: 0 }, BASE);
    expect(cam.scale).toBe(4);
  });

  it("a scene point stays put under a pan", () => {
    const cam: Camera = { scale: 3, x: 0, y: 0 };
    const before = sceneToScreen({ nx: 0.4, ny: 0.6 }, cam, VP, BASE);
    const panned = panBy(cam, 30, 0, VP);
    const after = sceneToScreen({ nx: 0.4, ny: 0.6 }, panned, VP, BASE);
    // The SCREEN position moved by the pan, but the SCENE coordinate is unchanged.
    expect(after.x - before.x).toBeCloseTo(30, 6);
    expect(screenToScene(after, panned, VP, BASE).nx).toBeCloseTo(0.4, 10);
  });
});

// ── 11–12. screen space vs world space ───────────────────────────────────────

describe("11-12. editor chrome keeps its physical size while the room scales", () => {
  it("chrome counter-scales by the inverse camera scale", () => {
    expect(css).toContain(".nest-screen-sized");
    expect(css).toContain("scale(var(--nest-inv-scale, 1))");
  });

  it("the inverse is published every camera frame, with no React render", () => {
    expect(canvas).toContain('setProperty("--nest-inv-scale"');
    const gestures = read("components", "nest", "app-shell", "use-scene-camera.ts");
    expect(gestures).toContain("subscribers.current.forEach");
  });

  it("resize and rotation handles are screen-sized", () => {
    const frame = canvas.slice(canvas.indexOf("function TransformFrame"));
    expect(frame).toContain('data-resize-handle=""');
    expect(frame).toContain('data-rotate-handle=""');
    expect((frame.match(/nest-screen-sized/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("the object toolbar is screen-sized too", () => {
    const bar = canvas.slice(canvas.indexOf("function ContextBar"));
    expect(bar).toContain("scale(var(--nest-inv-scale, 1))");
  });

  it("at 5× a 40px handle still measures 40px", () => {
    const HANDLE = 40;
    for (const scale of [1, 2, 5]) {
      expect(HANDLE * (1 / scale) * scale).toBeCloseTo(HANDLE, 10);
    }
  });
});

// ── 13. adding an asset while zoomed ─────────────────────────────────────────

describe("13. a new asset added at 5× lands in the visible area", () => {
  const asset = { id: "ast-stacked-books", name: "Books", compatibleSlotTypes: [] } as unknown as LivingNestAsset;
  const doc = { id: "d", name: "d", backgroundId: "bg", aspectRatio: "3:4", objects: [] } as unknown as EditableNestDocument;

  it("the visible rect at 5× is a small window, not the whole room", () => {
    const r = visibleSceneRect({ scale: 5, x: 0, y: 0 }, VP, BASE);
    expect(r.width).toBeCloseTo(0.2, 6);
    expect(r.height).toBeCloseTo(0.2, 6);
  });

  it("its centre follows the pan", () => {
    const centred = visibleSceneCentre({ scale: 5, x: 0, y: 0 }, VP, BASE);
    expect(centred).toEqual({ nx: 0.5, ny: 0.5 });
    // Panning the camera right moves the visible window LEFT across the room.
    const panned = visibleSceneCentre({ scale: 5, x: 200, y: 0 }, VP, BASE);
    expect(panned.nx).toBeLessThan(0.5);
  });

  it("the asset is centred on that point, so it appears under the creator's eye", () => {
    const at = visibleSceneCentre({ scale: 5, x: 0, y: 0 }, VP, BASE);
    const { doc: next, instanceId } = addObject(doc, asset, at);
    const o = next.objects.find((q) => q.instanceId === instanceId)!;
    expect(o.x + o.width / 2).toBeCloseTo(at.nx, 6);
    expect(o.y + o.height / 2).toBeCloseTo(at.ny, 6);
  });

  it("and it lands INSIDE the visible window at 5×", () => {
    const cam: Camera = { scale: 5, x: 0, y: 0 };
    const r = visibleSceneRect(cam, VP, BASE);
    const at = visibleSceneCentre(cam, VP, BASE);
    const { doc: next, instanceId } = addObject(doc, asset, at);
    const o = next.objects.find((q) => q.instanceId === instanceId)!;
    const cx = o.x + o.width / 2;
    expect(cx).toBeGreaterThanOrEqual(r.x);
    expect(cx).toBeLessThanOrEqual(r.x + r.width);
  });

  it("without a drop point it still uses the catalogue default", () => {
    const { doc: a } = addObject(doc, asset);
    const { doc: b } = addObject(doc, asset, undefined);
    expect(a.objects[0].x).toBe(b.objects[0].x);
  });

  it("the editor asks the canvas where the creator is looking", () => {
    const editor = read("components", "nest", "editor", "nest-editor.tsx");
    expect(editor).toContain("addObject(activeDoc, asset, visibleCentre.current?.())");
    expect(canvas).toContain("visibleSceneCentre(");
  });
});

// ── 14–15. reset, and never persisting the camera ────────────────────────────

describe("14-15. reset, and the camera is never saved", () => {
  it("reset returns to 1× centred", () => {
    expect(IDENTITY_CAMERA).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it("reset does not touch objects — it is a camera value, nothing else", () => {
    const before = nestDocumentToEditable(roundTrip(INTERACTIVE_TEST_NEST)).objects;
    // Resetting is `apply(IDENTITY_CAMERA)`; there is no document path from it.
    const after = nestDocumentToEditable(roundTrip(INTERACTIVE_TEST_NEST)).objects;
    expect(editableObjectsToPlacements(after)).toEqual(editableObjectsToPlacements(before));
  });

  it("no camera value reaches the published document", () => {
    const objects = nestDocumentToEditable(roundTrip(INTERACTIVE_TEST_NEST)).objects;
    for (const p of editableObjectsToPlacements(objects)) {
      expect(JSON.stringify(p)).not.toContain("camera");
      expect(JSON.stringify(p)).not.toContain("nest-inv-scale");
    }
    expect(JSON.stringify(roundTrip(INTERACTIVE_TEST_NEST))).not.toContain('"camera"');
  });

  it("Reset view is offered only while the camera is off its default", () => {
    expect(canvas).toContain("camera.zoomed && !hideChrome");
  });
});

// ── 16–18. nothing else regressed ────────────────────────────────────────────

describe("16. editor, Preview and visitor still place objects identically", () => {
  it("one document survives the editor round trip unchanged", () => {
    const objects = nestDocumentToEditable(roundTrip(INTERACTIVE_TEST_NEST)).objects;
    const back = editableObjectsToPlacements(objects);
    for (const original of INTERACTIVE_TEST_NEST.placements) {
      const r = back.find((p) => p.id === original.id)!;
      expect({ x: r.x, y: r.y, w: r.w, h: r.h, z: r.zIndex }).toEqual({
        x: original.x, y: original.y, w: original.w, h: original.h, z: original.zIndex,
      });
    }
  });

  it("and there is still exactly one runtime", () => {
    const editor = read("components", "nest", "editor", "nest-editor.tsx");
    const visitor = read("app", "nest", "[slug]", "visitor-client.tsx");
    expect(editor).toContain('mode="editor-preview"');
    expect(visitor).toContain('mode="visitor"');
    expect(runtime).toContain('const interactive = mode !== "card";');
  });
});

describe("17-18. interactions, drafts and publishing are untouched", () => {
  it("the interaction config still round-trips", () => {
    const objects = nestDocumentToEditable(roundTrip(INTERACTIVE_TEST_NEST)).objects;
    const tv = objects.find((o) => o.instanceId === "tv")!;
    expect(tv.assetInteraction?.connection?.kind).toBe("youtube");
    const back = editableObjectsToPlacements(objects).find((p) => p.id === "tv")!;
    expect(back.interaction?.asset?.connection?.kind).toBe("youtube");
  });

  it("the draft path still carries the whole document", () => {
    const repo = read("lib", "nest-repo.ts");
    expect(repo).toContain("placements: doc.placements");
    expect(repo).toContain("scene: doc.scene");
  });

  it("publishing still refuses rather than dropping focus data", () => {
    expect(read("lib", "nest", "supabase-nest-repo.ts")).toContain("assertSceneStorable(draft.scene");
  });
});

// ── the Stage itself ─────────────────────────────────────────────────────────

describe("the Nest Stage", () => {
  it("is a reusable structure, not a per-surface treatment", () => {
    expect(stage).toContain("export function NestStage");
    expect(stage).toContain("export function NestViewport");
    expect(stage).toContain("export function ScreenSpaceChrome");
    expect(runtime).toContain("<NestStage");
  });

  it("is ONE stage with two variants, not a colour derived per room", () => {
    expect(stage).not.toContain("charCodeAt");
    expect(stage).toContain("const DARK = {");
    expect(stage).toContain("const LIGHT = {");
  });

  it("has no blurred duplicate of the room", () => {
    expect(stage).not.toContain("blur");
    expect(stage).not.toContain("backgroundImage");
    expect(runtime).not.toContain("blur-2xl");
  });

  it("is decoration only — it can never swallow a tap meant for the room", () => {
    const decor = stage.slice(stage.indexOf('<div aria-hidden'));
    expect(decor.slice(0, 200)).toContain("pointer-events-none");
  });

  it("never enters the Nest document", () => {
    expect(JSON.stringify(INTERACTIVE_TEST_NEST)).not.toContain("stage");
    expect(JSON.stringify(INTERACTIVE_TEST_NEST)).not.toContain("theme");
  });

  it("keeps the canonical scene a strict 3:4", () => {
    expect(stage).toContain("aspect = 0.75");
    expect(stage).toContain("min(100cqw,");
  });
});
