import { listPublished, publishedUrl, type PublishedNest } from "@/lib/nest-document-store";
import { isShareable } from "@/lib/nest-document-types";

// ── The creator's Nest reel ──────────────────────────────────────────────────
//
// Day 3.2 groundwork. Arriving at a creator's House and stepping inside should begin an
// IMMERSIVE sequence — nest 1, then swipe left/right through the rest — never a grid of
// cards. The swipe UI is NOT built yet (it needs no new routing: /nest/<slug> already
// exists, so a future pass navigates between the slugs this module returns).
//
// This module is the single source of "which Nests, in which order" so the House entry
// point and a future swipe view can never disagree. Pure ordering logic — no UI, no fetch,
// no new storage. `listPublished` is already the store's ordering (newest first).

export type ReelEntry = { slug: string; url: string; title: string; entry: PublishedNest };

/** The creator's published Nests as an ordered reel (newest first). */
export function creatorReel(ownerId?: string): ReelEntry[] {
  return listPublished(ownerId).map((entry) => ({
    slug: entry.ref.slug,
    url: publishedUrl(entry),
    title: entry.doc.title,
    entry,
  }));
}

/**
 * The reel a given viewer may move through. Visitors only ever swipe between SHAREABLE
 * Nests (public/unlisted) — followers-only and private Nests are never reachable by
 * swiping. The owner sees all of their own.
 */
export function viewableReel(ownerId: string | undefined, isOwner: boolean): ReelEntry[] {
  const all = creatorReel(ownerId);
  return isOwner ? all : all.filter((r) => isShareable(r.entry.ref.visibility));
}

/** Where "Enter Nest" leads — the first screen of the reel (undefined when nothing is published). */
export function reelEntryPoint(reel: ReelEntry[]): ReelEntry | undefined {
  return reel[0];
}

/** Position of a slug inside the reel, or -1. The future swipe view uses this to seek. */
export function reelIndexOf(reel: ReelEntry[], slug: string): number {
  return reel.findIndex((r) => r.slug === slug);
}

/** Neighbours for horizontal swiping. Non-wrapping: the ends are the ends. */
export function reelNeighbours(reel: ReelEntry[], slug: string): { prev?: ReelEntry; next?: ReelEntry } {
  const i = reelIndexOf(reel, slug);
  if (i < 0) return {};
  return { prev: i > 0 ? reel[i - 1] : undefined, next: i < reel.length - 1 ? reel[i + 1] : undefined };
}
