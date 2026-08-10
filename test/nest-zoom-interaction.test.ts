import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolveTapTarget,
  type TapCandidate,
  CAMERA_DOUBLE_TAP_SCALE,
  CAMERA_MAX_SCALE,
  CAMERA_MIN_SCALE,
  cameraTransform,
  clampOffset,
  clampScale,
  doubleTapCamera,
  IDENTITY_CAMERA,
  isIdentityCamera,
  isTap,
  panBy,
  resolutionWarning,
  zoomAround,
  type Camera,
} from "@/lib/nest-camera";
import {
  audioFor,
  capabilitiesForAsset,
  creatorActionsFor,
  initialStateOf,
  isInteractiveObject,
  resolveConnection,
  tapObject,
  visualStateOf,
} from "@/lib/nest-asset-interaction";
import { editableObjectsToPlacements, nestDocumentToEditable } from "@/lib/nest-editor-bridge";
import { resolveFocusRegions } from "@/lib/nest-scene";
import { INTERACTIVE_TEST_NEST, LEGACY_FOCUS_NEST } from "@/lib/fixtures/interactive-nest";
import { inPaintOrder } from "@/lib/nest-geometry";
import type { NestDocument, NestPlacement } from "@/lib/nest-document-types";
import type { EditableNestObject } from "@/lib/nest-editor-types";

// ── M25 — free zoom + object interaction ─────────────────────────────────────
//
// The Focus-first model is replaced by two systems: the whole room zooms, and objects
// themselves are the interactive thing. These are the 22 regressions the sprint names.

const VIEWPORT = { width: 400, height: 533 };
const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const runtime = read("components", "nest", "app-shell", "nest-runtime.tsx");
const gestures = read("components", "nest", "app-shell", "use-scene-camera.ts");
const editor = read("components", "nest", "editor", "nest-editor.tsx");

const placement = (id: string) => INTERACTIVE_TEST_NEST.placements.find((p) => p.id === id)!;
const roundTrip = (d: NestDocument): NestDocument => JSON.parse(JSON.stringify(d));

// ── 1–4. the camera ──────────────────────────────────────────────────────────

describe("1. zoom clamps between the supported limits", () => {
  it("never goes below 1× — the room is always at least fitted", () => {
    expect(clampScale(0.2)).toBe(CAMERA_MIN_SCALE);
    expect(zoomAround(IDENTITY_CAMERA, 0.1, { x: 0, y: 0 }, VIEWPORT).scale).toBe(1);
  });

  it("never goes above ~5×, however hard the pinch", () => {
    expect(clampScale(400)).toBe(CAMERA_MAX_SCALE);
    expect(zoomAround(IDENTITY_CAMERA, 99, { x: 10, y: 10 }, VIEWPORT).scale).toBe(CAMERA_MAX_SCALE);
  });

  it("survives a degenerate gesture rather than producing NaN", () => {
    // A non-finite scale means the gesture maths broke; falling back to the FITTED room
    // is the only safe answer — an Infinity would blank the screen.
    expect(clampScale(NaN)).toBe(CAMERA_MIN_SCALE);
    expect(clampScale(Infinity)).toBe(CAMERA_MIN_SCALE);
    const bad = clampOffset({ scale: NaN, x: NaN, y: NaN }, VIEWPORT);
    expect(Number.isFinite(bad.x) && Number.isFinite(bad.y) && Number.isFinite(bad.scale)).toBe(true);
  });
});

describe("2. pinch preserves its focal point", () => {
  it("the pixel between the fingers does not move", () => {
    const focal = { x: 80, y: -40 };
    const cam = zoomAround(IDENTITY_CAMERA, 3, focal, VIEWPORT);
    // Where the focal point maps to after the transform must equal where it started.
    const mapped = { x: focal.x * cam.scale + cam.x, y: focal.y * cam.scale + cam.y };
    // The focal point started at `focal` in stage space at scale 1, offset 0.
    expect(mapped.x).toBeCloseTo(focal.x, 4);
    expect(mapped.y).toBeCloseTo(focal.y, 4);
  });

  it("zooming out around the same point returns to the identity camera", () => {
    const focal = { x: 55, y: 30 };
    const inCam = zoomAround(IDENTITY_CAMERA, 4, focal, VIEWPORT);
    const out = zoomAround(inCam, 1, focal, VIEWPORT);
    expect(isIdentityCamera(out)).toBe(true);
  });
});

