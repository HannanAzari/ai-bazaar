import { getEvents } from "@/lib/events";
import { actionLabels } from "@/lib/room-schema";
import type { Room, RoomActionType } from "@/lib/types";

// Lightweight, owner-facing room insights derived from the analytics events
// already in localStorage — no new store, no dashboards. Every object activation
// records one `object_click` with the object's id as `targetId`; we join those
// against the current room to surface the three numbers an owner cares about.

export type RoomInsights = {
  totalClicks: number;
  mostClicked: { objectId: string; label: string; count: number } | null;
  popularType: { actionType: RoomActionType; label: string; count: number } | null;
};

/** Aggregate `object_click` events for a house against its current room. */
export function getRoomInsights(room: Room, shopId: string): RoomInsights {
  const clicks = getEvents().filter((event) => event.type === "object_click" && event.shopId === shopId && event.targetId);

  const byObject = new Map<string, number>();
  const byType = new Map<RoomActionType, number>();
  for (const event of clicks) {
    const id = event.targetId!;
    byObject.set(id, (byObject.get(id) ?? 0) + 1);
    const object = room.objects.find((o) => o.id === id);
    if (object) byType.set(object.actionType, (byType.get(object.actionType) ?? 0) + 1);
  }

  let mostClicked: RoomInsights["mostClicked"] = null;
  for (const [objectId, count] of Array.from(byObject.entries())) {
    if (mostClicked && count <= mostClicked.count) continue;
    const object = room.objects.find((o) => o.id === objectId);
    mostClicked = { objectId, label: object?.label ?? "Removed object", count };
  }

  let popularType: RoomInsights["popularType"] = null;
  for (const [actionType, count] of Array.from(byType.entries())) {
    if (popularType && count <= popularType.count) continue;
    popularType = { actionType, label: actionLabels[actionType], count };
  }

  return { totalClicks: clicks.length, mostClicked, popularType };
}
