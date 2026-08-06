import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAMERA_MAX_SCALE, IDENTITY_CAMERA, panBy, zoomAround, type Camera } from "@/lib/nest-camera";
import { editableObjectsToPlacements, nestDocumentToEditable } from "@/lib/nest-editor-bridge";
import { safeUrl, youTubeVideoId } from "@/lib/nest-interaction";
import { resolveConnection, tapObject } from "@/lib/nest-asset-interaction";
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

  it("the Interaction panel's own inputs are 16px explicitly", () => {
    const inputs = panel.split("<input\n").slice(1); // real JSX elements, not prose
    expect(inputs.length).toBe(2);
    for (const i of inputs) expect(i.slice(0, 900)).toContain("text-base");
  });

  it("the sticky action stays above the keyboard without a viewport hack", () => {
    expect(panel).toContain("sticky bottom-0");
    expect(panel).toContain("env(safe-area-inset-bottom)");
  });
});

// ── P4. Save interaction actually saves ──────────────────────────────────────

describe("P4. Save interaction", () => {
  const tv: NestPlacement = { id: "tv", assetId: "ast-tv", x: 0.3, y: 0.3, w: 0.3, h: 0.2 };
  const withConn = (kind: "youtube" | "website" | "image", url: string): NestPlacement => ({
    ...tv,
    interaction: { asset: { initialState: "off", connection: { kind, url } } },
  });

  it("accepts a standard YouTube URL", () => {
    expect(youTubeVideoId("https://www.youtube.com/watch?v=aqz-KE-bpKQ")).toBe("aqz-KE-bpKQ");
    expect(resolveConnection(withConn("youtube", "https://www.youtube.com/watch?v=aqz-KE-bpKQ"))?.kind).toBe("youtube");
  });

  it("accepts a youtu.be short URL", () => {
    expect(youTubeVideoId("https://youtu.be/aqz-KE-bpKQ")).toBe("aqz-KE-bpKQ");
    expect(resolveConnection(withConn("youtube", "https://youtu.be/aqz-KE-bpKQ"))).toBeTruthy();
  });

  it("accepts a YouTube Shorts URL", () => {
    // The founder's list names Shorts explicitly.
    expect(youTubeVideoId("https://www.youtube.com/shorts/aqz-KE-bpKQ")).toBe("aqz-KE-bpKQ");
    expect(resolveConnection(withConn("youtube", "https://www.youtube.com/shorts/aqz-KE-bpKQ"))).toBeTruthy();
  });

  it("accepts website and image links", () => {
    expect(resolveConnection(withConn("website", "https://example.com/about"))?.kind).toBe("website");
    expect(resolveConnection(withConn("image", "https://example.com/p.jpg"))?.kind).toBe("image");
  });

  it("refuses an invalid or unsafe link rather than silently doing nothing", () => {
    expect(safeUrl("not a url")).toBeNull();
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(resolveConnection(withConn("website", "javascript:alert(1)"))).toBeNull();
    // …and the panel surfaces it.
    expect(panel).toContain('role="alert"');
    expect(panel).toContain("That link doesn’t look right");
  });

  it("commits the WHOLE config in one object, never two interleaving patches", () => {
    expect(panel).toContain("const next: AssetInteractionConfig | undefined =");
    expect(panel).toContain("commit(next);");
  });

  it("reads its values from refs, so a late iOS onChange cannot be missed", () => {
    expect(panel).toContain("const k = kindRef.current;");
    expect(panel).toContain("const raw = urlRef.current.trim();");
  });

  it("does not re-seed from the document on every commit — that read as 'Save did nothing'", () => {
    // The effect depends ONLY on which object is selected.
    expect(panel).toContain("}, [object.instanceId]);");
    expect(panel).not.toContain("cfg?.connection?.url,");
  });

  it("prevents a duplicate save and confirms visibly", () => {
    expect(panel).toContain("if (saving) return;");
    expect(panel).toContain("disabled={saving}");
    expect(panel).toContain("Saved");
  });

  it("is called Save interaction, not Save connection", () => {
    expect(panel).toContain('"Save interaction"');
    const copy = panel.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    expect(copy).not.toContain("Save connection");
  });

  it("a connection can be replaced, and removed", () => {
    const replaced = withConn("website", "https://example.com/new");
    expect(resolveConnection(replaced)?.url).toContain("/new");
    const removed: NestPlacement = { ...tv, interaction: { asset: { initialState: "off" } } };
    expect(resolveConnection(removed)).toBeNull();
    expect(panel).toContain("Remove interaction");
  });

  it("switching to Nothing clears the connection but keeps the toggle", () => {
    const only: NestPlacement = { ...tv, interaction: { asset: { initialState: "on" } } };
    expect(resolveConnection(only)).toBeNull();
    expect(tapObject(only, "on").state).toBe("off");
  });

  it("survives save → publish → reopen", () => {
    const doc: NestDocument = { ...INTERACTIVE_TEST_NEST, placements: [withConn("youtube", "https://youtu.be/aqz-KE-bpKQ")] };
    const reopened = nestDocumentToEditable(roundTrip(doc));
    expect(reopened.objects[0].assetInteraction?.connection?.url).toBe("https://youtu.be/aqz-KE-bpKQ");
    const republished = editableObjectsToPlacements(reopened.objects);
    expect(resolveConnection(republished[0])?.kind).toBe("youtube");
  });
});

// ── P5/P6. the redesign, and parity ──────────────────────────────────────────

describe("P5. the sheet reads as a creator flow, not a settings form", () => {
  it("no implementation vocabulary is visible to a creator", () => {
    const copy = panel.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");
    for (const word of ["capability", "binding", "hotspot", "child scene", "target scene", "surface projection", "media type"]) {
      expect(copy.toLowerCase()).not.toContain(word);
    }
  });

  it("behaviour comes first and content is a second step", () => {
    expect(panel).toContain('type Step = "behaviour" | "content"');
    expect(panel).toContain('setStep("content")');
  });

  it("the starting state is a compact toggle, not the dominant section", () => {
    expect(panel).toContain("How it starts");
    expect(panel).toContain("Starts ");
  });

  it("drops the uppercase micro-label styling the old panel leaned on", () => {
    expect(panel).not.toContain("uppercase tracking-[.16em]");
    expect(panel).not.toContain("uppercase tracking-[.18em]");
  });

  it("offers Test interaction, wired to the real Preview runtime", () => {
    expect(panel).toContain("Test");
    expect(editor).toContain("onTest={onPreview}");
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
