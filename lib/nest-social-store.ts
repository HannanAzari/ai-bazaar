// ── M24 §8 — ONE social state layer ──────────────────────────────────────────
//
// The founder's report: likes and comments persist but need a refresh to show; following
// someone doesn't move the follower count on their Profile; and Home, the full Nest, the
// creator drawer and Profile can each show a different number for the same thing.
//
// The cause was structural — every surface kept its OWN counter. `useNestSocial` fetched
// per Nest, `FollowButton` fetched per creator, Profile counted separately. Nothing told
// anything else that a number had changed, so they only agreed after a reload.
//
// This is that missing layer: a tiny module-level cache plus a subscription. Any component
// can read a value, any component can mutate it, and EVERY subscriber re-renders. It is
// deliberately not React Query or SWR — the app has no data-fetching library, and adding
// one to fix a counter would be new architecture this sprint is told not to introduce.
//
// The mutation shape is always the same:
//
//     optimistic write → notify subscribers → persist → reconcile → rollback if it failed
//
// so the UI moves on tap and only ever disagrees with the server for as long as the
// request is in flight.

export type NestSocialCounts = {
  likeCount: number;
  liked: boolean;
  commentCount: number;
};

export type CreatorSocialCounts = {
  followerCount: number;
  following: boolean;
};

type Listener = () => void;

const nestCache = new Map<string, NestSocialCounts>();
const creatorCache = new Map<string, CreatorSocialCounts>();
const listeners = new Set<Listener>();

/** Bumped on every write so `useSyncExternalStore` consumers see a new snapshot. */
let version = 0;

function notify(): void {
  version += 1;
  // Snapshot before calling out: a listener may unsubscribe during its own notification.
  listeners.forEach((l) => l());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getVersion(): number {
  return version;
}

// ── Reads ────────────────────────────────────────────────────────────────────
export function getNestCounts(slug: string): NestSocialCounts | undefined {
  return nestCache.get(slug);
}

export function getCreatorCounts(creatorId: string): CreatorSocialCounts | undefined {
  return creatorCache.get(creatorId);
}

// ── Writes ───────────────────────────────────────────────────────────────────

/** Seed/replace a Nest's counts from the server. Used after a fetch or a reconcile. */
export function setNestCounts(slug: string, counts: NestSocialCounts): void {
  nestCache.set(slug, counts);
  notify();
}

export function setCreatorCounts(creatorId: string, counts: CreatorSocialCounts): void {
  creatorCache.set(creatorId, counts);
  notify();
}

/**
 * Apply a like/unlike everywhere at once.
 *
 * Counts are clamped at zero: a stale cache plus an unlike must never render "-1", which
 * is the kind of detail that makes an app feel broken even when the data is fine.
 */
export function applyLike(slug: string, liked: boolean): NestSocialCounts | undefined {
  const current = nestCache.get(slug);
  if (!current) return undefined;
  if (current.liked === liked) return current; // already in this state — no double count
  const next: NestSocialCounts = {
    ...current,
    liked,
    likeCount: Math.max(0, current.likeCount + (liked ? 1 : -1)),
  };
  nestCache.set(slug, next);
  notify();
  return next;
}

export function applyCommentDelta(slug: string, delta: number): void {
  const current = nestCache.get(slug);
  if (!current) return;
  nestCache.set(slug, { ...current, commentCount: Math.max(0, current.commentCount + delta) });
  notify();
}

/**
 * Apply a follow/unfollow everywhere at once — the Follow button, the creator drawer, the
 * Profile's follower count and any visible creator card, in the same tick.
 */
export function applyFollow(creatorId: string, following: boolean): CreatorSocialCounts | undefined {
  const current = creatorCache.get(creatorId);
  if (!current) return undefined;
  if (current.following === following) return current; // guards against a duplicate follow
  const next: CreatorSocialCounts = {
    following,
    followerCount: Math.max(0, current.followerCount + (following ? 1 : -1)),
  };
  creatorCache.set(creatorId, next);
  notify();
  return next;
}

/** Restore a previous snapshot after a failed write. */
export function revertNest(slug: string, previous: NestSocialCounts | undefined): void {
  if (previous) nestCache.set(slug, previous);
  else nestCache.delete(slug);
  notify();
}

export function revertCreator(creatorId: string, previous: CreatorSocialCounts | undefined): void {
  if (previous) creatorCache.set(creatorId, previous);
  else creatorCache.delete(creatorId);
  notify();
}

/** Drop everything — used on sign-out so the next account never sees stale counts. */
export function resetSocialStore(): void {
  nestCache.clear();
  creatorCache.clear();
  notify();
}
