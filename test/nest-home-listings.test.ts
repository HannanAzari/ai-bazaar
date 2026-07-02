import { describe, it, expect, beforeEach } from "vitest";
import {
  createDocFromBackground,
  listDrafts,
  listPublished,
  publishDoc,
  publishedUrl,
} from "@/lib/nest-document-store";

// M15 — the Home/Explore listings read the same local store the editor writes to.
// A doc is a draft until published; publishing moves it into the published list.
describe("Home listings", () => {
  beforeEach(() => localStorage.clear());

  it("a new doc shows as a draft, not published", () => {
    const doc = createDocFromBackground("bg-1", "My Nest");
    expect(listDrafts().map((d) => d.id)).toContain(doc.id);
    expect(listPublished()).toHaveLength(0);
  });

  it("publishing moves a doc out of drafts into published", () => {
    const doc = createDocFromBackground("bg-1", "My Nest");
    const result = publishDoc(doc.id, "public", "owner-1");
    expect(result).toBeDefined();
    expect(listDrafts().map((d) => d.id)).not.toContain(doc.id);
    const pub = listPublished();
    expect(pub).toHaveLength(1);
    expect(pub[0].ref.ownerId).toBe("owner-1");
  });

  it("listPublished filters by owner", () => {
    const a = createDocFromBackground("bg-1", "A");
    const b = createDocFromBackground("bg-2", "B");
    publishDoc(a.id, "public", "owner-1");
    publishDoc(b.id, "public", "owner-2");
    expect(listPublished("owner-1")).toHaveLength(1);
    expect(listPublished("owner-1")[0].doc.id).toBe(a.id);
  });

  it("a shareable published nest gets a self-contained ?c= url", () => {
    const doc = createDocFromBackground("bg-1", "Cozy");
    publishDoc(doc.id, "public", "owner-1");
    const entry = listPublished("owner-1")[0];
    expect(publishedUrl(entry)).toMatch(/^\/nest\/.+\?c=.+/);
  });
});
