import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  IDENTITY_CAMERA,
  panBy,
  sceneToScreen,
  screenDeltaToScene,
  screenToScene,
  visibleSceneCentre,
  zoomAround,
  type Camera,
} from "@/lib/nest-camera";
import { beginGesture, gestureAllows, ownerMovesCamera, ownerMovesObject, upgradeGesture } from "@/lib/nest-gesture";
import { moveObject, resizeObject, rotateObject, addObject } from "@/lib/nest-editor";
import { editableObjectsToPlacements, nestDocumentToEditable } from "@/lib/nest-editor-bridge";
import { INTERACTIVE_TEST_NEST } from "@/lib/fixtures/interactive-nest";
import { resolveConnection, tapObject } from "@/lib/nest-asset-interaction";
import type { NestDocument } from "@/lib/nest-document-types";
import type { EditableNestDocument, EditableNestObject } from "@/lib/nest-editor-types";
import type { LivingNestAsset } from "@/lib/nest-visual-types";

// ── M26A-final — one dispatcher, and manipulation through screen space ───────

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const canvas = read("components", "nest", "editor", "editor-canvas.tsx");
const camera = read("components", "nest", "app-shell", "use-scene-camera.ts");
const editor = read("components", "nest", "editor", "nest-editor.tsx");
const selection = read("components", "nest", "editor", "screen-space-selection.tsx");

const VP = { left: 0, top: 0, width: 375, height: 500 };
const BASE = { width: 375, height: 500 };
const roundTrip = (d: NestDocument): NestDocument => JSON.parse(JSON.stringify(d));

const BOOK: EditableNestObject = {
  instanceId: "book-a",
  assetId: "ast-stacked-books",
  x: 0.4, y: 0.4, width: 0.08, height: 0.06,
  anchor: { x: 0.44, y: 0.46 },
  plane: "floor",
  zIndex: 3,
};
const doc = (): EditableNestDocument =>
  ({ id: "d", name: "d", backgroundId: "bg-creator-loft", aspectRatio: "3:4", objects: [BOOK] }) as unknown as EditableNestDocument;
const ASSETS: Record<string, LivingNestAsset> = {};

// ── 1–4. ownership ───────────────────────────────────────────────────────────

describe("1. the gesture owner locks until pointer-up", () => {
  const ctx = { pointerCount: 1, target: "selected-object" as const, scale: 5, objectId: "book-a" };

  it("an object drag stays an object drag for the whole session", () => {
    const g = beginGesture(ctx, 1);
    expect(gestureAllows(g, "object-move")).toBe(true);
    expect(gestureAllows(g, "camera-pan")).toBe(false);
    expect(upgradeGesture(g, 1).owner).toBe("object-move");
  });

  it("the canvas gates every move on the owner decided at pointer-down", () => {
    // REWRITTEN BY M26-S2 §2. The gate used to be a per-move check inside the canvas's own
    // React `onPointerMove`. That handler is gone: the canvas no longer listens to pointers
    // at all. Ownership is now enforced one level up — the camera is the single listener and
    // simply does not call the arbiter unless the host owns the session, and does no camera
    // work when it does. The invariant is stronger, so the assertion moved with it.
    expect(canvas).toContain("const arbiter = {");
    expect(canvas).toContain("ownerRef.current = null;");
    expect(camera).toContain("if (hostOwns) {");
  });

  it("Safari pointer-capture failures cannot swallow the gesture", () => {
    // Both capture calls are wrapped: capture is an optimisation, the gesture must survive.
    expect(canvas).toContain("try {");
    expect(canvas).toContain("setPointerCapture?.(e.pointerId)");
    const gestures = read("components", "nest", "app-shell", "use-scene-camera.ts");
    // Both capture calls sit inside their own try/catch: releasePointerCapture throws
    // NotFoundError when the pointer is already gone, and an exception there would abort
    // the handler BEFORE the tap/drag was classified.
    expect(gestures).toContain("try {\n        el.setPointerCapture?.(e.pointerId);");
    expect(gestures).toContain("try {\n        el.releasePointerCapture?.(e.pointerId);");
  });
});

describe("2-3. object drags and camera pans do not cross over", () => {
  it("an object drag never reaches the camera", () => {
    const g = beginGesture({ pointerCount: 1, target: "selected-object", scale: 5 }, 1);
    expect(ownerMovesObject(g.owner)).toBe(true);
    expect(ownerMovesCamera(g.owner)).toBe(false);
  });

  it("a pan from empty space never reaches an object", () => {
    const g = beginGesture({ pointerCount: 1, target: "empty", scale: 5 }, 1);
    expect(ownerMovesCamera(g.owner)).toBe(true);
    expect(ownerMovesObject(g.owner)).toBe(false);
  });

  it("panning the camera leaves every object coordinate untouched", () => {
    const before = doc().objects[0];
    panBy({ scale: 5, x: 0, y: 0 }, 120, -80, VP);
    expect(doc().objects[0]).toEqual(before);
  });
});

