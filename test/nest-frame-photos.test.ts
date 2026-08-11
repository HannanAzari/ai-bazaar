import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { clampContentIndex, nextContentIndex, SWIPE_THRESHOLD_PX, swipeIntent } from "@/lib/nest-media-session";
import { placementDisplayContent } from "@/lib/nest-object-display";
import { activeContentIndex, initialStateOf, placementContents, visualStateOf } from "@/lib/nest-asset-interaction";
import { addContent, moveContent, storedContents } from "@/lib/nest-contents";
import { editableObjectsToPlacements } from "@/lib/nest-editor-bridge";
import type { EditableNestObject } from "@/lib/nest-editor-types";

// ── M27B-3A1 — a frame with several photos ───────────────────────────────────
//
// The abandoned M27B-3A attempt assumed every object had `off` / `on` states and set the
// visual state alongside the content index. A Framed Photo's catalogue state is `shown`.
//
// I twice reported that this "would have blanked the frame". THAT WAS WRONG, and the test
// below records the correction: `visualStateOf` falls back to the asset's DEFAULT state, so
// a frame would have kept rendering. The real objection survives and is still decisive —
// the object's recorded state would be one it does not have, and any asset whose default
// hides its screen (a TV, whose default is `off`) would go dark instead.
//
// So the two ideas are kept strictly apart:
//
//     asset visual state — what the OBJECT looks like; owned by the catalogue, per-asset
//     content index      — WHICH item is on display; owned by the session, universal

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const session = read("lib", "nest-media-session.ts");
const runtime = read("components", "nest", "app-shell", "nest-runtime.tsx");
const canvas = read("components", "nest", "editor", "editor-canvas.tsx");

const photo = (n: number) => ({ kind: "image" as const, url: `https://s.test/${n}.jpg` });
const frameObj = (contents: ReturnType<typeof photo>[]): EditableNestObject =>
  ({ instanceId: "f1", assetId: "ast-framed-photo", x: 0.2, y: 0.2, width: 0.2, height: 0.2,
     anchor: { x: 0.3, y: 0.4 }, plane: "front_wall", zIndex: 3,
     assetInteraction: { contents } } as unknown as EditableNestObject);
const frame = (n = 3) => editableObjectsToPlacements([frameObj([1, 2, 3].slice(0, n).map(photo))])[0];

// ── 1–3 — the asset's own state vocabulary is untouched ──────────────────────

describe("1-3. content index never touches the asset's visual state", () => {
  it("a one-photo frame renders immediately, no tap", () => {
    const p = frame(1);
    expect(placementDisplayContent(p, initialStateOf(p), "runtime")?.src).toBe(photo(1).url);
  });

  it("the frame's catalogue state is `shown` — not off/on", () => {
    expect(initialStateOf(frame())).toBe("shown");
    expect(visualStateOf("ast-framed-photo", "shown")?.showsScreen).toBe(true);
  });

  it("`on` is not a state a frame HAS — `visualStateOf` falls back to its default", () => {
    // CORRECTION to what I claimed in two earlier reports: the abandoned off/on design
    // would NOT have blanked the frame, because `visualStateOf` falls back to
    // `def.states[def.defaultState]`. The real objection is subtler and still decisive —
    // the object's recorded state would silently be a state it does not have, which is
    // incoherent, and any asset whose DEFAULT state hides its screen would go dark.
    expect(visualStateOf("ast-framed-photo", "on")).toEqual(visualStateOf("ast-framed-photo", "shown"));
    // A TV is exactly that asset: its default is `off`, which shows nothing.
    expect(visualStateOf("ast-tv", "nonsense")?.showsScreen).toBeFalsy();
  });

  it("changing the index leaves the state alone, at every index", () => {
    const p = frame();
    for (const i of [0, 1, 2]) {
      expect(placementDisplayContent(p, "shown", "runtime", i)?.src).toBe(photo(i + 1).url);
    }
  });

  it("the session module never names a visual state at all", () => {
    // Structural: it cannot set a state it does not know. Compared on CODE — the header
    // comment quotes the abandoned `off` / `on` design in order to explain it.
    const code = session.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const t of ['"on"', '"off"', "visualStateOf", "showsScreen"]) expect(code).not.toContain(t);
  });
});

