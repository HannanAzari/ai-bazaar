// ── M18 — Notifications (real, local persistence) ────────────────────────────
//
// The first useful notifications: someone liked / followed / commented. Durable
// (localStorage; survives reloads), keyed by recipient account id. This is the local
// backend for the preview; the Supabase equivalent is the `notifications` table in
// supabase/migrations/20260703_01_nest_social.sql, enabled at the cutover.
//
// Standalone (no other social deps) so lib/nest-social can create notifications without
// a cycle. No push, no email — an unread badge + an in-app list.

export type NotificationType = "like" | "follow" | "comment";

export type NestNotification = {
  id: string;
  recipientId: string;
  actorId: string;
  type: NotificationType;
  /** The nest slug (like/comment) or the actor id (follow). */
  entityId: string;
  read: boolean;
  createdAt: string;
};

const KEY = "nestudio-notifications";
export const NEST_NOTIFICATIONS_CHANGED = "nestudio-notifications-changed";

const isBrowser = () => typeof window !== "undefined";
const now = () => new Date().toISOString();
const rid = () => `ntf-${Math.random().toString(36).slice(2, 10)}`;

function read(): NestNotification[] {
  if (!isBrowser()) return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as NestNotification[];
  } catch {
    return [];
  }
}
function write(list: NestNotification[]) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(NEST_NOTIFICATIONS_CHANGED));
  } catch {
    /* ignore */
  }
}

/** Record a notification. No-op when acting on your own thing (don't notify yourself). */
export function createNotification(input: { recipientId: string; actorId: string; type: NotificationType; entityId: string }): void {
  if (!input.recipientId || input.recipientId === input.actorId) return;
  const list = read();
  list.push({ id: rid(), read: false, createdAt: now(), ...input });
  write(list);
}

/** Remove a matching notification (e.g. when an unlike/unfollow undoes one). */
export function removeNotification(input: { recipientId: string; actorId: string; type: NotificationType; entityId: string }): void {
  const list = read();
  const next = list.filter((n) => !(n.recipientId === input.recipientId && n.actorId === input.actorId && n.type === input.type && n.entityId === input.entityId));
  if (next.length !== list.length) write(next);
}

export function listNotifications(recipientId: string): NestNotification[] {
  return read().filter((n) => n.recipientId === recipientId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function unreadCount(recipientId: string): number {
  return read().filter((n) => n.recipientId === recipientId && !n.read).length;
}

export function markAllRead(recipientId: string): void {
  const list = read();
  let changed = false;
  for (const n of list) if (n.recipientId === recipientId && !n.read) { n.read = true; changed = true; }
  if (changed) write(list);
}

/** Today's interaction tallies for the owner's activity summary. */
export function todayCounts(recipientId: string): { likes: number; follows: number; comments: number } {
  const today = new Date().toDateString();
  const out = { likes: 0, follows: 0, comments: 0 };
  for (const n of read()) {
    if (n.recipientId !== recipientId) continue;
    if (new Date(n.createdAt).toDateString() !== today) continue;
    if (n.type === "like") out.likes += 1;
    else if (n.type === "follow") out.follows += 1;
    else if (n.type === "comment") out.comments += 1;
  }
  return out;
}

export function onNotificationsChanged(cb: () => void): () => void {
  if (!isBrowser()) return () => {};
  const h = () => cb();
  window.addEventListener(NEST_NOTIFICATIONS_CHANGED, h);
  window.addEventListener("storage", h);
  return () => {
    window.removeEventListener(NEST_NOTIFICATIONS_CHANGED, h);
    window.removeEventListener("storage", h);
  };
}