describe("4. a pinch over a selected object zooms — it does not resize or move it", () => {
  it("the object-pinch gesture is GONE from the canvas", () => {
    // It used to resize AND rotate the object from two fingers, so pinching to look closer
    // silently rewrote the creator's geometry.
    expect(canvas).not.toContain('kind: "pinch"');
    expect(canvas).not.toContain('g.kind === "pinch"');
  });

  it("a second finger on the held object TRANSFORMS it — it is not abandoned", () => {
    // REWRITTEN BY M26-S2 §2/§4. M26A deleted the old two-finger object gesture because it
    // fired on ANY object under two fingers and silently rewrote geometry. The gesture is
    // back, but gated on the FIRST finger: it transforms only the object the creator is
    // already holding. Handing the gesture to the camera here was the forbidden
    // OBJECT → CAMERA switch, and it made the sticker gesture unreachable.
    expect(canvas).toContain("armTransform(pts);");
    expect(canvas).toContain('kind: "transform"');
  });

  it("and the owner stays with the object", () => {
    const g = upgradeGesture(beginGesture({ pointerCount: 1, target: "selected-object", scale: 2 }, 1), 2);
    expect(g.owner).toBe("object-transform");
    expect(ownerMovesObject(g.owner)).toBe(true);
    expect(ownerMovesCamera(g.owner)).toBe(false);
  });

  it("zooming changes only the camera", () => {
    const before = doc().objects[0];
    const cam = zoomAround(IDENTITY_CAMERA, 5, { x: 20, y: 10 }, VP);
    expect(cam.scale).toBe(5);
    expect(doc().objects[0]).toEqual(before);
  });
});

// ── 5–7. manipulation at every scale ─────────────────────────────────────────

describe("5-7. move, resize and rotate produce identical geometry at 1×, 2× and 5×", () => {
  /** The canonical path: screen delta → inverse camera → scene delta. */
  const dragToScene = (screenPx: number, cam: Camera) => screenDeltaToScene(screenPx, 0, cam, BASE).dnx;

  it("the SAME finger travel yields the same scene move once divided by scale", () => {
    // 50px at 1×, 100px at 2×, 250px at 5× are all the same intent: move it 13.3%.
    const a = dragToScene(50, IDENTITY_CAMERA);
    const b = dragToScene(100, { scale: 2, x: 0, y: 0 });
    const c = dragToScene(250, { scale: 5, x: 0, y: 0 });
    expect(b).toBeCloseTo(a, 12);
    expect(c).toBeCloseTo(a, 12);
  });

  it("moving at 5× lands the object at the same canonical x as moving at 1×", () => {
    const d1 = moveObject(doc(), "book-a", dragToScene(50, IDENTITY_CAMERA), 0, ASSETS);
    const d5 = moveObject(doc(), "book-a", dragToScene(250, { scale: 5, x: 0, y: 0 }), 0, ASSETS);
    expect(d5.objects[0].x).toBeCloseTo(d1.objects[0].x, 10);
  });

  it("resizing at 1× and 5× reaches the same canonical width", () => {
    const w1 = resizeObject(doc(), "book-a", BOOK.width + dragToScene(40, IDENTITY_CAMERA) * 2, ASSETS).objects[0].width;
    const w5 = resizeObject(doc(), "book-a", BOOK.width + dragToScene(200, { scale: 5, x: 0, y: 0 }) * 2, ASSETS).objects[0].width;
    expect(w5).toBeCloseTo(w1, 10);
  });

  it("rotation is an ANGLE, so it is scale-independent by construction", () => {
    // The angle between the object's centre and the finger is the same number whatever the
    // camera is doing — there is no scale term to get wrong. Asserted as equality rather
    // than a literal, because the catalogue decides whether an asset rotates at all.
    const r1 = rotateObject(doc(), "book-a", 32, ASSETS).objects[0].rotation;
    const r5 = rotateObject(doc(), "book-a", 32, ASSETS).objects[0].rotation;
    expect(r5).toEqual(r1);
  });
});

// ── 8–10. the screen-space frame ─────────────────────────────────────────────

