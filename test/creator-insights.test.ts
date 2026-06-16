import { describe, expect, it } from "vitest";
import { computeCreatorInsights, formatDuration } from "@/lib/creator-insights";
import type { BazaarEvent, EventType, HouseRooms, RoomObject } from "@/lib/types";

const SHOP = "shop-1";

function obj(id: string, label: string, actionType: RoomObject["actionType"]): RoomObject {
  return { id, assetId: "ast-x", zoneId: "back_wall", anchorId: "a", x: 0, y: 0, scale: 1, rotation: 0, zIndex: 0, label, actionType, tags: [], hidden: false };
}

const house: HouseRooms = {
  shopAddress: "a.b.c",
  entryRoomId: "room-1",
  rooms: [
    { id: "room-1", shopAddress: "a.b.c", name: "Entry", type: "standard", theme: "warm", background: "standard", zones: [], objects: [obj("obj-1", "Gallery", "gallery"), obj("obj-2", "Link", "link")] },
    { id: "room-2", shopAddress: "a.b.c", name: "Studio", type: "studio", theme: "warm", background: "standard", zones: [], objects: [obj("obj-3", "Booking", "booking")] },
  ],
};

let seq = 0;
function ev(type: EventType, extra: Partial<BazaarEvent> = {}): BazaarEvent {
  return { id: `e${seq++}`, type, shopId: SHOP, createdAt: "2026-06-15T12:00:00Z", ...extra };
}

const events: BazaarEvent[] = [
  // visits from two distinct visitors (one repeat)
  ev("house_view", { visitorId: "v1" }),
  ev("house_view", { visitorId: "v1" }),
  ev("house_view", { visitorId: "v2" }),
  // room entries: a mount (no target → entry room) + two into room-2
  ev("room_entered"),
  ev("room_entered", { targetId: "room-2" }),
  ev("room_entered", { targetId: "room-2" }),
  // object interactions
  ev("object_view", { targetId: "obj-1" }),
  ev("object_view", { targetId: "obj-1" }),
  ev("object_view", { targetId: "obj-1" }),
  ev("object_view", { targetId: "obj-1" }),
  ev("object_click", { targetId: "obj-1" }),
  ev("object_click", { targetId: "obj-1" }),
  ev("object_click", { targetId: "obj-2" }),
  ev("gallery_opened", { targetId: "obj-1" }),
  // sessions with known durations → avg 2000ms
  ev("session_ended", { metadata: { durationMs: 1000 } }),
  ev("session_ended", { metadata: { durationMs: 3000 } }),
  // an event for a different shop must be ignored
  ev("house_view", { shopId: "shop-2", visitorId: "v9" }),
];

describe("computeCreatorInsights", () => {
  const insights = computeCreatorInsights(events, SHOP, house);

  it("counts total visits for this shop only", () => {
    expect(insights.totalVisits).toBe(3);
  });

  it("counts unique visitors by visitor id", () => {
    expect(insights.uniqueVisitors).toBe(2);
  });

  it("counts room entries", () => {
    expect(insights.roomEntries).toBe(3);
  });

  it("averages session duration from session_ended events", () => {
    expect(insights.avgSessionDurationMs).toBe(2000);
  });

  it("computes conversion = interactions ÷ visits", () => {
    expect(insights.interactions).toBe(3);
    expect(insights.conversion).toBe(100);
  });

  it("ranks top objects by clicks with engagement %", () => {
    const top = insights.topObjects[0];
    expect(top.objectId).toBe("obj-1");
    expect(top.views).toBe(4);
    expect(top.clicks).toBe(2);
    expect(top.opens).toBe(1); // gallery_opened
    expect(top.engagement).toBe(50); // 2 clicks / 4 views
  });

  it("identifies the top room (entry mount attributed to entry room)", () => {
    expect(insights.topRoom?.roomId).toBe("room-2");
    expect(insights.topRoom?.entries).toBe(2);
    expect(insights.topRoom?.name).toBe("Studio");
  });

  it("identifies the busiest day of week", () => {
    expect(insights.topDayOfWeek).not.toBeNull();
    expect(typeof insights.topDayOfWeek?.day).toBe("string");
    // all shop events share one day → its count equals the shop event total (16)
    expect(insights.topDayOfWeek?.count).toBe(16);
  });

  it("builds the visitor funnel steps", () => {
    const byKey = Object.fromEntries(insights.funnel.map((step) => [step.key, step.count]));
    expect(byKey.visits).toBe(3);
    expect(byKey.rooms).toBe(3);
    expect(byKey.interactions).toBe(3);
    expect(byKey.exits).toBe(2);
  });

  it("returns zeros with no events", () => {
    const empty = computeCreatorInsights([], SHOP, house);
    expect(empty.totalVisits).toBe(0);
    expect(empty.uniqueVisitors).toBe(0);
    expect(empty.topObjects).toHaveLength(0);
    expect(empty.topRoom).toBeNull();
    expect(empty.conversion).toBe(0);
  });
});

describe("formatDuration", () => {
  it("formats seconds and minutes", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(45000)).toBe("45s");
    expect(formatDuration(80000)).toBe("1m 20s");
  });
});
