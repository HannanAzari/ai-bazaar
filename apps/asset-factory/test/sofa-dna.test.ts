import { describe, it, expect } from "vitest";
import {
  SOFA_VARIATIONS,
  SOFA_DNA_PROVIDER,
  sofaVariationPrompt,
  buildSofaDnaPrompts,
  dryRunSofaDnaSamples,
  realSofaDnaSamples,
  sofaDnaSample,
} from "@/lib/sofa-dna";
import { MASTER_PROMPT, NESTUDIO_DNA } from "@/lib/prompts";
import { obeysNestudioSpecs } from "@/lib/nestudio-spec";

describe("sofa DNA discovery (V3.5)", () => {
  it("defines ten distinct sofa personalities", () => {
    expect(SOFA_VARIATIONS).toHaveLength(10);
    expect(new Set(SOFA_VARIATIONS.map((v) => v.key)).size).toBe(10);
    expect(new Set(SOFA_VARIATIONS.map((v) => v.name)).size).toBe(10);
    // Different silhouettes / materials / colours — not clones.
    expect(new Set(SOFA_VARIATIONS.map((v) => v.silhouette)).size).toBe(10);
    expect(new Set(SOFA_VARIATIONS.map((v) => v.material)).size).toBe(10);
    expect(new Set(SOFA_VARIATIONS.map((v) => v.color)).size).toBe(10);
  });

  it("every prompt shares the DNA + master spine but differs in personality", () => {
    const prompts = buildSofaDnaPrompts().map((p) => p.prompt);
    expect(prompts.every((p) => p.startsWith(MASTER_PROMPT))).toBe(true);
    // Same world: the DNA identity is present in every prompt.
    expect(prompts.every((p) => p.includes("Scandinavian"))).toBe(true);
    expect(prompts.every((p) => p.includes("warm cozy palette"))).toBe(true);
    // Different personality: every prompt is unique.
    expect(new Set(prompts).size).toBe(10);
    // Each is a sofa.
    expect(prompts.every((p) => p.toLowerCase().includes("sofa"))).toBe(true);
  });

  it("does not modify camera, isolation, or transparency (still obeys the specs)", () => {
    for (const v of SOFA_VARIATIONS) {
      expect(obeysNestudioSpecs(sofaVariationPrompt(v))).toBe(true);
    }
  });

  it("dry-run builds 10 OpenAI placeholders under itemKey sofa", () => {
    const samples = dryRunSofaDnaSamples();
    expect(samples).toHaveLength(10);
    expect(samples.every((s) => s.itemKey === "sofa")).toBe(true);
    expect(samples.every((s) => s.provider === SOFA_DNA_PROVIDER)).toBe(true);
    expect(samples.every((s) => s.styleId === "nestudio_v2")).toBe(true);
    expect(samples.every((s) => s.imageUrl.startsWith("/samples/"))).toBe(true);
    expect(new Set(samples.map((s) => s.id)).size).toBe(10);
  });

  it("each sample carries its personality name + variation prompt", () => {
    const samples = dryRunSofaDnaSamples();
    samples.forEach((s, i) => {
      expect(s.subject.startsWith(SOFA_VARIATIONS[i].name)).toBe(true);
      expect(s.prompt).toBe(sofaVariationPrompt(SOFA_VARIATIONS[i]));
    });
  });

  it("real samples use only provider URLs and skip empties (index-aligned)", () => {
    const urls = SOFA_VARIATIONS.map((_, i) => (i % 2 === 0 ? `https://o/${i}.png` : ""));
    const samples = realSofaDnaSamples(urls, { provider: "openai", model: "gpt-image-1" });
    expect(samples).toHaveLength(5); // only the even indices
    expect(samples.every((s) => s.imageUrl.startsWith("https://o/"))).toBe(true);
    expect(samples.some((s) => s.imageUrl.startsWith("/samples/"))).toBe(false);
  });

  it("a single real sample carries its url + model", () => {
    const s = sofaDnaSample(SOFA_VARIATIONS[0], 0, "https://o/a.png", { provider: "openai", model: "gpt-image-1" });
    expect(s.imageUrl).toBe("https://o/a.png");
    expect(s.model).toBe("gpt-image-1");
    expect(s.itemKey).toBe("sofa");
  });

  it("the DNA identity layer is non-trivial and on-direction", () => {
    expect(NESTUDIO_DNA).toContain("Scandinavian");
    expect(NESTUDIO_DNA).toContain("soft rounded geometry");
    expect(NESTUDIO_DNA.toLowerCase()).toContain("warm");
    // The generic culprit is gone.
    expect(NESTUDIO_DNA.toLowerCase()).not.toContain("neutral premium palette");
  });
});
