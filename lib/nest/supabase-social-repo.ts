// ── M23B — Supabase social repository ────────────────────────────────────────
//
// Likes, comments and follows against the shared tables, keyed by a Nest's stable
// **slug** so a like survives a re-publish and can be resolved straight from a share URL.
//
// Notifications reuse the EXISTING `public.notifications` table (the legacy pre-pivot
// inbox: user_id / type / title / body / href / actor_id / read). We deliberately did not
// create a second notification system — the only schema change is one nullable
// `entity_id` column so an unlike can withdraw the row it created.
//
// One like per user per Nest is enforced by the primary key `(nest_slug, user_id)`, not
// by client-side bookkeeping.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { NestRepoError } from "@/lib/nest/supabase-nest-repo";

function sb(): SupabaseClient {
  const client = createSupabaseBrowserClient();
  if (!client) throw new NestRepoError("Supabase is not configured in this build.");
  return client;
}

function fail(op: string, error: unknown): never {
  const detail =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "unknown error");
  console.error(`[social-repo] ${op} failed:`, error);
  throw new NestRepoError(`${op} failed: ${detail}`, error);
}

export type NestComment = {
  id: string;
  nestSlug: string;
  userId: string;
  body: string;
  createdAt: string;
};

export type NestSocialState = {
  likeCount: number;
  liked: boolean;
  commentCount: number;
};

// ── Reads ────────────────────────────────────────────────────────────────────

/** Everything the engagement rail needs for one Nest, in two round-trips. */
export async function loadSocialState(nestSlug: string, viewerId?: string): Promise<NestSocialState> {
  const client = sb();
  const [likes, comments] = await Promise.all([
    client.from("nest_likes").select("user_id", { count: "exact" }).eq("nest_slug", nestSlug),
    client.from("nest_comments").select("id", { count: "exact", head: true }).eq("nest_slug", nestSlug),
  ]);
  if (likes.error) fail("Loading likes", likes.error);
  if (comments.error) fail("Loading comments", comments.error);
  const rows = (likes.data ?? []) as { user_id: string }[];
  return {
    likeCount: likes.count ?? rows.length,
    liked: !!viewerId && rows.some((r) => r.user_id === viewerId),
    commentCount: comments.count ?? 0,
  };
}

export async function listComments(nestSlug: string, limit = 100): Promise<NestComment[]> {
  const { data, error } = await sb()
    .from("nest_comments")
    .select("id, nest_slug, user_id, body, created_at")
    .eq("nest_slug", nestSlug)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("Loading comments", error);
  return ((data ?? []) as {
    id: string;
    nest_slug: string;
    user_id: string;
    body: string;
    created_at: string;
  }[]).map((r) => ({
    id: r.id,
    nestSlug: r.nest_slug,
    userId: r.user_id,
    body: r.body,
    createdAt: r.created_at,
  }));
}

export async function isFollowing(followerId: string, creatorId: string): Promise<boolean> {
  const { data, error } = await sb()
    .from("creator_follows")
    .select("creator_id")
    .eq("follower_id", followerId)
    .eq("creator_id", creatorId)
    .maybeSingle();
  if (error) fail("Loading follow state", error);
  return !!data;
}

export async function followerCount(creatorId: string): Promise<number> {
  const { count, error } = await sb()
    .from("creator_follows")
    .select("follower_id", { count: "exact", head: true })
    .eq("creator_id", creatorId);
  if (error) fail("Loading followers", error);
  return count ?? 0;
}

// ── Writes ───────────────────────────────────────────────────────────────────

/** Like a Nest. Idempotent — the PK makes a double-like a no-op, not an error. */
export async function like(nestSlug: string, userId: string, ownerId?: string, nestTitle?: string): Promise<void> {
  const { error } = await sb()
    .from("nest_likes")
    .upsert({ nest_slug: nestSlug, user_id: userId }, { onConflict: "nest_slug,user_id" });
  if (error) fail("Liking this Nest", error);
  await notify({ ownerId, actorId: userId, type: "like", nestSlug, nestTitle, body: "liked your Nest." });
}

export async function unlike(nestSlug: string, userId: string): Promise<void> {
  const { error } = await sb().from("nest_likes").delete().eq("nest_slug", nestSlug).eq("user_id", userId);
  if (error) fail("Removing your like", error);
  await withdrawNotification(userId, "like", nestSlug);
}

export async function addComment(
  nestSlug: string,
  userId: string,
  body: string,
  ownerId?: string,
  nestTitle?: string,
): Promise<NestComment> {
  const text = body.trim().slice(0, 500);
  if (!text) throw new NestRepoError("Write something first.");
  const { data, error } = await sb()
    .from("nest_comments")
    .insert({ nest_slug: nestSlug, user_id: userId, body: text })
    .select("id, nest_slug, user_id, body, created_at")
    .single();
  if (error) fail("Posting your comment", error);
  await notify({ ownerId, actorId: userId, type: "comment", nestSlug, nestTitle, body: "commented on your Nest." });
  const r = data as { id: string; nest_slug: string; user_id: string; body: string; created_at: string };
  return { id: r.id, nestSlug: r.nest_slug, userId: r.user_id, body: r.body, createdAt: r.created_at };
}

export async function deleteComment(id: string, userId: string): Promise<void> {
  const { error } = await sb().from("nest_comments").delete().eq("id", id).eq("user_id", userId);
  if (error) fail("Deleting your comment", error);
}

export async function setFollowing(followerId: string, creatorId: string, following: boolean): Promise<void> {
  if (followerId === creatorId) return;
  const client = sb();
  if (following) {
    const { error } = await client
      .from("creator_follows")
      .upsert({ follower_id: followerId, creator_id: creatorId }, { onConflict: "follower_id,creator_id" });
    if (error) fail("Following this creator", error);
    await notify({ ownerId: creatorId, actorId: followerId, type: "follow", body: "started following you." });
    return;
  }
  const { error } = await client
    .from("creator_follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("creator_id", creatorId);
  if (error) fail("Unfollowing this creator", error);
  await withdrawNotification(followerId, "follow", creatorId);
}

// ── Notifications (reusing the existing inbox) ───────────────────────────────
//
// Best-effort by design: a like is a like even if the recipient's bell never rings, and
// the notifications table is not part of the truthfulness contract this sprint is about.
// The failure is logged, never swallowed silently and never surfaced as a failed like.

async function notify(input: {
  ownerId?: string;
  actorId: string;
  type: "like" | "comment" | "follow";
  nestSlug?: string;
  nestTitle?: string;
  body: string;
}): Promise<void> {
  const { ownerId, actorId, type, nestSlug, nestTitle, body } = input;
  if (!ownerId || ownerId === actorId) return; // never notify yourself
  const title = nestTitle ? nestTitle.slice(0, 120) : "Your Nest";
  const { error } = await sb().from("notifications").insert({
    user_id: ownerId,
    actor_id: actorId,
    type,
    title,
    body,
    href: nestSlug ? `/nest/${nestSlug}` : undefined,
    entity_id: nestSlug ?? actorId,
  });
  if (error) console.warn(`[social-repo] notification (${type}) not delivered:`, error);
}

async function withdrawNotification(actorId: string, type: "like" | "follow", entityId: string): Promise<void> {
  const { error } = await sb()
    .from("notifications")
    .delete()
    .eq("actor_id", actorId)
    .eq("type", type)
    .eq("entity_id", entityId);
  if (error) console.warn(`[social-repo] notification (${type}) not withdrawn:`, error);
}
