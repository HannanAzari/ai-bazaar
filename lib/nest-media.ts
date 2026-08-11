// ── M26-S §9 — creator media lives in Storage, not in the document ───────────
//
// The rule: a Nest document holds a REFERENCE to media, never the media itself.
//
// Uploads were being persisted as base64 `data:` URLs inside `nest_objects.interaction`.
// A phone photo is 2–5 MB, base64 adds ~33%, and that blob was then re-sent on every feed
// read, every Profile card and every visitor load — and shown to the creator as a wall of
// `data:image/jpeg;base64,/9j/4AAQ…`. It is already in the live database.
//
// This module uploads to the `nest-media` bucket (see
// `supabase/provision/m26s_media_storage.sql`) and returns a small reference. It also
// provides the guard that stops a data URL reaching the document again.

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export const NEST_MEDIA_BUCKET = "nest-media";

/** What the document stores for one piece of creator media. Small, and always small. */
export type MediaRef = {
  id: string;
  kind: "image" | "video" | "audio";
  /** The path inside the bucket — the durable identity, survives a CDN domain change. */
  storagePath: string;
  /** The public URL to render. Derived from `storagePath`; kept for a cheap read path. */
  url: string;
  /** A still for video, when we have one. */
  thumbnailUrl?: string;
  title?: string;
};

/** True when a value is an inline data URL — the thing that must never be persisted. */
export function isDataUrl(value: string | undefined | null): boolean {
  return typeof value === "string" && /^data:/i.test(value.trim());
}

/**
 * Reject a document that still carries inline media.
 *
 * Used as a guard on the write path AND asserted by test. A data URL in a document is not
 * a cosmetic problem — it is a document that will grow without bound, so it fails loudly
 * rather than being quietly written.
 */
export function assertNoInlineMedia(value: unknown, where: string): void {
  const json = JSON.stringify(value ?? null);
  if (json && json.includes('"data:')) {
    throw new Error(
      `${where}: refusing to persist inline media. Upload it to the "${NEST_MEDIA_BUCKET}" bucket ` +
        "and store a reference instead (lib/nest-media.ts).",
    );
  }
}

const KIND_BY_PREFIX: Array<[string, MediaRef["kind"]]> = [
  ["image/", "image"],
  ["video/", "video"],
  ["audio/", "audio"],
];

/** The media kind a browser File represents, or null when we do not support it. */
export function mediaKindOf(mime: string): MediaRef["kind"] | null {
  return KIND_BY_PREFIX.find(([p]) => mime.startsWith(p))?.[1] ?? null;
}

/**
 * The object key for a creator's upload.
 *
 * `<ownerId>/<nestId>/<timestamp>-<safe name>`. The FIRST segment must be the owner's uid,
 * because the Storage policies key ownership off `storage.foldername(name)[1]` — that is
 * what lets a creator manage only their own media with no extra table.
 */
export function mediaKey(ownerId: string, nestId: string, objectId: string, mediaId: string, ext: string): string {
  const seg = (v: string) => v.replace(/[^\w.\-]+/g, "-").replace(/-+/g, "-").slice(0, 64) || "x";
  const e = ext.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 8) || "bin";
  return `${seg(ownerId)}/${seg(nestId)}/${seg(objectId)}/${seg(mediaId)}.${e}`;
}

// ── M27A §3 — what may be uploaded ───────────────────────────────────────────
//
// Kept in lockstep with `allowed_mime_types` on the bucket. Storage enforces it server-side
// too; this list exists so the creator gets a sentence they can act on instead of a 400.
// Audio is deliberately absent this sprint.
export const ALLOWED_UPLOAD_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

/** 25 MB, matching the bucket's own `file_size_limit`. */
export const MAX_UPLOAD_BYTES = 26214400;

/**
 * Why this file cannot be uploaded, in words a creator can act on — or null when it can.
 *
 * Checked BEFORE the network call: a 25 MB video that is going to be rejected should not be
 * uploaded over a phone connection first.
 */
