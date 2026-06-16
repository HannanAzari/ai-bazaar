import { describe, expect, it } from "vitest";
import { lastActiveAt, rankNewCreators, rankRecentlyActive, rankTrending, visitCounts } from "@/lib/discovery";
import type { BazaarEvent, EventType, Shop } from "@/lib/types";

function shop(id: string, partial: Partial<Shop> = {}): Shop {
  return {
    id,
    address: `${id}.test.house`,
    bazaarId: "b1",
    slotNumber: 1,
    name: id,
    owner: "Owner",
    ownerHandle: `@${id}`,
    tagline: "",
    bio: "",
    avatar: "X",
    palette: "",
    cover: "",
    likes: 0,
    followers: 0,
    visitors: 0,
    createdAt: "2026-01-01",
    links: [],
    decorations: [],
    ...partial,
  };
}

let seq = 0;
function ev(type: EventType, shopId: string, createdAt: string): BazaarEvent {
  return { id: `e${seq++}`, type, shopId, createdAt };
}

const shops = [
  shop("a", { visitors: 10, likes: 5, createdAt: "2026-06-01" }),
  shop("b", { visitors: 100, likes: 50, createdAt: "2026-06-10" }),
  shop("c", { visitors: 1, likes: 1, createdAt: "2026-06-20", hidden: true }),
  shop("d", { visitors: 5, likes: 2, createdAt: "2026-06-15" }),
];

const events = [
  ev("house_view", "a", "2026-06-24T10:00:00Z"),
  ev("house_view", "a", "2026-06-24T11:00:00Z"),
  ev("house_view", "a", "2026-06-24T12:00:00Z"),
  ev("house_view", "d", "2026-06-25T09:00:00Z"),
  ev("object_click", "d", "2026-06-25T18:00:00Z"),
];

describe("visitCounts / lastActiveAt", () => {
  it("counts house_view events per shop", () => {
    const counts = visitCounts(events);
    expect(counts.get("a")).toBe(3);
    expect(counts.get("d")).toBe(1);
    expect(counts.get("b")).toBeUndefined();
  });

  it("tracks the latest activity timestamp per shop", () => {
    const latest = lastActiveAt(events);
    expect(latest.get("a")).toBe("2026-06-24T12:00:00Z");
    expect(latest.get("d")).toBe("2026-06-25T18:00:00Z");
  });
});

describe("rankTrending", () => {
  it("ranks by recorded visits first, then seeded data", () => {
    const ranked = rankTrending(shops, events).map((item) => item.id);
    // a has 3 recorded visits, d has 1; b/d have none beyond that, so b falls back
    // to its high seeded visitor count. Hidden c is excluded.
    expect(ranked[0]).toBe("a");
    expect(ranked).not.toContain("c");
    expect(ranked).toContain("b");
  });

  it("falls back to seeded visitors when there are no events", () => {
    const ranked = rankTrending(shops, []).map((item) => item.id);
    expect(ranked[0]).toBe("b"); // highest seeded visitors
  });

  it("excludes moderator-hidden addresses", () => {
    const ranked = rankTrending(shops, events, new Set(["a.test.house"])).map((item) => item.id);
    expect(ranked).not.toContain("a");
  });
});

describe("rankNewCreators", () => {
  it("orders by creation date, newest first, excluding hidden", () => {
    const ranked = rankNewCreators(shops).map((item) => item.id);
    expect(ranked).toEqual(["d", "b", "a"]);
  });
});

describe("rankRecentlyActive", () => {
  it("orders by most recent activity, falling back to creation date", () => {
    const ranked = rankRecentlyActive(shops, events).map((item) => item.id);
    // d's last event (06-25) > a's (06-24) > b (no events → createdAt 06-10)
    expect(ranked).toEqual(["d", "a", "b"]);
  });
});
