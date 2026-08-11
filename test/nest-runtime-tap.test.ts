import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initialStateOf, isInteractiveObject, tapObject } from "@/lib/nest-asset-interaction";
import { isTap, TAP_MAX_MS, TAP_SLOP_PX } from "@/lib/nest-camera";
import { editableObjectsToPlacements } from "@/lib/nest-editor-bridge";
import { placementDisplayContent } from "@/lib/nest-object-display";
import type { EditableNestObject } from "@/lib/nest-editor-types";

// ── M27B-3A0 — the runtime tap contract ──────────────────────────────────────
//
// THIS SPRINT FOUND NO REGRESSION. The M27B-3A report claiming the runtime tap path was
// dead was WRONG, and both halves of it were measurement error:
//
//   • "double-tap zoom is dead" — the probe waited 600ms between the two taps. The camera's
//     double-tap window is 300ms, so those were two single taps and nothing should have
//     zoomed. Corrected timing zooms to scale(2) every time.
//
//   • "TV cannot turn on" — the probe asserted the thumbnail count INCREASED. A TV toggles
//     off→on→off, so the second tap correctly removes the thumbnail and the assertion
//     failed on working behaviour. Some runs also tapped a TV that had no content at all,
//     where showing nothing is right.
//
// These tests exist so the contract is pinned by something deterministic rather than by a
// hand-driven probe that can be mistimed. They pass on 3211a8c — there was nothing to fix —
// and they would fail on any future change that breaks tap classification or state
// stepping, which is the actual protection worth having.

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const runtime = read("components", "nest", "app-shell", "nest-runtime.tsx");
const camera = read("components", "nest", "app-shell", "use-scene-camera.ts");

const obj = (assetId: string, assetInteraction?: Record<string, unknown>): EditableNestObject =>
  ({ instanceId: "o1", assetId, x: 0.2, y: 0.2, width: 0.2, height: 0.2,
     anchor: { x: 0.3, y: 0.4 }, plane: "front_wall", zIndex: 3, assetInteraction } as unknown as EditableNestObject);

const YT = { kind: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" };
const tv = (contents = [YT]) => editableObjectsToPlacements([obj("ast-tv", { contents })])[0];

// ── One tap = exactly one step ───────────────────────────────────────────────

describe("a tap advances an object's state by exactly one step", () => {
  it("off → on → off, and never two steps at once", () => {
    const p = tv();
    const s1 = tapObject(p, initialStateOf(p)).state;
    expect(s1).toBe("on");
    expect(tapObject(p, s1).state).toBe("off");
  });

  it("the SCREEN follows that state — which is what a probe can observe", () => {
    // This is the exact observable the browser check counts: a thumbnail present or not.
    const p = tv();
    expect(placementDisplayContent(p, "off", "runtime")).toBeNull();
    expect(placementDisplayContent(p, "on", "runtime")?.src).toContain("i.ytimg.com");
  });

  it("so a toggle makes the thumbnail come and GO — an increase-only assertion is wrong", () => {
    // The mistake that produced the false regression report, pinned so it cannot recur.
    const p = tv();
    const seen = ["off", "on", "off"].map((st) => (placementDisplayContent(p, st, "runtime") ? 1 : 0));
    expect(seen).toEqual([0, 1, 0]);
  });

  it("a TV with NO content shows nothing when switched on — also not a fault", () => {
    const bare = editableObjectsToPlacements([obj("ast-tv")])[0];
    expect(placementDisplayContent(bare, "on", "runtime")).toBeNull();
    // …but it is still tappable, because its behaviour is its own, not its content's.
    expect(isInteractiveObject(bare)).toBe(true);
  });

  it("an object with content but no state machine is still interactive", () => {
    const frame = editableObjectsToPlacements([obj("ast-framed-photo", { contents: [{ kind: "image", url: "https://s.test/p.jpg" }] })])[0];
    expect(isInteractiveObject(frame)).toBe(true);
  });
});

// ── Tap classification ───────────────────────────────────────────────────────

describe("what the camera counts as a tap", () => {
  const at = (x: number, y: number, t: number) => ({ x, y, t });

  it("a still, brief press is a tap", () => {
    expect(isTap(at(100, 100, 0), at(100, 100, 80), 0)).toBe(true);
  });

  it("a long press is not", () => {
    expect(isTap(at(100, 100, 0), at(100, 100, TAP_MAX_MS + 50), 0)).toBe(false);
  });

  it("a press that travelled is not, even if it returns to where it started", () => {
    // `maxDistance` is why: the finger's furthest point decides, not its endpoint.
    expect(isTap(at(100, 100, 0), at(100, 100, 80), TAP_SLOP_PX + 5)).toBe(false);
  });

  it("the double-tap window is 300ms — the constant that invalidated the old probe", () => {
    // A probe that waits longer than this between taps is issuing two SINGLE taps, and
    // nothing zooming is the correct outcome.
    expect(camera).toContain("now - lastTapAt < 300");
    expect(camera).toContain("distance(p, lastTapPoint) < 40");
  });
});

// ── The pipeline stays single-owner and self-clearing ────────────────────────

describe("one pointer pipeline, fully reset between gestures", () => {
  it("the camera is still the only listener, and the tap reaches the object", () => {
    expect(runtime).toContain("useSceneCamera({ onTap: onSceneTap");
    expect(runtime).toContain("if (p) onObjectTap(p);");
  });

  it("every session ends at the arbiter, whoever owned it", () => {
    // Without this a host claim could leave the session latched after pointerup.
    expect(camera).toContain("arbiterRef.current?.up(wasTap);");
  });

  it("the session's state is cleared on the final pointerup", () => {
    const end = camera.slice(camera.indexOf("const endGesture"));
    expect(end).toContain("start = null;");
    expect(end).toContain("maxDist = 0;");
    expect(end).toContain("moved = false;");
  });

  it("pointer capture is released, and a failure there cannot swallow the tap", () => {
    // `releasePointerCapture` throws NotFoundError when the pointer is already gone; an
    // exception here would abort before the tap is classified.
    const end = camera.slice(camera.indexOf("const endGesture"), camera.indexOf("const opts"));
    expect(end).toContain("releasePointerCapture");
    expect(end).toContain("catch");
  });

  it("media drawn into an object never intercepts its taps", () => {
    // The object is the hit target; its picture is decoration. If this ever became
    // pointer-events-auto, a tap on a TV showing a thumbnail would hit the image instead.
    const screen = runtime.slice(runtime.indexOf("{screenSrc && screenBounds ?"), runtime.indexOf("Legacy surface content"));
    expect(screen).toContain("pointer-events-none");
  });
});
