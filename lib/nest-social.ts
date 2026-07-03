// ── M18 — Social layer (real, local persistence) ────────────────────────────
//
// Real likes, follows, comments, and view counts for Nestudio — durable in
// localStorage (survives reloads), keyed by account id. This replaces the M17.1
// UI placeholders with real state so a creator genuinely feels "someone visited my
// Nest." It is the local backend for the preview; the Supabase equivalent is
// supabase/migrations/20260703_01_nest_social.sql (nest_likes / creator_follows /
// nest_comments), enabled at the cutover.
//
// A Nest is identified by its published **slug** (`nestId`). Social actions notify the
// Nest owner (resolved from the local published registry) or the followed creator —
// never yourself.

import { resolvePublishedBySlug } from "@/lib/nest-document-store";
import { createNotification, removeNotification } from "@/lib/nest-notifications-store";

const LIKES_KEY = "nestudio-likes"; // Like[]
const FOLLOWS_KEY = "nestudio-follows"; // Follow[]
const COMMENTS_KEY = "nestudio-comments"; // NestComment[]
const VIEWS_KEY = "nestudio-views"; // Record<nestId, number>
export const NEST_SOCIAL_CHANGED = "nestudio-social-changed";

const isBrowser = () => typeof window !== "undefined";
const now = () => new Date().toISOString();
const rid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 10)}`;

export type Like = { nestId: string; userId: string; createdAt: string };
export type Follow = { followerId: string; creatorId: string; createdAt: string };
export type NestComment = { id: string; nestId: string; userId: string; body: string; createdAt: string };

function read<T>(key: string, fb: T): T {
  if (!isBrowser()) return fb;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fb;
  } catch {
    return fb;
  }
}
function write(key: string, value: unknown) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(NEST_SOCIAL_CHANGED));
  } catch {
    /* ignore */
  }
}

/** The owner (recipient for notifications) of a published Nest, if known locally. */
function nestOwner(nestId: string): string | undefined {
  return resolvePublishedBySlug(nestId)?.ref.ownerId;
}

// ── Likes ──────────────────────────────────────────────────────────────────--
export function likeCount(nestId: string): number {
  return read<Like[]>(LIKES_KEY, []).filter((l) => l.nestId === nestId).length;
}
export function isLiked(nestId: string, userId?: string): boolean {
  if (!userId) return false;
  return read<Like[]>(LIKES_KEY, []).some((l) => l.nestId === nestId && l.userId === userId);
}
/** Toggle a like (one per user per Nest). Returns the new liked state. */
export function toggleLike(nestId: string, userId: string): boolean {
  const likes = read<Like[]>(LIKES_KEY, []);
  const existing = likes.find((l) => l.nestId === nestId && l.userId === userId);
  const owner = nestOwner(nestId);
  if (existing) {
    write(LIKES_KEY, likes.filter((l) => !(l.nestId === nestId && l.userId === userId)));
    if (owner) removeNotification({ recipientId: owner, actorId: userId, type: "like", entityId: nestId });
    return false;
  }
  likes.push({ nestId, userId, createdAt: now() });
  write(LIKES_KEY, likes);
  if (owner) createNotification({ recipientId: owner, actorId: userId, type: "like", entityId: nestId });
  return true;
}
/** Total likes across a creator's published Nests. */
export function likesForOwner(ownerId: string): number {
  const owned = new Set(ownedSlugs(ownerId));
  return read<Like[]>(LIKES_KEY, []).filter((l) => owned.has(l.nestId)).length;
}

// ── Follows ────────────────────────────────────────────────────────────────--
export function isFollowing(followerId: string | undefined, creatorId: string): boolean {
  if (!followerId) return false;
  return read<Follow[]>(FOLLOWS_KEY, []).some((f) => f.followerId === followerId && f.creatorId === creatorId);
}
export function followerCount(creatorId: string): number {
  return read<Follow[]>(FOLLOWS_KEY, []).filter((f) => f.creatorId === creatorId).length;
}
export function followingCount(userId: string): number {
  return read<Follow[]>(FOLLOWS_KEY, []).filter((f) => f.followerId === userId).length;
}
/** Toggle following a creator. Returns the new following state. */
export function toggleFollow(followerId: string, creatorId: string): boolean {
  if (followerId === creatorId) return false; // can't follow yourself
  const follows = read<Follow[]>(FOLLOWS_KEY, []);
  const existing = follows.find((f) => f.followerId === followerId && f.creatorId === creatorId);
  if (existing) {
    write(FOLLOWS_KEY, follows.filter((f) => !(f.followerId === followerId && f.creatorId === creatorId)));
    removeNotification({ recipientId: creatorId, actorId: followerId, type: "follow", entityId: followerId });
    return false;
  }
  follows.push({ followerId, creatorId, createdAt: now() });
  write(FOLLOWS_KEY, follows);
  createNotification({ recipientId: creatorId, actorId: followerId, type: "follow", entityId: followerId });
  return true;
}

// ── Comments ─────────────────────────────────────────────────────────────────
export function listComments(nestId: string): NestComment[] {
  // Newest first. Reverse (latest-appended first) then stable-sort by createdAt desc, so
  // comments added within the same millisecond still order newest-first.
  return read<NestComment[]>(COMMENTS_KEY, []).filter((c) => c.nestId === nestId).reverse().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function commentCount(nestId: string): number {
  return read<NestComment[]>(COMMENTS_KEY, []).filter((c) => c.nestId === nestId).length;
}
export function addComment(nestId: string, userId: string, body: string): NestComment | undefined {
  const text = body.trim();
  if (!text) return undefined;
  const comment: NestComment = { id: rid("cmt"), nestId, userId, body: text.slice(0, 500), createdAt: now() };
  const comments = read<NestComment[]>(COMMENTS_KEY, []);
  comments.push(comment);
  write(COMMENTS_KEY, comments);
  const owner = nestOwner(nestId);
  if (owner) createNotification({ recipientId: owner, actorId: userId, type: "comment", entityId: nestId });
  return comment;
}
/** Delete your own comment. Returns whether it was removed. */
export function deleteComment(id: string, userId: string): boolean {
  const comments = read<NestComment[]>(COMMENTS_KEY, []);
  const next = comments.filter((c) => !(c.id === id && c.userId === userId));
  if (next.length === comments.length) return false;
  write(COMMENTS_KEY, next);
  return true;
}
export function commentsForOwner(ownerId: string): number {
  const owned = new Set(ownedSlugs(ownerId));
  return read<NestComment[]>(COMMENTS_KEY, []).filter((c) => owned.has(c.nestId)).length;
}

// ── Views ──────────────────────────────────────────────────────────────────--
export function viewCount(nestId: string): number {
  return read<Record<string, number>>(VIEWS_KEY, {})[nestId] ?? 0;
}
/** Count a visit (call once per visitor page load; skip the owner's own views). */
export function recordView(nestId: string): void {
  const views = read<Record<string, number>>(VIEWS_KEY, {});
  views[nestId] = (views[nestId] ?? 0) + 1;
  write(VIEWS_KEY, views);
}
export function viewsForOwner(ownerId: string): number {
  const views = read<Record<string, number>>(VIEWS_KEY, {});
  return ownedSlugs(ownerId).reduce((sum, slug) => sum + (views[slug] ?? 0), 0);
}

// ── Helpers ────────────────────────────────────────────────────────────────--
/** The published slugs owned by a creator (from the local publish registry). */
function ownedSlugs(ownerId: string): string[] {
  if (!isBrowser()) return [];
  try {
    const refs = JSON.parse(window.localStorage.getItem("nestudio-published") ?? "{}") as Record<string, { slug: string; ownerId?: string }>;
    return Object.values(refs).filter((r) => r.ownerId === ownerId).map((r) => r.slug);
  } catch {
    return [];
  }
}

export function onSocialChanged(cb: () => void): () => void {
  if (!isBrowser()) return () => {};
  const h = () => cb();
  window.addEventListener(NEST_SOCIAL_CHANGED, h);
  window.addEventListener("storage", h);
  return () => {
    window.removeEventListener(NEST_SOCIAL_CHANGED, h);
    window.removeEventListener("storage", h);
  };
}
