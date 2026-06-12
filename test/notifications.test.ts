import { describe, it, expect } from "vitest";
import { addNotification, getNotifications, markAllRead, markRead, unreadCount } from "@/lib/notifications";

describe("notifications read/unread", () => {
  it("tracks unread count and toggles individual + all read", () => {
    addNotification({ type: "like", title: "New like", body: "Someone liked your house." });
    addNotification({ type: "follow", title: "New follower", body: "A neighbour followed you." });
    expect(unreadCount()).toBe(2);

    const [first] = getNotifications();
    markRead(first.id);
    expect(unreadCount()).toBe(1);

    markRead(first.id, false);
    expect(unreadCount()).toBe(2);

    markAllRead();
    expect(unreadCount()).toBe(0);
  });
});
