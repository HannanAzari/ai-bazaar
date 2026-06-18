import { describe, it, expect } from "vitest";
import {
  COLLECTION,
  COLLECTION_KEYS,
  DNA_PROVIDER,
  PERSONALITY_GROUPS,
  PERSONALITIES,
  variantsForCategory,
  safeVariants,
  boldVariants,
  collectionCategory,
  variantPrompt,
  buildDnaPrompts,
  dryRunDnaSamples,
  realDnaSamples,
  dnaSample,
} from "@/lib/sofa-dna";
import { MASTER_PROMPT, NESTUDIO_DNA, NESTUDIO_SIGNATURE } from "@/lib/prompts";
import { obeysNestudioSpecs } from "@/lib/nestudio-spec";

describe("manufacturer collection (V3.7)", () => {
  it("covers sofa, chair, and coffee table", () => {
    expect(COLLECTION_KEYS).toEqual(["sofa", "chair", "coffee_table"]);
    expect(collectionCategory("coffee_table").category).toBe("table"); // golden key → FactoryCategory
    expect(collectionCategory("sofa").category).toBe("sofa");
  });

  it("each category has ten distinct variants, 5 safe + 5 bold, all personalities", () => {
    for (const c of COLLECTION) {
      const vs = variantsForCategory(c.goldenKey);
      expect(vs).toHaveLength(10);
      expect(new Set(vs.map((v) => v.key)).size).toBe(10);
      expect(new Set(vs.map((v) => v.silhouette)).size).toBe(10);
      expect(new Set(vs.map((v) => v.personality))).toEqual(new Set(PERSONALITY_GROUPS));
      expect(safeVariants(c.goldenKey)).toHaveLength(5);
      expect(boldVariants(c.goldenKey)).toHaveLength(5);
    }
  });

  it("a personality keeps the SAME accent + character across every category (one line)", () => {
    for (const p of PERSONALITIES) {
      const acrossCats = COLLECTION.map((c) => variantsForCategory(c.goldenKey).find((v) => v.personality === p.group)!);
      expect(new Set(acrossCats.map((v) => v.accent))).toEqual(new Set([p.accent]));
      expect(new Set(acrossCats.map((v) => v.tier))).toEqual(new Set([p.tier]));
    }
  });

  it("every variant prompt shares the DNA + Signature Design Language + master spine", () => {
    for (const c of COLLECTION) {
      const prompts = buildDnaPrompts(c.goldenKey).map((p) => p.prompt);
      expect(prompts.every((p) => p.startsWith(MASTER_PROMPT))).toBe(true);
      expect(prompts.every((p) => p.includes("Scandinavian"))).toBe(true);
      expect(prompts.every((p) => p.includes("design language"))).toBe(true);
      expect(prompts.every((p) => p.includes("warm-oak wood detailing"))).toBe(true);
      expect(new Set(prompts).size).toBe(10); // distinct per personality
      expect(prompts.every((p) => p.toLowerCase().includes(c.noun.split(" ").pop()!))).toBe(true);
    }
  });

  it("does not modify camera, isolation, or transparency (every variant obeys the specs)", () => {
    for (const c of COLLECTION) {
      for (const v of variantsForCategory(c.goldenKey)) {
        expect(obeysNestudioSpecs(variantPrompt(v))).toBe(true);
      }
    }
  });

  it("dry-run builds 10 OpenAI placeholders under the category's golden itemKey", () => {
    const samples = dryRunDnaSamples("coffee_table");
    expect(samples).toHaveLength(10);
    expect(samples.every((s) => s.itemKey === "coffee_table")).toBe(true);
    expect(samples.every((s) => s.category === "table")).toBe(true);
    expect(samples.every((s) => s.provider === DNA_PROVIDER)).toBe(true);
    expect(samples.every((s) => s.styleId === "nestudio_v2")).toBe(true);
    expect(samples.every((s) => s.imageUrl.startsWith("/samples/"))).toBe(true);
    expect(new Set(samples.map((s) => s.id)).size).toBe(10);
  });

  it("each sample label carries personality + category + tier and the variant prompt", () => {
    const samples = dryRunDnaSamples("chair");
    const variants = variantsForCategory("chair");
    samples.forEach((s, i) => {
      const v = variants[i];
      expect(s.subject.startsWith(`${v.personality} ${v.categoryLabel} · ${v.tier}`)).toBe(true);
      expect(s.prompt).toBe(variantPrompt(v));
    });
  });

  it("real samples use only provider URLs and skip empties (index-aligned)", () => {
    const urls = variantsForCategory("sofa").map((_, i) => (i % 2 === 0 ? `https://o/${i}.png` : ""));
    const samples = realDnaSamples("sofa", urls, { provider: "openai", model: "gpt-image-1" });
    expect(samples).toHaveLength(5);
    expect(samples.every((s) => s.imageUrl.startsWith("https://o/"))).toBe(true);
    expect(samples.some((s) => s.imageUrl.startsWith("/samples/"))).toBe(false);
  });

  it("a single real sample carries its url + model + golden itemKey", () => {
    const v = variantsForCategory("sofa")[0];
    const s = dnaSample(v, 0, "https://o/a.png", { provider: "openai", model: "gpt-image-1" });
    expect(s.imageUrl).toBe("https://o/a.png");
    expect(s.model).toBe("gpt-image-1");
    expect(s.itemKey).toBe("sofa");
  });

  it("the Signature Design Language carries the manufacturer-consistency traits (V3.7)", () => {
    expect(NESTUDIO_DNA).toContain(NESTUDIO_SIGNATURE);
    expect(NESTUDIO_SIGNATURE).toContain("design language");
    expect(NESTUDIO_SIGNATURE).toContain("rounded corners");
    expect(NESTUDIO_SIGNATURE).toContain("wood detailing");
    expect(NESTUDIO_SIGNATURE).toContain("render finish");
    expect(NESTUDIO_DNA.toLowerCase()).not.toContain("neutral premium palette");
  });
});
