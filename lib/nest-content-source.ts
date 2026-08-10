// ── M26-R §P5/§P6 — "paste a link", and Nestudio works out the rest ──────────
//
// The product rule this file implements:
//
//     Interaction belongs to the ASSET. Content belongs to the CREATOR.
//
// A creator never picks a "source type", a "media type" or an "action". They paste a link
// or upload a file; we detect what it is and whether the selected object can show it. The
// old sheet asked them to choose between Nothing / YouTube / Video / Image / Website AND a
// starting state — five decisions to hang one video on a TV.
//
// Pure: no React, no DOM, no network. Detection is by URL shape only — we never fetch a
// page to sniff it, because that would leak the creator's link to us before they publish.

import { safeUrl, youTubeVideoId } from "@/lib/nest-interaction";
import type { ConnectedContentKind } from "@/lib/nest-asset-interaction";

/** What a pasted link or uploaded file turned out to be. */
export type DetectedContent = {
  kind: ConnectedContentKind;
  url: string;
  /** The provider, when we recognised one — used for the creator-facing label. */
  provider?: "youtube" | "spotify" | "vimeo" | "soundcloud";
  /** A human label for the detected source ("YouTube", "Website"). Creator-facing. */
  label: string;
  /** For YouTube: the id, already validated to 11 URL-safe characters. */
  videoId?: string;
};

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|wav|flac)(\?|#|$)/i;

/**
 * What did the creator just paste?
 *
 * Order matters: a recognised PROVIDER beats a file extension, because
 * `youtube.com/watch?v=…&thumb=x.jpg` is a video, not an image. File extensions beat the
 * generic website fallback.
 */
export function detectContentSource(raw: string): DetectedContent | null {
  const url = safeUrl(raw);
  if (!url) return null;

  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }

  // ── Providers ──
  const videoId = youTubeVideoId(url);
  if (videoId) return { kind: "youtube", url, provider: "youtube", label: "YouTube", videoId };

  if (host === "spotify.com" || host.endsWith(".spotify.com")) {
    return { kind: "audio", url, provider: "spotify", label: "Spotify" };
  }
  if (host === "soundcloud.com" || host.endsWith(".soundcloud.com")) {
    return { kind: "audio", url, provider: "soundcloud", label: "SoundCloud" };
  }
  if (host === "vimeo.com" || host.endsWith(".vimeo.com")) {
    return { kind: "video", url, provider: "vimeo", label: "Vimeo" };
  }

  // ── File extensions ──
  if (IMAGE_EXT.test(url)) return { kind: "image", url, label: "Image" };
  if (VIDEO_EXT.test(url)) return { kind: "video", url, label: "Video" };
  if (AUDIO_EXT.test(url)) return { kind: "audio", url, label: "Audio" };

  // ── Anything else a browser can open ──
  return { kind: "website", url, label: "Website" };
}

/** An uploaded file → the same shape, so the Connect sheet has one code path. */
export function detectUploadedFile(file: { type: string; name: string }, dataUrl: string): DetectedContent | null {
  if (file.type.startsWith("image/")) return { kind: "image", url: dataUrl, label: "Image" };
  if (file.type.startsWith("video/")) return { kind: "video", url: dataUrl, label: "Video" };
  if (file.type.startsWith("audio/")) return { kind: "audio", url: dataUrl, label: "Audio" };
  return null;
}

/**
 * Why this object cannot show that content, in the creator's words — or null when it can.
 *
 * The message names the OBJECT and the CONTENT, never a capability or a kind: "A lamp
 * can't show a video" is actionable; "asset does not accept kind=youtube" is not.
 */
export function contentRejection(
  detected: DetectedContent,
  accepts: ConnectedContentKind[],
  assetName: string,
): string | null {
  if (accepts.includes(detected.kind)) return null;
  if (!accepts.length) return `${assetName} doesn't hold content — it just responds when someone taps it.`;
  // A YouTube link on an audio-only object is still music to a creator, so say what WOULD
  // work rather than only what failed.
  const canShow = accepts.map(friendlyKind).filter((v, i, a) => a.indexOf(v) === i);
  return `${assetName} can't show ${friendlyKind(detected.kind)}. Try ${listOf(canShow)}.`;
}

function friendlyKind(k: ConnectedContentKind): string {
  switch (k) {
    case "youtube":
    case "video":
      return "a video";
    case "audio":
      return "music";
    case "image":
      return "a photo";
    case "website":
      return "a link";
  }
}

function listOf(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}

/**
 * A short creator-facing description of what is connected, for the "already connected"
 * state: `YouTube · youtu.be` rather than a raw URL the creator has to parse.
 */
export function describeConnected(detected: DetectedContent): string {
  try {
    const host = new URL(detected.url).hostname.replace(/^www\./, "");
    return detected.url.startsWith("data:") ? detected.label : `${detected.label} · ${host}`;
  } catch {
    return detected.label;
  }
}
