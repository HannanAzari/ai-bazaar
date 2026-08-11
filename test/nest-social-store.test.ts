import { beforeEach, describe, expect, it, vi } from "vitest";
import * as store from "@/lib/nest-social-store";

// ── M24 §8 — one social state layer, so every surface agrees ─────────────────
//
// The founder's report: a like or comment needed a refresh to show, following someone
// didn't move the follower count on their Profile, and Home / full Nest / drawer / Profile
// could each show a different number for the same thing.
//
// These pin the store's contract: optimistic, shared, clamped, and reversible.

beforeEach(() => store.resetSocialStore());

describe("likes", () => {
  it("moves the count optimistically and marks the viewer's own like", () => {
    store.setNestCounts("cosy-ab12", { likeCount: 4, liked: false, commentCount: 1 });
    const next = store.applyLike("cosy-ab12", true);
    expect(next).toEqual({ likeCount: 5, liked: true, commentCount: 1 });
  });

  it("decrements on unlike", () => {
    store.setNestCounts("cosy-ab12", { likeCount: 4, liked: true, commentCount: 0 });
    expect(store.applyLike("cosy-ab12", false)?.likeCount).toBe(3);
  });

  it("never double-counts a repeated like", () => {
    store.setNestCounts("cosy-ab12", { likeCount: 4, liked: true, commentCount: 0 });
    store.applyLike("cosy-ab12", true);
    store.applyLike("cosy-ab12", true);
    expect(store.getNestCounts("cosy-ab12")?.likeCount).toBe(4);
  });

  it("never renders a negative count from a stale cache", () => {
    store.setNestCounts("cosy-ab12", { likeCount: 0, liked: true, commentCount: 0 });
    expect(store.applyLike("cosy-ab12", false)?.likeCount).toBe(0);
  });

  it("rolls back to the exact previous snapshot when persistence fails", () => {
    const before = { likeCount: 4, liked: false, commentCount: 2 };
    store.setNestCounts("cosy-ab12", before);
    store.applyLike("cosy-ab12", true);
    store.revertNest("cosy-ab12", before);
    expect(store.getNestCounts("cosy-ab12")).toEqual(before);
  });
});

describe("comments", () => {
  it("increments immediately when a comment is posted", () => {
    store.setNestCounts("cosy-ab12", { likeCount: 0, liked: false, commentCount: 2 });
    store.applyCommentDelta("cosy-ab12", 1);
    expect(store.getNestCounts("cosy-ab12")?.commentCount).toBe(3);
  });

  it("decrements when a comment is deleted, and never goes below zero", () => {
    store.setNestCounts("cosy-ab12", { likeCount: 0, liked: false, commentCount: 0 });
    store.applyCommentDelta("cosy-ab12", -1);
    expect(store.getNestCounts("cosy-ab12")?.commentCount).toBe(0);
  });
});

describe("follows", () => {
  it("moves the follower count optimistically", () => {
    store.setCreatorCounts("creator-1", { followerCount: 10, following: false });
    expect(store.applyFollow("creator-1", true)).toEqual({ followerCount: 11, following: true });
  });

  it("decrements on unfollow and clamps at zero", () => {
    store.setCreatorCounts("creator-1", { followerCount: 0, following: true });
    expect(store.applyFollow("creator-1", false)?.followerCount).toBe(0);
  });

  it("prevents a duplicate follow from inflating the count", () => {
    store.setCreatorCounts("creator-1", { followerCount: 10, following: false });
    store.applyFollow("creator-1", true);
    store.applyFollow("creator-1", true);
    expect(store.getCreatorCounts("creator-1")?.followerCount).toBe(11);
  });

  it("rolls back a failed follow", () => {
    const before = { followerCount: 10, following: false };
    store.setCreatorCounts("creator-1", before);
    store.applyFollow("creator-1", true);
    store.revertCreator("creator-1", before);
    expect(store.getCreatorCounts("creator-1")).toEqual(before);
  });
});

describe("every subscriber is notified — this is what 'update everywhere' means", () => {
  it("notifies all listeners on a like, a comment and a follow", () => {
    // Four listeners stand in for Home, the full Nest, the creator drawer and Profile.
    const listeners = [vi.fn(), vi.fn(), vi.fn(), vi.fn()];
    const unsubs = listeners.map((l) => store.subscribe(l));

    store.setNestCounts("cosy-ab12", { likeCount: 1, liked: false, commentCount: 0 });
    store.setCreatorCounts("creator-1", { followerCount: 1, following: false });
    listeners.forEach((l) => l.mockClear());

    store.applyLike("cosy-ab12", true);
    listeners.forEach((l) => expect(l).toHaveBeenCalledTimes(1));

    store.applyCommentDelta("cosy-ab12", 1);
    listeners.forEach((l) => expect(l).toHaveBeenCalledTimes(2));

    store.applyFollow("creator-1", true);
    listeners.forEach((l) => expect(l).toHaveBeenCalledTimes(3));

    unsubs.forEach((u) => u());
  });

  it("bumps the version so useSyncExternalStore sees a new snapshot", () => {
    const before = store.getVersion();
    store.setNestCounts("cosy-ab12", { likeCount: 0, liked: false, commentCount: 0 });
    expect(store.getVersion()).toBeGreaterThan(before);
  });

  it("stops notifying after unsubscribe", () => {
    const listener = vi.fn();
    store.subscribe(listener)();
    store.setNestCounts("cosy-ab12", { likeCount: 1, liked: false, commentCount: 0 });
    expect(listener).not.toHaveBeenCalled();
  });

  it("survives a listener unsubscribing during its own notification", () => {
    const other = vi.fn();
    // `const` is safe despite the self-reference: the callback only runs on a later
    // `setNestCounts`, long after the binding is initialised.
    const unsubSelf: () => void = store.subscribe(() => unsubSelf());
    store.subscribe(other);
    expect(() => store.setNestCounts("x", { likeCount: 0, liked: false, commentCount: 0 })).not.toThrow();
    expect(other).toHaveBeenCalled();
  });
});

describe("sign-out", () => {
  it("clears every cached count so the next account starts clean", () => {
    store.setNestCounts("cosy-ab12", { likeCount: 9, liked: true, commentCount: 3 });
    store.setCreatorCounts("creator-1", { followerCount: 9, following: true });
    store.resetSocialStore();
    expect(store.getNestCounts("cosy-ab12")).toBeUndefined();
    expect(store.getCreatorCounts("creator-1")).toBeUndefined();
  });
});
