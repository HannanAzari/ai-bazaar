import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  objectTransformFromPinch,
  ownerMovesCamera,
  ownerMovesObject,
  pinchSample,
  regionContains,
  resolveGestureOwner,
  shortestAngleDelta,
  transformRegionFor,
  twoFingerOwner,
  upgradeGesture,
  beginGesture,
} from "@/lib/nest-gesture";
import { assertNoInlineMedia, isDataUrl, mediaKey, mediaKindOf, shortSourceLabel } from "@/lib/nest-media";

// ── M26-S §2/§4 — the sticker gesture ────────────────────────────────────────
//
// Two fingers on the SELECTED object scale and rotate it together, the way a sticker
// behaves in Instagram or Telegram. Two fingers anywhere else are always a camera pinch.
// Selection is what makes this safe: M26A had to delete the previous two-finger object
// gesture precisely because it fired on any object under two fingers.

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const editor = read("components", "nest", "editor", "nest-editor.tsx");

const BOOK = { left: 200, top: 300, width: 10, height: 9 }; // a tiny book on a phone

describe("1-2. two fingers on the selected object scale and rotate it", () => {
  it("spreading the fingers scales by exactly the distance ratio", () => {
    const start = pinchSample({ x: 100, y: 100 }, { x: 200, y: 100 }); // 100px apart
    const now = pinchSample({ x: 75, y: 100 }, { x: 225, y: 100 }); // 150px apart
    expect(objectTransformFromPinch(start, now).scale).toBeCloseTo(1.5, 10);
  });

  it("turning the fingers rotates by the angle delta", () => {
    const start = pinchSample({ x: 0, y: 0 }, { x: 100, y: 0 }); // 0°
    const now = pinchSample({ x: 0, y: 0 }, { x: 0, y: 100 }); // 90°
    expect(objectTransformFromPinch(start, now).rotationDeg).toBeCloseTo(90, 6);
  });

  it("both happen at once — it is one gesture, not two", () => {
    const start = pinchSample({ x: 0, y: 0 }, { x: 100, y: 0 });
    const now = pinchSample({ x: 0, y: 0 }, { x: 0, y: 200 });
    const t = objectTransformFromPinch(start, now);
    expect(t.scale).toBeCloseTo(2, 6);
    expect(t.rotationDeg).toBeCloseTo(90, 6);
  });

  it("crossing ±180° never spins the object the long way round", () => {
    expect(shortestAngleDelta(170, -170)).toBeCloseTo(20, 6);
    expect(shortestAngleDelta(-170, 170)).toBeCloseTo(-20, 6);
    expect(shortestAngleDelta(0, 180)).toBeCloseTo(180, 6);
  });

  it("a degenerate pinch (both fingers on one pixel) cannot produce Infinity", () => {
    const degenerate = pinchSample({ x: 50, y: 50 }, { x: 51, y: 50 });
    const t = objectTransformFromPinch(degenerate, pinchSample({ x: 0, y: 0 }, { x: 400, y: 0 }));
    expect(t.scale).toBe(1);
    expect(Number.isFinite(t.scale)).toBe(true);
  });
});

describe("3. the midpoint translates the object too", () => {
  it("moving both fingers together carries the object with them", () => {
    const start = pinchSample({ x: 100, y: 100 }, { x: 200, y: 100 });
    const now = pinchSample({ x: 140, y: 130 }, { x: 240, y: 130 });
    const t = objectTransformFromPinch(start, now);
    expect(t.dx).toBeCloseTo(40, 6);
    expect(t.dy).toBeCloseTo(30, 6);
    expect(t.scale).toBeCloseTo(1, 6); // pure translation, no scale
  });
});

describe("4. a tiny object gets an enlarged transform region", () => {
  it("a 10px book claims ~90px, centred on itself", () => {
    const r = transformRegionFor(BOOK);
    expect(r.width).toBe(90);
    expect(r.height).toBe(90);
    // Still centred on the book, so it does not drift toward one corner.
    expect(r.left + r.width / 2).toBeCloseTo(BOOK.left + BOOK.width / 2, 6);
    expect(r.top + r.height / 2).toBeCloseTo(BOOK.top + BOOK.height / 2, 6);
  });

  it("a large object is NOT shrunk to the minimum", () => {
    const sofa = { left: 0, top: 0, width: 300, height: 200 };
    const r = transformRegionFor(sofa);
    expect(r.width).toBe(300);
    expect(r.height).toBe(200);
  });

  it("a finger 30px off a 10px book still lands in its region", () => {
    const r = transformRegionFor(BOOK);
    expect(regionContains(r, { x: BOOK.left + 30, y: BOOK.top })).toBe(true);
    expect(regionContains(r, { x: BOOK.left + 300, y: BOOK.top })).toBe(false);
  });
});

