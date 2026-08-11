// ── M24E — the typed interaction contract ────────────────────────────────────
//
// What a visitor's tap DOES, as one closed union. Every interactive thing in a Nest — a
// hotspot on an object, a Focus region, a whole placement carrying a link — resolves to
// exactly one of these, and the runtime executes nothing else.
//
// The rule this file exists to enforce: an action is ALWAYS resolved from creator-authored
// data (`hotspot.binding`, `placement.linkUrl`, a Focus region's id). It is NEVER inferred
// from an asset id or a name. Guessing that `ast-tv` should play a video is how a room ends
// up doing things the creator never asked for, and how a creator's actual configuration
// gets quietly ignored — which is precisely the bug this sprint is fixing.
//
// Pure: no React, no DOM, no Supabase. The runtime imports it; so do the tests.

import type { NestAssetHotspot, NestHotspotContentBinding } from "@/lib/nest-hotspot-types";
import { isInternalSemantic } from "@/lib/nest-hotspot-types";
import type { NestPlacement } from "@/lib/nest-document-types";

/** What a tap does. Closed union — the runtime's switch is exhaustive. */
export type NestInteraction =
  | { type: "open-url"; url: string; label?: string }
  | { type: "open-youtube"; url: string; videoId: string; label?: string }
  | { type: "enter-focus"; focusId: string; label?: string }
  | { type: "none" };

export const NO_INTERACTION: NestInteraction = { type: "none" };

/** Schemes a Nest may ever navigate to. Everything else is refused. */
const SAFE_PROTOCOLS = ["http:", "https:"];

/**
 * A creator-supplied URL, or null.
 *
 * Mirrors `validateBindingUrl` in lib/nest-hotspots.ts (the authoring-time check) so a
 * value that was rejected at authoring time cannot slip in later through a hand-edited
 * document, a legacy row or an imported Nest. Authoring validates to *tell the creator*;
 * this validates to *protect the visitor*, and the visitor-side check is the one that has
 * to hold when the data did not come from our own editor.
 */
export function safeUrl(raw: string | undefined | null): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  // Reject obfuscated dangerous schemes before parsing, exactly as authoring does.
  if (/^\s*(javascript|data|vbscript|file):/i.test(s)) return null;
  try {
    const u = new URL(s);
    return SAFE_PROTOCOLS.includes(u.protocol.toLowerCase()) ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * The YouTube video id in a URL, or null.
 *
 * Handles the three forms creators actually paste: `watch?v=`, `youtu.be/<id>` and
 * `/embed/<id>`. Anything else is treated as an ordinary link rather than being coerced
 * into a player that would then fail to load.
 */
export function youTubeVideoId(raw: string): string | null {
  const url = safeUrl(raw);
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const id =
    host === "youtu.be"
      ? u.pathname.slice(1)
      : host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")
        ? u.searchParams.get("v") ?? (/^\/(embed|shorts|v)\//.test(u.pathname) ? u.pathname.split("/")[2] : "")
        : "";
  // YouTube ids are 11 URL-safe characters. Being strict here keeps a malformed id out of
  // an <iframe> src rather than silently rendering a broken player.
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

/** The embed URL for a video id. `nocookie` so a visitor is not tracked for looking. */
export function youTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
}

/**
 * M27B-1 §P3 — the still image for a YouTube video, from its id alone.
 *
 * `youTubeVideoId()` has always parsed and VALIDATED the id — `resolveConnection` calls it
 * to decide whether a connection is usable — and then threw it away. Nothing anywhere
 * derived a picture from it, so a TV with a perfectly good YouTube link had nothing to show
 * on its screen. That is the whole of the second P0 finding.
 *
 * `i.ytimg.com` serves these deterministically with no API key and no quota, which is why
 * this needs no credentials and cannot fail at runtime in a way we have to handle.
 *
 * `hqdefault` over `maxresdefault` deliberately: maxres does not exist for every video and
 * 404s when it does not, which would put a broken image inside the television. hqdefault is
 * generated for every video, and at the size of a TV screen inside a phone-sized room it is
 * already more resolution than the aperture can show.
 */
export function youTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * A creator's content binding → the action it performs.
 *
 * `semantic` decides the *shape* of the action, never the destination: a `video` binding
 * whose URL is a YouTube link plays inline; the same semantic with any other URL opens
 * that URL. Internal semantics (ambience, animation, profile) have no destination yet and
 * resolve to `none` rather than to a guess.
 */
export function interactionFromBinding(binding: NestHotspotContentBinding | undefined): NestInteraction {
  if (!binding) return NO_INTERACTION;
  const label = binding.label;
  const url = safeUrl(binding.url);
  if (!url) {
    // An internal action without a URL is legitimate and simply does nothing yet. A
    // *link* semantic without a usable URL is malformed — see `interactionProblem`.
    return NO_INTERACTION;
  }
  const videoId = youTubeVideoId(url);
  if (videoId) return { type: "open-youtube", url, videoId, ...(label ? { label } : {}) };
  return { type: "open-url", url, ...(label ? { label } : {}) };
}

/** The action a hotspot performs. Resolved from its binding — never from its asset. */
export function interactionForHotspot(hotspot: NestAssetHotspot): NestInteraction {
  if (!hotspot.enabled) return NO_INTERACTION;
  return interactionFromBinding(hotspot.binding);
}

/**
 * The action a whole placement performs when it carries a bare `linkUrl` and no hotspot.
 *
 * Object-level links predate hotspots and are still authored by the simple editor path, so
 * they stay supported — but a hotspot always wins, because it is the more specific thing
 * the creator drew.
 */
export function interactionForPlacement(p: NestPlacement): NestInteraction {
  const url = safeUrl(p.linkUrl);
  if (!url) return NO_INTERACTION;
  const videoId = youTubeVideoId(url);
  if (videoId) return { type: "open-youtube", url, videoId, ...(p.label ? { label: p.label } : {}) };
  return { type: "open-url", url, ...(p.label ? { label: p.label } : {}) };
}

/**
 * Why a hotspot the creator configured will not do anything, or null when it is fine.
 *
 * Malformed interaction data must FAIL VISIBLY rather than disappear — a hotspot that
 * silently does nothing is indistinguishable from a hotspot the runtime forgot to render,
 * which is exactly the ambiguity that made this sprint necessary. The runtime logs this in
 * development and still renders the region, so the creator can see and fix it.
 */
export function interactionProblem(hotspot: NestAssetHotspot): string | null {
  if (!hotspot.enabled) return null;
  const binding = hotspot.binding;
  if (!binding) return null; // never configured — not an error, just not connected yet
  if (isInternalSemantic(binding.type) && !binding.url) return null; // valid internal action
  const raw = (binding.url ?? "").trim();
  if (!raw) return `hotspot "${hotspot.name}" is bound to ${binding.type} but has no URL`;
  if (!safeUrl(raw)) return `hotspot "${hotspot.name}" has an unusable or unsafe URL: ${raw}`;
  return null;
}

/** A one-line description of what will happen, for aria-labels and dev output. */
export function describeInteraction(i: NestInteraction): string {
  switch (i.type) {
    case "open-url":
      return i.label ? `Open ${i.label}` : "Open link";
    case "open-youtube":
      return i.label ? `Play ${i.label}` : "Play video";
    case "enter-focus":
      return i.label ? `Look closer: ${i.label}` : "Look closer";
    case "none":
      return "";
  }
}
