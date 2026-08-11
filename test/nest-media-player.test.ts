import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { playerAfterAction, playerCommand, playerTrack, trackTitle } from "@/lib/nest-player";
import { placementContents, capabilitiesForAsset } from "@/lib/nest-asset-interaction";
import { nextContentIndex, clampContentIndex } from "@/lib/nest-media-session";
import { youTubeEmbedUrl, youTubeThumbnailUrl } from "@/lib/nest-interaction";
import { editableObjectsToPlacements } from "@/lib/nest-editor-bridge";
import { LAYER } from "@/lib/nest-layers";
import type { EditableNestObject } from "@/lib/nest-editor-types";
import type { ConnectedContent } from "@/lib/nest-asset-interaction";

// ── M27B-3B — the Nest media player ──────────────────────────────────────────
//
// M27B-3A2 ended with `playRequest` — a recorded intent and no player. This sprint consumes
// it. The state machine in front of it is UNCHANGED and its tests still stand
// (`nest-tv-behaviour.test.ts`); everything here is about what happens after the request.
//
// The two ideas that carry the whole design:
//
//   ONE INDEX      the player has no cursor. It renders the runtime's `contentIndex`, the
//                  same map the television reads and an aperture swipe writes. Next in the
//                  player and a swipe on the TV are the same write, so they cannot diverge.
//
//   ONE ELEMENT    the mini bar and the expanded surface are one tree with two sets of
//                  classes. React keeps the <iframe> mounted across the change, so expanding
//                  does not restart the video. Two components would have restarted it.

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const runtime = read("components", "nest", "app-shell", "nest-runtime.tsx");
const player = read("components", "nest", "app-shell", "nest-media-player.tsx");
const layers = read("lib", "nest-layers.ts");
/**
 * Comments stripped.
 *
 * These files explain themselves at length, and a "there is exactly one `<iframe>`" or "no
 * bare z-index" assertion read against the prose counts the sentences that describe the rule
 * as violations of it. Structural claims are made against CODE.
 */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const YT = ["aqz-KE-bpKQ", "dQw4w9WgXcQ", "jNQXAC9IVRw"];
const vid = (id: string): ConnectedContent => ({ kind: "youtube", url: `https://www.youtube.com/watch?v=${id}` });
const tvObj = (contents: ConnectedContent[] = YT.map(vid)): EditableNestObject =>
  ({ instanceId: "tv1", assetId: "ast-tv", x: 0.2, y: 0.2, width: 0.3, height: 0.2,
     anchor: { x: 0.35, y: 0.4 }, plane: "front_wall", zIndex: 3,
     assetInteraction: { contents } } as unknown as EditableNestObject);
const tvContents = (c?: ConnectedContent[]) => placementContents(editableObjectsToPlacements([tvObj(c)])[0]);

// ── 1 — the request opens on the item the television is showing ──────────────

describe("1. playRequest consumes the CURRENT content index", () => {
  it("the seed is the visitor's swiped position, not the creator's stored one", () => {
    const tap = runtime.slice(runtime.indexOf("const onObjectTap"), runtime.indexOf("const onSceneTap"));
    expect(tap).toContain("index: contentIndex[p.id] ?? activeContentIndex(configForPlacement(p), placementContents(p).length),");
  });

  it("and the LIVE index wins over the seed once the player is open", () => {
    // `contentIndex` is read on every render; `playRequest.index` is only the fallback for a
    // visitor who never swiped. This is what makes Next in the player move the TV as well.
    expect(runtime).toContain("? clampContentIndex(contentIndex[playRequest.objectId] ?? playRequest.index, playerContents.length)");
  });

  it("the track resolved at that index is the one on the screen", () => {
    const list = tvContents();
    for (let i = 0; i < 3; i++) {
      expect(playerTrack(list, i)?.providerId).toBe(YT[i]);
      expect(playerTrack(list, i)?.thumbnailUrl).toBe(youTubeThumbnailUrl(YT[i]));
    }
  });

  it("a stale index clamps instead of opening on nothing", () => {
    expect(playerTrack(tvContents(), 99)?.providerId).toBe(YT[2]);
    expect(clampContentIndex(99, 3)).toBe(2);
  });
});

// ── 2 — the first tap is still only a light switch ───────────────────────────

describe("2. the first tap on a TV never opens the player", () => {
  it("the OFF branch returns before anything can request playback", () => {
    const tap = runtime.slice(runtime.indexOf("const onObjectTap"), runtime.indexOf("const onSceneTap"));
    const off = tap.indexOf("if (!visualStateOf(p.assetId, current)?.showsScreen) {");
    const play = tap.indexOf("setPlayRequest({");
    expect(off).toBeGreaterThan(-1);
    expect(off).toBeLessThan(play);
    expect(tap.slice(off, play)).toContain("return; // the screen wakes up. No modal, no navigation.");
  });

  it("and the player only mounts when there IS a request", () => {
    expect(runtime).toContain("{interactive && track && playRequest ? (");
  });

  it("a card never mounts it at all — `interactive` gates the whole thing", () => {
    expect(runtime).toContain('const interactive = mode !== "card";');
  });
});

