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
export function mediaKey(ownerId: string, nestId: string, fileName: string): string {
  const safe = fileName
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-64);
  return `${ownerId}/${nestId}/${Date.now()}-${safe}`;
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
  opts: { ownerId: string; nestId: string },
): Promise<MediaRef> {
  const kind = mediaKindOf(file.type);
  if (!kind) throw new Error("That file type isn't supported yet. Try a photo or a video.");

  const db = createSupabaseBrowserClient();
  if (!db) {
    throw new Error(
      "Uploads need a connection to Nestudio's servers, and this build has none. " +
        "Your Nest is unchanged.",
    );
  }

  const storagePath = mediaKey(opts.ownerId, opts.nestId, file.name);
  const { error } = await db.storage.from(NEST_MEDIA_BUCKET).upload(storagePath, file, {
    cacheControl: "31536000", // creator media is immutable — the key carries a timestamp
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) {
    // Name the bucket, because "not found" here almost always means the provision SQL has
    // not been applied yet.
    throw new Error(`Upload failed (${error.message}). If this persists, the "${NEST_MEDIA_BUCKET}" bucket may not exist yet.`);
  }

  const { data } = db.storage.from(NEST_MEDIA_BUCKET).getPublicUrl(storagePath);
  return {
    id: storagePath,
    kind,
    storagePath,
    url: data.publicUrl,
    title: file.name.replace(/\.[^.]+$/, "").slice(0, 60),
  };
}

/** Remove a creator's media. Best-effort: a failed delete must never block an edit. */
export async function removeNestMedia(storagePath: string): Promise<void> {
  const db = createSupabaseBrowserClient();
  if (!db) return;
  await db.storage.from(NEST_MEDIA_BUCKET).remove([storagePath]).catch(() => undefined);
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