describe("5. ownership — the object and the camera never both act", () => {
  const region = transformRegionFor(BOOK);

  it("EITHER finger inside the region gives the object the gesture", () => {
    // Requiring both would fail exactly the small-object case the region exists for:
    // one finger anchors on the book, the other spreads into open room.
    expect(twoFingerOwner({ x: 203, y: 303 }, { x: 900, y: 900 }, region)).toBe("object-transform");
    expect(twoFingerOwner({ x: 900, y: 900 }, { x: 203, y: 303 }, region)).toBe("object-transform");
  });

  it("both fingers in open room give the camera the gesture", () => {
    expect(twoFingerOwner({ x: 900, y: 900 }, { x: 950, y: 950 }, region)).toBe("camera-pinch");
  });

  it("with nothing selected, two fingers are always the camera", () => {
    expect(twoFingerOwner({ x: 203, y: 303 }, { x: 205, y: 305 }, null)).toBe("camera-pinch");
  });

  it("the resolver agrees: on the selected region → transform, otherwise → pinch", () => {
    expect(resolveGestureOwner({ pointerCount: 2, target: "selected-object", scale: 3, onSelectedTransformRegion: true })).toBe("object-transform");
    expect(resolveGestureOwner({ pointerCount: 2, target: "empty", scale: 3 })).toBe("camera-pinch");
    expect(resolveGestureOwner({ pointerCount: 2, target: "other-object", scale: 3 })).toBe("camera-pinch");
  });

  it("a LOCKED object never transforms", () => {
    expect(resolveGestureOwner({ pointerCount: 2, target: "selected-object", scale: 3, onSelectedTransformRegion: true, locked: true })).toBe("camera-pinch");
  });

  it("object-transform moves the object and never the camera", () => {
    expect(ownerMovesObject("object-transform")).toBe(true);
    expect(ownerMovesCamera("object-transform")).toBe(false);
  });
});

describe("6. a second finger on the object being dragged becomes a transform", () => {
  const drag = beginGesture({ pointerCount: 1, target: "selected-object", scale: 4, objectId: "book-a" }, 1);

  it("…when it lands on the selected object's region", () => {
    expect(upgradeGesture(drag, 2, true).owner).toBe("object-transform");
  });

  it("…and becomes a camera pinch when it lands anywhere else", () => {
    expect(upgradeGesture(drag, 2, false).owner).toBe("camera-pinch");
  });

  it("a camera pan is never upgraded into an object transform", () => {
    const pan = beginGesture({ pointerCount: 1, target: "empty", scale: 4 }, 1);
    expect(upgradeGesture(pan, 2, true).owner).toBe("camera-pinch");
  });
});

// ── §6/§7 — the editor shell ─────────────────────────────────────────────────