// ── 3 — the second tap ───────────────────────────────────────────────────────

describe("3. the second tap creates playback, and the old modal is not involved", () => {
  it("the TV branch returns before `tapObject`, so `run(open)` is unreachable for it", () => {
    const tap = runtime.slice(runtime.indexOf("const onObjectTap"), runtime.indexOf("const onSceneTap"));
    expect(tap.indexOf("setPlayRequest({")).toBeLessThan(tap.indexOf("const result = tapObject(p, current);"));
  });

  it("the legacy modal survives for the content that still needs it, untouched", () => {
    // §1 — "do not delete legacy behaviour globally". `open-url` on a pre-M25 Nest still
    // opens the old overlay; the TV simply never reaches it.
    expect(runtime).toContain("function MediaOverlay(");
    expect(runtime).toContain('i.type === "open-url"');
  });

  it("the player renders a real embed, from the id resolved at the boundary", () => {
    expect(playerTrack(tvContents(), 0)?.embedUrl).toBe(youTubeEmbedUrl(YT[0], { inline: true }));
    // §4 — no second parser. The player module never looks at a URL's shape.
    expect(read("lib", "nest-player.ts")).not.toMatch(/youtube\.com|youtu\.be|watch\?v/);
  });

  it("the embed is playable on a phone: inline, and controllable", () => {
    const url = playerTrack(tvContents(), 0)!.embedUrl!;
    // Without `playsinline` iOS Safari throws the video into its own fullscreen player, which
    // is exactly the "a website appeared" feeling the sprint exists to remove.
    expect(url).toContain("playsinline=1");
    expect(url).toContain("enablejsapi=1");
    expect(url).toContain("youtube-nocookie.com");
  });
});

// ── 4 — one index, shared with the television ────────────────────────────────

describe("4. next/previous move the SHARED runtime index", () => {
  it("stepping writes `contentIndex` and nothing else", () => {
    const step = runtime.slice(runtime.indexOf("const stepPlayer"), runtime.indexOf("const setExpanded"));
    expect(step).toContain("setContentIndex((m) => ({ ...m, [playRequest.objectId]: nextContentIndex(from, count, direction) }));");
    // If it also wrote `playRequest`, the player would carry a cursor of its own.
    expect(step).not.toContain("setPlayRequest(");
    expect(step).not.toContain("setSession(");
  });

  it("the television reads that same map", () => {
    expect(runtime).toContain("contentIndex={contentIndex[p.id]}");
  });

  it("stepping wraps, the same arithmetic a swipe uses", () => {
    expect(nextContentIndex(2, 3, 1)).toBe(0);
    expect(nextContentIndex(0, 3, -1)).toBe(2);
  });

  it("there is exactly ONE index in the runtime", () => {
    // A `playerIndex` piece of state would be the second playlist §5 forbids. It is derived.
    expect(runtime).toContain("const playerIndex = playRequest && playerPlacement");
    expect(runtime).not.toMatch(/useState[^\n]*playerIndex/);
  });
});

// ── 5 — closing ──────────────────────────────────────────────────────────────

describe("5. closing the player leaves the room exactly as it was", () => {
  it("ONE closing rule, in one place", () => {
    expect(playerAfterAction({ expanded: true }, "collapse")).toEqual({ expanded: false });
    expect(playerAfterAction({ expanded: true }, "stop")).toBeNull();
    expect(playerAfterAction(null, "collapse")).toBeNull();
  });

  it("collapse keeps playing; only the mini bar's × stops it", () => {
    expect(runtime).toContain('playerAfterAction(r, "collapse")');
    expect(runtime).toContain('playerAfterAction(r, "stop")');
    expect(player).toContain('<PlayerButton label="Stop" onClick={onStop}>');
  });

  it("nothing in the player path touches the TV's on/off state", () => {
    const block = runtime.slice(runtime.indexOf("const playerPlacement"), runtime.indexOf("// Opening media remembers"));
    expect(block).not.toContain("setSession(");
    expect(block).not.toContain("initialStateOf");
  });

  it("nothing in the player path touches the camera", () => {
    // §6 is true by construction: there is no camera call here to get wrong. The legacy
    // modal below it DOES save and restore, because it deliberately moves the camera.
    const block = runtime.slice(runtime.indexOf("const playerPlacement"), runtime.indexOf("// Opening media remembers"));
    for (const t of ["camera.read", "camera.restore", "camera.reset", "savedCamera"]) expect(block).not.toContain(t);
    expect(code(player)).not.toContain("camera");
  });
});

