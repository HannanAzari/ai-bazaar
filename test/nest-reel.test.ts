import { beforeEach, describe, expect, it } from "vitest";
import { creatorReel, reelEntryPoint, reelIndexOf, reelNeighbours, viewableReel } from "@/lib/nest-reel";
import type { NestDocument, NestVisibility } from "@/lib/nest-document-types";

// Day 3.3 — the Nest reel drives "Enter Nests" and the horizontal swipe inside the viewer.
// These cover zero / one / multiple published Nests, visibility rules, and navigation ends.

const OWNER = "owner-1";
const doc = (id: string, title: string): NestDocument => ({
  id, ownerId: OWNER, backgroundId: "bg-1", placements: [], title,
  visibility: "public", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
});

function seed(entries: { slug: string; id: string; title: string; visibility: NestVisibility }[]) {
  const docs: Record<string, NestDocument> = {};
  const refs: Record<string, { slug: string; docId: string; visibility: NestVisibility; ownerId: string }> = {};
  for (const e of entries) {
    docs[e.id] = { ...doc(e.id, e.title), visibility: e.visibility };
    refs[e.slug] = { slug: e.slug, docId: e.id, visibility: e.visibility, ownerId: OWNER };
  }
  localStorage.setItem("nestudio-nest-documents", JSON.stringify(docs));
  localStorage.setItem("nestudio-published", JSON.stringify(refs));
}

beforeEach(() => {
  localStorage.clear();
});

describe("zero published Nests", () => {
  it("returns an empty reel and no entry point", () => {
    seed([]);
    const reel = creatorReel(OWNER);
    expect(reel).toEqual([]);
    expect(reelEntryPoint(reel)).toBeUndefined();
  });
});

describe("one published Nest", () => {
  it("has an entry point and no neighbours to swipe to", () => {
    seed([{ slug: "a", id: "d1", title: "Only Nest", visibility: "public" }]);
    const reel = creatorReel(OWNER);
    expect(reel).toHaveLength(1);
    expect(reelEntryPoint(reel)?.slug).toBe("a");
    expect(reelNeighbours(reel, "a")).toEqual({ prev: undefined, next: undefined });
  });
});

describe("multiple published Nests", () => {
  const entries = [
    { slug: "a", id: "d1", title: "One", visibility: "public" as const },
    { slug: "b", id: "d2", title: "Two", visibility: "public" as const },
    { slug: "c", id: "d3", title: "Three", visibility: "public" as const },
  ];

  it("orders the reel and exposes each position", () => {
    seed(entries);
    const reel = creatorReel(OWNER);
    expect(reel).toHaveLength(3);
    expect(reelIndexOf(reel, reel[1].slug)).toBe(1);
    expect(reelIndexOf(reel, "not-a-slug")).toBe(-1);
  });

  it("navigates forward and back, and does NOT wrap at the ends", () => {
    seed(entries);
    const reel = creatorReel(OWNER);
    const [first, middle, last] = reel;

    expect(reelNeighbours(reel, first.slug).prev).toBeUndefined();
    expect(reelNeighbours(reel, first.slug).next?.slug).toBe(middle.slug);
    expect(reelNeighbours(reel, middle.slug).prev?.slug).toBe(first.slug);
    expect(reelNeighbours(reel, middle.slug).next?.slug).toBe(last.slug);
    expect(reelNeighbours(reel, last.slug).next).toBeUndefined();
  });

  it("returns nothing for a slug outside the reel (direct URL to another creator's Nest)", () => {
    seed(entries);
    expect(reelNeighbours(creatorReel(OWNER), "elsewhere")).toEqual({});
  });
});

describe("visibility restrictions", () => {
  const mixed = [
    { slug: "pub", id: "d1", title: "Public", visibility: "public" as const },
    { slug: "unl", id: "d2", title: "Unlisted", visibility: "unlisted" as const },
    { slug: "fol", id: "d3", title: "Followers", visibility: "followers" as const },
    { slug: "prv", id: "d4", title: "Private", visibility: "private" as const },
  ];

  it("a VISITOR may only swipe between shareable Nests", () => {
    seed(mixed);
    const slugs = viewableReel(OWNER, false).map((r) => r.slug);
    expect(slugs).toContain("pub");
    expect(slugs).toContain("unl");
    expect(slugs).not.toContain("fol");
    expect(slugs).not.toContain("prv");
  });

  it("the OWNER moves through all of their own Nests", () => {
    seed(mixed);
    expect(viewableReel(OWNER, true)).toHaveLength(4);
  });

  it("a visitor cannot reach a private Nest as a neighbour", () => {
    seed(mixed);
    const visitor = viewableReel(OWNER, false);
    const all = visitor.flatMap((r) => [reelNeighbours(visitor, r.slug).prev?.slug, reelNeighbours(visitor, r.slug).next?.slug]);
    expect(all).not.toContain("prv");
    expect(all).not.toContain("fol");
  });
});
