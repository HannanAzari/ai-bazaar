import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  connectionForEditableObject,
  editableObjectDisplayContent,
  placementDisplayContent,
  resolveObjectDisplayContent,
} from "@/lib/nest-object-display";
import { editableObjectsToPlacements } from "@/lib/nest-editor-bridge";
import { initialStateOf, resolveConnection, tapObject } from "@/lib/nest-asset-interaction";
import { youTubeThumbnailUrl, youTubeVideoId } from "@/lib/nest-interaction";
import type { EditableNestObject } from "@/lib/nest-editor-types";

// ── M27B-1 — connected content is VISIBLE, everywhere ────────────────────────
//
// P0 found the editor and the runtime answering "what appears inside this object?" through
// different systems:
//
//   • the RUNTIME read `interaction.asset.connection` and drew it into the asset's aperture;
//   • the EDITOR read `object.surfaces` (the separate M8 store) and never mentioned
//     `connection` at all.
//
// So an uploaded photo appeared in Preview and not in Edit. And a YouTube connection drew
// nothing anywhere, because the runtime's inline expression was
//
//     connection?.thumbnailUrl ?? (kind === "image" ? url : undefined)
//
// — YouTube has neither, even though `youTubeVideoId()` had already parsed and validated
// the id purely to decide the connection was usable, and then thrown it away.

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const canvas = read("components", "nest", "editor", "editor-canvas.tsx");
const runtime = read("components", "nest", "app-shell", "nest-runtime.tsx");

const obj = (assetId: string, connection: Record<string, unknown>): EditableNestObject =>
  ({
    instanceId: "o1",
    assetId,
    x: 0.2,
    y: 0.2,
    width: 0.2,
    height: 0.2,
    anchor: { x: 0.3, y: 0.4 },
    plane: "front_wall",
    zIndex: 3,
    assetInteraction: { connection },
  }) as unknown as EditableNestObject;

