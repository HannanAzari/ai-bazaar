import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { editableObjectDisplayContent, placementDisplayContent } from "@/lib/nest-object-display";
import { editableObjectsToPlacements } from "@/lib/nest-editor-bridge";
import { initialStateOf } from "@/lib/nest-asset-interaction";
import { setContentCrop, storedContents } from "@/lib/nest-contents";
import { mediaCropStyle } from "@/lib/nest-media-crop";
import type { AssetInteractionConfig } from "@/lib/nest-asset-interaction";
import type { EditableNestObject } from "@/lib/nest-editor-types";

// ── M28.1 — the crop reaches every surface, and only through one path ────────
//
// The failure this guards against is the one M27B-1 already cost a sprint to: two surfaces
// answering the same question separately and drifting. A crop that Edit honoured and the
// visitor Nest ignored would be exactly that bug wearing new clothes.

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");

/**
 * A file with its comments removed.
 *
 * The structural assertions below are about what the CODE does. Asserting over the raw text
 * makes a file's own explanation of what it must never do — "nothing here touches the
 * camera" — read as evidence that it does, which is both wrong and an incentive to write
 * less honest comments.
 */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const canvas = read("components", "nest", "editor", "editor-canvas.tsx");
const runtime = read("components", "nest", "app-shell", "nest-runtime.tsx");
const gallery = read("components", "nest", "app-shell", "nest-photo-gallery.tsx");
const card = read("components", "nest", "app-shell", "nest-card.tsx");
const preview = read("components", "nest", "app-shell", "nest-preview.tsx");

const CROP = { x: 0.2, y: 0.8, zoom: 1.6 };
const PHOTO = { kind: "image" as const, url: "https://s.test/a.jpg", storagePath: "u/n/o/a.jpg" };
const PHOTO_B = { kind: "image" as const, url: "https://s.test/b.jpg", storagePath: "u/n/o/b.jpg" };

const obj = (config: AssetInteractionConfig): EditableNestObject =>
  ({
    instanceId: "o1",
    assetId: "ast-framed-photo",
    x: 0.2,
    y: 0.2,
    width: 0.2,
    height: 0.2,
    anchor: { x: 0.3, y: 0.4 },
    plane: "front_wall",
    zIndex: 3,
    assetInteraction: config,
  }) as unknown as EditableNestObject;

// ── §4 — rendering parity ────────────────────────────────────────────────────

describe("§4 — the same crop in Edit, Preview and the visitor Nest", () => {
  const config: AssetInteractionConfig = { contents: [{ ...PHOTO, crop: CROP }] };

  it("Edit resolves the crop", () => {
    expect(editableObjectDisplayContent(obj(config))?.crop).toEqual(CROP);
  });

  it("the published placement resolves the identical crop", () => {
    const [p] = editableObjectsToPlacements([obj(config)]);
    expect(placementDisplayContent(p, initialStateOf(p), "runtime")?.crop).toEqual(CROP);
  });

  it("Edit and the visitor produce the very same CSS, not merely similar values", () => {
    const [p] = editableObjectsToPlacements([obj(config)]);
    const edit = mediaCropStyle(editableObjectDisplayContent(obj(config))?.crop);
    const visit = mediaCropStyle(placementDisplayContent(p, initialStateOf(p), "runtime")?.crop);
    expect(edit).toEqual(visit);
    expect(edit).toEqual({ objectPosition: "20% 80%", transform: "scale(1.6)", transformOrigin: "20% 80%" });
  });

  it("each item in a list carries its OWN crop", () => {
    const many: AssetInteractionConfig = { contents: [{ ...PHOTO, crop: CROP }, PHOTO_B] };
    const [p] = editableObjectsToPlacements([obj(many)]);
    expect(placementDisplayContent(p, initialStateOf(p), "runtime", 0)?.crop).toEqual(CROP);
    // The second photo was never adjusted and must stay untouched — a per-object crop
    // would have leaked the first photo's framing onto it.
    expect(placementDisplayContent(p, initialStateOf(p), "runtime", 1)?.crop).toBeUndefined();
  });

  it("a photo published before M28.1 renders with no crop style at all", () => {
    const [p] = editableObjectsToPlacements([obj({ connection: PHOTO })]);
    const display = placementDisplayContent(p, initialStateOf(p), "runtime");
    expect(display?.src).toBe(PHOTO.url);
    expect(display?.crop).toBeUndefined();
    expect(mediaCropStyle(display?.crop)).toEqual({});
  });

  it("a corrupt stored crop is clamped at the boundary, never passed through raw", () => {
    const bad = { contents: [{ ...PHOTO, crop: { x: 40, y: -2, zoom: 500 } }] } as AssetInteractionConfig;
    const [p] = editableObjectsToPlacements([obj(bad)]);
    expect(placementDisplayContent(p, initialStateOf(p), "runtime")?.crop).toEqual({ x: 1, y: 0, zoom: 4 });
  });
});

// ── §2 — the stored shape ────────────────────────────────────────────────────