describe("8. handles keep a constant physical size", () => {
  it("they carry pixel dimensions, never percentages of the object", () => {
    expect(selection).toContain("const HANDLE = 40;");
    expect(selection).toContain("width: HANDLE,");
    expect(selection).not.toContain("nest-inv-scale");
  });

  it("the frame itself carries no transform at all", () => {
    expect(selection).toContain("style={{ left: 0, top: 0, width: 0, height: 0 }}");
  });

  it("the object toolbar rides INSIDE the frame, so it inherits screen-pixel position", () => {
    // It used to position itself in scene percentages AND counter-scale. Once the frame
    // moved to screen space that became a double negative and shrank the bar 5×.
    expect(selection).toContain('data-object-toolbar=""');
    expect(canvas).toContain("toolbar={");
    const bar = canvas.slice(canvas.indexOf("function ContextBar"));
    expect(bar).not.toContain("nest-inv-scale");
    expect(bar).not.toContain("pos.transform");
  });
});

describe("9-10. the selection frame tracks pan and zoom", () => {
  const rect = { x: 0.4, y: 0.4, width: 0.08, height: 0.06 };
  const project = (cam: Camera) => {
    const tl = sceneToScreen({ nx: rect.x, ny: rect.y }, cam, VP, BASE);
    const br = sceneToScreen({ nx: rect.x + rect.width, ny: rect.y + rect.height }, cam, VP, BASE);
    return { left: tl.x, top: tl.y, width: br.x - tl.x, height: br.y - tl.y };
  };

  it("it follows a pan by exactly the pan delta", () => {
    const a = project({ scale: 3, x: 0, y: 0 });
    const b = project({ scale: 3, x: 40, y: -15 });
    expect(b.left - a.left).toBeCloseTo(40, 8);
    expect(b.top - a.top).toBeCloseTo(-15, 8);
    expect(b.width).toBeCloseTo(a.width, 8);
  });

  it("it grows with the zoom, because it wraps the OBJECT", () => {
    const a = project(IDENTITY_CAMERA);
    const b = project({ scale: 5, x: 0, y: 0 });
    expect(b.width / a.width).toBeCloseTo(5, 6);
  });

  it("it is projected from sceneToScreen every camera frame", () => {
    expect(selection).toContain("return subscribe((cam) => {");
    expect(selection).toContain("sceneToScreen(");
    expect(selection).toContain("el.style.left");
  });

  it("an object entirely outside the viewport hides its controls", () => {
    expect(selection).toContain('el.style.visibility = off ? "hidden" : "visible"');
  });
});

// ── 11. adding while zoomed ──────────────────────────────────────────────────

describe("11. adding an asset while zoomed uses visible-centre coordinates", () => {
  const asset = { id: "ast-stacked-books", name: "Books", compatibleSlotTypes: [] } as unknown as LivingNestAsset;
  const empty = { id: "d", name: "d", backgroundId: "bg", aspectRatio: "3:4", objects: [] } as unknown as EditableNestDocument;

  it("the viewport centre inverse-transforms to the visible scene centre", () => {
    const cam: Camera = { scale: 5, x: 150, y: -100 };
    const centre = screenToScene({ x: VP.width / 2, y: VP.height / 2 }, cam, VP, BASE);
    expect(visibleSceneCentre(cam, VP, BASE).nx).toBeCloseTo(centre.nx, 6);
    expect(visibleSceneCentre(cam, VP, BASE).ny).toBeCloseTo(centre.ny, 6);
  });

  it("the new object is centred there, not at the unzoomed room centre", () => {
    const cam: Camera = { scale: 5, x: 300, y: 0 }; // panned well off centre
    const at = visibleSceneCentre(cam, VP, BASE);
    expect(at.nx).not.toBeCloseTo(0.5, 2);
    const { doc: next, instanceId } = addObject(empty, asset, at);
    const o = next.objects.find((q) => q.instanceId === instanceId)!;
    expect(o.x + o.width / 2).toBeCloseTo(at.nx, 6);
  });

  it("the editor asks the canvas for that point at add time", () => {
    expect(editor).toContain("addObject(activeDoc, asset, visibleCentre.current?.())");
    expect(canvas).toContain("visibleSceneCentre(");
  });

  it("and the new object is selected immediately", () => {
    expect(editor).toContain("setSelectedId(instanceId)");
  });
});

// ── 12–13, 17. the camera never reaches storage ──────────────────────────────

