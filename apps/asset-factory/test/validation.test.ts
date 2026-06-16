import { describe, it, expect } from "vitest";
import {
  validateImport,
  candidateFromImport,
  parseImportJson,
  isAcceptedImageType,
  isKnownCategory,
} from "@/lib/validation";
import { slugify } from "@/lib/slug";

const good = {
  name: "Cozy Lamp",
  category: "lamp",
  imageUrl: "https://cdn.example.com/lamp.png",
  width: 1024,
  height: 1024,
  transparent: true,
  tags: ["lamp"],
};

describe("import validation", () => {
  it("accepts a complete, valid candidate", () => {
    const r = validateImport(good);
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("requires name, category, image and dimensions", () => {
    const r = validateImport({});
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThanOrEqual(4);
  });

  it("rejects non PNG/WebP images", () => {
    const r = validateImport({ ...good, imageUrl: "https://x/y.jpg" });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/PNG or WebP/);
  });

  it("accepts data URLs and query strings", () => {
    expect(isAcceptedImageType("data:image/png;base64,AAAA")).toBe(true);
    expect(isAcceptedImageType("https://x/y.webp?v=2")).toBe(true);
    expect(isAcceptedImageType("https://x/y.gif")).toBe(false);
  });

  it("warns (not errors) on opaque background and missing tags", () => {
    const r = validateImport({ ...good, transparent: false, tags: [] });
    expect(r.ok).toBe(true);
    expect(r.warnings.length).toBe(2);
  });

  it("knows valid categories", () => {
    expect(isKnownCategory("chair")).toBe(true);
    expect(isKnownCategory("spaceship")).toBe(false);
  });

  it("builds a normalized candidate with category-derived defaults", () => {
    const c = candidateFromImport(good);
    expect(c.slug).toBe(slugify(good.name));
    expect(c.status).toBe("needs_review");
    expect(c.placementType).toBe("floor");
    expect(c.compatibleZones.length).toBeGreaterThan(0);
    expect(c.defaultActionType).toBeTruthy();
  });

  it("throws when building from invalid input", () => {
    expect(() => candidateFromImport({ name: "x" })).toThrow();
  });

  it("parses single object and array JSON", () => {
    expect(parseImportJson('{"name":"a"}')).toEqual({ ok: true, items: [{ name: "a" }] });
    expect(parseImportJson("[{},{}]").ok).toBe(true);
    expect(parseImportJson("nope").ok).toBe(false);
    expect(parseImportJson("123").ok).toBe(false);
  });
});