export function uploadRejection(file: { type: string; size: number; name: string }): string | null {
  if (!ALLOWED_UPLOAD_MIME[file.type]) {
    if (file.type.startsWith("audio/")) return "Audio isn't supported yet — photos and videos work.";
    if (file.type.startsWith("image/")) return "That image format isn't supported. Try JPEG, PNG or WebP.";
    if (file.type.startsWith("video/")) return "That video format isn't supported. Try MP4 or WebM.";
    return "That file type isn't supported. Try a photo (JPEG, PNG, WebP) or a video (MP4, WebM).";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `That file is ${(file.size / 1048576).toFixed(1)} MB — the limit is ${Math.round(MAX_UPLOAD_BYTES / 1048576)} MB.`;
  }
  if (file.size === 0) return "That file is empty.";
  return null;
}

/** A short, opaque id for one media item. */
function newMediaId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Upload one file and return its reference.
 *
 * Throws rather than falling back to base64. A silent fallback here would reintroduce
 * exactly the problem this module exists to remove, and the creator would never know their
 * Nest had quietly become a file container.
 */
export async function uploadNestMedia(
  file: File,
  opts: { ownerId: string; nestId: string; objectId: string },
): Promise<MediaRef> {
  const reject = uploadRejection(file);
  if (reject) throw new Error(reject);
  const kind = mediaKindOf(file.type);
  if (!kind) throw new Error("That file type isn't supported yet. Try a photo or a video.");

  const db = createSupabaseBrowserClient();
  if (!db) {
    throw new Error(
      "Uploads need a connection to Nestudio's servers, and this build has none. " +
        "Your Nest is unchanged.",
    );
  }

  const storagePath = mediaKey(opts.ownerId, opts.nestId, opts.objectId, newMediaId(), ALLOWED_UPLOAD_MIME[file.type]);
  const { error } = await db.storage.from(NEST_MEDIA_BUCKET).upload(storagePath, file, {
    cacheControl: "31536000", // creator media is immutable — the key carries a timestamp
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(uploadErrorMessage(error.message));

  const { data } = db.storage.from(NEST_MEDIA_BUCKET).getPublicUrl(storagePath);
  return {
    id: storagePath,
    kind,
    storagePath,
    url: data.publicUrl,
    title: file.name.replace(/\.[^.]+$/, "").slice(0, 60),
  };
}

/**
 * Turn a Storage error into something a creator can act on.
 *
 * "Bucket not found" was the founder's phone error for the whole of M26-S and M27 — the
 * provision SQL had never been applied — and the old message buried that behind
 * "If this persists…". Say the actual thing.
 */
export function uploadErrorMessage(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("bucket not found") || m.includes("nosuchbucket")) {
    return `Media storage isn't set up on this project yet (the "${NEST_MEDIA_BUCKET}" bucket is missing). Run supabase/provision/m27a_media_storage.sql. Your Nest is unchanged.`;
  }
  if (m.includes("row-level security") || m.includes("unauthorized") || m.includes("jwt")) {
    return "You need to be signed in to upload media. Your Nest is unchanged.";
  }
  if (m.includes("payload too large") || m.includes("exceeded the maximum")) {
    return `That file is too large — the limit is ${Math.round(MAX_UPLOAD_BYTES / 1048576)} MB.`;
  }
  if (m.includes("mime")) return "That file type isn't supported. Try a photo (JPEG, PNG, WebP) or a video (MP4, WebM).";
  return `Upload failed (${raw}). Your Nest is unchanged.`;
}

/**
 * Remove a creator's media from Storage.
 *
 * Best-effort by design: a failed delete must never block the edit. The document is the
 * source of truth for what a Nest SHOWS; a leftover object is wasted bytes, not a broken
 * Nest. Returns whether the object actually went, so callers can report honestly.
 */
export async function removeNestMedia(storagePath: string): Promise<boolean> {
  if (!storagePath) return false;
  const db = createSupabaseBrowserClient();
  if (!db) return false;
  try {
    const { error } = await db.storage.from(NEST_MEDIA_BUCKET).remove([storagePath]);
    return !error;
  } catch {
    return false;
  }
}

/**
 * A short, creator-facing label for a media URL — `youtube.com`, `example.com`, or the
 * file name for an upload.
 *
 * The founder's screenshot showed a full base64 blob filling the sheet. Nothing
 * creator-facing should ever render a raw URL at length (§11, §20).
 */
export function shortSourceLabel(url: string): string {
  if (isDataUrl(url)) return "Uploaded file";
  try {
    const u = new URL(url);
    if (u.hostname.includes("supabase")) return decodeURIComponent(u.pathname.split("/").pop() ?? "Uploaded file");
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
}