// ── 4–7 — swiping ────────────────────────────────────────────────────────────

describe("4-7. swipe direction and wraparound", () => {
  it("left advances, right goes back", () => {
    expect(swipeIntent(-40, 0)).toBe(1);
    expect(swipeIntent(40, 0)).toBe(-1);
  });

  it("forward wraps last → first", () => {
    expect(nextContentIndex(2, 3, 1)).toBe(0);
  });

  it("backward wraps first → last", () => {
    expect(nextContentIndex(0, 3, -1)).toBe(2);
  });

  it("a single-item list never moves", () => {
    expect(nextContentIndex(0, 1, 1)).toBe(0);
    expect(nextContentIndex(0, 1, -1)).toBe(0);
  });

  it("the whole cycle, forwards and back", () => {
    let i = 0;
    const fwd = [1, 2, 0].map(() => (i = nextContentIndex(i, 3, 1)));
    expect(fwd).toEqual([1, 2, 0]);
    const back = [2, 1, 0].map(() => (i = nextContentIndex(i, 3, -1)));
    expect(back).toEqual([2, 1, 0]);
  });
});

// ── 8–9 — what must NOT change the photo ─────────────────────────────────────

describe("8-9. a tap and a vertical drag leave the photo alone", () => {
  it("a tap is no travel at all", () => {
    expect(swipeIntent(0, 0)).toBeNull();
  });

  it("a wobble under the threshold is not a swipe", () => {
    expect(swipeIntent(SWIPE_THRESHOLD_PX - 1, 0)).toBeNull();
  });

  it("a vertical drag is not a swipe, however long", () => {
    expect(swipeIntent(0, 200)).toBeNull();
    expect(swipeIntent(10, 200)).toBeNull();
  });

  it("a diagonal that is not dominantly horizontal is not a swipe", () => {
    // Equal parts is deliberately NOT a swipe — inside a small aperture that is far more
    // likely to be someone starting a page gesture, and stealing it would break their scroll.
    expect(swipeIntent(60, 60)).toBeNull();
    expect(swipeIntent(60, 59)).toBe(-1);
  });
});

// ── 10–12 — ownership ────────────────────────────────────────────────────────

