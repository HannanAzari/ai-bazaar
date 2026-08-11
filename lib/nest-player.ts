// ── M27B-3B — what the Nest media player is looking at ───────────────────────
//
// Pure: no React, no DOM, no provider SDK. The component in
// `components/nest/app-shell/nest-media-player.tsx` renders what this module decides.
//
// ── THE ONE INDEX ────────────────────────────────────────────────────────────
//
// There is deliberately no playlist state in here. The runtime's `contentIndex` — the same
// map the physical television reads to choose its thumbnail, and the same map a swipe on the
// aperture writes — is the only cursor. `playerTrack` takes that index as an argument.
//
// That is what makes §5 of the brief true by construction rather than by synchronisation:
// pressing Next in the player and swiping the TV are the same write, so the TV underneath
// cannot drift from the player above it. A second index here would be a bug waiting for a
// sprint to find it.
//
// ── AND ONE PROVIDER ID ──────────────────────────────────────────────────────
//
// Nothing here parses a URL. `resolveContents` already did that at the boundary and kept the
// result on `providerId` (M27B-3B §4). An item that arrives without one simply cannot be
// played inline, which is a fact about the item, not a failure to handle.

import type { ConnectedContent } from "@/lib/nest-asset-interaction";
import { youTubeEmbedUrl } from "@/lib/nest-interaction";

/** Everything the player UI needs about the current item. */
export type PlayerTrack = {
  index: number;
  count: number;
  title: string;
  /** Human-readable provider name, for the line under the title. */
  provider: string;
  /** The provider's id, resolved at the content boundary. Null ⇒ no inline playback. */
  providerId: string | null;
  thumbnailUrl: string | null;
  /** The embed to mount, or null when this item cannot play inside Nestudio. */
  embedUrl: string | null;
  /** The provider's own page, for the secondary "open externally" action. */
  externalUrl: string | null;
  /** Whether play/pause can actually be commanded (see `playerCommand`). */
  canControl: boolean;
};

const PROVIDER_NAMES: Record<string, string> = {
  youtube: "YouTube",
  video: "Video",
  audio: "Audio",
  website: "Link",
  image: "Photo",
};

/**
 * A title that is always safe to show.
 *
 * Creators rarely label a pasted link, and "Untitled" repeated three times in a playlist
 * tells a visitor nothing about which item they are on. Numbering by POSITION does, and it is
 * the position they are navigating by.
 */
export function trackTitle(c: ConnectedContent | undefined, index: number): string {
  const label = c?.label?.trim();
  // Connect stamps the PROVIDER as the label when a creator pastes a link without naming it,
  // so a real fixture built through the real panel reads "YouTube" over "YouTube" three times
  // over. A label that only repeats the provider line carries no information, so it is
  // treated as absent — found by driving the actual Connect path, not by reading the code.
  if (label && label.toLowerCase() !== (PROVIDER_NAMES[c?.kind ?? ""] ?? "").toLowerCase()) return label;
  const noun = c?.kind === "youtube" || c?.kind === "video" ? "Video" : c?.kind === "audio" ? "Track" : c?.kind === "image" ? "Photo" : "Item";
  return `${noun} ${index + 1}`;
}

/**
 * The current track, or null when there is nothing at that index.
 *
 * `index` is the RUNTIME's content index, clamped by the caller — a track resolved from a
 * stale index would put the player and the television on different items, which is the exact
 * failure §5 exists to prevent.
 */
export function playerTrack(contents: ConnectedContent[], index: number): PlayerTrack | null {
  if (!contents.length) return null;
  const i = Math.min(Math.max(Math.trunc(index) || 0, 0), contents.length - 1);
  const c = contents[i];
  if (!c) return null;
  const providerId = c.kind === "youtube" ? c.providerId ?? null : null;
  return {
    index: i,
    count: contents.length,
    title: trackTitle(c, i),
    provider: PROVIDER_NAMES[c.kind] ?? "Media",
    providerId,
    thumbnailUrl: c.thumbnailUrl ?? null,
    // Only YouTube plays inside Nestudio today. Anything else keeps its artwork and its
    // external action rather than being forced into a frame that would fail to load.
    embedUrl: providerId ? youTubeEmbedUrl(providerId, { inline: true }) : null,
    externalUrl: c.url ?? null,
    canControl: Boolean(providerId),
  };
}

/**
 * A YouTube IFrame API command, as a JSON string to post to the frame's window.
 *
 * This is the documented postMessage protocol, used WITHOUT loading YouTube's own script:
 * pulling a third-party player library into the room to toggle one button would cost more
 * than the button is worth, and would run their code on every Nest page.
 *
 * The honest limitation, recorded here rather than hidden: the protocol is one-way as used.
 * Nothing reports back that the video actually started, so the button reflects the visitor's
 * INTENT. A play that the browser blocks leaves the button saying "playing" — which is why
 * the second tap on the object is treated as the playback gesture and the thumbnail stays up
 * until the frame reports `load`.
 */
export function playerCommand(action: "play" | "pause"): string {
  return JSON.stringify({ event: "command", func: action === "play" ? "playVideo" : "pauseVideo", args: [] });
}

/**
 * §13 — THE ONE CLOSING RULE, in one place so it cannot be re-decided per button.
 *
 *   collapse  — leaving the expanded player returns to the mini bar. Media keeps playing.
 *   stop      — only the mini bar's × ends playback. The room is never reset by either.
 *
 * Both are strictly about the PLAYER. Neither touches the camera, the object's on/off state
 * or the content index, which is why closing returns the visitor to exactly the Nest they
 * left (§6) — there is nothing in this transition that could reset it.
 */
export type PlayerAction = "collapse" | "stop";

export function playerAfterAction<T extends { expanded: boolean }>(state: T | null, action: PlayerAction): T | null {
  if (!state) return null;
  return action === "stop" ? null : { ...state, expanded: false };
}
