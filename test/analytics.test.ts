import { describe, expect, it, vi } from "vitest";
import { eventCounts, getEvents, trackEvent, trackEventLocal } from "@/lib/events";
import { LocalEventsRepository } from "@/lib/repos/local";
import { SupabaseEventsRepository, mapEventRow } from "@/lib/repos/supabase";
import { startSession } from "@/lib/visitor-session";
import type { EventType } from "@/lib/types";

// ── Demo (local) analytics: the default path, unchanged behaviour ──
describe("trackEvent (demo mode)", () => {
  it("appends events to the local store", () => {
    trackEvent("house_view", { shopId: "shop-1" });
    trackEvent("object_click", { shopId: "shop-1", targetId: "obj-1" });
    const events = getEvents();
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("house_view");
    expect(events[1].targetId).toBe("obj-1");
  });

  it("survives a 'reload' — events are read back from storage", () => {
    trackEvent("room_view", { shopId: "shop-1" });
    // Re-reading (as a fresh page load would) returns the persisted event.
    expect(getEvents().some((event) => event.type === "room_view")).toBe(true);
  });

  it("auto-enriches events with the active visitor + session ids", () => {
    const session = startSession("shop-1");
    trackEvent("object_view", { shopId: "shop-1", targetId: "obj-1" });
    const event = getEvents().find((item) => item.type === "object_view");
    expect(event?.visitorId).toBe(session?.visitorId);
    expect(event?.sessionId).toBe(session?.sessionId);
  });

  it("counts include the new analytics event types and start at zero", () => {
    const counts = eventCounts();
    expect(counts.session_started).toBe(0);
    expect(counts.object_view).toBe(0);
    trackEventLocal("object_view", { shopId: "shop-1" });
    expect(eventCounts().object_view).toBe(1);
  });
});

describe("LocalEventsRepository", () => {
  it("records and lists through the demo store", async () => {
    const repo = new LocalEventsRepository();
    await repo.record("like", { shopId: "shop-1" });
    const list = await repo.list();
    expect(list.some((event) => event.type === "like")).toBe(true);
    const counts = await repo.counts();
    expect(counts.like).toBe(1);
  });
});

// ── Production (Supabase) analytics: durable writes + reads via a mock client ──
type AnyResult = { data: unknown; error: unknown };

function builder(result: AnyResult) {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.order = () => b;
  b.limit = () => Promise.resolve(result);
  b.then = (resolve: (value: AnyResult) => unknown) => Promise.resolve(result).then(resolve);
  return b;
}

function mockClient(opts: { events?: unknown[]; counts?: unknown[]; rpc?: ReturnType<typeof vi.fn> } = {}) {
  const rpc = opts.rpc ?? vi.fn(() => Promise.resolve({ error: null }));
  return {
    rpc,
    from: (table: string) =>
      table === "event_counts"
        ? builder({ data: opts.counts ?? [], error: null })
        : builder({ data: opts.events ?? [], error: null }),
  } as never;
}

describe("SupabaseEventsRepository", () => {
  it("records via the record_event RPC with metadata packing", async () => {
    const rpc = vi.fn(() => Promise.resolve({ error: null }));
    const repo = new SupabaseEventsRepository(mockClient({ rpc }));
    await repo.record("object_click", {
      shopId: "shop-uuid",
      targetId: "obj-1",
      visitorId: "vis-1",
      sessionId: "ses-1",
      metadata: { durationMs: 1200 },
    });
    expect(rpc).toHaveBeenCalledWith("record_event", {
      p_type: "object_click",
      p_shop_id: "shop-uuid",
      p_metadata: { durationMs: 1200, targetId: "obj-1", visitorId: "vis-1", sessionId: "ses-1" },
    });
  });

  it("throws when the RPC errors so the caller can fall back", async () => {
    const rpc = vi.fn(() => Promise.resolve({ error: new Error("rls denied") }));
    const repo = new SupabaseEventsRepository(mockClient({ rpc }));
    await expect(repo.record("house_view", { shopId: "s" })).rejects.toThrow("rls denied");
  });

  it("lists events, unpacking ids from the metadata jsonb", async () => {
    const rows = [
      { id: "e1", type: "object_view" as EventType, shop_id: "shop-1", metadata: { visitorId: "vis-1", targetId: "obj-1" }, created_at: "2026-06-25T00:00:00Z" },
    ];
    const repo = new SupabaseEventsRepository(mockClient({ events: rows }));
    const list = await repo.list();
    expect(list[0]).toMatchObject({ id: "e1", type: "object_view", shopId: "shop-1", visitorId: "vis-1", targetId: "obj-1" });
  });

  it("counts from the event_counts view, zero-filling missing types", async () => {
    const repo = new SupabaseEventsRepository(mockClient({ counts: [{ type: "house_view", total: 7 }] }));
    const counts = await repo.counts();
    expect(counts.house_view).toBe(7);
    expect(counts.object_view).toBe(0);
  });
});

describe("mapEventRow", () => {
  it("separates known ids from leftover metadata", () => {
    const event = mapEventRow({
      id: "e1",
      type: "session_ended",
      shop_id: "shop-1",
      metadata: { visitorId: "vis-1", sessionId: "ses-1", durationMs: 5000 },
      created_at: "2026-06-25T00:00:00Z",
    });
    expect(event.visitorId).toBe("vis-1");
    expect(event.sessionId).toBe("ses-1");
    expect(event.metadata).toEqual({ durationMs: 5000 });
  });

  it("handles null metadata and shop_id", () => {
    const event = mapEventRow({ id: "e2", type: "follow", shop_id: null, metadata: null, created_at: "2026-06-25T00:00:00Z" });
    expect(event.shopId).toBeUndefined();
    expect(event.metadata).toBeUndefined();
  });
});
