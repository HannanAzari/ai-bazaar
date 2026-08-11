import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  activeContentIndex,
  capabilitiesForAsset,
  initialStateOf,
  nextState,
  placementContents,
  visualStateOf,
} from "@/lib/nest-asset-interaction";
import { nextContentIndex, swipeIntent } from "@/lib/nest-media-session";
import { moveContent } from "@/lib/nest-contents";
import { placementDisplayContent } from "@/lib/nest-object-display";
import { youTubeThumbnailUrl, youTubeVideoId } from "@/lib/nest-interaction";
import { editableObjectsToPlacements } from "@/lib/nest-editor-bridge";
import type { EditableNestObject } from "@/lib/nest-editor-types";

// ── M27B-3A2 — a television that behaves like one ────────────────────────────
//
//     OFF  --tap-->  ON (thumbnail)  --tap-->  playback requested
//
// TWO THINGS WERE WRONG BEFORE, and they compounded:
//
//   • `tapObject` returned the connected content's `open` action on the SAME tap that
//     changed the state, so the first touch of a TV turned it on AND threw a full-screen
//     card over the room. Turning something on and starting it are different intentions.
//
//   • the catalogue's `toggleTo` is a 2-cycle (off↔on), so the second tap turned the TV
//     back OFF — which makes "second tap plays" impossible to express at all.
//
// The runtime now owns the progression. `toggleTo` still describes the ASSET (a TV has two
// looks); it no longer decides what a tap means.

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const runtime = read("components", "nest", "app-shell", "nest-runtime.tsx");
const canvas = read("components", "nest", "editor", "editor-canvas.tsx");
const session = read("lib", "nest-media-session.ts");

const YT = ["aqz-KE-bpKQ", "dQw4w9WgXcQ", "jNQXAC9IVRw"];
const vid = (id: string) => ({ kind: "youtube" as const, url: `https://www.youtube.com/watch?v=${id}` });
const tvObj = (ids = YT): EditableNestObject =>
  ({ instanceId: "tv1", assetId: "ast-tv", x: 0.2, y: 0.2, width: 0.3, height: 0.2,
     anchor: { x: 0.35, y: 0.4 }, plane: "front_wall", zIndex: 3,
     assetInteraction: { contents: ids.map(vid) } } as unknown as EditableNestObject);
const tv = (ids = YT) => editableObjectsToPlacements([tvObj(ids)])[0];

// ── 1–4 — off, then on, and NO modal ─────────────────────────────────────────

describe("1-4. a TV starts off and wakes up on the first tap", () => {
  it("its initial state is off, and an off screen shows nothing", () => {
    const p = tv();
    expect(initialStateOf(p)).toBe("off");
    expect(visualStateOf("ast-tv", "off")?.showsScreen).toBeFalsy();
    expect(placementDisplayContent(p, "off", "runtime")).toBeNull();
  });

  it("on, the FIRST item's thumbnail is inside the TV aperture", () => {
    const d = placementDisplayContent(tv(), nextState("ast-tv", "off"), "runtime");
    expect(d?.src).toBe(youTubeThumbnailUrl(YT[0]));
    expect(d?.bounds).toEqual({ x: 0.2, y: 0.11, width: 0.6, height: 0.48 });
  });

  it("the first tap opens NOTHING — it only turns the screen on", () => {
    // The whole point of the sprint. `run(result.open)` is unreachable for a stateful
    // screen with content, because that branch returns before `tapObject` is consulted.
    const tap = runtime.slice(runtime.indexOf("const onObjectTap"), runtime.indexOf("const onSceneTap"));
    expect(tap).toContain("if (!visualStateOf(p.assetId, current)?.showsScreen) {");
    expect(tap).toContain("return; // the screen wakes up. No modal, no navigation.");
    // …and the guarded branch comes BEFORE the legacy `tapObject` path.
    expect(tap.indexOf("setSession((st) => ({ ...st, [p.id]: nextState")).toBeLessThan(tap.indexOf("const result = tapObject(p, current);"));
  });

  it("the machine applies only to STATEFUL screens, so a frame is untouched", () => {
    // A Framed Photo has no `toggleTo` — it is always `shown` — and must fall through.
    expect(capabilitiesForAsset("ast-tv")?.toggleTo).toBeTruthy();
    expect(capabilitiesForAsset("ast-framed-photo")?.toggleTo).toBeUndefined();
    expect(runtime).toContain("if (def?.screenSurfaceId && def.toggleTo && placementContents(p).length) {");
  });
});

// ── 5–8 — the playlist ───────────────────────────────────────────────────────

describe("5-8. swiping changes the video and keeps the TV on", () => {
  it("left advances, right goes back", () => {
    expect(swipeIntent(-40, 0)).toBe(1);
    expect(swipeIntent(40, 0)).toBe(-1);
  });

  it("the thumbnail follows the index, item by item", () => {
    const p = tv();
    for (let i = 0; i < 3; i++) {
      expect(placementDisplayContent(p, "on", "runtime", i)?.src).toBe(youTubeThumbnailUrl(YT[i]));
    }
  });

  it("wraps both ways", () => {
    expect(nextContentIndex(2, 3, 1)).toBe(0);
    expect(nextContentIndex(0, 3, -1)).toBe(2);
  });

  it("swiping never touches the visual state — only the index moves", () => {
    // The arbiter sets `contentIndex` and nothing else; there is no `setSession` in it.
    const arb = runtime.slice(runtime.indexOf("const mediaArbiter"), runtime.indexOf("const camera = useSceneCamera"));
    expect(arb).toContain("setContentIndex(");
    expect(arb).not.toContain("setSession(");
    expect(arb).not.toContain("setPlayRequest(");
  });
});