// ── 6 — nothing is written back to the creator's document ────────────────────

describe("6. the visitor's position stays in the visit", () => {
  it("no index is ever persisted", () => {
    expect(runtime).not.toMatch(/setActiveContent|activeIndex:\s*contentIndex/);
  });

  it("player and index both reset when the Nest changes", () => {
    expect(runtime).toContain("useEffect(() => { setContentIndex({}); setPlayRequest(null); }, [doc.id]);");
  });
});

// ── 7 — the foreground contract ──────────────────────────────────────────────

describe("7. the expanded player owns the foreground", () => {
  it("it is portalled out of whatever stacking context the runtime sits in", () => {
    // The visitor page wraps the runtime in `z-0` and the feed wraps it in a <Link>; a
    // z-index applied in place is trapped under those ancestors.
    expect(player).toContain("createPortal(node, window.document.body)");
  });

  it("…and named in the ONE layer file, not given a local number", () => {
    expect(player).toContain("zIndex: LAYER.player");
    expect(code(player)).not.toMatch(/z-\[\d{3,}\]|zIndex:\s*\d/);
    expect(LAYER.player).toBeGreaterThan(LAYER.editor);
    expect(LAYER.editor).toBeGreaterThan(LAYER.toast);
  });

  it("the editor shell is in that file too — the bug was that it was NOT", () => {
    // The player rendered, laid out and hit-tested correctly in the editor's Preview while
    // being painted over by a bare `z-[110]` the layer file had never heard of.
    expect(read("components", "nest", "editor", "nest-editor.tsx")).toContain("fixed inset-0 ${z.editor}");
    expect(layers).toContain("editor: 110,");
    expect(layers).toContain("player: 120,");
  });

  it("no click-through: the shell swallows the pointer events the room would see", () => {
    expect(player).toContain("onPointerDown={(e) => e.stopPropagation()}");
    expect(player).toContain("onPointerUp={(e) => e.stopPropagation()}");
  });

  it("room controls stand down under an EXPANDED player, and stay live under the mini bar", () => {
    expect(runtime).toContain("hidden={!!media || !!playRequest?.expanded}");
  });

  it("the bar clears the app's bottom navigation by measuring it", () => {
    expect(player).toContain('window.document.querySelector(\'nav[aria-label="Primary"]\')');
    expect(player).toContain("env(safe-area-inset-bottom)");
  });
});

// ── 8 — one implementation on every surface ──────────────────────────────────

describe("8. Preview, Home and the visitor share the implementation", () => {
  it("all three mount the same runtime", () => {
    for (const f of [
      ["components", "nest", "editor", "nest-editor.tsx"],
      ["app", "nest", "[slug]", "visitor-client.tsx"],
      ["components", "nest", "app-shell", "nest-preview.tsx"],
    ]) expect(read(...f)).toContain("<NestRuntime");
  });

  it("the player is mounted in exactly ONE place, by the runtime", () => {
    expect((runtime.match(/<NestMediaPlayer/g) ?? []).length).toBe(1);
    // No surface imports it directly, so no surface can fork it.
    for (const f of [
      ["components", "nest", "editor", "nest-editor.tsx"],
      ["app", "nest", "[slug]", "visitor-client.tsx"],
      ["components", "nest", "app-shell", "discovery.tsx"],
    ]) expect(read(...f)).not.toContain("nest-media-player");
  });

  it("Home is deliberately NOT interactive — the room is a link, not a runtime you drive", () => {
    // Recorded because it is the one acceptance step this sprint cannot perform rather than
    // one it skipped: the feed passes `interactive={false}`, so there are no tap targets at
    // all on Home and the TV cannot be switched on, swiped or played there.
    expect(read("components", "nest", "app-shell", "nest-preview.tsx")).toContain('mode={interactive ? "visitor" : "card"}');
    expect(read("components", "nest", "app-shell", "nest-preview.tsx")).toContain("interactive = false");
    const feed = read("components", "nest", "app-shell", "discovery.tsx");
    const card = feed.slice(feed.indexOf("function FeedCard"), feed.indexOf("function CreateCard"));
    expect(card).toContain("<NestPreview doc={item.doc}");
    expect(card).not.toContain("interactive");
  });
});

// ── 9 — the expanded surface is a Nestudio surface ───────────────────────────

