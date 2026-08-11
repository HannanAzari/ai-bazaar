import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  beginGesture,
  objectTransformFromPinch,
  ownerMovesCamera,
  ownerMovesObject,
  pinchSample,
  transformedCentre,
  upgradeGesture,
} from "@/lib/nest-gesture";

// ── M26 Stabilisation Sprint 2 — the mobile gesture engine ───────────────────
//
// Two structural defects, both found by driving the editor rather than by reading it:
//
//  • TWO POINTER PIPELINES — the canvas ran React pointer handlers on the scene while the
//    camera ran native listeners on the viewport ancestor. Both saw every event and each
//    decided independently, so `object-transform` was unreachable: the camera pinched on
//    two fingers no matter what the arbiter returned.
//
//  • DEAD HANDLES — the screen-space selection frame is a SIBLING of the stage, so
//    `pointermove` from a resize or rotate handle never reached the scene's React handlers.
//    The corner handles had been inert since the frame moved into screen space.
//
//  • SELECTION CYCLED ON DRAG — overlap cycling ran at pointer-DOWN with a 1.6s window, so
//    tapping an object and then pressing it to drag grabbed the object underneath instead.

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const canvas = read("components", "nest", "editor", "editor-canvas.tsx");
const camera = read("components", "nest", "app-shell", "use-scene-camera.ts");
const selection = read("components", "nest", "editor", "screen-space-selection.tsx");

// ── §2 — one owner per pointer session ───────────────────────────────────────

describe("§2 — a gesture family never changes mid-session", () => {
  const objectDrag = beginGesture({ pointerCount: 1, target: "selected-object", scale: 1, objectId: "a" }, 1);
  const cameraPan = beginGesture({ pointerCount: 1, target: "empty", scale: 4 }, 1);

  it("OBJECT never becomes CAMERA, wherever the second finger lands", () => {
    for (const inRegion of [true, false]) {
      expect(ownerMovesObject(upgradeGesture(objectDrag, 2, inRegion).owner)).toBe(true);
      expect(ownerMovesCamera(upgradeGesture(objectDrag, 2, inRegion).owner)).toBe(false);
    }
  });

  it("CAMERA never becomes OBJECT, even directly on the selected object", () => {
    expect(upgradeGesture(cameraPan, 2, true).owner).toBe("camera-pinch");
  });

  it("a single pointer changes nothing at all", () => {
    expect(upgradeGesture(objectDrag, 1, true)).toEqual(objectDrag);
  });

  it("the allowed subtype transitions, and only those", () => {
    expect(upgradeGesture(objectDrag, 2).owner).toBe("object-transform"); // drag → transform
    expect(upgradeGesture(cameraPan, 2).owner).toBe("camera-pinch"); // pan → pinch
  });
});

// ── §4 — the transform is a pure function of its own start ───────────────────

describe("§4 — the object stays anchored under the fingers", () => {
  it("a pure translation carries the centre with the midpoint", () => {
    const start = pinchSample({ x: 0, y: 0 }, { x: 100, y: 0 }); // midpoint (50,0)
    const now = pinchSample({ x: 30, y: 40 }, { x: 130, y: 40 }); // midpoint (80,40)
    const c = transformedCentre({ x: 50, y: 0 }, start, now);
    expect(c.x).toBeCloseTo(80, 6);
    expect(c.y).toBeCloseTo(40, 6);
  });

  it("spreading pushes the centre away from the midpoint by the same ratio", () => {
    const start = pinchSample({ x: 0, y: 0 }, { x: 100, y: 0 }); // midpoint (50,0)
    const now = pinchSample({ x: -50, y: 0 }, { x: 150, y: 0 }); // ×2, same midpoint
    // A centre 10px right of the midpoint ends up 20px right of it.
    expect(transformedCentre({ x: 60, y: 0 }, start, now).x).toBeCloseTo(70, 6);
  });

  it("twisting swings the centre around the midpoint", () => {
    const start = pinchSample({ x: 0, y: 0 }, { x: 100, y: 0 });
    const now = pinchSample({ x: 50, y: -50 }, { x: 50, y: 50 }); // 90°, same distance
    const c = transformedCentre({ x: 60, y: 0 }, start, now); // 10px right of midpoint
    expect(c.x).toBeCloseTo(50, 6); // → 10px BELOW it
    expect(c.y).toBeCloseTo(10, 6);
  });

  it("a centre exactly on the midpoint never moves, whatever the fingers do", () => {
    const start = pinchSample({ x: 0, y: 0 }, { x: 100, y: 0 });
    const now = pinchSample({ x: -80, y: -80 }, { x: 180, y: 80 });
    const c = transformedCentre(start.midpoint, start, now);
    expect(c.x).toBeCloseTo(now.midpoint.x, 6);
    expect(c.y).toBeCloseTo(now.midpoint.y, 6);
  });

  it("replaying the same pointers gives the same answer — it cannot drift", () => {
    // The anti-drift property: every frame is computed from the gesture START, never
    // accumulated, so a dropped frame or a slow paint changes nothing.
    const start = pinchSample({ x: 10, y: 10 }, { x: 90, y: 30 });
    const now = pinchSample({ x: 40, y: 70 }, { x: 200, y: 10 });
    const once = transformedCentre({ x: 55, y: 25 }, start, now);
    // …and the same, whether or not intermediate frames were computed in between.
    transformedCentre({ x: 55, y: 25 }, start, pinchSample({ x: 20, y: 30 }, { x: 120, y: 20 }));
    expect(transformedCentre({ x: 55, y: 25 }, start, now)).toEqual(once);
  });

  it("a degenerate start cannot produce NaN or Infinity", () => {
    const degenerate = pinchSample({ x: 5, y: 5 }, { x: 6, y: 5 });
    const c = transformedCentre({ x: 0, y: 0 }, degenerate, pinchSample({ x: 0, y: 0 }, { x: 500, y: 0 }));
    expect(Number.isFinite(c.x)).toBe(true);
    expect(Number.isFinite(c.y)).toBe(true);
    expect(objectTransformFromPinch(degenerate, degenerate).scale).toBe(1);
  });
});

