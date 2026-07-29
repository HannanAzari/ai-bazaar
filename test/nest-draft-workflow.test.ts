import { beforeEach, describe, expect, it, vi } from "vitest";

// ── M24B §4 — the draft workflow ─────────────────────────────────────────────
//
// A published Nest must keep serving its live version while its creator edits over
// several sessions (the YouTube model). The invariant these defend:
//
//   saving a PUBLISHED Nest must never touch what visitors see.

const calls: { op: string; args: unknown[] }[] = [];

vi.mock("@/lib/nest/supabase-nest-repo", () => ({
  NestRepoError: class extends Error {},
  saveNest: (...a: unknown[]) => { calls.push({ op: "saveNest", args: a }); return Promise.resolve(a[0]); },
  saveNestDraft: (...a: unknown[]) => { calls.push({ op: "saveNestDraft", args: a }); return Promise.resolve(); },
  getNestDraft: (...a: unknown[]) => { calls.push({ op: "getNestDraft", args: a }); return Promise.resolve(null); },
  publishNestDraft: (...a: unknown[]) => {
    calls.push({ op: "publishNestDraft", args: a });
    return Promise.resolve({ slug: "s", url: "/nest/s", visibility: a[1] });
  },
  publishNest: (...a: unknown[]) => { calls.push({ op: "publishNest", args: a }); return Promise.resolve({ slug: "s", url: "/nest/s", visibility: a[1] }); },
}));

vi.mock("@/lib/supabase/project-info", () => ({ hasSupabaseEnv: () => true }));

const doc = {
  id: "nest-1",
  title: "My Living Room",
  backgroundId: "bg-1",
  visibility: "public" as const,
  placements: [{ id: "p1", assetId: "ast-sofa", x: 0.1, y: 0.2, w: 0.3, h: 0.2 }],
  createdAt: "",
  updatedAt: "",
};

beforeEach(() => {
  calls.length = 0;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  delete process.env.NEXT_PUBLIC_NEST_BACKEND;
  vi.resetModules();
});

describe("saving", () => {
  it("a PUBLISHED Nest saves to the draft — the live version is untouched", async () => {
    const { saveWork } = await import("@/lib/nest-repo");
    const r = await saveWork(doc, true);
    expect(r.target).toBe("draft");
    expect(calls.map((c) => c.op)).toEqual(["saveNestDraft"]);
    // Crucially: saveNest (which rewrites what visitors read) was NOT called.
    expect(calls.some((c) => c.op === "saveNest")).toBe(false);
  });

  it("an UNPUBLISHED Nest saves straight to the live row — no visitors to protect", async () => {
    const { saveWork } = await import("@/lib/nest-repo");
    const r = await saveWork({ ...doc, visibility: "draft" }, false);
    expect(r.target).toBe("live");
    expect(calls.map((c) => c.op)).toEqual(["saveNest"]);
  });

  it("stores the complete scene document in the draft", async () => {
    const { saveWork } = await import("@/lib/nest-repo");
    await saveWork(doc, true);
    const [nestId, draft] = calls[0].args as [string, { title: string; backgroundId: string; placements: unknown[] }];
    expect(nestId).toBe("nest-1");
    expect(draft).toEqual({
      title: "My Living Room",
      backgroundId: "bg-1",
      placements: doc.placements,
    });
  });
});

describe("publishing", () => {
  it("promotes the pending draft rather than re-publishing the older live version", async () => {
    const { publish } = await import("@/lib/nest-repo");
    await publish("nest-1", "public");
    expect(calls.map((c) => c.op)).toEqual(["publishNestDraft"]);
  });

  it("keeps the visibility the creator chose", async () => {
    const { publish } = await import("@/lib/nest-repo");
    const r = await publish("nest-1", "unlisted");
    expect(r.visibility).toBe("unlisted");
  });
});

describe("reopening", () => {
  it("asks for the pending draft, so editing resumes where it left off", async () => {
    const { loadPendingDraft } = await import("@/lib/nest-repo");
    await loadPendingDraft("nest-1");
    expect(calls.map((c) => c.op)).toEqual(["getNestDraft"]);
  });

  it("returns null on the local/demo backend rather than inventing one", async () => {
    process.env.NEXT_PUBLIC_NEST_BACKEND = "local";
    vi.resetModules();
    const { loadPendingDraft } = await import("@/lib/nest-repo");
    await expect(loadPendingDraft("nest-1")).resolves.toBeNull();
    expect(calls).toHaveLength(0);
  });
});
