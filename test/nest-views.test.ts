import { beforeEach, describe, expect, it, vi } from "vitest";

// ── M24 §2 — views: deduplicated, owner-excluded, privacy-safe ───────────────
//
// Views were localStorage-only, so they were per-browser and read 0 for everyone else.
// These cover the rules that make the new shared counter trustworthy.

const insert = vi.fn();
const select = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    from: () => ({
      insert: (row: unknown) => { insert(row); return { select: () => select() }; },
    }),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  select.mockResolvedValue({ data: [{ id: "v1" }], error: null });
});

describe("anonymous viewer key", () => {
  it("is stable for the same browser, so one person counts once", async () => {
    const { anonymousViewerKey } = await import("@/lib/nest/supabase-views-repo");
    expect(anonymousViewerKey()).toBe(anonymousViewerKey());
  });

  it("is random and carries nothing identifying — no IP, no fingerprint", async () => {
    const { anonymousViewerKey } = await import("@/lib/nest/supabase-views-repo");
    const key = anonymousViewerKey();
    expect(key.startsWith("anon-")).toBe(true);
    // A UUID, not anything derived from the person or their device.
    expect(key).toMatch(/^anon-[0-9a-f-]{36}$/i);
  });

  it("prefers the signed-in user id when there is one", async () => {
    const { viewerKey } = await import("@/lib/nest/supabase-views-repo");
    expect(viewerKey("user-123")).toBe("user-123");
    expect(viewerKey()).toMatch(/^anon-/);
  });
});

describe("recording a Nest view", () => {
  it("writes one row keyed by viewer", async () => {
    const { recordNestView } = await import("@/lib/nest/supabase-views-repo");
    await expect(recordNestView("cosy-ab12", "user-123")).resolves.toBe(true);
    expect(insert).toHaveBeenCalledWith({ nest_slug: "cosy-ab12", viewer_key: "user-123" });
  });

  it("treats the unique-index violation as 'already counted', not a failure", async () => {
    // 23505 is the DB enforcing one view per viewer per day — the dedup working.
    select.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } });
    const { recordNestView } = await import("@/lib/nest/supabase-views-repo");
    await expect(recordNestView("cosy-ab12", "user-123")).resolves.toBe(false);
  });

  it("never throws on a backend failure — a counter must not break a page", async () => {
    select.mockResolvedValue({ data: null, error: { code: "42P01", message: "relation does not exist" } });
    const { recordNestView } = await import("@/lib/nest/supabase-views-repo");
    await expect(recordNestView("cosy-ab12", "user-123")).resolves.toBe(false);
  });

  it("ignores an empty slug", async () => {
    const { recordNestView } = await import("@/lib/nest/supabase-views-repo");
    await expect(recordNestView("", "user-123")).resolves.toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("the dwell rule is a real threshold", () => {
  it("waits long enough to exclude an accidental tap", async () => {
    const { VIEW_DWELL_MS } = await import("@/components/nest/social/use-record-view");
    expect(VIEW_DWELL_MS).toBeGreaterThanOrEqual(2000);
    expect(VIEW_DWELL_MS).toBeLessThanOrEqual(3000);
  });
});
