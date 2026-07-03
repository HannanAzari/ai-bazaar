import { describe, expect, it } from "vitest";
import {
  DEFAULT_STYLE_KEY,
  HOUSE_STYLES,
  deriveHouse,
  hashSeed,
  houseFromItems,
  houseInitial,
  personaToStyleKey,
  styleFor,
} from "@/lib/nest-house";
import type { DiscoveryItem } from "@/lib/nest-discovery";
import type { NestDocument } from "@/lib/nest-document-types";

const doc: NestDocument = {
  id: "d1", backgroundId: "bg-creator-loft", title: "My Loft", visibility: "public",
  placements: [], createdAt: "", updatedAt: "",
};

function item(over: Partial<DiscoveryItem> = {}): DiscoveryItem {
  return {
    key: "k", id: "s1", title: "My Loft", creator: { id: "u1", username: "hannan", displayName: "Hannan" },
    doc, tags: [], visibility: "public", source: "published", href: "/nest/s1", ...over,
  };
}

describe("personaToStyleKey", () => {
  it("maps known personas to cozy styles", () => {
    expect(personaToStyleKey("Creator")).toBe("creator");
    expect(personaToStyleKey("Gamer")).toBe("gamer");
    expect(personaToStyleKey("Writer")).toBe("writer");
    expect(personaToStyleKey("Minimalist")).toBe("minimalist");
  });
  it("matches loosely by keyword", () => {
    expect(personaToStyleKey("Indie game dev")).toBe("gamer");
    expect(personaToStyleKey("Author & reader")).toBe("writer");
    expect(personaToStyleKey("Nature / garden")).toBe("garden");
    expect(personaToStyleKey("Digital artist")).toBe("creator");
  });
  it("falls back to the default style", () => {
    expect(personaToStyleKey(undefined)).toBe(DEFAULT_STYLE_KEY);
    expect(personaToStyleKey("")).toBe(DEFAULT_STYLE_KEY);
    expect(personaToStyleKey("something new")).toBe(DEFAULT_STYLE_KEY);
  });
  it("every style key resolves to a real palette", () => {
    for (const key of ["creator", "gamer", "writer", "minimalist", "garden", "cottage"]) {
      expect(HOUSE_STYLES[key]).toBeTruthy();
      expect(HOUSE_STYLES[key].wall).toMatch(/^#/);
    }
  });
});

describe("hashSeed", () => {
  it("is deterministic and unsigned", () => {
    expect(hashSeed("house:hannan")).toBe(hashSeed("house:hannan"));
    expect(hashSeed("a")).not.toBe(hashSeed("b"));
    expect(hashSeed("anything")).toBeGreaterThanOrEqual(0);
  });
});

describe("deriveHouse", () => {
  it("builds a stable house from a creator + persona", () => {
    const a = deriveHouse({ creator: { id: "u1", username: "hannan", displayName: "Hannan" }, persona: "Writer" });
    const b = deriveHouse({ creator: { id: "u1", username: "hannan", displayName: "Hannan" }, persona: "Writer" });
    expect(a.seed).toBe(b.seed);
    expect(a.style.key).toBe("writer");
    expect(a.handle).toBe("hannan");
    expect(a.isReal).toBe(true);
    expect(typeof a.online).toBe("boolean");
  });
  it("uses the username as the stable id and falls back for names", () => {
    expect(deriveHouse({ creator: { username: "ivy" } }).id).toBe("ivy");
    expect(deriveHouse({ creator: { displayName: "Nestudio" } }).name).toBe("Nestudio");
    expect(deriveHouse({ creator: {} }).name).toBe("A Nestudio creator");
  });
  it("carries the enter target through", () => {
    const h = deriveHouse({ creator: { username: "ivy" }, nestHref: "/nest/x", latestNestTitle: "Reading Room" });
    expect(h.nestHref).toBe("/nest/x");
    expect(h.latestNestTitle).toBe("Reading Room");
  });
});

describe("houseFromItems", () => {
  it("collapses a creator's items into one house (newest = primary)", () => {
    const h = houseFromItems([item({ title: "Newest", href: "/nest/new", category: "Gamer" }), item({ title: "Older" })]);
    expect(h?.latestNestTitle).toBe("Newest");
    expect(h?.nestHref).toBe("/nest/new");
    expect(h?.style.key).toBe("gamer");
  });
  it("returns null with no items", () => {
    expect(houseFromItems([])).toBeNull();
  });
});

describe("houseInitial", () => {
  it("prefers the name, then the handle", () => {
    expect(houseInitial({ name: "Hannan", handle: "h" })).toBe("H");
    expect(houseInitial({ name: "", handle: "ivy" })).toBe("I");
  });
});

describe("styleFor", () => {
  it("never returns undefined", () => {
    expect(styleFor(undefined)).toBe(HOUSE_STYLES[DEFAULT_STYLE_KEY]);
  });
});
