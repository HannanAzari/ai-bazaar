import { describe, expect, it } from "vitest";
import { rowToPlacement } from "@/lib/nest/supabase-nest-repo";
import { editableObjectsToPlacements } from "@/lib/nest-editor-bridge";
import { placementContents } from "@/lib/nest-asset-interaction";
import { placementDisplayContent } from "@/lib/nest-object-display";
import { ALLOWED_UPLOAD_MIME, UNSUPPORTED_VIDEO, mediaKey, uploadRejection, videoPlaybackRejection } from "@/lib/nest-media";
import type { EditableNestObject } from "@/lib/nest-editor-types";

// ── M27C — the beta freeze regressions ───────────────────────────────────────
//
// Two investigations, and only one of them found a defect.
//
// P2 — "the published Framed Photo disappeared". It did not. Driven again through the real
// UI, a published Nest carrying a TV and a Framed Photo with three images contains BOTH
// objects, with both content lists intact, after a visitor reload. The M27B-3B fixture was
// malformed: every newly added asset is dropped at the SAME default centre, so the frame and
// the television were exactly concentric with the television larger, and every tap aimed at
// the frame resolved to the television. What is locked below is therefore not a fix but the
// round-trip INVARIANT the panic was about — the thing that would actually have been broken
// if the report had been right.
//
// P3 — the iPhone video path. This one is real, and it is the case a MIME check cannot see.

const obj = (assetId: string, contents: { kind: string; url: string }[]): EditableNestObject =>
  ({ instanceId: `${assetId}-1`, assetId, x: 0.2, y: 0.3, width: 0.25, height: 0.2,
     anchor: { x: 0.3, y: 0.5 }, plane: "front_wall", zIndex: 3, rotation: 12, flipX: true,
     assetInteraction: { contents } } as unknown as EditableNestObject);

const photos = [1, 2, 3].map((n) => ({ kind: "image" as const, url: `https://s.test/p${n}.jpg` }));
const videos = ["aqz-KE-bpKQ", "dQw4w9WgXcQ", "jNQXAC9IVRw"].map((id) => ({ kind: "youtube" as const, url: `https://www.youtube.com/watch?v=${id}` }));

/**
 * The publish → persist → read-back round trip, exactly as the two real functions perform it.
 *
 * `placementToRow` is private, so the row is built the way the repo builds it and mapped back
 * with the repo's own `rowToPlacement`. That is the boundary the report accused.
 */
const roundTrip = (objects: EditableNestObject[]) =>
  editableObjectsToPlacements(objects).map((p, i) =>
    rowToPlacement({
      id: `row-${i}`, nest_id: "n1", asset_id: p.assetId, x: p.x, y: p.y,
      scale: p.scale ?? null, rotation: p.rotation ?? 0, z_index: p.zIndex ?? i + 1,
      w: p.w ?? null, h: p.h ?? null, flip_x: p.flipX ?? false,
      overlay: p.overlay ?? null, interaction: p.interaction ?? null,
      label: null, link_url: null,
    } as Parameters<typeof rowToPlacement>[0]),
  );

// ── P2 ───────────────────────────────────────────────────────────────────────

describe("P2. publishing a Nest keeps every object AND its connected content", () => {
  const objects = [obj("ast-framed-photo", photos), obj("ast-tv", videos)];

  it("both objects survive — nothing is dropped between editor and visitor", () => {
    const out = roundTrip(objects);
    expect(out).toHaveLength(2);
    expect(out.map((p) => p.assetId)).toEqual(["ast-framed-photo", "ast-tv"]);
  });

  it("the frame keeps all three photos, in the creator's order", () => {
    const frame = roundTrip(objects)[0];
    expect(placementContents(frame).map((c) => c.url)).toEqual(photos.map((p) => p.url));
  });

  it("the TV keeps all three videos, each with its resolved provider id", () => {
    const tv = roundTrip(objects)[1];
    expect(placementContents(tv).map((c) => c.providerId)).toEqual(["aqz-KE-bpKQ", "dQw4w9WgXcQ", "jNQXAC9IVRw"]);
  });

  it("the frame RENDERS its first photo on the visitor's first frame, with no tap", () => {
    // The strongest form of the claim: not merely present in the document, but drawn.
    const frame = roundTrip(objects)[0];
    expect(placementDisplayContent(frame, "shown", "runtime")?.src).toBe(photos[0].url);
  });

  it("geometry, rotation and mirror survive the same trip", () => {
    const frame = roundTrip(objects)[0];
    expect(frame.rotation).toBe(12);
    expect(frame.flipX).toBe(true);
    expect(frame.w).toBeCloseTo(0.25, 5);
    expect(frame.h).toBeCloseTo(0.2, 5);
  });

  it("an object with NO connected content still publishes", () => {
    // The frame in the M27B-3B fixture had an empty list, because the taps went elsewhere.
    // An empty list must never be a reason to drop the object.
    const bare = roundTrip([obj("ast-framed-photo", []), obj("ast-tv", videos)]);
    expect(bare).toHaveLength(2);
    expect(placementContents(bare[0])).toEqual([]);
  });
});

