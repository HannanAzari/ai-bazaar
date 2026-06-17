import { describe, it, expect } from "vitest";
import {
  GOLDEN_ITEMS,
  VARIATIONS_PER_ITEM,
  buildStyleSamples,
  decideSample,
  markClosest,
  scoreStyleLab,
  goldenPicks,
  goldenItem,
} from "@/lib/style-lab";
import { MASTER_PROMPT } from "@/lib/prompts";

describe("style lab", () => {
  it("defines the ten golden items", () => {
    expect(GOLDEN_ITEMS).toHaveLength(10);
    expect(GOLDEN_ITEMS.map((i) => i.key)).toEqual([
      "chair", "sofa", "desk", "lamp", "bookshelf", "plant", "microphone", "monitor", "coffee_table", "rug",
    ]);
    // Each maps to a real factory category.
    expect(GOLDEN_ITEMS.every((i) => typeof i.category === "string")).toBe(true);
  });

  it("builds 5 variations carrying the premium master prompt", () => {
    const samples = buildStyleSamples(goldenItem("chair")!);
    expect(samples).toHaveLength(VARIATIONS_PER_ITEM);
    expect(samples.every((s) => s.prompt.startsWith(MASTER_PROMPT))).toBe(true);
    expect(samples.every((s) => s.decision === "pending" && !s.closest)).toBe(true);
    expect(new Set(samples.map((s) => s.id)).size).toBe(5);
  });

  it("uses provided image urls when present (real generation)", () => {
    const samples = buildStyleSamples(goldenItem("sofa")!, { imageUrls: ["https://img/a.png", "https://img/b.png"], count: 2 });
    expect(samples).toHaveLength(2);
    expect(samples[0].imageUrl).toBe("https://img/a.png");
  });

  it("applies approve/reject decisions", () => {
    let samples = buildStyleSamples(goldenItem("desk")!);
    samples = decideSample(samples, samples[0].id, "approved");
    samples = decideSample(samples, samples[1].id, "rejected");
    expect(samples[0].decision).toBe("approved");
    expect(samples[1].decision).toBe("rejected");
  });

  it("marks exactly one closest per item (toggle clears the others)", () => {
    let samples = buildStyleSamples(goldenItem("lamp")!);
    samples = markClosest(samples, samples[0].id);
    expect(samples.filter((s) => s.closest)).toHaveLength(1);
    samples = markClosest(samples, samples[2].id);
    expect(samples.filter((s) => s.closest)).toHaveLength(1);
    expect(samples[2].closest).toBe(true);
    samples = markClosest(samples, samples[2].id); // toggle off
    expect(samples.filter((s) => s.closest)).toHaveLength(0);
  });

  it("scores an item as calibrated only with an approval AND a closest pick", () => {
    let samples = buildStyleSamples(goldenItem("plant")!);
    expect(scoreStyleLab(samples).itemsCalibrated).toBe(0);
    samples = decideSample(samples, samples[0].id, "approved");
    expect(scoreStyleLab(samples).itemsCalibrated).toBe(0); // approved but no closest
    samples = markClosest(samples, samples[0].id);
    const score = scoreStyleLab(samples);
    expect(score.itemsCalibrated).toBe(1);
    expect(score.items.find((i) => i.key === "plant")!.calibrated).toBe(true);
    expect(score.overall).toBe(10); // 1 of 10 items
    expect(goldenPicks(samples)).toHaveLength(1);
  });

  it("reaches 100 only when all ten items are calibrated", () => {
    let all = GOLDEN_ITEMS.flatMap((item) => {
      const s = buildStyleSamples(item, { count: 1 });
      return [decideSample(s, s[0].id, "approved")[0]];
    });
    all = all.map((s) => ({ ...s, closest: true }));
    expect(scoreStyleLab(all).overall).toBe(100);
  });
});
