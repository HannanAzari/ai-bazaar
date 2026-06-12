import type { Decoration, Shop, ShopLink } from "@/lib/types";

/** Lowercase, hyphenated, alphanumeric — the one canonical form for a tag. */
export function normalizeTag(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

/** Parse a free-text field ("painting, Portrait  art") into clean unique tags. */
export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  for (const raw of input.split(/[,\n]/)) {
    const tag = normalizeTag(raw);
    if (tag) seen.add(tag);
  }
  return Array.from(seen);
}

export type TaggedItem =
  | { kind: "house"; shop: Shop; tags: string[] }
  | { kind: "decoration"; shop: Shop; decoration: Decoration; tags: string[] }
  | { kind: "link"; shop: Shop; link: ShopLink; tags: string[] };

/** Flatten every tag-bearing thing in a shop into a single list. */
export function collectTaggedItems(shops: Shop[]): TaggedItem[] {
  const items: TaggedItem[] = [];
  for (const shop of shops) {
    if (shop.hidden) continue;
    if (shop.tags?.length) items.push({ kind: "house", shop, tags: shop.tags });
    for (const decoration of shop.decorations) {
      if (decoration.tags?.length) items.push({ kind: "decoration", shop, decoration, tags: decoration.tags });
    }
    for (const link of shop.links) {
      if (link.tags?.length) items.push({ kind: "link", shop, link, tags: link.tags });
    }
  }
  return items;
}

export type TagCount = { tag: string; count: number };

/** Count tag usage across all houses and items, most-used first. */
export function tagCounts(shops: Shop[]): TagCount[] {
  const counts = new Map<string, number>();
  for (const item of collectTaggedItems(shops)) {
    for (const tag of item.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** Every tagged thing carrying a given tag. */
export function itemsForTag(shops: Shop[], tag: string): TaggedItem[] {
  const target = normalizeTag(tag);
  return collectTaggedItems(shops).filter((item) => item.tags.includes(target));
}

/** Distinct houses (deduped) carrying a given tag — directly, or via an item. */
export function housesForTag(shops: Shop[], tag: string): Shop[] {
  const target = normalizeTag(tag);
  const seen = new Set<string>();
  const houses: Shop[] = [];
  for (const item of itemsForTag(shops, target)) {
    if (!seen.has(item.shop.id)) {
      seen.add(item.shop.id);
      houses.push(item.shop);
    }
  }
  return houses;
}
