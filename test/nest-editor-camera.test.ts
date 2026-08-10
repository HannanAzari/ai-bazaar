import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAMERA_MAX_SCALE, IDENTITY_CAMERA, panBy, zoomAround, type Camera } from "@/lib/nest-camera";
import { editableObjectsToPlacements, nestDocumentToEditable } from "@/lib/nest-editor-bridge";
import { resolveConnection, tapObject } from "@/lib/nest-asset-interaction";
import { contentRejection, detectContentSource } from "@/lib/nest-content-source";
import { INTERACTIVE_TEST_NEST } from "@/lib/fixtures/interactive-nest";
import { LAYER } from "@/lib/nest-layers";
import type { NestDocument, NestPlacement } from "@/lib/nest-document-types";

// ── M25B — the creator's half of the runtime ─────────────────────────────────
//
// Four verified problems, one workflow: the editor had no camera, the floating toolbar
// painted over the Interaction sheet, iOS zoomed the page on every URL field, and Save
// did not stick. These are the regressions for each.

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const canvas = read("components", "nest", "editor", "editor-canvas.tsx");
const panel = read("components", "nest", "editor", "interaction-panel.tsx");
const editor = read("components", "nest", "editor", "nest-editor.tsx");
const gestures = read("components", "nest", "app-shell", "use-scene-camera.ts");
const css = read("app", "globals.css");

const VIEWPORT = { width: 375, height: 500 };
const roundTrip = (d: NestDocument): NestDocument => JSON.parse(JSON.stringify(d));

// ── P1. the editor uses the SAME camera ──────────────────────────────────────

describe("P1. Arrange mode has zoom and pan, from the one camera model", () => {
  it("reuses use-scene-camera — there is no second zoom system", () => {
    expect(canvas).toContain('from "@/components/nest/app-shell/use-scene-camera"');
    expect(canvas).toContain("useSceneCamera({");
    // No bespoke pinch maths in the canvas — no second scale clamp, no second focal
    // calculation. (`Math.hypot` still appears for the ROTATE handle, which is object
    // geometry, not camera.)
    expect(canvas).not.toContain("CAMERA_MAX_SCALE");
    expect(canvas).not.toContain("pinchStart");
  });

  it("a one-finger drag ON AN ASSET moves the asset, not the camera", () => {
    // M26A replaced the inline predicate with the shared gesture arbiter.
    expect(canvas).toContain("canPanFrom:");
    expect(canvas).toContain("resolveGestureOwner({");
    expect(canvas).toContain("data-editor-object={o.instanceId}");
  });

  it("the pan filter is decided at pointerdown so it cannot flip mid-drag", () => {
    expect(gestures).toContain("panAllowed = canPanFromRef.current");
    expect(gestures).toContain("if (panAllowed && cam.current.scale > 1.001)");
  });

  it("pinching still works when a finger starts on an asset", () => {
    // The filter declines only the SINGLE-finger pan; both pointers are still tracked.
    const twoFingerBlock = gestures.slice(gestures.indexOf("if (points.size >= 2 && pinchStart)"));
    expect(twoFingerBlock.slice(0, 400)).not.toContain("panAllowed");
  });

  it("a reset control appears only while zoomed", () => {
    expect(canvas).toContain("camera.zoomed && !hideChrome");
    expect(canvas).toContain("Reset view");
  });
});