// ── §2 — there is exactly ONE pointer pipeline ───────────────────────────────

describe("§2 — the canvas no longer runs a second pointer pipeline", () => {
  it("the scene element has no pointer handlers of its own", () => {
    const scene = canvas.slice(canvas.indexOf("editor-scene absolute"), canvas.indexOf("props.backgroundNode"));
    for (const gone of ["onPointerMove=", "onPointerUp=", "onPointerCancel=", "onPointerDown="]) {
      expect(scene).not.toContain(gone);
    }
  });

  it("objects are markers, not event sources — the arbiter reads the target", () => {
    const list = canvas.slice(canvas.indexOf("{objects.map((o)"), canvas.indexOf("Read-only foreground overlay"));
    expect(list).toContain("data-editor-object={o.instanceId}");
    expect(list).not.toContain("onPointerDown");
  });

  it("the camera is handed the arbiter and is the only listener", () => {
    expect(canvas).toContain("const camera = useSceneCamera({\n    arbiter,");
    expect(camera).toContain("arbiterRef.current?.down(e, pts)");
    expect(camera).toContain("arbiterRef.current?.move(");
    expect(camera).toContain("arbiterRef.current?.up(");
  });

  it("the host owning the session stands the camera down completely", () => {
    // Not "the camera also runs but its effect is small" — it returns before any camera work.
    const move = camera.slice(camera.indexOf("const onPointerMove"), camera.indexOf("const endGesture"));
    expect(move.indexOf("if (hostOwns)")).toBeLessThan(move.indexOf("pinchStart"));
    expect(move).toContain("arbiterRef.current?.move(Array.from(points.values()));");
  });

  it("ownership is latched at the FIRST pointer, with ONE narrow release", () => {
    expect(camera).toContain("if (points.size === 1) {\n        hostOwns = claimed;");
    // M27B-3A1 — a host may HAND BACK the session when a second finger lands, and only
    // then. This exists because a two-finger pinch beginning inside a small media aperture
    // was being swallowed: media claimed at the first finger, so the camera never took a
    // pinch baseline and the room would not zoom.
    expect(camera).toContain("if (hostOwns && !claimed) hostOwns = false;");
    // The camera still cannot STEAL a gesture: it only proceeds once the host has declined.
    expect(camera).toContain("if (!hostOwns) {");
  });

  it("a host that still wants the gesture keeps it — object transform is untouched", () => {
    // The editor's arbiter returns true for its own object on the second pointer, so
    // `hostOwns` stays true and drag → two-finger transform behaves exactly as before.
    const objectDrag = beginGesture({ pointerCount: 1, target: "selected-object", scale: 1, objectId: "a" }, 1);
    expect(ownerMovesObject(upgradeGesture(objectDrag, 2, false).owner)).toBe(true);
    expect(canvas).toContain("armTransform(pts);");
  });
});

// ── §9 — the handles are alive again ─────────────────────────────────────────

