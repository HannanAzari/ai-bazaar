import { describe, it, expect, beforeEach } from "vitest";
import {
  adoptLocalWork,
  canEditDoc,
  countAdoptableWork,
  createDocFromBackground,
  listDrafts,
  listPublished,
  publishDoc,
  setDocOwner,
} from "@/lib/nest-document-store";

// M16 — ownership + Phase 4 migration on the local store.
describe("ownership", () => {
  beforeEach(() => localStorage.clear());

  it("canEditDoc allows the owner and un-owned guest drafts, denies others", () => {
    expect(canEditDoc({ ownerId: undefined }, "acct-1")).toBe(true); // guest draft
    expect(canEditDoc({ ownerId: "acct-1" }, "acct-1")).toBe(true); // owner
    expect(canEditDoc({ ownerId: "acct-1" }, "acct-2")).toBe(false); // someone else
  });

  it("listDrafts is owner-aware (own + un-owned, not other accounts')", () => {
    createDocFromBackground("bg-1", "Guest draft"); // un-owned
    createDocFromBackground("bg-1", "Mine", "acct-1");
    createDocFromBackground("bg-1", "Theirs", "acct-2");
    const mine = listDrafts("acct-1").map((d) => d.title);
    expect(mine).toContain("Mine");
    expect(mine).toContain("Guest draft");
    expect(mine).not.toContain("Theirs");
  });
});

describe("migration (adopt local work)", () => {
  beforeEach(() => localStorage.clear());

  it("adopts un-owned + legacy-stub work into an account without losing any", () => {
    const guest = createDocFromBackground("bg-1", "Guest draft"); // un-owned
    const legacy = createDocFromBackground("bg-2", "Legacy draft", "stub-1"); // M15 stub owner
    setDocOwner(legacy.id, "stub-1");
    // A published nest owned by the stub.
    const pub = createDocFromBackground("bg-3", "Legacy published", "stub-1");
    publishDoc(pub.id, "public", "stub-1");

    const pending = countAdoptableWork("acct-1", "stub-1");
    expect(pending.drafts).toBeGreaterThanOrEqual(2);
    expect(pending.published).toBe(1);

    const moved = adoptLocalWork("acct-1", "stub-1");
    expect(moved.published).toBe(1);

    // Everything now belongs to the account.
    expect(listDrafts("acct-1").map((d) => d.id)).toEqual(expect.arrayContaining([guest.id, legacy.id]));
    expect(listPublished("acct-1")).toHaveLength(1);
    // Idempotent: a second run adopts nothing new.
    expect(adoptLocalWork("acct-1", "stub-1")).toEqual({ drafts: 0, published: 0 });
    // No nest lost — the published one is still resolvable.
    expect(listPublished("stub-1")).toHaveLength(0);
  });
});