// ── 9 — the second tap ───────────────────────────────────────────────────────

describe("9. a deliberate tap on a live screen requests playback", () => {
  it("it records WHICH object and WHICH item", () => {
    expect(runtime).toContain("setPlayRequest({ objectId: p.id, index:");
  });

  it("and never turns the screen back off", () => {
    // The old `toggleTo` 2-cycle did exactly that, which is why second-tap playback was
    // impossible to express. Nothing in the tap path sets the state back to `off`.
    const tap = runtime.slice(runtime.indexOf("const onObjectTap"), runtime.indexOf("const onSceneTap"));
    expect(tap).not.toContain('"off"');
    expect(tap).toContain("// Already on ⇒ this is a deliberate request to play the item on screen.");
  });

  it("playback is a STATE, not a half-built player", () => {
    // The aperture is ~87x45px on a phone — below the size a YouTube embed reliably plays
    // in — so M27B-3A2 records the intent and M27B-3B renders it.
    expect(runtime).toContain("data-play-requested");
    // Scoped to the APERTURE. The file still contains the legacy media-modal iframe, which
    // this sprint deliberately leaves alone (it is M27B-3B's to replace) — the point is
    // that nothing renders a player INSIDE the object.
    const aperture = runtime.slice(runtime.indexOf("data-media-aperture={p.id}"), runtime.indexOf("Legacy surface content"));
    expect(aperture).not.toContain("<iframe");
    expect(aperture).toContain("nest-media-fade");
  });
});

// ── 10 — nothing is written ──────────────────────────────────────────────────

describe("10. the visitor's position is session-only", () => {
  it("the runtime never writes an index back to the document", () => {
    expect(runtime).not.toMatch(/setActiveContent|activeIndex:\s*contentIndex/);
  });

  it("both session maps reset when the Nest changes", () => {
    expect(runtime).toContain("useEffect(() => { setContentIndex({}); setPlayRequest(null); }, [doc.id]);");
  });

  it("a cold read still starts at the creator's item", () => {
    expect(activeContentIndex({ contents: YT.map(vid) }, 3)).toBe(0);
    expect(placementDisplayContent(tv(), "on", "runtime")?.src).toBe(youTubeThumbnailUrl(YT[0]));
  });
});

// ── 11–13 — ownership and parity ─────────────────────────────────────────────

describe("11-13. ownership, Edit, and one runtime", () => {
  it("two fingers are the camera, never a swipe", () => {
    const camera = read("components", "nest", "app-shell", "use-scene-camera.ts");
    expect(runtime).toContain("pts.length > 1");
    expect(camera).toContain("if (hostOwns && !claimed) hostOwns = false;");
  });

  it("EDIT never runs media swipe — the editor has no aperture marker at all", () => {
    expect(canvas).not.toContain("data-media-aperture");
  });

  it("still exactly ONE pointer pipeline", () => {
    expect(runtime).toContain("useSceneCamera({ onTap: onSceneTap, enabled: interactive, arbiter: mediaArbiter })");
    expect((runtime.match(/addEventListener\("pointer/g) ?? []).length).toBe(0);
  });

  it("Preview, Home and the visitor are the same component — no per-surface TV logic", () => {
    for (const f of [
      ["components", "nest", "editor", "nest-editor.tsx"],
      ["app", "nest", "[slug]", "visitor-client.tsx"],
      ["components", "nest", "app-shell", "nest-preview.tsx"],
    ]) {
      expect(read(...f)).toContain("<NestRuntime");
    }
    expect(runtime).not.toMatch(/function\s+\w*(Tv|TV)(Player|Carousel|Controls)/);
  });
});

// ── 14–15 — shared resolvers stay shared ─────────────────────────────────────

describe("14-15. one YouTube resolver, and the frame is untouched", () => {
  it("no second YouTube parser was added", () => {
    expect(youTubeVideoId(`https://www.youtube.com/watch?v=${YT[1]}`)).toBe(YT[1]);
    for (const f of [runtime, session, read("lib", "nest-contents.ts")]) {
      expect(f).not.toMatch(/v=\)\|youtu\\?\.be|new RegExp\(.*youtube/i);
    }
  });

  it("each item resolves its own thumbnail through the shared path", () => {
    expect(placementContents(tv()).map((c) => c.thumbnailUrl)).toEqual(YT.map(youTubeThumbnailUrl));
  });

  it("the frame still starts at contents[0] and honours a reorder", () => {
    const frame = (cfg: object) =>
      editableObjectsToPlacements([{ ...tvObj(), assetId: "ast-framed-photo", assetInteraction: cfg } as EditableNestObject])[0];
    const photos = [1, 2, 3].map((n) => ({ kind: "image" as const, url: `https://s.test/${n}.jpg` }));
    expect(placementDisplayContent(frame({ contents: photos }), "shown", "runtime")?.src).toBe(photos[0].url);
    expect(placementDisplayContent(frame(moveContent({ contents: photos }, 2, 0)), "shown", "runtime")?.src).toBe(photos[2].url);
  });

  it("a frame's tap still does nothing — it has no play machine", () => {
    const photos = [{ kind: "image" as const, url: "https://s.test/1.jpg" }];
    const p = editableObjectsToPlacements([{ ...tvObj(), assetId: "ast-framed-photo", assetInteraction: { contents: photos } } as EditableNestObject])[0];
    expect(capabilitiesForAsset(p.assetId)?.toggleTo).toBeUndefined();
  });
});