describe("§9 — resize and rotate handles use the same pipeline", () => {
  it("they carry no pointer handler of their own", () => {
    expect(selection).not.toContain("onHandleDown");
    expect(selection).toContain('data-resize-handle=""');
    expect(selection).toContain('data-rotate-handle=""');
  });

  it("the corner a handle represents is data, not a closure", () => {
    expect(selection).toContain("data-dir-x={dirX}");
    expect(canvas).toContain("dataset.dirX");
  });

  it("the chrome marker sits on the TOOLBAR, not the whole frame", () => {
    // Sprint 1 marked the entire frame as chrome to fix Mirror. That also told the camera —
    // now the only listener — to ignore the handles, which is what left them inert.
    const frame = selection.slice(selection.indexOf("data-screen-selection"), selection.indexOf("data-resize-handle"));
    expect(frame).not.toContain('data-editor-chrome=""');
    const toolbar = selection.slice(selection.indexOf("data-object-toolbar"));
    expect(toolbar).toContain('data-editor-chrome=""');
  });

  it("Mirror is still exempt — the Sprint 1 fix is intact", () => {
    expect(camera).toContain('if (e.target instanceof Element && e.target.closest("[data-editor-chrome]")) return;');
  });
});

// ── §1/§7 — selection versus dragging ────────────────────────────────────────

describe("§7 — a drag never advances the overlap cycle", () => {
  it("the gesture arms on the object that is ALREADY selected", () => {
    expect(canvas).toContain("const keep = selectedId && candidates.some((c) => c.objectId === selectedId) ? selectedId : null;");
    // M26-P widened this into a block so a re-tap can also be recorded; the invariant is
    // unchanged — a gesture that begins on the current selection drags THAT object.
    expect(canvas).toContain("reselected.current = keep;");
    expect(canvas).toContain("return keep;");
  });

  it("the cycled candidate is only applied when the gesture was a pure tap", () => {
    expect(canvas).toContain("const wasTap = tapped && !didMove.current;");
    expect(canvas).toContain("if (wasTap && pc) {");
    expect(canvas).toContain("onSelect(pc.id);");
  });

  it("a tap must travel before it becomes a drag", () => {
    expect(canvas).toContain("const DRAG_SLOP_PX = 5;");
    expect(canvas).toContain("if (d && Math.hypot(pts[0].x - d.x, pts[0].y - d.y) < DRAG_SLOP_PX) return;");
  });
});

// ── §14 — the diagnostic cannot ship ─────────────────────────────────────────

describe("§14 — the gesture diagnostic is development-only", () => {
  it("it is gated on NODE_ENV so the bundler drops it", () => {
    expect(canvas).toContain('const isDev = process.env.NODE_ENV !== "production";');
    expect(canvas).toContain("if (!isDev) return null;");
  });

  it("it reports every field the brief asks for", () => {
    const dbg = canvas.slice(canvas.indexOf("function GestureDebug"));
    for (const field of ["owner", "subtype", "pointers", "scale", "selectedId"]) {
      expect(dbg).toContain(field);
    }
    expect(dbg).toContain('"OBJECT"');
    expect(dbg).toContain('"CAMERA"');
    expect(dbg).toContain('"NONE"');
  });

  it("the scale comes from the per-frame subscription, not a stale render", () => {
    // The camera deliberately does not re-render React during a gesture, so a scale read
    // from render state lies about it for the whole gesture.
    const dbg = canvas.slice(canvas.indexOf("function GestureDebug"));
    expect(dbg).toContain("return subscribe((cam) => {");
  });
});

// ── §0 — the pre-flight found a persistence hole ─────────────────────────────

describe("§0 — Save draft now has a matching LOAD", () => {
  const editor = read("components", "nest", "editor", "nest-editor.tsx");

  it("a scratch session restores its draft on mount", () => {
    // `loadDraft` existed but was reachable only from a manual Advanced-menu item, so the
    // primary lifecycle Sprint 1 introduced discarded the creator's work on every reopen.
    expect(editor).toContain("const restored = useRef(false);");
    expect(editor).toContain("if (restored.current || documentId) return;");
    expect(editor).toContain("const r = loadDraft(seed?.id ?? freshDocument().id);");
  });

  it("the restored draft — not the seed — becomes the persisted baseline", () => {
    // Both effects run in the same commit and the baseline one closes over the SEED, so
    // leaving it to that effect made discard roll back to the starter Nest.
    expect(editor).toContain("persistedRef.current = dirtyKey(r.doc);");
    expect(editor).toContain("persistedDocRef.current = r.doc;");
  });

  it("discard rolls the draft back instead of deleting saved work", () => {
    // A debounced autosave writes every edit to the draft ~900ms later, so by the time the
    // creator reaches "Close without saving" the change is already on disk.
    expect(editor).toContain("else if (persistedDocRef.current) saveDraft(persistedDocRef.current);");
  });

  it("camera state is still never persisted", () => {
    const key = editor.slice(editor.indexOf("function dirtyKey"), editor.indexOf("export function NestEditor"));
    for (const notData of ["camera", "scale", "zoom"]) {
      expect(key).not.toContain(notData);
    }
  });
});