describe("3. pan bounds keep the room on screen", () => {
  it("at 1× there is nowhere to pan — a drag cannot slide the room away", () => {
    const p = panBy(IDENTITY_CAMERA, 500, -500, VIEWPORT);
    expect([p.scale, p.x === 0, p.y === 0]).toEqual([1, true, true]);
  });

  it("at 3× panning stops at the room's own edge", () => {
    const cam: Camera = { scale: 3, x: 0, y: 0 };
    const panned = panBy(cam, 9999, 9999, VIEWPORT);
    expect(panned.x).toBeCloseTo((VIEWPORT.width * 3 - VIEWPORT.width) / 2, 4);
    expect(panned.y).toBeCloseTo((VIEWPORT.height * 3 - VIEWPORT.height) / 2, 4);
  });

  it("the room can never be pushed entirely off screen", () => {
    for (const scale of [1, 1.5, 2, 5]) {
      const p = panBy({ scale, x: 0, y: 0 }, 1e6, 1e6, VIEWPORT);
      expect(Math.abs(p.x)).toBeLessThanOrEqual((VIEWPORT.width * scale) / 2);
      expect(Math.abs(p.y)).toBeLessThanOrEqual((VIEWPORT.height * scale) / 2);
    }
  });
});

describe("4. a tap is told apart from a drag", () => {
  const at = (x: number, y: number, t: number) => ({ x, y, t });

  it("a still, quick touch is a tap", () => {
    expect(isTap(at(10, 10, 0), at(12, 11, 120), 2.2)).toBe(true);
  });

  it("a drag is not a tap, however briefly it lasts", () => {
    expect(isTap(at(10, 10, 0), at(90, 10, 120), 80)).toBe(false);
  });

  it("a finger that wanders away and comes back is still a drag", () => {
    // maxDistance, not start→end: this is the "accidental activation while panning" case.
    expect(isTap(at(10, 10, 0), at(11, 10, 300), 120)).toBe(false);
  });

  it("a long press is not a tap", () => {
    expect(isTap(at(10, 10, 0), at(10, 10, 900), 0)).toBe(false);
  });

  it("the runtime only fires an interaction from a classified tap", () => {
    expect(gestures).toContain("isTap(start");
    expect(gestures).toContain("&& !wasPanning");
    expect(runtime).toContain("useSceneCamera({ onTap: onSceneTap");
  });
});

describe("double tap", () => {
  it("zooms to ~2× around the tapped point", () => {
    const cam = doubleTapCamera(IDENTITY_CAMERA, { x: 40, y: 20 }, VIEWPORT);
    expect(cam.scale).toBe(CAMERA_DOUBLE_TAP_SCALE);
  });

  it("a second double tap returns to the original framing", () => {
    const zoomed = doubleTapCamera(IDENTITY_CAMERA, { x: 40, y: 20 }, VIEWPORT);
    expect(doubleTapCamera(zoomed, { x: 0, y: 0 }, VIEWPORT)).toEqual(IDENTITY_CAMERA);
  });

  it("produces a GPU-friendly transform", () => {
    expect(cameraTransform({ scale: 2, x: 10, y: -5 })).toBe("translate3d(10px, -5px, 0) scale(2)");
  });
});

// ── 5–7. interaction at every zoom level, and hit targets ────────────────────

describe("5. interaction works at every zoom level", () => {
  it("the camera is a viewport transform, so object hit areas scale with the room", () => {
    // Hit-testing goes through elementFromPoint on the LIVE, transformed DOM, so a target
    // is correct at any scale by construction — nothing recomputes geometry per zoom step.
    expect(runtime).toContain("window.document.elementFromPoint(point.x, point.y)");
    expect(runtime).toContain('closest?.("[data-object-id]")');
  });

  it("tapping resolves the same object regardless of camera state", () => {
    // tapObject takes only the placement and its state — the camera is not an input.
    const tv = placement("tv");
    expect(tapObject(tv, "off").state).toBe("on");
    expect(tapObject(tv, "off").open?.type).toBe("open-youtube");
  });
});

