import { describe, it, expect } from "vitest";
import {
  collectCategories,
  collectTags,
  creatorLabel,
  curatedItems,
  filterByTag,
  publishedItem,
  searchDiscovery,
  templateToExample,
  type DiscoveryItem,
} from "@/lib/nest-discovery";
import type { ProductionTemplate } from "@/lib/nest-production-types";
import type { NestDocument } from "@/lib/nest-document-types";

const pubDoc = (over: Partial<NestDocument> = {}): NestDocument => ({
  id: "d1", ownerId: "acct-1", backgroundId: "bg-loft", title: "My Loft",
  visibility: "public", placements: [], createdAt: "", updatedAt: "", ...over,
});

const tpl = (over: Partial<ProductionTemplate> = {}): ProductionTemplate => ({
  id: "loft",
  name: "Creator Loft",
  persona: "Creator",
  backgroundId: "bg-loft",
  objectPlacements: [{ assetId: "ast-tv", x: 0.5, y: 0.8, scale: 0.4, zIndex: 1 }],
  status: "featured",
  tags: ["creator", "loft"],
  previewImage: "/prev/loft.webp",
  ...over,
});

describe("discovery item generation", () => {
  it("builds curated items with source, tags, category, and a self-contained Nest link", () => {
    const [item] = curatedItems([tpl()]);
    expect(item.source).toBe("curated");
    expect(item.title).toBe("Creator Loft");
    expect(item.category).toBe("Creator");
    expect(item.tags).toEqual(["creator", "loft"]);
    expect(item.creator.displayName).toBe("Nestudio");
    expect(item.href).toMatch(/^\/nest\/loft\?c=.+/); // opens the real visitor Nest
  });

  it("templateToExample encodes a shareable ?c= link", () => {
    const { href, doc } = templateToExample(tpl());
    expect(href).toContain("/nest/loft?c=");
    expect(doc.visibility).toBe("public");
  });

  it("builds a published item carrying the creator + visibility", () => {
    const item = publishedItem({
      slug: "my-loft-ab12",
      title: "My Loft",
      visibility: "public",
      href: "/nest/my-loft-ab12?c=xyz",
      creator: { username: "hannan", displayName: "Hannan" }, doc: pubDoc(),
      tags: ["cozy"],
      category: "Creator",
    });
    expect(item.source).toBe("published");
    expect(item.creator.username).toBe("hannan");
    expect(item.visibility).toBe("public");
    expect(item.href).toContain("/nest/my-loft-ab12");
  });
});

describe("published nest inclusion", () => {
  it("a published Nest and curated examples coexist in one list", () => {
    const items: DiscoveryItem[] = [
      publishedItem({ slug: "p1", title: "Mine", visibility: "public", href: "/nest/p1", creator: { username: "hannan" }, doc: pubDoc(), tags: [] }),
      ...curatedItems([tpl(), tpl({ id: "cave", name: "Gamer Cave", persona: "Gamer", tags: ["gamer"] })]),
    ];
    expect(items).toHaveLength(3);
    expect(items.filter((i) => i.source === "published")).toHaveLength(1);
    expect(items.filter((i) => i.source === "curated")).toHaveLength(2);
  });
});

describe("search + filtering", () => {
  const items: DiscoveryItem[] = [
    publishedItem({ slug: "p1", title: "Ceramics Studio", visibility: "public", href: "/nest/p1", creator: { username: "hannan", displayName: "Hannan" }, doc: pubDoc(), tags: ["pottery"], category: "Artist" }),
    ...curatedItems([tpl(), tpl({ id: "cave", name: "Gamer Cave", persona: "Gamer", tags: ["gamer", "neon"] })]),
  ];

  it("empty query returns everything", () => {
    expect(searchDiscovery(items, "")).toHaveLength(items.length);
  });
  it("searches by title", () => {
    expect(searchDiscovery(items, "cave").map((i) => i.id)).toEqual(["cave"]);
  });
  it("searches by creator (username or display name)", () => {
    expect(searchDiscovery(items, "hannan").map((i) => i.title)).toEqual(["Ceramics Studio"]);
  });
  it("searches by tag and by category", () => {
    expect(searchDiscovery(items, "neon").map((i) => i.id)).toEqual(["cave"]);
    expect(searchDiscovery(items, "artist").map((i) => i.title)).toEqual(["Ceramics Studio"]);
  });
  it("filters by an exact tag (case-insensitive)", () => {
    expect(filterByTag(items, "Gamer").map((i) => i.id)).toEqual(["cave"]);
    expect(filterByTag(items, "pottery")).toHaveLength(1);
  });
});

describe("tags + categories + labels + empty states", () => {
  it("collects trending tags and categories", () => {
    const items = curatedItems([tpl(), tpl({ id: "cave", persona: "Gamer", tags: ["creator", "gamer"] })]);
    expect(collectTags(items)).toContain("creator");
    expect(collectCategories(items)).toEqual(expect.arrayContaining(["Creator", "Gamer"]));
  });
  it("creatorLabel prefers @username, then display name, then a default", () => {
    expect(creatorLabel({ username: "hannan" })).toBe("@hannan");
    expect(creatorLabel({ displayName: "Hannan" })).toBe("Hannan");
    expect(creatorLabel({})).toBe("A Nestudio creator");
  });
  it("search/filter of an empty list stays empty (empty-state safety)", () => {
    expect(searchDiscovery([], "anything")).toEqual([]);
    expect(filterByTag([], "x")).toEqual([]);
    expect(collectTags([])).toEqual([]);
  });
});