describe("10-12. gesture ownership", () => {
  it("the claim needs one finger, an aperture, and MORE THAN ONE item", () => {
    expect(runtime).toContain("if (!interactive || pts.length !== 1) return false;");
    expect(runtime).toContain('Number(ap.dataset.contentCount ?? 0) < 2');
  });

  it("two fingers are never a swipe — the camera reclaims the session", () => {
    expect(runtime).toContain("pts.length > 1");
    const camera = read("components", "nest", "app-shell", "use-scene-camera.ts");
    expect(camera).toContain("if (hostOwns && !claimed) hostOwns = false;");
  });

  it("EDIT mode never runs photo swipe — `interactive` gates the whole claim", () => {
    // The editor draws connected media through its own layer and has no aperture marker,
    // so there is nothing for a swipe to attach to even before `interactive` is checked.
    expect(canvas).not.toContain("data-media-aperture");
    expect(canvas).toContain("data-object-display");
  });

  it("there is still exactly ONE pointer pipeline", () => {
    expect(runtime).toContain("useSceneCamera({ onTap: onSceneTap, enabled: interactive, arbiter: mediaArbiter })");
    expect((runtime.match(/addEventListener\("pointer/g) ?? []).length).toBe(0);
  });

  it("a claim that never became a swipe is still a tap", () => {
    // Otherwise claiming the session would silently eat taps on any multi-photo frame.
    expect(runtime).toContain("if (sw && !sw.fired && tapped) {");
  });
});

// ── 13–15 — ordering, persistence, and what is NOT persisted ─────────────────

describe("13-15. the creator's order is canonical; the visitor's index is not", () => {
  it("the frame starts at contents[0]", () => {
    expect(placementDisplayContent(frame(), "shown", "runtime")?.src).toBe(photo(1).url);
  });

  it("reordering in Connect changes what the frame starts on", () => {
    // C, A, B → the frame must open on C. This requires that a creator who never chose a
    // cover does not get one pinned for them: M27B-2 preserved the ACTIVE ITEM across a
    // reorder, which silently wrote `activeIndex` and made position 0 stop being
    // authoritative. Preserved only when the creator actually set one.
    const reordered = moveContent({ contents: [photo(1), photo(2), photo(3)] }, 2, 0);
    expect(reordered.activeIndex).toBeUndefined();
    const p = editableObjectsToPlacements([{ ...frameObj([]), assetInteraction: reordered } as EditableNestObject])[0];
    expect(placementDisplayContent(p, "shown", "runtime")?.src).toBe(photo(3).url);
  });

  it("…but a cover the creator DID choose still follows its item", () => {
    const withCover = moveContent({ contents: [photo(1), photo(2), photo(3)], activeIndex: 0 }, 2, 0);
    expect(withCover.contents?.[withCover.activeIndex ?? 0].url).toBe(photo(1).url);
  });

  it("order survives the publish conversion exactly", () => {
    const p = frame();
    expect(placementContents(p).map((c) => c.url)).toEqual([1, 2, 3].map((n) => photo(n).url));
  });

  it("a session index is an ARGUMENT, never something written to the document", () => {
    // The override is passed per render; nothing in the runtime writes it back.
    const p = frame();
    expect(placementDisplayContent(p, "shown", "runtime", 2)?.src).toBe(photo(3).url);
    expect(activeContentIndex({ contents: [photo(1), photo(2), photo(3)] }, 3)).toBe(0);
    expect(runtime).not.toMatch(/setActiveContent|activeIndex:\s*contentIndex/);
  });

  it("adding photos never invents an activeIndex", () => {
    let cfg = {};
    for (const n of [1, 2, 3]) cfg = addContent(cfg, photo(n));
    expect(storedContents(cfg)).toHaveLength(3);
    expect((cfg as { activeIndex?: number }).activeIndex).toBeUndefined();
  });

  it("a stale index clamps rather than blanking the frame", () => {
    expect(clampContentIndex(9, 3)).toBe(2);
    expect(clampContentIndex(-4, 3)).toBe(0);
    expect(placementDisplayContent(frame(), "shown", "runtime", 99)?.src).toBe(photo(3).url);
  });
});

// ── §6 — one aperture everywhere ─────────────────────────────────────────────

describe("§6 — the photo stays in the catalogue aperture on every surface", () => {
  it("the geometry comes from the shared resolver, at every index", () => {
    const p = frame();
    for (const i of [0, 1, 2]) {
      expect(placementDisplayContent(p, "shown", "runtime", i)?.bounds).toEqual({ x: 0.18, y: 0.18, width: 0.64, height: 0.64 });
      expect(placementDisplayContent(p, "shown", "runtime", i)?.surfaceId).toBe("frame-photo");
    }
  });

  it("no separate carousel component was built", () => {
    expect(runtime).not.toMatch(/function\s+\w*Carousel/);
  });

  it("the transition touches OPACITY only", () => {
    // M26-F cost a sprint to an animation that also set `transform`: an animation outranks
    // an inline style, so it silently discarded every object's rotation and mirror.
    expect(runtime).toContain("@keyframes nest-media-fade { from { opacity: 0 } to { opacity: 1 } }");
    const css = runtime.slice(runtime.indexOf("const RUNTIME_CSS"), runtime.indexOf("function PlacedObject"));
    expect(css).not.toContain("transform");
    expect(css).not.toContain("both");
  });
});
