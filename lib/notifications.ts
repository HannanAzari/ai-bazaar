import type { Notification, NotificationType } from "@/lib/types";

// Demo notifications. Stored in localStorage so the bell and the notifications
// page work without a backend; production writes the same shape to the Supabase
// `notifications` table (see schema.sql). No push delivery in this sprint.

const STORAGE_KEY = "ai-bazaar-notifications";
const SEEDED_KEY = "ai-bazaar-notifications-seeded";
const MAX = 200;

export const notificationLabels: Record<NotificationType, string> = {
  house_view: "House visit",
  like: "New like",
  follow: "New follower",
  guestbook_entry: "Guestbook note",
  item_click: "Item opened",
  report_status: "Report update",
};

function read(): Notification[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as Notification[];
  } catch {
    return [];
  }
}

function write(items: Notification[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX)));
  window.dispatchEvent(new Event("ai-bazaar-notifications-changed"));
}

export function getNotifications(): Notification[] {
  return read().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function unreadCount(): number {
  return read().filter((item) => !item.read).length;
}

/** Add a notification to the top of the list. No-op during SSR. */
export function addNotification(input: {
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
}): void {
  if (typeof window === "undefined") return;
  const notification: Notification = {
    id: `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    read: false,
    createdAt: new Date().toISOString(),
    ...input,
  };
  write([notification, ...read()]);
}

export function markRead(id: string, value = true) {
  write(read().map((item) => (item.id === id ? { ...item, read: value } : item)));
}

export function markAllRead() {
  write(read().map((item) => ({ ...item, read: true })));
}

/**
 * Populate a friendly set of starter notifications the first time the bell is
 * shown, so the foundation is visible without a multi-user backend.
 */
export function seedDemoNotifications() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(SEEDED_KEY)) return;
  window.localStorage.setItem(SEEDED_KEY, "true");
  if (read().length > 0) return;

  const now = Date.now();
  const minutes = (m: number) => new Date(now - m * 60_000).toISOString();
  const samples: Notification[] = [
    { id: "seed-1", type: "follow", title: "New follower", body: "Mina Farah started following you.", href: "/u/minamakes", read: false, createdAt: minutes(8) },
    { id: "seed-2", type: "like", title: "New like", body: "Someone liked your house.", read: false, createdAt: minutes(42) },
    { id: "seed-3", type: "guestbook_entry", title: "Guestbook note", body: "Theo left a note in your guestbook.", read: false, createdAt: minutes(95) },
    { id: "seed-4", type: "house_view", title: "House visit", body: "Your house had 12 visits today.", read: true, createdAt: minutes(180) },
    { id: "seed-5", type: "report_status", title: "Report update", body: "A report you filed was reviewed.", href: "/moderation", read: true, createdAt: minutes(600) },
  ];
  write(samples);
}
