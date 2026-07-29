import { describe, expect, it } from "vitest";
import { notificationHref, type CreatorNotification } from "@/lib/nest/supabase-notifications-repo";

// ── M24 §3 — notifications navigate to the right place ───────────────────────
//
// The table has been receiving rows since M23B; the page was still reading localStorage.
// Tap-through is the part most likely to rot silently, so it is pinned here.

const base: CreatorNotification = {
  id: "n1",
  actorId: "actor-1",
  type: "like",
  title: "My Living Room",
  body: "liked your Nest.",
  href: "/nest/my-living-room-ab12",
  entityId: "my-living-room-ab12",
  read: false,
  createdAt: "2026-07-28T10:00:00.000Z",
};

describe("tap destinations", () => {
  it("Like → the relevant Nest", () => {
    expect(notificationHref(base)).toBe("/nest/my-living-room-ab12");
  });

  it("Comment → the relevant Nest", () => {
    expect(notificationHref({ ...base, type: "comment", body: "commented on your Nest." })).toBe(
      "/nest/my-living-room-ab12",
    );
  });

  it("Follow → the ACTOR's profile, not a Nest", () => {
    const follow: CreatorNotification = { ...base, type: "follow", href: null, entityId: "actor-1" };
    expect(notificationHref(follow, "ada")).toBe("/@ada");
  });

  it("Follow with no resolvable handle falls back somewhere useful", () => {
    const follow: CreatorNotification = { ...base, type: "follow", href: null, entityId: "actor-1" };
    expect(notificationHref(follow)).toBe("/explore");
  });

  it("rebuilds a Nest link from entity_id when an older row has no href", () => {
    expect(notificationHref({ ...base, href: null })).toBe("/nest/my-living-room-ab12");
  });

  it("never produces a dead link", () => {
    const shapes: CreatorNotification[] = [
      { ...base, href: null, entityId: null },
      { ...base, type: "comment", href: null, entityId: null },
      { ...base, type: "follow", href: null, entityId: null },
    ];
    for (const n of shapes) {
      const href = notificationHref(n);
      expect(href.startsWith("/")).toBe(true);
      expect(href.length).toBeGreaterThan(1);
    }
  });
});

describe("the message a creator reads", () => {
  // The page composes "<actor> liked “<title>”" from these fields; this documents the
  // shape the writer (supabase-social-repo) must keep producing.
  it("carries everything needed to render a sentence without another query", () => {
    expect(base.actorId).toBeTruthy();
    expect(base.title).toBeTruthy();
    expect(base.type).toBe("like");
    expect(base.createdAt).toBeTruthy();
    expect(base.read).toBe(false);
  });
});