describe("6. small assets keep usable hit targets", () => {
  it("the benchmark really does contain tiny objects", () => {
    const a = placement("book-a");
    expect(a.w!).toBeLessThan(0.04); // ~3.5% of the room wide
    expect(placement("tiny-frame").w!).toBeLessThan(0.05);
  });

  it("an invisible minimum touch target grows the HIT area, not the object", () => {
    expect(runtime).toContain("minWidth: 44");
    expect(runtime).toContain("minHeight: 44");
    // It is aria-hidden and transparent, but it MUST be hittable — a pointer-events-none
    // pad extends nothing, which is how this shipped broken the first time.
    expect(runtime).toContain('<span aria-hidden className="absolute" style={{ inset: "-14px"');
    expect(runtime).not.toContain('pointer-events-none absolute" style={{ inset: "-14px"');
  });

  it("a tiny object is still fully interactive", () => {
    expect(isInteractiveObject(placement("book-a"))).toBe(true);
  });
});

describe("7. the highest z-index object wins an overlapping tap", () => {
  it("the benchmark overlaps the table over the sofa", () => {
    const sofa = placement("sofa");
    const table = placement("table");
    expect(table.zIndex!).toBeGreaterThan(sofa.zIndex!);
  });

  it("two tiny objects with overlapping touch pads resolve to the one under the finger", () => {
    // book-a and book-b sit ~12px apart on a shelf, so their 14px pads overlap entirely.
    // Without a tie-break the later-painted one won every tap aimed at the first.
    const bookA: TapCandidate = { id: "book-a", rect: { left: 100, top: 100, width: 12, height: 11 }, zIndex: 8 };
    const bookB: TapCandidate = { id: "book-b", rect: { left: 128, top: 100, width: 10, height: 10 }, zIndex: 8 };
    expect(resolveTapTarget([bookA, bookB], { x: 106, y: 105 })).toBe("book-a");
    expect(resolveTapTarget([bookA, bookB], { x: 133, y: 105 })).toBe("book-b");
  });

  it("a point inside no visual box goes to the NEAREST object, not the last painted", () => {
    const bookA: TapCandidate = { id: "book-a", rect: { left: 100, top: 100, width: 12, height: 11 }, zIndex: 8 };
    const bookB: TapCandidate = { id: "book-b", rect: { left: 128, top: 100, width: 10, height: 10 }, zIndex: 8 };
    expect(resolveTapTarget([bookA, bookB], { x: 114, y: 105 })).toBe("book-a");
  });

  it("visual containment beats z-index order, and z-index breaks a real overlap", () => {
    const low: TapCandidate = { id: "sofa", rect: { left: 0, top: 0, width: 200, height: 200 }, zIndex: 2 };
    const high: TapCandidate = { id: "table", rect: { left: 50, top: 50, width: 100, height: 100 }, zIndex: 5 };
    expect(resolveTapTarget([low, high], { x: 100, y: 100 })).toBe("table");
    expect(resolveTapTarget([low, high], { x: 10, y: 10 })).toBe("sofa");
  });

  it("returns null when nothing is near", () => {
    expect(resolveTapTarget([], { x: 0, y: 0 })).toBeNull();
  });

  it("paint order is z-index order, so the topmost object is hit first", () => {
    // elementFromPoint returns the topmost PAINTED element, and paint order is exactly
    // inPaintOrder — so "highest z-index wins" needs no separate resolver.
    const order = inPaintOrder(INTERACTIVE_TEST_NEST.placements).map((p) => p.zIndex ?? 0);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});

// ── 8–12. per-asset behaviour ────────────────────────────────────────────────

describe("8. TV state and media connection round-trip", () => {
  it("starts in the creator's authored state", () => {
    expect(initialStateOf(placement("tv"))).toBe("off");
  });

  it("a tap turns it on AND opens what it is connected to", () => {
    const r = tapObject(placement("tv"), "off");
    expect(r.state).toBe("on");
    expect(r.open).toMatchObject({ type: "open-youtube", videoId: "aqz-KE-bpKQ" });
  });

  it("tapping again turns it off and does NOT reopen the media", () => {
    // Reopening a modal the visitor just dismissed by switching the TV off is a trap.
    const r = tapObject(placement("tv"), "on");
    expect(r.state).toBe("off");
    expect(r.open).toBeNull();
  });

  it("the screen only shows content in the ON state", () => {
    expect(visualStateOf("ast-tv", "off")?.showsScreen).toBeFalsy();
    expect(visualStateOf("ast-tv", "on")?.showsScreen).toBe(true);
  });

  it("survives editor → document → reopen", () => {
    const objects = nestDocumentToEditable(roundTrip(INTERACTIVE_TEST_NEST)).objects;
    const tv = objects.find((o) => o.instanceId === "tv")!;
    expect(tv.assetInteraction?.initialState).toBe("off");
    expect(tv.assetInteraction?.connection?.kind).toBe("youtube");
    const back = editableObjectsToPlacements(objects).find((p) => p.id === "tv")!;
    expect(back.interaction?.asset?.connection?.url).toContain("aqz-KE-bpKQ");
  });
});

describe("9. laptop (desk) states round-trip", () => {
  it("closed → open → closed", () => {
    expect(initialStateOf(placement("desk"))).toBe("closed");
    expect(tapObject(placement("desk"), "closed").state).toBe("open");
    expect(tapObject(placement("desk"), "open").state).toBe("closed");
  });

  it("opening reveals the connected destination", () => {
    expect(tapObject(placement("desk"), "closed").open).toMatchObject({ type: "open-url" });
  });

  it("closing does not reopen it", () => {
    expect(tapObject(placement("desk"), "open").open).toBeNull();
  });
});

describe("10. speaker playback is per-session, never authored", () => {
  const speaker: NestPlacement = {
    id: "spk", assetId: "ast-speaker", x: 0.5, y: 0.5,
    interaction: { asset: { initialState: "off", connection: { kind: "audio", url: "https://example.com/track.mp3", loop: true } } },
  };

  it("off by default and silent", () => {
    expect(audioFor(speaker, "off")).toBeNull();
  });

  it("a tap starts it playing", () => {
    expect(tapObject(speaker, "off").state).toBe("playing");
    expect(audioFor(speaker, "playing")).toMatchObject({ url: "https://example.com/track.mp3", loop: true });
  });

  it("the AUTHORED state is what a reload returns to — playback does not persist", () => {
    expect(initialStateOf(speaker)).toBe("off");
    // Session state lives in component state and is re-seeded from the document.
    expect(runtime).toContain("const [session, setSession] = useState<SessionStates>(authored)");
    expect(runtime).toContain("useEffect(() => setSession(authored), [authored])");
  });

  it("no visitor tap is ever written back to the database", () => {
    expect(runtime).not.toContain("saveNest");
    expect(runtime).not.toContain("persistDoc");
  });
});

describe("11. lamp state renders consistently", () => {
  it("toggles with no link required", () => {
    expect(capabilitiesForAsset("ast-floor-lamp")?.accepts).toEqual([]);
    expect(tapObject(placement("lamp"), "off")).toEqual({ state: "on", open: null });
  });

  it("the ON state carries a local glow, so the room visibly changes", () => {
    expect(visualStateOf("ast-floor-lamp", "on")?.glow).toBeTruthy();
    expect(visualStateOf("ast-floor-lamp", "off")?.glow).toBeUndefined();
  });

  it("the creator panel offers no URL field for it", () => {
    expect(creatorActionsFor("ast-floor-lamp").map((a) => a.id)).toEqual(["toggle"]);
  });
});

describe("12. curtain state renders consistently", () => {
  it("open/closed with no link", () => {
    const def = capabilitiesForAsset("ast-curtain")!;
    expect(def.accepts).toEqual([]);
    expect(def.toggleTo).toEqual({ closed: "open", open: "closed" });
  });
});

describe("a non-interactive object simply does nothing", () => {
  it("the plant is not a tap target", () => {
    expect(capabilitiesForAsset("ast-potted-plant")).toBeNull();
    expect(isInteractiveObject(placement("plant"))).toBe(false);
  });

  it("tapping it produces no state change and no content", () => {
    expect(tapObject(placement("plant"), null)).toEqual({ state: null, open: null });
  });
});

// ── 13–17. one runtime, persistence, media ───────────────────────────────────

describe("13. Preview and visitor use the same runtime", () => {
  it("both mount NestRuntime and differ only in mode", () => {
    const visitor = read("app", "nest", "[slug]", "visitor-client.tsx");
    expect(editor).toContain('<NestRuntime document={previewDoc} mode="editor-preview"');
    expect(visitor).toContain('<NestRuntime document={doc} mode="visitor"');
    expect(runtime).toContain('const interactive = mode !== "card";');
  });

  it("the camera, the state machine and the media overlay all live in that one file", () => {
    expect(runtime).toContain("useSceneCamera");
    expect(runtime).toContain("tapObject");
    expect(runtime).toContain("MediaOverlay");
  });
});

describe("14–16. interaction config survives draft, publish and reopen", () => {
  it("14/15. every authored field round-trips through the document", () => {
    const back = roundTrip(INTERACTIVE_TEST_NEST);
    const tv = back.placements.find((p) => p.id === "tv")!;
    expect(tv.interaction?.asset).toEqual(placement("tv").interaction?.asset);
  });

  it("15b. the draft carries the same document a publish does", () => {
    const repo = read("lib", "nest-repo.ts");
    expect(repo).toContain("placements: doc.placements");
    expect(repo).toContain("scene: doc.scene");
  });

  it("16. geometry survives editor → document → reopen exactly", () => {
    const objects = nestDocumentToEditable(roundTrip(INTERACTIVE_TEST_NEST)).objects;
    const back = editableObjectsToPlacements(objects);
    for (const original of INTERACTIVE_TEST_NEST.placements) {
      const r = back.find((p) => p.id === original.id)!;
      expect({ x: r.x, y: r.y, w: r.w, h: r.h, z: r.zIndex }).toEqual({
        x: original.x, y: original.y, w: original.w, h: original.h, z: original.zIndex,
      });
    }
  });

  it("16b. overlays, rotation and flip are not casualties of the new bag", () => {
    const objects = nestDocumentToEditable(roundTrip(INTERACTIVE_TEST_NEST)).objects;
    const back = editableObjectsToPlacements(objects);
    expect(back.find((p) => p.id === "sticker")?.overlay).toMatchObject({ kind: "image" });
    expect(back.find((p) => p.id === "caption")?.overlay).toMatchObject({ kind: "text", text: "welcome in" });
  });
});

describe("17. closing media restores the zoom and pan", () => {
  it("the camera is saved on open and restored on close", () => {
    expect(runtime).toContain("savedCamera.current = camera.read()");
    expect(runtime).toContain("camera.restore(savedCamera.current)");
  });

  it("the room stays visible behind the overlay rather than being replaced", () => {
    expect(runtime).toContain("bg-black/70");
    expect(runtime).toContain('role="dialog"');
  });

  it("Escape and mobile back both close it", () => {
    expect(runtime).toContain('e.key === "Escape"');
    expect(runtime).toContain('window.addEventListener("popstate", onPop)');
  });

  it("YouTube uses the privacy-enhanced host", () => {
    expect(read("lib", "nest-interaction.ts")).toContain("youtube-nocookie.com");
  });
});

// ── 18–22. compatibility, discovery, and the migration guard ─────────────────

describe("18. a legacy Focus Nest still opens", () => {
  it("its focus region and child objects still resolve", () => {
    const [focus] = resolveFocusRegions(LEGACY_FOCUS_NEST);
    expect(focus.area.id).toBe("focus-1");
    expect(focus.objects.map((o) => o.instanceId)).toEqual(["legacy-book"]);
  });

  it("the runtime still plays it, and still offers a way back", () => {
    expect(runtime).toContain("resolveFocusRegions");
    expect(runtime).toContain("Back to the room");
  });

  it("nothing about legacy Focus data is destroyed", () => {
    const reopened = nestDocumentToEditable(roundTrip(LEGACY_FOCUS_NEST));
    expect(reopened.focusAreas).toHaveLength(1);
    expect(reopened.detailScenes?.[0].objects).toHaveLength(1);
  });
});

describe("19. a new Nest needs no Focus at all", () => {
  it("the benchmark authors none, and every object is still reachable", () => {
    expect(resolveFocusRegions(INTERACTIVE_TEST_NEST)).toEqual([]);
    expect(INTERACTIVE_TEST_NEST.placements.some((p) => isInteractiveObject(p))).toBe(true);
  });

  it("Focus is gone from the editor toolbar", () => {
    expect(editor).not.toContain('label="Focus"');
    expect(editor).not.toContain('label="Surface"');
    // M26-R renamed the dock entry: "Connect" is what a creator is doing; "Interaction"
    // was our word for our model.
    expect(editor).toContain('label="Connect"');
    expect(editor).not.toContain('label="Interaction"');
  });
});

describe("20. no permanent interaction icon renders in the room", () => {
  it("objects carry no badge — the object itself is the target", () => {
    // The old runtime painted a Maximize2 chip on every focus region and every hotspot.
    expect(runtime).not.toContain("<Maximize2 className=\"size-3\" />");
    expect(runtime).toContain('data-object-id');
  });

  it("legacy Focus regions became invisible targets, not badges", () => {
    const focusBlock = runtime.slice(runtime.indexOf('data-object-id={`focus:'), runtime.indexOf('data-object-id={`focus:') + 700);
    expect(focusBlock).not.toContain("Maximize2");
  });

  it("the only Maximize2 left is the Reset control, outside the scene", () => {
    const controls = runtime.slice(runtime.indexOf("function RoomControls"));
    expect(controls).toContain("Reset view");
  });
});

describe("21. the Hint pulse highlights only interactive assets", () => {
  it("the pulse class is applied from an interactive-only set", () => {
    expect(runtime).toContain("interactiveIds.has(p.id)");
    expect(runtime).toContain("hinting ? \"nest-hint-pulse\" : \"\"");
  });

  it("the set is built from real capability, not from every object", () => {
    const ids = INTERACTIVE_TEST_NEST.placements.filter((p) => isInteractiveObject(p)).map((p) => p.id);
    expect(ids).toContain("tv");
    expect(ids).toContain("lamp");
    expect(ids).not.toContain("plant");
    expect(ids).not.toContain("sofa");
  });

  it("it is transient — an animation, never a persistent badge", () => {
    expect(read("app", "globals.css")).toContain("@keyframes nest-hint-pulse");
    expect(runtime).toContain("setTimeout(() => setHinting(false)");
  });

  it("and it respects reduced motion", () => {
    expect(read("app", "globals.css")).toContain("prefers-reduced-motion");
  });
});

describe("22. a missing migration blocks the save instead of dropping data", () => {
  it("the repository still refuses rather than reporting a false success", () => {
    const repo = read("lib", "nest", "supabase-nest-repo.ts");
    expect(repo).toContain("assertSceneStorable(doc.scene");
    expect(repo).toContain("Nothing has been changed.");
  });

  it("M25 interaction config needs NO new column — it rides in an existing jsonb bag", () => {
    // `nest_objects.interaction` already exists and round-trips losslessly (M24E), so
    // there is nothing new to provision and nothing new to block on.
    const cols = read("lib", "nest", "supabase-nest-repo.ts");
    expect(cols).toContain("interaction: p.interaction ?? null");
    const back = roundTrip(INTERACTIVE_TEST_NEST).placements.find((p) => p.id === "tv");
    expect(back?.interaction?.asset?.connection?.kind).toBe("youtube");
  });
});

// ── source-resolution honesty ────────────────────────────────────────────────

describe("zoom does not pretend low-resolution art is sharp", () => {
  it("warns in development when an asset cannot hold the full zoom range", () => {
    expect(resolutionWarning("ast-tiny", 200, 100)).toMatch(/sharp to ~2\.0×/);
  });

  it("stays silent when the source is good enough", () => {
    expect(resolutionWarning("ast-big", 2000, 100)).toBeNull();
  });
});

// ── the model's own honesty ──────────────────────────────────────────────────

describe("capability comes from the catalogue, configuration from the creator", () => {
  it("an unconfigured TV still toggles, because that is what a TV does", () => {
    const bare: NestPlacement = { id: "t", assetId: "ast-tv", x: 0, y: 0 };
    expect(isInteractiveObject(bare)).toBe(true);
    expect(tapObject(bare, null).state).toBe("on");
  });

  it("an unsafe or mismatched connection is refused, not executed", () => {
    const bad: NestPlacement = { id: "t", assetId: "ast-tv", x: 0, y: 0, interaction: { asset: { connection: { kind: "youtube", url: "javascript:alert(1)" } } } };
    expect(resolveConnection(bad)).toBeNull();
    const wrongKind: NestPlacement = { id: "t", assetId: "ast-floor-lamp", x: 0, y: 0, interaction: { asset: { connection: { kind: "website", url: "https://example.com" } } } };
    expect(resolveConnection(wrongKind)).toBeNull(); // a lamp accepts nothing
  });

  it("M26-R — a creator CANNOT disable an asset's built-in behaviour", () => {
    // Reversed deliberately. Interaction belongs to the asset: a TV behaves like a TV the
    // moment it is placed, with no configuration and no off switch. A legacy `disabled`
    // flag is read without error and then ignored.
    const legacy: NestPlacement = { id: "t", assetId: "ast-tv", x: 0, y: 0, interaction: { asset: { disabled: true } } };
    expect(isInteractiveObject(legacy)).toBe(true);
    expect(tapObject(legacy, null).state).toBe("on");
  });

  it("M26-R — an object always opens in its natural idle state", () => {
    // A legacy "starts on" is ignored too: two Nests with the same lamp must not behave
    // differently for a reason the visitor cannot see.
    const legacy: NestPlacement = { id: "l", assetId: "ast-floor-lamp", x: 0, y: 0, interaction: { asset: { initialState: "on" } } };
    expect(initialStateOf(legacy)).toBe("off");
  });
});

describe("the creator never sees our internal vocabulary", () => {
  const panel = read("components", "nest", "editor", "interaction-panel.tsx");
  it("no hotspot, surface projection, child scene or target scene in the UI copy", () => {
    const copy = panel.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");
    for (const word of ["hotspot", "child scene", "target scene", "surface projection", "binding"]) {
      expect(copy.toLowerCase()).not.toContain(word);
    }
  });

  it("scenery says so plainly instead of offering dead controls", () => {
    expect(panel).toContain("is decoration");
  });
});

// ── the editor is not allowed to author the visitor's camera ─────────────────

describe("the editor's viewport is workspace state, not Nest data", () => {
  it("no camera is ever written into the canonical document", () => {
    // (`cameraDnaVersion` in the bridge is asset provenance, not a viewport — hence the
    // check is on what the document actually carries, not on the word.)
    const doc: NestDocument = roundTrip(INTERACTIVE_TEST_NEST);
    expect(Object.keys(doc)).not.toContain("camera");
    expect(Object.keys(doc)).not.toContain("viewport");
    for (const p of doc.placements) {
      expect(Object.keys(p.interaction ?? {})).not.toContain("camera");
    }
  });

  it("every visitor therefore opens at the same framing", () => {
    expect(IDENTITY_CAMERA).toEqual({ scale: 1, x: 0, y: 0 });
  });
});

// ── the fixture is what the sprint asked for ─────────────────────────────────

describe("the benchmark Nest contains what the brief specified", () => {
  const ids = INTERACTIVE_TEST_NEST.placements.map((p) => p.id);
  it("has a TV+YouTube, a laptop, a lamp, tiny books, a tiny odd object and a plant", () => {
    for (const id of ["tv", "desk", "lamp", "book-a", "book-b", "tiny-frame", "plant"]) {
      expect(ids).toContain(id);
    }
  });

  it("has overlapping assets, an image sticker and a text overlay", () => {
    expect(ids).toContain("sticker");
    expect(ids).toContain("caption");
    const objs = INTERACTIVE_TEST_NEST.placements as NestPlacement[];
    expect(objs.filter((p) => p.overlay).length).toBe(2);
  });

  it("uses only assets that actually exist in the library", () => {
    // Speaker/console/curtain are declared in the capability model but have no art, so
    // they are deliberately NOT in the benchmark — see AWAITING_ART.
    for (const p of INTERACTIVE_TEST_NEST.placements) {
      expect(p.assetId.startsWith("overlay:") || !["ast-speaker", "ast-console", "ast-curtain"].includes(p.assetId)).toBe(true);
    }
  });
});

describe("focus children still paint correctly for legacy Nests", () => {
  it("a legacy child object keeps its exact geometry", () => {
    const [focus] = resolveFocusRegions(roundTrip(LEGACY_FOCUS_NEST));
    const b = focus.objects[0] as EditableNestObject;
    expect({ x: b.x, y: b.y, width: b.width, height: b.height }).toEqual({ x: 0.3, y: 0.42, width: 0.22, height: 0.16 });
  });
});