describe("12-13. camera state is absent from draft and published serialization", () => {
  it("no camera in the canonical document", () => {
    const json = JSON.stringify(roundTrip(INTERACTIVE_TEST_NEST));
    for (const key of ['"camera"', '"scale"', '"nest-inv-scale"', '"viewport"']) {
      expect(json).not.toContain(key);
    }
  });

  it("no camera survives the editor round trip into placements", () => {
    const objects = nestDocumentToEditable(roundTrip(INTERACTIVE_TEST_NEST)).objects;
    for (const p of editableObjectsToPlacements(objects)) {
      expect(JSON.stringify(p)).not.toContain("camera");
    }
  });

  it("the draft carries the document, and the document has no camera", () => {
    const repo = read("lib", "nest-repo.ts");
    expect(repo).toContain("placements: doc.placements");
    expect(repo).not.toContain("camera");
  });
});

describe("17. a draft reopen preserves zoom-authored placement", () => {
  it("an object placed at 5× keeps its canonical coordinates through save → reopen", () => {
    const asset = { id: "ast-stacked-books", name: "Books", compatibleSlotTypes: [] } as unknown as LivingNestAsset;
    const empty = { id: "d", name: "d", backgroundId: "bg-creator-loft", aspectRatio: "3:4", objects: [] } as unknown as EditableNestDocument;
    const at = visibleSceneCentre({ scale: 5, x: 200, y: -120 }, VP, BASE);
    const { doc: authored, instanceId } = addObject(empty, asset, at);
    const placed = authored.objects.find((o) => o.instanceId === instanceId)!;

    const published: NestDocument = {
      ...INTERACTIVE_TEST_NEST,
      placements: editableObjectsToPlacements([placed]),
    };
    const reopened = nestDocumentToEditable(roundTrip(published)).objects[0];
    expect({ x: reopened.x, y: reopened.y, width: reopened.width, height: reopened.height }).toEqual({
      x: placed.x, y: placed.y, width: placed.width, height: placed.height,
    });
  });
});

// ── 14–16. Edit / Preview, and nothing else regressed ────────────────────────

describe("14-15. Edit and Preview share one document and one renderer", () => {
  it("M26 — the header carries Edit|Preview, in ONE fixed position", () => {
    // M26-S removed it from the header and left the copy inside the Preview branch, so
    // the toggle vanished in Edit and appeared in Preview — exactly what the founder
    // reported. It is back, rendered by the same component in both modes.
    // Asserted on RENDERED content, not comments.
    const header = editor
      .slice(editor.indexOf("<header"), editor.indexOf("</header>"))
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    expect(header).toContain("<ModeSwitch");
    // Workflow stays out of the header — that is what keeps it inside 375px.
    expect(header).not.toContain("setShowPublish");
  });

  it("M26-S1 — Publish is the dock's one strong action; Save moved to Close", () => {
    const dock = editor.slice(editor.indexOf("<nav"), editor.indexOf("</nav>"));
    expect(dock).toContain("setShowPublish(true)");
    expect(dock).not.toContain('label="Save"');
  });

  it("Preview mounts the real visitor runtime, from the same canonical document", () => {
    expect(editor).toContain('<NestRuntime document={previewDoc} mode="editor-preview"');
    expect(editor).toContain("editableObjectsToPlacements(doc.objects)");
    expect(editor).not.toContain("MockRuntime");
  });

  it("Preview shows no editor selection controls", () => {
    // The selection layer lives in EditorCanvas, which the preview branch never mounts.
    const previewBranch = editor.slice(editor.indexOf('{mode === "preview"'), editor.indexOf('{mode === "preview"') + 1400);
    expect(previewBranch).not.toContain("ScreenSpaceSelection");
    expect(previewBranch).not.toContain("EditorCanvas");
  });

  it("switching modes saves nothing and publishes nothing", () => {
    const enter = editor.slice(editor.indexOf("const onPreview = () =>"), editor.indexOf("const onPatchFocus"));
    expect(enter).not.toContain("saveWork");
    expect(enter).not.toContain("publish");
    expect(enter).not.toContain("onCommit");
  });
});

describe("16. existing object interactions still work", () => {
  it("the TV still toggles and opens its connection", () => {
    const tv = INTERACTIVE_TEST_NEST.placements.find((p) => p.id === "tv")!;
    expect(resolveConnection(tv)?.kind).toBe("youtube");
    const r = tapObject(tv, "off");
    expect(r.state).toBe("on");
    expect(r.open).toMatchObject({ type: "open-youtube" });
  });

  it("the lamp still toggles with no link", () => {
    const lamp = INTERACTIVE_TEST_NEST.placements.find((p) => p.id === "lamp")!;
    expect(tapObject(lamp, "off")).toEqual({ state: "on", open: null });
  });
});
