import type { BazaarEvent, EventType } from "@/lib/types";

// Demo analytics. In the running app events are appended to localStorage so
// counts are visible without a backend; in production the same shape is written
// to the Supabase `events` table via record_event() (see schema.sql).

const STORAGE_KEY = "ai-bazaar-events";
const MAX_EVENTS = 1000;

export const eventLabels: Record<EventType, string> = {
  house_view: "House views",
  room_view: "Room views",
  decoration_click: "Decoration clicks",
  object_click: "Object clicks",
  link_click: "Link clicks",
  share_click: "Shares",
  follow: "Follows",
  like: "Likes",
  room_object_added: "Objects added",
  room_object_deleted: "Objects deleted",
  room_object_moved: "Objects moved",
  room_object_resized: "Objects resized",
  room_template_applied: "Templates applied",
  gallery_opened: "Galleries opened",
  video_opened: "Videos opened",
  product_opened: "Products opened",
  booking_opened: "Bookings opened",
  contact_opened: "Contacts opened",
  profile_opened: "Profiles opened",
  room_entered: "Rooms entered",
  room_created: "Rooms created",
  room_deleted: "Rooms deleted",
  room_link_clicked: "Door/stair clicks",
};

function read(): BazaarEvent[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as BazaarEvent[];
  } catch {
    return [];
  }
}

function write(events: BazaarEvent[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  window.dispatchEvent(new Event("ai-bazaar-events-changed"));
}

/** Record one analytics event. No-op during SSR. */
export function trackEvent(type: EventType, payload: { shopId?: string; targetId?: string } = {}) {
  if (typeof window === "undefined") return;
  const event: BazaarEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    shopId: payload.shopId,
    targetId: payload.targetId,
    createdAt: new Date().toISOString(),
  };
  write([...read(), event]);
}

export function getEvents(): BazaarEvent[] {
  return read();
}

/** Totals per event type, including zeroes, in display order. */
export function eventCounts(): Record<EventType, number> {
  const counts = Object.fromEntries(
    (Object.keys(eventLabels) as EventType[]).map((type) => [type, 0]),
  ) as Record<EventType, number>;
  for (const event of read()) counts[event.type] = (counts[event.type] ?? 0) + 1;
  return counts;
}
