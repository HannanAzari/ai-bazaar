"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import { nestBackend } from "@/lib/nest-repo";
import * as repo from "@/lib/nest/supabase-notifications-repo";
import {
  listNotifications as localList,
  markAllRead as localMarkAllRead,
  onNotificationsChanged,
  unreadCount as localUnread,
} from "@/lib/nest-notifications-store";

// ── M24 §3 — notifications state, shared by the page and the nav badge ───────
//
// Two consumers need the same number: the Notifications page and the unread dot on the
// bottom nav. They share a tiny store for the same reason the social counters do — two
// independent fetches would disagree, and reading the page would not clear the badge.
//
// Freshness without a second backend: the unread count refetches when the tab regains
// focus and on a slow interval. Supabase Realtime is not used because it is not currently
// configured for this project, and the sprint says not to build a parallel system on a
// maybe. Focus-refetch covers the actual flow (switch to the tab → see the badge).

const isSupabase = () => nestBackend() === "supabase";

// ── The shared unread count ──────────────────────────────────────────────────
let unread = 0;
const listeners = new Set<() => void>();

function setUnread(n: number): void {
  if (n === unread) return;
  unread = Math.max(0, n);
  listeners.forEach((l) => l());
}

function subscribeUnread(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** How often the badge re-checks while the tab is open. Deliberately unhurried. */
const POLL_MS = 60_000;

/** The unread badge. Cheap enough to mount in the nav on every screen. */
export function useUnreadNotifications(): number {
  const { ownerId } = useNestIdentity();
  const count = useSyncExternalStore(subscribeUnread, () => unread, () => 0);

  const refresh = useCallback(async () => {
    if (!ownerId) { setUnread(0); return; }
    if (!isSupabase()) { setUnread(localUnread(ownerId)); return; }
    setUnread(await repo.unreadCount(ownerId));
  }, [ownerId]);

  useEffect(() => {
    void refresh();
    if (!isSupabase()) return onNotificationsChanged(() => void refresh());

    // Refetch when the creator comes back to the tab — this is what makes a follow that
    // happened elsewhere show up without a logout/login or a manual reload.
    const onFocus = () => { if (!document.hidden) void refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, POLL_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(timer);
    };
  }, [refresh]);

  return count;
}

// ── The page ─────────────────────────────────────────────────────────────────
export type NotificationsState = {
  items: repo.CreatorNotification[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  markOneRead: (id: string) => void;
  markEverythingRead: () => void;
};

export function useNotifications(): NotificationsState {
  const { ownerId } = useNestIdentity();
  const [items, setItems] = useState<repo.CreatorNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const load = useCallback(async () => {
    if (!ownerId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    if (!isSupabase()) {
      setItems(
        localList(ownerId).map((n) => ({
          id: n.id,
          actorId: n.actorId,
          type: n.type,
          title: "Your Nest",
          body: n.type === "follow" ? "started following you." : `${n.type}d your Nest.`,
          href: n.type === "follow" ? null : `/nest/${n.entityId}`,
          entityId: n.entityId,
          read: n.read,
          createdAt: n.createdAt,
        })),
      );
      setLoading(false);
      return;
    }
    try {
      const rows = await repo.listNotifications(ownerId);
      if (!alive.current) return;
      setError(null);
      setItems(rows);
      setUnread(rows.filter((n) => !n.read).length);
    } catch (e) {
      if (!alive.current) return;
      // A real error state — never an empty inbox that pretends nothing happened.
      setError(e instanceof Error ? e.message : "Notifications could not be loaded.");
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => { void load(); }, [load]);

  const markOneRead = useCallback(
    (id: string) => {
      if (!ownerId) return;
      // Optimistic: the row un-bolds and the badge drops on tap, not after a round-trip.
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnread(unread - 1);
      if (isSupabase()) void repo.markRead(id, ownerId);
    },
    [ownerId],
  );

  const markEverythingRead = useCallback(() => {
    if (!ownerId) return;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    if (isSupabase()) void repo.markAllRead(ownerId);
    else localMarkAllRead(ownerId);
  }, [ownerId]);

  return { items, loading, error, reload: () => void load(), markOneRead, markEverythingRead };
}