describe("the editor shell fits at 375px", () => {
  it("the header carries Edit|Preview and no workflow buttons", () => {
    const header = editor
      .slice(editor.indexOf("<header"), editor.indexOf("</header>"))
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    // M26 §P1 — the switch is BACK, in one fixed position. M26-S removed it from the
    // header and left the copy inside Preview, so it vanished in Edit and appeared in
    // Preview — exactly what the founder reported.
    expect(header).toContain("<ModeSwitch");
    for (const gone of ["Publish", "setShowPublish"]) {
      expect(header).not.toContain(gone);
    }
    // `onDone` IS in the header — as a prop handed to the More menu, which is exactly
    // where Save & finish now lives. What must be gone is a Done BUTTON competing for the
    // row.
    expect(header).not.toContain("> Done</button>");
    expect(header).not.toContain("/> Done<");
    // §2 — Back became Close: leaving is where persistence matters.
    expect(header).toContain('aria-label="Close editor"');
    expect(header).toContain('label="Undo"');
    expect(header).toContain('label="Redo"');
    expect(header).toContain('label="More"');
  });

  it("the dock is Assets · Publish — saving happens on the way out", () => {
    const dock = editor.slice(editor.indexOf("<nav"), editor.indexOf("</nav>"));
    expect(dock).toContain('label="Assets"');
    expect(dock).toContain("setShowPublish(true)");
    expect(dock).toContain("#d9913c");
    // §1 — a standalone Save asks the creator to think about persistence, which is our
    // concern. It moved to the Close decision.
    expect(dock).not.toContain('label="Save"');
    expect(editor).toContain("closeSavingDraft");
  });

  it("Connect is contextual on the selection, never a global tab", () => {
    const canvas = read("components", "nest", "editor", "editor-canvas.tsx");
    const dock = editor.slice(editor.indexOf("<nav"), editor.indexOf("</nav>"));
    expect(dock).not.toContain('label="Connect"');
    // M26-S removed it from the dock and never added the replacement, leaving NO route
    // to Connect at all.
    expect(canvas).toContain('<CtxBtn label="Connect"');
    expect(canvas).toContain("capabilitiesForAsset(o.assetId)?.accepts.length");
  });

  it("no mode asks the creator how their fingers should behave (§24)", () => {
    const dock = editor.slice(editor.indexOf("<nav"), editor.indexOf("</nav>"));
    for (const mode of ['label="Arrange"', 'label="Interaction"', 'label="Focus"', 'label="Surface"']) {
      expect(dock).not.toContain(mode);
    }
  });

  it("Save & finish remains available under the More menu", () => {
    expect(editor).toContain("onDone();");
  });
});

// ── §9 — creator media never lives in the document ───────────────────────────

describe("uploaded media is a reference, never base64", () => {
  const panel = read("components", "nest", "editor", "interaction-panel.tsx");
  const media = read("lib", "nest-media.ts");
  const sql = read("supabase", "provision", "m26s_media_storage.sql");

  it("the upload path goes to Storage, with NO base64 fallback", () => {
    expect(panel).toContain("uploadNestMedia(file,");
    // The old path read the file as a data URL and wrote it straight into the Nest.
    expect(panel).not.toContain("readAsDataURL");
    expect(panel).not.toContain("detectUploadedFile");
    // A silent fallback would quietly turn the Nest back into a file container.
    expect(media).not.toContain("readAsDataURL");
  });

  it("a data URL is recognised and refused", () => {
    expect(isDataUrl("data:image/jpeg;base64,/9j/4AAQ")).toBe(true);
    expect(isDataUrl("https://example.com/p.jpg")).toBe(false);
    expect(() => assertNoInlineMedia({ url: "data:image/png;base64,AAA" }, "test")).toThrow(/inline media/);
    expect(() => assertNoInlineMedia({ url: "https://example.com/p.jpg" }, "test")).not.toThrow();
  });

  it("the storage key starts with the owner id — the policies depend on it", () => {
    const key = mediaKey("user-123", "nest-abc", "My Photo (1).JPG");
    expect(key.startsWith("user-123/nest-abc/")).toBe(true);
    expect(key).not.toMatch(/[()\s]/); // sanitised
    expect(sql).toContain("(storage.foldername(name))[1] = auth.uid()::text");
  });

  it("the bucket provision is additive and idempotent", () => {
    expect(sql).toContain("on conflict (id) do update");
    expect(sql).not.toMatch(/\bdrop\s+(table|bucket)\b/i);
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
  });

  it("the media kind is derived from the MIME type, not the file name", () => {
    expect(mediaKindOf("image/jpeg")).toBe("image");
    expect(mediaKindOf("video/mp4")).toBe("video");
    expect(mediaKindOf("audio/mpeg")).toBe("audio");
    expect(mediaKindOf("application/pdf")).toBeNull();
  });

  it("a creator is never shown a long URL", () => {
    expect(shortSourceLabel("https://www.youtube.com/watch?v=abcdefghijk")).toBe("youtube.com");
    expect(shortSourceLabel("data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ")).toBe("Uploaded file");
    // …and the sheet truncates rather than wrapping a raw value across the panel.
    expect(panel).toContain("truncate text-[13px]");
    expect(panel).not.toContain("break-all");
  });
});
