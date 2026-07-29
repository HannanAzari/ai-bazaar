// ── M24 §3 — Notifications, read from the table that already receives them ───
//
// `lib/nest/supabase-social-repo.ts` has been WRITING notifications since M23B (the live
// table holds real rows). What was missing was the reading half: the page, the unread
// badge and tap-through were still on the localStorage store, so a creator never saw the
// follow/like/comment that had genuinely been recorded for them.
//
// This is the read side of that same table. No second backend, no new schema — the only
// column M23B added was a nullable `entity_id` so an unlike can withdraw its own row.
//
// Live shape (the legacy pre-pivot inbox, deliberately reused):
//   id · user_id (recipient) · actor_id · type · title · body · href · entity_id
//   · read · created_at

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type NotificationType = "like" | "follow" | "comment";

export type CreatorNotification = {
  id: string;
  actorId: string | null;
  type: NotificationType;
  /** The Nest's title for like/comment; "Your Nest" as a fallback. */
  title: string;
  /** e.g. "liked your Nest." */
  body: string;
  /** Where tapping it goes. Follow → actor profile; like/comment → the Nest. */
  href: string | null;
  /** Nest slug for like/comment, actor id for follow. */
  entityId: string | null;
  read: boolean;
  createdAt: string;
};

type Row = {
  id: string;
  actor_id: string | null;
  type: string;
  title: string | null;
  body: string | null;
  href: string | null;
  entity_id: string | null;
  read: boolean;
  created_at: string;
};

const COLS = "id, actor_id, type, title, body, href, entity_id, read, created_at";

/** Only the three social types belong in this inbox; legacy rows are ignored. */
const SOCIAL_TYPES: NotificationType[] = ["like", "follow", "comment"];

function sb(): SupabaseClient | null {
  return createSupabaseBrowserClient();
}

function quietly(op: string, error: unknown): void {
  if (process.env.NODE_ENV !== "production") console.warn(`[notifications] ${op}:`, error);
}

function toNotification(r: Row): CreatorNotification {
  return {
    id: r.id,
    actorId: r.actor_id,
    type: r.type as NotificationType,
    title: r.title ?? "Your Nest",
    body: r.body ?? "",
    href: r.href,
    entityId: r.entity_id,
    read: r.read,
    createdAt: r.created_at,
  };
}

export async function listNotifications(recipientId: string, limit = 50): Promise<CreatorNotification[]> {
  const client = sb();
  if (!client || !recipientId) return [];
  const { data, error } = await client
    .from("notifications")
    .select(COLS)
    .eq("user_id", recipientId)
    .in("type", SOCIAL_TYPES)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error; // the page shows a real error state rather than "no notifications"
  return ((data ?? []) as Row[]).map(toNotification);
}

export async function unreadCount(recipientId: string): Promise<number> {
  const client = sb();
  if (!client || !recipientId) return 0;
  const { count, error } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", recipientId)
    .in("type", SOCIAL_TYPES)
    .eq("read", false);
  if (error) { quietly("unreadCount", error); return 0; }
  return count ?? 0;
}

/** Mark one as read — used when a notification is tapped. */
export async function markRead(id: string, recipientId: string): Promise<void> {
  const client = sb();
  if (!client) return;
  const { error } = await client
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
    .eq("user_id", recipientId);
  if (error) quietly("markRead", error);
}

export async function markAllRead(recipientId: string): Promise<void> {
  const client = sb();
  if (!client || !recipientId) return;
  const { error } = await client
    .from("notifications")
    .update({ read: true })
    .eq("user_id", recipientId)
    .eq("read", false);
  if (error) quietly("markAllRead", error);
}

/**
 * Where a notification goes when tapped.
 *
 * `href` is written at creation time, so this is only the fallback for older rows and for
 * follows (which carry the actor id rather than a Nest slug).
 */
export function notificationHref(n: CreatorNotification, actorUsername?: string): string {
  if (n.type === "follow") return actorUsername ? `/@${actorUsername}` : "/explore";
  if (n.href) return n.href;
  return n.entityId ? `/nest/${n.entityId}` : "/home";
}
