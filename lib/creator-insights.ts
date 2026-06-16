import type { BazaarEvent, EventType, HouseRooms, RoomActionType, RoomObject } from "@/lib/types";
import { actionLabels } from "@/lib/room-schema";

// Creator Insights V1 — pure aggregation over the analytics event stream for a
// single shop. One module powers the Studio dashboard (Task 4), per-object
// analytics (Task 5), and the visitor funnel (Task 8), so demo (localStorage)
// and production (Supabase) share exactly one computation path. No I/O here.

/** Events that count as "opening" an object (the visitor engaged with it). */
const OPEN_EVENT_TYPES: ReadonlySet<EventType> = new Set<EventType>([
  "gallery_opened",
  "video_opened",
  "product_opened",
  "booking_opened",
  "contact_opened",
  "profile_opened",
  "link_click",
  "room_link_clicked",
]);

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export type ObjectStat = {
  objectId: string;
  label: string;
  actionType: RoomActionType;
  views: number;
  clicks: number;
  opens: number;
  /** clicks ÷ views as a percentage (0 when never viewed). */
  engagement: number;
};

export type FunnelStep = { key: string; label: string; count: number };

export type CreatorInsights = {
  totalVisits: number;
  uniqueVisitors: number;
  roomEntries: number;
  interactions: number;
  avgSessionDurationMs: number;
  /** interactions ÷ visits as a percentage. */
  conversion: number;
  topObjects: ObjectStat[];
  objects: ObjectStat[];
  topRoom: { roomId: string; name: string; entries: number } | null;
  topDayOfWeek: { day: string; count: number } | null;
  funnel: FunnelStep[];
};

const pct = (num: number, denom: number): number => (denom > 0 ? Math.round((num / denom) * 100) : 0);

/** Aggregate all events for one shop into the numbers a creator cares about. */
export function computeCreatorInsights(events: BazaarEvent[], shopId: string, house: HouseRooms | null): CreatorInsights {
  const shopEvents = events.filter((event) => event.shopId === shopId);
  const byType = (type: EventType) => shopEvents.filter((event) => event.type === type);

  const totalVisits = byType("house_view").length;
  const roomEntries = byType("room_entered").length;
  const interactions = byType("object_click").length;

  const uniqueVisitors = new Set(shopEvents.map((event) => event.visitorId).filter(Boolean)).size;

  // Average session duration from session_ended events (durationMs metadata).
  const durations = byType("session_ended")
    .map((event) => Number(event.metadata?.durationMs))
    .filter((ms) => Number.isFinite(ms) && ms >= 0);
  const avgSessionDurationMs = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

  // ── Per-object analytics (views / clicks / opens / engagement) ──
  const rooms = house?.rooms ?? [];
  const allObjects: RoomObject[] = rooms.flatMap((room) => room.objects);
  const tally = (type: EventType) => {
    const map = new Map<string, number>();
    for (const event of byType(type)) {
      if (event.targetId) map.set(event.targetId, (map.get(event.targetId) ?? 0) + 1);
    }
    return map;
  };
  const viewMap = tally("object_view");
  const clickMap = tally("object_click");
  const opensMap = new Map<string, number>();
  for (const event of shopEvents) {
    if (OPEN_EVENT_TYPES.has(event.type) && event.targetId) {
      opensMap.set(event.targetId, (opensMap.get(event.targetId) ?? 0) + 1);
    }
  }

  const objects: ObjectStat[] = allObjects.map((object) => {
    const views = viewMap.get(object.id) ?? 0;
    const clicks = clickMap.get(object.id) ?? 0;
    return {
      objectId: object.id,
      label: object.label || actionLabels[object.actionType] || "Object",
      actionType: object.actionType,
      views,
      clicks,
      opens: opensMap.get(object.id) ?? 0,
      engagement: pct(clicks, views),
    };
  });
  objects.sort((a, b) => b.clicks - a.clicks || b.views - a.views || b.opens - a.opens);
  const topObjects = objects.filter((object) => object.views + object.clicks + object.opens > 0);

  // ── Top room by entries. Navigation entries carry the room id as targetId;
  // the initial mount entry has none, so it is attributed to the entry room. ──
  const roomEntryCounts = new Map<string, number>();
  for (const event of byType("room_entered")) {
    const roomId = event.targetId ?? house?.entryRoomId;
    if (roomId) roomEntryCounts.set(roomId, (roomEntryCounts.get(roomId) ?? 0) + 1);
  }
  let topRoom: CreatorInsights["topRoom"] = null;
  for (const [roomId, entries] of Array.from(roomEntryCounts.entries())) {
    if (topRoom && entries <= topRoom.entries) continue;
    const room = rooms.find((item) => item.id === roomId);
    topRoom = { roomId, name: room?.name ?? "A room", entries };
  }

  // ── Top day of week across all this shop's events. ──
  const dayCounts = new Map<string, number>();
  for (const event of shopEvents) {
    const day = DAY_NAMES[new Date(event.createdAt).getDay()];
    if (day) dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }
  let topDayOfWeek: CreatorInsights["topDayOfWeek"] = null;
  for (const [day, count] of Array.from(dayCounts.entries())) {
    if (topDayOfWeek && count <= topDayOfWeek.count) continue;
    topDayOfWeek = { day, count };
  }

  const exits = byType("session_ended").length;
  const funnel: FunnelStep[] = [
    { key: "visits", label: "Visits", count: totalVisits },
    { key: "rooms", label: "Room entries", count: roomEntries },
    { key: "interactions", label: "Interactions", count: interactions },
    { key: "exits", label: "Exits", count: exits },
  ];

  return {
    totalVisits,
    uniqueVisitors,
    roomEntries,
    interactions,
    avgSessionDurationMs,
    conversion: pct(interactions, totalVisits),
    topObjects,
    objects,
    topRoom,
    topDayOfWeek,
    funnel,
  };
}

/** Human-friendly session duration, e.g. "1m 20s" or "45s". */
export function formatDuration(ms: number): string {
  if (ms <= 0) return "0s";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}