describe("§2 — setContentCrop", () => {
  const two: AssetInteractionConfig = { contents: [PHOTO, PHOTO_B] };

  it("writes the crop onto one item only", () => {
    const next = setContentCrop(two, 0, CROP);
    const list = storedContents(next);
    expect(list[0].crop).toEqual(CROP);
    expect(list[1].crop).toBeUndefined();
  });

  it("never touches the stored file — the original is always what you re-adjust", () => {
    const list = storedContents(setContentCrop(two, 0, CROP));
    expect(list[0].url).toBe(PHOTO.url);
    expect(list[0].storagePath).toBe(PHOTO.storagePath);
  });

  it("Reset removes the field rather than storing the default", () => {
    const adjusted = setContentCrop(two, 0, CROP);
    const reset = setContentCrop(adjusted, 0, { x: 0.5, y: 0.5, zoom: 1 });
    expect(storedContents(reset)[0].crop).toBeUndefined();
    expect("crop" in storedContents(reset)[0]).toBe(false);
  });

  it("clears with null", () => {
    expect(storedContents(setContentCrop(setContentCrop(two, 1, CROP), 1, null))[1].crop).toBeUndefined();
  });

  it("does not change which photo the frame opens on", () => {
    const chosen: AssetInteractionConfig = { contents: [PHOTO, PHOTO_B], activeIndex: 1 };
    expect(setContentCrop(chosen, 0, CROP).activeIndex).toBe(1);
  });

  it("ignores an index that is not there", () => {
    expect(setContentCrop(two, 9, CROP)).toEqual(two);
    expect(setContentCrop(two, -1, CROP)).toEqual(two);
  });

  it("upgrades a legacy single connection on first adjust, like every other edit", () => {
    const legacy: AssetInteractionConfig = { connection: PHOTO };
    const next = setContentCrop(legacy, 0, CROP);
    expect(next.connection).toBeUndefined();
    expect(next.contents?.[0].crop).toEqual(CROP);
  });
});

// ── §4 again, structurally: there is only ONE crop implementation ────────────

describe("§4 — no per-surface crop logic", () => {
  it("both render surfaces apply the shared function", () => {
    expect(canvas).toContain("mediaCropStyle(display.crop)");
    expect(runtime).toContain("mediaCropStyle(display?.crop)");
  });

  it("neither surface hand-rolls object-position or a scale transform", () => {
    // If this fails, someone has started a second renderer. That is the M27B-1 bug.
    for (const source of [code(canvas), code(runtime)]) {
      expect(source).not.toMatch(/objectPosition:\s*`/);
      expect(source).not.toMatch(/transform:\s*`scale\(/);
    }
  });
});

// ── §5/§6 — the gallery ──────────────────────────────────────────────────────

describe("§5/§6 — the gallery holds no index of its own", () => {
  it("takes its index and every change as props", () => {
    expect(gallery).toContain("index,");
    expect(gallery).toContain("onStep");
    // A `useState` holding a cursor here would be the second playlist state §6 forbids.
    expect(gallery).not.toMatch(/useState[^\n]*[Ii]ndex/);
  });

  it("steps through the runtime's one session map", () => {
    expect(runtime).toContain("const stepGallery");
    expect(runtime).toMatch(/setContentIndex\(\(m\) => \(\{ \.\.\.m, \[gallery\.objectId\]/);
  });

  it("shows the photo uncropped and at its own aspect", () => {
    expect(gallery).toContain("object-contain");
    expect(gallery).not.toContain("mediaCropStyle");
  });

  it("dims and blurs the room rather than replacing it", () => {
    expect(gallery).toContain("backdrop-blur");
    expect(gallery).toMatch(/backgroundColor: "rgba\(/);
  });

  it("shows a count only when there is more than one photo", () => {
    expect(gallery).toMatch(/count > 1 \?/);
    expect(gallery).toContain("{index + 1} / {count}");
  });

  it("is not the legacy link modal", () => {
    expect(code(gallery)).not.toContain("MediaOverlay");
    expect(code(gallery)).not.toContain("iframe");
  });
});

describe("§7 — the gallery never touches the room", () => {
  it("does not read, write or restore the camera", () => {
    for (const needle of ["camera", "savedCamera", "useSceneCamera", "restore("]) {
      expect(code(gallery)).not.toContain(needle);
    }
  });

  it("the runtime's gallery block writes only the content index", () => {
    // Bounded by the two ends of the gallery block itself — a fixed-length slice ran on
    // into the legacy MediaOverlay's camera save and reported a failure that was not there.
    const source = code(runtime);
    const from = source.indexOf("const stepGallery");
    const to = source.indexOf("if (gallery && !gallerySrc)");
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    const block = source.slice(from, to);
    expect(block).toContain("setContentIndex");
    expect(block).not.toContain("savedCamera");
    expect(block).not.toContain("setSession");
  });
});

// ── §8/§9 — where the gallery may NOT appear ─────────────────────────────────

describe("§8/§9 — Edit and Home are untouched", () => {
  it("the gallery mounts only in the interactive runtime", () => {
    expect(runtime).toContain("{interactive && gallery && gallerySrc ?");
  });

  it("opening it is gated on the shared display resolver, so a hidden screen opens nothing", () => {
    expect(runtime).toContain('const shown = placementDisplayContent(p, current, "runtime", idx);');
    expect(runtime).toMatch(/if \(shown && list\[idx\]\?\.kind === "image"\)/);
  });

  it("the editor canvas has no gallery and no tap-to-open", () => {
    expect(code(canvas)).not.toContain("NestPhotoGallery");
    expect(code(canvas)).not.toContain("setGallery");
  });

  it("Home still renders an inert card", () => {
    // The feed opts IN to nothing: `NestPreview` defaults to `interactive = false`, and the
    // card never passes the prop. That default is the Home decision M28.1 must not disturb.
    expect(preview).toContain("interactive = false");
    expect(preview).toContain('mode={interactive ? "visitor" : "card"}');
    expect(code(card)).not.toContain("interactive");
  });
});