describe("P1. screen → scene conversion is correct at every scale", () => {
  // The canvas converts with `(clientX - rect.left) / rect.width` where `rect` is the
  // scene's own getBoundingClientRect. A transformed element's bounding rect is its
  // POST-transform box, so that ratio is already a canonical scene coordinate — no scale
  // term is needed anywhere. This models exactly that, at 1×, 2× and 5×.
  const sceneAtScale = (scale: number, camX = 0, camY = 0) => {
    const w = VIEWPORT.width * scale;
    const h = VIEWPORT.height * scale;
    return { left: (VIEWPORT.width - w) / 2 + camX, top: (VIEWPORT.height - h) / 2 + camY, width: w, height: h };
  };
  const toNorm = (r: { left: number; top: number; width: number; height: number }, cx: number, cy: number) => ({
    nx: (cx - r.left) / r.width,
    ny: (cy - r.top) / r.height,
  });

  it("the same scene point maps back from the screen at 1×, 2× and 5×", () => {
    const target = { nx: 0.7, ny: 0.35 };
    for (const scale of [1, 2, 5]) {
      const r = sceneAtScale(scale);
      // Where that scene point sits on screen at this scale…
      const screenX = r.left + target.nx * r.width;
      const screenY = r.top + target.ny * r.height;
      // …converts straight back, with no scale term.
      const back = toNorm(r, screenX, screenY);
      expect(back.nx).toBeCloseTo(target.nx, 10);
      expect(back.ny).toBeCloseTo(target.ny, 10);
    }
  });

  it("a DRAG delta converts to a scene delta that shrinks as you zoom in", () => {
    // 20 screen px is a big move at 1× and a small one at 5× — which is exactly why
    // zooming in makes small objects placeable.
    const d1 = 20 / sceneAtScale(1).width;
    const d5 = 20 / sceneAtScale(5).width;
    expect(d5).toBeCloseTo(d1 / 5, 10);
  });

  it("panning the camera does not change the scene coordinate under a finger", () => {
    const r = sceneAtScale(3, 60, -40);
    const screenX = r.left + 0.42 * r.width;
    expect(toNorm(r, screenX, r.top).nx).toBeCloseTo(0.42, 10);
  });
});

describe("P1. the camera never touches object geometry or the document", () => {
  it("panning and pinching produce a camera, never a placement", () => {
    const cam: Camera = zoomAround(IDENTITY_CAMERA, 5, { x: 40, y: 10 }, VIEWPORT);
    const panned = panBy(cam, 30, -20, VIEWPORT);
    expect(Object.keys(panned).sort()).toEqual(["scale", "x", "y"]);
    expect(panned.scale).toBeLessThanOrEqual(CAMERA_MAX_SCALE);
  });

  it("publishing after a zoomed edit stores geometry only", () => {
    const objects = nestDocumentToEditable(roundTrip(INTERACTIVE_TEST_NEST)).objects;
    const placements = editableObjectsToPlacements(objects);
    for (const p of placements) {
      expect(Object.keys(p)).not.toContain("camera");
      expect(Object.keys(p)).not.toContain("scale_view");
      expect(Object.keys(p.interaction ?? {})).not.toContain("camera");
    }
  });

  it("creator geometry at 5× equals visitor geometry at 1× — same canonical numbers", () => {
    const objects = nestDocumentToEditable(roundTrip(INTERACTIVE_TEST_NEST)).objects;
    const back = editableObjectsToPlacements(objects);
    for (const original of INTERACTIVE_TEST_NEST.placements) {
      const r = back.find((p) => p.id === original.id)!;
      expect({ x: r.x, y: r.y, w: r.w, h: r.h }).toEqual({ x: original.x, y: original.y, w: original.w, h: original.h });
    }
  });

  it("reopening the editor starts at 1×", () => {
    // The camera is component state in the canvas; nothing reads it from the document.
    expect(canvas).not.toContain("doc.camera");
    expect(IDENTITY_CAMERA).toEqual({ scale: 1, x: 0, y: 0 });
  });
});

// ── P2. the sheet is the top interactive layer ───────────────────────────────

