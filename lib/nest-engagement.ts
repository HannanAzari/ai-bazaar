// ── M17.1 — Placeholder engagement (UI only, NO backend) ─────────────────────
//
// Discovery feels alive when Nests show likes/comments — but there is no social
// backend this sprint. These are **deterministic placeholders** derived from a stable
// id, so counts don't flicker between renders and never imply real data changing.
// Every surface that shows them also disables the control (see the feed/owner views).

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Deterministic 0..max-1 draw for a given id + salt. */
function draw(id: string, salt: string, max: number): number {
  return hash(`${id}:${salt}`) % max;
}

export type NestEngagement = { likes: number; comments: number; shares: number; views: number };

/** Stable placeholder engagement for a Nest (feed cards + owner view). */
export function placeholderEngagement(id: string): NestEngagement {
  const likes = draw(id, "likes", 400);
  return {
    likes,
    comments: draw(id, "comments", 40),
    shares: draw(id, "shares", 25),
    views: likes * 6 + draw(id, "views", 200),
  };
}

export type SocialCounts = { followers: number; following: number };

/** Stable placeholder follower/following counts for a profile. */
export function placeholderSocial(handle: string): SocialCounts {
  return { followers: draw(handle, "followers", 500), following: draw(handle, "following", 300) };
}

/** Compact count formatting: 1200 → "1.2k". */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(n % 1000 >= 100 ? 1 : 0)}k`;
}