// ── P3 ───────────────────────────────────────────────────────────────────────

describe("P3. iPhone video is rejected before it is uploaded, never transcoded", () => {
  const file = (type: string, size = 1000) => ({ type, size, name: `clip.${type.split("/")[1]}` });

  it("a camera-roll .MOV never leaves the phone", () => {
    // iOS reports `video/quicktime` for a camera-roll movie. Chromium's own `canPlayType`
    // returns "" for it — measured in the browser, not assumed.
    expect(ALLOWED_UPLOAD_MIME["video/quicktime"]).toBeUndefined();
    expect(uploadRejection(file("video/quicktime"))).toBe(UNSUPPORTED_VIDEO);
  });

  it("the message tells the creator what to do instead", () => {
    expect(UNSUPPORTED_VIDEO).toContain("MP4");
    expect(UNSUPPORTED_VIDEO).toContain("YouTube");
  });

  it("MP4 and WebM are accepted", () => {
    expect(uploadRejection(file("video/mp4"))).toBeNull();
    expect(uploadRejection(file("video/webm"))).toBeNull();
  });

  it("HEVC inside an .mp4 is the case MIME CANNOT catch — hence the decode probe", () => {
    // This is the whole reason `videoPlaybackRejection` exists. The container passes; the
    // codec does not. Verified in the browser: `canPlayType('video/mp4; codecs="hvc1"')` is
    // "" in Chromium, while the file's MIME is a perfectly ordinary `video/mp4`.
    expect(uploadRejection(file("video/mp4"))).toBeNull();
    expect(typeof videoPlaybackRejection).toBe("function");
  });

  it("the probe fails OPEN without a DOM, so nothing server-side is broken by it", async () => {
    // Node has no <video>. A guard that threw here would take down every non-browser caller.
    await expect(videoPlaybackRejection(new Blob([new Uint8Array([1, 2, 3])], { type: "video/mp4" }) as Blob & { type: string })).resolves.toBeNull();
  });

  it("it never touches images", async () => {
    await expect(videoPlaybackRejection(new Blob([new Uint8Array([1])], { type: "image/jpeg" }) as Blob & { type: string })).resolves.toBeNull();
  });

  it("oversized files are refused before the network, not after", () => {
    expect(uploadRejection(file("video/mp4", 40 * 1048576))).toMatch(/limit is 25 MB/);
  });

  it("no transcoding was built — this is a guard, not a pipeline", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("lib/nest-media.ts", "utf8");
    for (const t of ["ffmpeg", "transcode", "WebCodecs", "VideoEncoder"]) expect(src).not.toContain(t);
  });
});

// ── The storage contract, frozen ─────────────────────────────────────────────

describe("storage path contract", () => {
  it("the owner's uid is the FIRST segment — the RLS policies key on it", () => {
    // `(storage.foldername(name))[1] = auth.uid()::text`. Change this and every policy
    // silently stops matching, which is a data-access bug, not a naming preference.
    expect(mediaKey("user-1", "nest-2", "obj-3", "media-4", "jpg")).toBe("user-1/nest-2/obj-3/media-4.jpg");
  });

  it("a segment cannot introduce a separator, so nothing can escape the owner's folder", () => {
    // What makes traversal impossible is that `/` is stripped from every segment — a
    // surviving ".." is inert without one. The key therefore always has exactly four
    // segments, whatever the caller passes.
    const key = mediaKey("../../etc", "n/../..", "o", "m", "jpg");
    expect(key.split("/")).toHaveLength(4);
    expect(key.split("/")[0]).toBe("..-..-etc");
    expect(key.startsWith("..-..-etc/")).toBe(true);
  });

  it("the extension follows the MIME, never the filename", () => {
    expect(ALLOWED_UPLOAD_MIME["image/jpeg"]).toBe("jpg");
    expect(ALLOWED_UPLOAD_MIME["image/webp"]).toBe("webp");
  });
});