describe("9. expanded is a room-aware surface, not an embedded web page", () => {
  it("the room behind is dimmed AND blurred", () => {
    expect(player).toContain("backdrop-blur-md");
    expect(player).toContain('backgroundColor: "rgba(13, 12, 16, 0.72)"');
  });

  it("a proper 16:9 media area, restrained corners", () => {
    expect(player).toContain('expanded ? "aspect-video w-full rounded-2xl" : "size-11 rounded-xl"');
    expect(player).toContain('expanded ? "rounded-[26px]" : "rounded-2xl"');
  });

  it("a still and a spinner cover the frame until the provider reports load", () => {
    expect(player).toContain("onLoad={() => setReady(true)}");
    expect(player).toContain("expanded && !ready && track.embedUrl");
  });

  it("leaving Nestudio is secondary and never automatic", () => {
    // §4 — "never redirect externally just because autoplay failed".
    expect(player).toContain('target="_blank"');
    expect(player).not.toContain("window.location");
    expect(player).not.toContain("router.push");
  });

  it("expanding does not restart the video — one iframe, two layouts", () => {
    // The <iframe> keeps the same position in the tree in both layouts; only classes change.
    // Verified in the browser by identity (`iframeEl() === before`), and structurally here.
    expect((code(player).match(/<iframe/g) ?? []).length).toBe(1);
    expect(code(player)).not.toMatch(/expanded \?\s*<iframe|\{expanded && <iframe/);
  });
});

// ── 10 — titles, providers and items that cannot play ────────────────────────

describe("10. what the bar says", () => {
  it("an unlabelled item is named by its position", () => {
    expect(trackTitle(undefined, 1)).toBe("Item 2");
    expect(trackTitle({ kind: "youtube", url: "" }, 0)).toBe("Video 1");
  });

  it("a creator's real label wins", () => {
    expect(trackTitle({ kind: "youtube", url: "", label: "My favourite set" }, 0)).toBe("My favourite set");
  });

  it("…but a label that only repeats the provider does not", () => {
    // Connect stamps "YouTube" as the label for an unnamed pasted link, so a real playlist
    // read "YouTube" over "YouTube" three times. Found by building the fixture through the
    // real Connect panel rather than by hand.
    expect(trackTitle({ kind: "youtube", url: "", label: "YouTube" }, 1)).toBe("Video 2");
    expect(trackTitle({ kind: "youtube", url: "", label: "youtube" }, 1)).toBe("Video 2");
  });

  it("an item with no provider id offers no inline playback and no play button", () => {
    const link: ConnectedContent = { kind: "website", url: "https://example.com/x" };
    const t = playerTrack([link], 0)!;
    expect(t.embedUrl).toBeNull();
    expect(t.canControl).toBe(false);
    expect(t.externalUrl).toBe("https://example.com/x");
    // …and it still shows something rather than an empty black square.
    expect(player).toContain("<LinkIcon");
  });

  it("play/pause speaks the provider's protocol without loading the provider's script", () => {
    expect(JSON.parse(playerCommand("play"))).toEqual({ event: "command", func: "playVideo", args: [] });
    expect(JSON.parse(playerCommand("pause"))).toEqual({ event: "command", func: "pauseVideo", args: [] });
    expect(player).not.toContain("youtube.com/iframe_api");
  });

  it("previous/next appear only for a real playlist", () => {
    expect(player).toContain("const multi = track.count > 1;");
    expect(playerTrack(tvContents([vid(YT[0])]), 0)?.count).toBe(1);
  });
});

// ── 11 — the frame is untouched ──────────────────────────────────────────────

describe("11. a photo frame never routes into the TV player", () => {
  it("it has no `toggleTo`, so it cannot reach the branch that requests playback", () => {
    expect(capabilitiesForAsset("ast-framed-photo")?.toggleTo).toBeUndefined();
    expect(runtime).toContain("if (def?.screenSurfaceId && def.toggleTo && placementContents(p).length) {");
  });

  it("its photos still resolve, and swipe is still the aperture's own gesture", () => {
    const photos: ConnectedContent[] = [1, 2].map((n) => ({ kind: "image", url: `https://s.test/${n}.jpg` }));
    const frame = editableObjectsToPlacements([{ ...tvObj(), assetId: "ast-framed-photo", assetInteraction: { contents: photos } } as EditableNestObject])[0];
    expect(placementContents(frame)).toHaveLength(2);
    expect(runtime).toContain("if (!interactive || pts.length !== 1) return false;");
  });
});

// ── 12 — the boundary resolves the provider id once ──────────────────────────

describe("12. one place parses a URL", () => {
  it("`providerId` arrives with the content, already resolved", () => {
    expect(tvContents().map((c) => c.providerId)).toEqual(YT);
  });

  it("and is re-derived on every read, so a stored value cannot reach an iframe", () => {
    const poisoned = [{ ...vid(YT[0]), providerId: "../../evil" } as ConnectedContent];
    expect(tvContents(poisoned)[0]?.providerId).toBe(YT[0]);
  });

  it("a non-YouTube item never claims one", () => {
    expect(playerTrack([{ kind: "website", url: "https://example.com" }], 0)?.providerId).toBeNull();
  });
});
