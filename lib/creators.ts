import type { Shop, ShopLink } from "@/lib/types";

// A creator is derived from the houses they own. The demo has one house per
// owner, but the model aggregates by handle so multi-house owners work later.

export type Creator = {
  handle: string;        // bare handle, no leading "@"
  displayHandle: string; // with "@"
  name: string;
  avatar: string;
  bio: string;
  links: ShopLink[];
  houses: Shop[];
  followers: number;
  following: number;
};

/** Normalize a handle: strip a leading @, lowercase, trim. */
export function normalizeHandle(value: string): string {
  return value.replace(/^@/, "").toLowerCase().trim();
}

/** Stable pseudo "following" count for demo data, derived from the handle. */
function demoFollowing(handle: string): number {
  let h = 0;
  for (let i = 0; i < handle.length; i++) h = (h * 31 + handle.charCodeAt(i)) >>> 0;
  return 8 + (h % 120);
}

export function getCreator(shops: Shop[], handle: string): Creator | null {
  const target = normalizeHandle(handle);
  const houses = shops.filter((shop) => normalizeHandle(shop.ownerHandle) === target);
  if (houses.length === 0) return null;

  const primary = houses[0];
  // Links are deduped across the creator's houses by url.
  const links: ShopLink[] = [];
  const seenUrls = new Set<string>();
  for (const house of houses) {
    for (const link of house.links) {
      if (seenUrls.has(link.url)) continue;
      seenUrls.add(link.url);
      links.push(link);
    }
  }

  return {
    handle: target,
    displayHandle: primary.ownerHandle.startsWith("@") ? primary.ownerHandle : `@${target}`,
    name: primary.owner,
    avatar: primary.avatar,
    bio: primary.bio,
    links,
    houses,
    followers: houses.reduce((sum, house) => sum + house.followers, 0),
    following: demoFollowing(target),
  };
}
