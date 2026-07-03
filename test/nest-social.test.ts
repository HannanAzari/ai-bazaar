import { describe, it, expect, beforeEach } from "vitest";
import {
  addComment,
  commentCount,
  deleteComment,
  followerCount,
  followingCount,
  isFollowing,
  isLiked,
  likeCount,
  listComments,
  recordView,
  toggleFollow,
  toggleLike,
  viewCount,
} from "@/lib/nest-social";
import { listNotifications, todayCounts, unreadCount } from "@/lib/nest-notifications-store";
import { createDocFromBackground, publishDoc } from "@/lib/nest-document-store";

// Publish a Nest owned by `owner` and return its slug.
function publish(owner: string, title = "My Nest"): string {
  const doc = createDocFromBackground("bg-1", title, owner);
  return publishDoc(doc.id, "public", owner)!.slug;
}

describe("likes", () => {
  beforeEach(() => localStorage.clear());

  it("toggles one like per user and updates the count + notifies the owner", () => {
    const slug = publish("owner-1");
    expect(likeCount(slug)).toBe(0);
    expect(toggleLike(slug, "visitor-1")).toBe(true);
    expect(likeCount(slug)).toBe(1);
    expect(isLiked(slug, "visitor-1")).toBe(true);
    // Owner got a "like" notification.
    expect(listNotifications("owner-1").filter((n) => n.type === "like")).toHaveLength(1);
    // Toggling again unlikes + removes the notification.
    expect(toggleLike(slug, "visitor-1")).toBe(false);
    expect(likeCount(slug)).toBe(0);
    expect(listNotifications("owner-1").filter((n) => n.type === "like")).toHaveLength(0);
  });

  it("does not notify the owner for their own like", () => {
    const slug = publish("owner-1");
    toggleLike(slug, "owner-1");
    expect(likeCount(slug)).toBe(1);
    expect(listNotifications("owner-1")).toHaveLength(0);
  });
});

describe("follows", () => {
  beforeEach(() => localStorage.clear());

  it("follows/unfollows and tracks counts + a notification", () => {
    expect(toggleFollow("f1", "creator-1")).toBe(true);
    expect(isFollowing("f1", "creator-1")).toBe(true);
    expect(followerCount("creator-1")).toBe(1);
    expect(followingCount("f1")).toBe(1);
    expect(listNotifications("creator-1").filter((n) => n.type === "follow")).toHaveLength(1);
    expect(toggleFollow("f1", "creator-1")).toBe(false);
    expect(followerCount("creator-1")).toBe(0);
  });

  it("cannot follow yourself", () => {
    expect(toggleFollow("me", "me")).toBe(false);
    expect(followerCount("me")).toBe(0);
  });
});

describe("comments", () => {
  beforeEach(() => localStorage.clear());

  it("adds newest-first, notifies the owner, and deletes only your own", () => {
    const slug = publish("owner-1");
    addComment(slug, "visitor-1", "first");
    addComment(slug, "visitor-2", "second");
    const list = listComments(slug);
    expect(list.map((c) => c.body)).toEqual(["second", "first"]); // newest first
    expect(commentCount(slug)).toBe(2);
    expect(listNotifications("owner-1").filter((n) => n.type === "comment")).toHaveLength(2);
    // Another user cannot delete your comment; the author can.
    const mine = list.find((c) => c.userId === "visitor-1")!;
    expect(deleteComment(mine.id, "someone-else")).toBe(false);
    expect(deleteComment(mine.id, "visitor-1")).toBe(true);
    expect(commentCount(slug)).toBe(1);
  });

  it("ignores empty comments", () => {
    const slug = publish("owner-1");
    expect(addComment(slug, "visitor-1", "   ")).toBeUndefined();
    expect(commentCount(slug)).toBe(0);
  });
});

describe("views + notifications inbox", () => {
  beforeEach(() => localStorage.clear());

  it("counts views", () => {
    const slug = publish("owner-1");
    recordView(slug);
    recordView(slug);
    expect(viewCount(slug)).toBe(2);
  });

  it("aggregates unread + today's tallies for the owner", () => {
    const slug = publish("owner-1");
    toggleLike(slug, "v1");
    addComment(slug, "v2", "hi");
    toggleFollow("v3", "owner-1");
    expect(unreadCount("owner-1")).toBe(3);
    expect(todayCounts("owner-1")).toEqual({ likes: 1, comments: 1, follows: 1 });
  });
});
