import type { BazaarEvent, Shop } from "@/lib/types";

// Discovery ranking V1 — pure ordering for the Featured Nests sections (Tasks
// 6–7). Trending and Recently Active are derived from **real stored analytics**
// (house_view events + last activity), falling back to the shop's seeded
// visit/creation data so the sections are always populated. No feeds, no social
// graph — just three ways to surface existing creators. No I/O here.

/** house_view counts per shop id, from the event stream. */
export function visitCounts(events: BazaarEvent[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (event.type === "house_view" && event.shopId) {
      counts.set(event.shopId, (counts.get(event.shopId) ?? 0) + 1);
    }
  }
  return counts;
}

/** Most recent event timestamp (ISO) per shop id. */
export function lastActiveAt(events: BazaarEvent[]): Map<string, string> {
  const latest = new Map<string, string>();
  for (const event of events) {
    if (!event.shopId) continue;
    const current = latest.get(event.shopId);
    if (!current || event.createdAt > current) latest.set(event.shopId, event.createdAt);
  }
  return latest;
}

/** Drop moderator-hidden / self-hidden shops. */
function visible(shops: Shop[], hidden?: ReadonlySet<string>): Shop[] {
  return shops.filter((shop) => !shop.hidden && !(hidden?.has(shop.address) ?? false));
}

/**
 * Trending = most visited. Primary key is real recorded visits; ties (and shops
 * with no recorded visits yet) fall back to seeded visitor counts then likes, so
 * the rail is meaningful before any browsing has happened.
 */
export function rankTrending(shops: Shop[], events: BazaarEvent[], hidden?: ReadonlySet<string>): Shop[] {
  const counts = visitCounts(events);
  return visible(shops, hidden)
    .map((shop) => ({ shop, visits: counts.get(shop.id) ?? 0 }))
    .sort((a, b) => b.visits - a.visits || b.shop.visitors - a.shop.visitors || b.shop.likes - a.shop.likes)
    .map((entry) => entry.shop);
}

/** New creators = newest houses by creation date. */
export function rankNewCreators(shops: Shop[], hidden?: ReadonlySet<string>): Shop[] {
  return visible(shops, hidden).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Recently active = most recent real activity (any event for the shop), falling
 * back to the house's creation date when it has no recorded events yet.
 */
export function rankRecentlyActive(shops: Shop[], events: BazaarEvent[], hidden?: ReadonlySet<string>): Shop[] {
  const latest = lastActiveAt(events);
  return visible(shops, hidden)
    .map((shop) => ({ shop, activeAt: latest.get(shop.id) ?? shop.createdAt }))
    .sort((a, b) => b.activeAt.localeCompare(a.activeAt))
    .map((entry) => entry.shop);
}