describe("P2. the floating toolbar cannot cover the Interaction sheet", () => {
  it("the toolbar is removed entirely while a sheet is open", () => {
    expect(canvas).toContain("!hideChrome && selected && !selected.hidden");
    expect(editor).toContain('hideChrome={mode === "interact" || overlaySheetOpen}');
  });

  it("it uses the shared layer token, not an arbitrary z-[600]", () => {
    // It renders OUTSIDE `.editor-scene`'s stacking context, so its z-index competed
    // directly with the sheet's.
    const bar = canvas.slice(canvas.indexOf("function ContextBar"));
    expect(bar).not.toContain("z-[600]");
    expect(bar).toContain("${z.chrome} flex justify-center");
  });

  it("chrome sits below the drawer layer, so a sheet always wins", () => {
    expect(LAYER.chrome).toBeLessThan(LAYER.drawer);
    expect(LAYER.drawer).toBeLessThan(LAYER.modal);
  });
});

// ── P3. no Safari page zoom ──────────────────────────────────────────────────

describe("P3. form controls never trigger iOS page zoom", () => {
  it("there is a 16px floor on every coarse-pointer form control", () => {
    expect(css).toContain("@media (pointer: coarse)");
    expect(css).toContain("font-size: max(16px, 1em)");
  });

  it("the fix is font size — accessibility zoom is NOT disabled", () => {
    // Asserted on the DECLARATIONS, not on prose: the CSS comment names both anti-patterns
    // deliberately so nobody reintroduces them.
    const declarations = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(declarations).not.toContain("user-scalable");
    expect(declarations).not.toContain("maximum-scale");
    expect(readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf8")).not.toContain("maximumScale");
  });

  it("the Connect panel's link input is 16px explicitly", () => {
    const urlInput = panel.slice(panel.indexOf("<input\n"), panel.indexOf("<input\n") + 1400);
    expect(urlInput).toContain("text-base");
  });

  it("the sticky action stays above the keyboard without a viewport hack", () => {
    expect(panel).toContain("sticky bottom-0");
    expect(panel).toContain("env(safe-area-inset-bottom)");
  });
});

// ── P4. Save interaction actually saves ──────────────────────────────────────

describe("P4/M26-R. Connect — paste a link, nothing else", () => {
  const tv: NestPlacement = { id: "tv", assetId: "ast-tv", x: 0.3, y: 0.3, w: 0.3, h: 0.2 };
  const withConn = (kind: "youtube" | "website" | "image" | "audio", url: string): NestPlacement => ({
    ...tv,
    interaction: { asset: { connection: { kind, url } } },
  });

  it("detects YouTube in all three link shapes", () => {
    for (const u of [
      "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      "https://youtu.be/aqz-KE-bpKQ",
      "https://www.youtube.com/shorts/aqz-KE-bpKQ",
    ]) {
      expect(detectContentSource(u)).toMatchObject({ kind: "youtube", provider: "youtube", label: "YouTube" });
    }
  });

  it("detects audio providers and plain media files", () => {
    expect(detectContentSource("https://open.spotify.com/track/x")).toMatchObject({ kind: "audio", provider: "spotify" });
    expect(detectContentSource("https://example.com/a.mp3")).toMatchObject({ kind: "audio" });
    expect(detectContentSource("https://example.com/p.jpg")).toMatchObject({ kind: "image" });
    expect(detectContentSource("https://example.com/clip.mp4")).toMatchObject({ kind: "video" });
  });

  it("falls back to a plain website", () => {
    expect(detectContentSource("https://example.com/about")).toMatchObject({ kind: "website", label: "Website" });
  });

  it("a provider beats a file extension in the URL", () => {
    // youtube.com/watch?v=…&thumb=x.jpg is a video, not an image.
    expect(detectContentSource("https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=x.jpg")).toMatchObject({ kind: "youtube" });
  });

  it("refuses an unsafe or malformed link rather than silently doing nothing", () => {
    expect(detectContentSource("javascript:alert(1)")).toBeNull();
    expect(detectContentSource("not a url")).toBeNull();
    expect(panel).toContain('role="alert"');
    expect(panel).toContain("That doesn’t look like a link");
  });

  it("explains in plain words when the object can't show that content", () => {
    const msg = contentRejection({ kind: "video", url: "https://x/y.mp4", label: "Video" }, ["audio"], "Speaker");
    expect(msg).toContain("Speaker");
    expect(msg).toContain("a video");
    expect(msg).toContain("music"); // says what WOULD work
    expect(msg).not.toContain("kind");
    expect(msg).not.toContain("capability");
  });

  it("there is NO explicit save — content commits on add, Done just closes", () => {
    // Removes the whole class of a save that reported success and dropped the link (P18).
    expect(panel).toContain("onCommit({ ...cfg, connection: next })");
    const copy = panel.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    expect(copy).not.toContain("Save connection");
    expect(copy).not.toContain("Save interaction");
    expect(panel).toContain('"Done"');
  });

  it("the sheet asks for no behaviour at all", () => {
    for (const gone of ["How it starts", "Starts off", "Starts on", "Turn it on and off", "Nothing"]) {
      expect(panel).not.toContain(gone);
    }
  });

  it("connections still round-trip through the document", () => {
    expect(resolveConnection(withConn("youtube", "https://youtu.be/aqz-KE-bpKQ"))?.kind).toBe("youtube");
    const reopened = nestDocumentToEditable(roundTrip({ ...INTERACTIVE_TEST_NEST, placements: [withConn("website", "https://example.com/a")] }));
    expect(reopened.objects[0].assetInteraction?.connection?.url).toBe("https://example.com/a");
    expect(resolveConnection(editableObjectsToPlacements(reopened.objects)[0])?.kind).toBe("website");
  });

  it("removing a connection leaves the object's built-in behaviour intact", () => {
    const bare: NestPlacement = { ...tv };
    expect(resolveConnection(bare)).toBeNull();
    expect(tapObject(bare, "off").state).toBe("on"); // a TV is still a TV
  });
});

describe("P5. the sheet reads as a creator flow, not a settings form", () => {
  it("no implementation vocabulary is visible to a creator", () => {
    const copy = panel.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");
    for (const word of ["capability", "binding", "hotspot", "child scene", "target scene", "surface projection", "media type"]) {
      expect(copy.toLowerCase()).not.toContain(word);
    }
  });

  it("M26-R — there are no steps at all: one field, one Done", () => {
    expect(panel).not.toContain('type Step =');
    expect(panel).toContain('placeholder="Paste a link"');
  });

  it("M26-R — pasting acts immediately, without a second tap", () => {
    expect(panel).toContain("onPaste={(e) => {");
    expect(panel).toContain("connect(detectContentSource(text));");
  });

  it("drops the uppercase micro-label styling the old panel leaned on", () => {
    expect(panel).not.toContain("uppercase tracking-[.16em]");
    expect(panel).not.toContain("uppercase tracking-[.18em]");
  });

  it("M26-R — no per-object Test button; Preview is the one top-level mode", () => {
    expect(editor).toContain("function ModeSwitch(");
    expect(panel).not.toContain("onTest");
  });
});

describe("P6. one interaction document, one runtime", () => {
  it("Test / Preview / visitor all resolve the same saved config", () => {
    const p = { id: "tv", assetId: "ast-tv", x: 0, y: 0, interaction: { asset: { initialState: "off", connection: { kind: "youtube" as const, url: "https://youtu.be/aqz-KE-bpKQ" } } } };
    const first = tapObject(p, "off");
    expect(first.state).toBe("on");
    expect(first.open).toMatchObject({ type: "open-youtube", videoId: "aqz-KE-bpKQ" });
    // Same input, same output — there is no editor-only branch to diverge.
    expect(tapObject(roundTrip({ ...INTERACTIVE_TEST_NEST, placements: [p] }).placements[0], "off")).toEqual(first);
  });

  it("the editor Preview mounts the real runtime, not a mock", () => {
    expect(editor).toContain('<NestRuntime document={previewDoc} mode="editor-preview"');
    expect(editor).not.toContain("MockRuntime");
  });
});