const PHOTO = { kind: "image", url: "https://s.test/photo.jpg", storagePath: "u/n/o/m.jpg" };
const YT = { kind: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" };

// ── §P2 — the photo frame ────────────────────────────────────────────────────

describe("P2 — a connected image renders inside the frame", () => {
  it("resolves to the frame's aperture, not the whole object", () => {
    const d = editableObjectDisplayContent(obj("ast-framed-photo", PHOTO));
    expect(d?.src).toBe(PHOTO.url);
    // The decorative moulding survives because the picture is inset, never full-bleed.
    expect(d?.bounds).toEqual({ x: 0.18, y: 0.18, width: 0.64, height: 0.64 });
    expect(d?.surfaceId).toBe("frame-photo");
  });

  it("THE ACCEPTANCE INVARIANT: what Preview shows, Edit already showed", () => {
    // Byte-identical, not merely "both non-null" — a different crop or aperture would still
    // be a divergence.
    const o = obj("ast-framed-photo", PHOTO);
    const [p] = editableObjectsToPlacements([o]);
    expect(editableObjectDisplayContent(o)).toEqual(placementDisplayContent(p, initialStateOf(p), "runtime"));
  });

  it("needs no tap — the frame's only state shows its screen", () => {
    const [p] = editableObjectsToPlacements([obj("ast-framed-photo", PHOTO)]);
    expect(placementDisplayContent(p, initialStateOf(p), "runtime")).not.toBeNull();
  });

  it("survives the publish conversion", () => {
    const [p] = editableObjectsToPlacements([obj("ast-framed-photo", PHOTO)]);
    expect(p.interaction?.asset?.connection?.url).toBe(PHOTO.url);
    expect(p.interaction?.asset?.connection?.storagePath).toBe(PHOTO.storagePath);
  });

  it("an object with no aperture draws nothing, however it is connected", () => {
    expect(editableObjectDisplayContent(obj("ast-lr-sofa-boucle", PHOTO))).toBeNull();
  });
});

// ── §P3 — the YouTube thumbnail ──────────────────────────────────────────────

describe("P3 — a YouTube URL resolves its own thumbnail", () => {
  it("derives it from the parsed video id", () => {
    expect(youTubeThumbnailUrl("dQw4w9WgXcQ")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });

  it("hqdefault, not maxresdefault — maxres 404s for many videos", () => {
    // A 404 here would put a broken image inside the television.
    expect(youTubeThumbnailUrl("x")).not.toContain("maxres");
  });

  it("resolveConnection attaches it, so every consumer gets it from one place", () => {
    const [p] = editableObjectsToPlacements([obj("ast-tv", YT)]);
    const c = resolveConnection(p);
    expect(c?.thumbnailUrl).toBe(youTubeThumbnailUrl(youTubeVideoId(YT.url)!));
  });

  it("a creator-supplied thumbnail always wins over the derived one", () => {
    const [p] = editableObjectsToPlacements([obj("ast-tv", { ...YT, thumbnailUrl: "https://s.test/mine.jpg" })]);
    expect(resolveConnection(p)?.thumbnailUrl).toBe("https://s.test/mine.jpg");
  });

  it("every accepted YouTube URL form resolves the same picture", () => {
    for (const u of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    ]) {
      const [p] = editableObjectsToPlacements([obj("ast-tv", { kind: "youtube", url: u })]);
      expect(resolveConnection(p)?.thumbnailUrl).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    }
  });

  it("a malformed YouTube URL resolves nothing rather than a broken image", () => {
    const [p] = editableObjectsToPlacements([obj("ast-tv", { kind: "youtube", url: "https://youtube.com/watch?v=" })]);
    expect(resolveConnection(p)).toBeNull();
  });
});

// ── §P4 — the TV screen ──────────────────────────────────────────────────────

describe("P4 — the thumbnail draws inside the TV when its screen is on", () => {
  const [p] = editableObjectsToPlacements([obj("ast-tv", YT)]);

  it("off: nothing on the screen", () => {
    expect(placementDisplayContent(p, "off", "runtime")).toBeNull();
  });

  it("on: the YouTube thumbnail, in the TV's own aperture", () => {
    const d = placementDisplayContent(p, "on", "runtime");
    expect(d?.src).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(d?.bounds).toEqual({ x: 0.2, y: 0.11, width: 0.6, height: 0.48 });
  });

  it("authoring shows it regardless of state — an off TV would give no feedback", () => {
    expect(editableObjectDisplayContent(obj("ast-tv", YT))?.src).toBe(placementDisplayContent(p, "on", "runtime")?.src);
  });
});

// ── §P5 — content type beats URL transport ───────────────────────────────────

describe("P5 — media does not fall through to a generic website action", () => {
  const tap = (assetId: string, connection: Record<string, unknown>) => {
    const [p] = editableObjectsToPlacements([obj(assetId, connection)]);
    return tapObject(p, initialStateOf(p));
  };

  it("an image on a screen-carrying object opens no tab", () => {
    expect(tap("ast-framed-photo", PHOTO).open).toBeNull();
  });

  it("a YouTube link is YouTube media, not open-url", () => {
    const open = tap("ast-tv", YT).open;
    expect(open?.type).toBe("open-youtube");
    expect(open).not.toMatchObject({ type: "open-url" });
  });

  it("an ORDINARY website is still a website", () => {
    expect(tap("ast-tv", { kind: "website", url: "https://example.com/page" }).open?.type).toBe("open-url");
  });

  it("a website connection draws no picture — it has no still to show", () => {
    const [p] = editableObjectsToPlacements([obj("ast-tv", { kind: "website", url: "https://example.com" })]);
    expect(placementDisplayContent(p, "on", "runtime")).toBeNull();
  });
});

// ── §P1 — one resolver, two callers ──────────────────────────────────────────

describe("P1 — the editor and the runtime share the resolver", () => {
  it("both import it; neither re-implements the conditions", () => {
    expect(canvas).toContain("editableObjectDisplayContent");
    expect(runtime).toContain("placementDisplayContent");
    // The inline expression that used to live in the runtime, and nowhere in the editor.
    for (const src of [canvas, runtime]) {
      expect(src).not.toContain('connection?.kind === "image" ? connection.url : undefined');
    }
  });

  it("the editor's display layer cannot steal an editing gesture", () => {
    // A tap on the photo inside a frame must still select and drag the FRAME.
    const layer = canvas.slice(canvas.indexOf("function ObjectDisplayLayer"));
    expect(layer.slice(0, 1200)).toContain("pointer-events-none");
  });

  it("the legacy surface layer no longer competes for the same aperture", () => {
    expect(canvas).toContain("editableObjectDisplayContent(o)?.surfaceId");
    expect(runtime).toContain("sf.id !== screenSurfaceId || !screenSrc");
  });

  it("editable-object normalisation goes through resolveConnection, not a copy of it", () => {
    // Duplicating the accepted-kind / URL-safety / YouTube rules is exactly how Edit and
    // Preview drifted apart the first time.
    const mod = read("lib", "nest-object-display.ts");
    expect(mod).toContain("return resolveConnection(asPlacement);");
    expect(connectionForEditableObject(obj("ast-tv", YT))?.thumbnailUrl).toContain("i.ytimg.com");
  });

  it("returns null rather than a half-configured result", () => {
    expect(resolveObjectDisplayContent({ assetId: "ast-tv", connection: null, mode: "authoring" })).toBeNull();
    expect(resolveObjectDisplayContent({ assetId: "ast-nonexistent", connection: PHOTO as never, mode: "authoring" })).toBeNull();
  });
});

// ── §P6 — it survives the round trip ─────────────────────────────────────────

describe("P6 — save / reopen / publish keeps both", () => {
  it("a frame photo and a TV video both round-trip through publish", () => {
    const [frame, tv] = editableObjectsToPlacements([obj("ast-framed-photo", PHOTO), { ...obj("ast-tv", YT), instanceId: "o2" }]);
    expect(placementDisplayContent(frame, initialStateOf(frame), "runtime")?.src).toBe(PHOTO.url);
    expect(placementDisplayContent(tv, "on", "runtime")?.src).toContain("i.ytimg.com");
  });

  it("no inline media is introduced by any of this", async () => {
    const { assertNoInlineMedia } = await import("@/lib/nest-media");
    const [frame] = editableObjectsToPlacements([obj("ast-framed-photo", PHOTO)]);
    expect(() => assertNoInlineMedia(frame, "publish")).not.toThrow();
  });
});
