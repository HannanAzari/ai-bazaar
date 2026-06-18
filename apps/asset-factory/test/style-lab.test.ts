import { describe, it, expect } from "vitest";
import {
  GOLDEN_ITEMS,
  VARIATIONS_PER_ITEM,
  buildStyleSamples,
  realStyleSamples,
  parseStyleResult,
  decideSample,
  markClosest,
  scoreSample,
  noteSample,
  scoreStyleLab,
  goldenPicks,
  goldenItem,
} from "@/lib/style-lab";
import { MASTER_PROMPT } from "@/lib/prompts";
import { type SampleScores } from "@/lib/types";

const fullScores: SampleScores = { consistency: 9, readability: 9, silhouette: 9, styleFit: 9, productionReadiness: 9 };

describe("style lab (single locked identity)", () => {
  it("defines the ten golden calibration items (permanent benchmark)", () => {
    expect(GOLDEN_ITEMS).toHaveLength(10);
    expect(GOLDEN_ITEMS.map((i) => i.key)).toEqual([
      "chair", "sofa", "desk", "bookshelf", "tv", "plant", "floor_lamp", "coffee_table", "guitar", "computer",
    ]);
  });

  it("builds 5 variations carrying the master prompt + nestudio_v2 style id", () => {
    const samples = buildStyleSamples(goldenItem("chair")!);
    expect(samples).toHaveLength(VARIATIONS_PER_ITEM);
    expect(samples.every((s) => s.styleId === "nestudio_v2")).toBe(true);
    expect(samples.every((s) => s.prompt.startsWith(MASTER_PROMPT))).toBe(true);
    expect(new Set(samples.map((s) => s.id)).size).toBe(5);
  });

  it("defaults the provider to openai (the calibration provider)", () => {
    const samples = buildStyleSamples(goldenItem("sofa")!);
    expect(samples.every((s) => s.provider === "openai")).toBe(true);
  });

  it("dry-run samples use placeholder /samples/ paths", () => {
    const samples = buildStyleSamples(goldenItem("floor_lamp")!);
    expect(samples.every((s) => s.imageUrl.startsWith("/samples/"))).toBe(true);
  });

  it("real samples use ONLY provider urls and never placeholders", () => {
    const samples = realStyleSamples(goldenItem("floor_lamp")!, "nestudio_v2", [
      "https://cdn/openai/a.png",
      "",
      null,
      "https://cdn/openai/b.png",
    ]);
    expect(samples).toHaveLength(2);
    expect(samples.map((s) => s.imageUrl)).toEqual(["https://cdn/openai/a.png", "https://cdn/openai/b.png"]);
    expect(samples.some((s) => s.imageUrl.startsWith("/samples/"))).toBe(false);
  });

  it("real samples are empty when the provider returned nothing", () => {
    expect(realStyleSamples(goldenItem("tv")!, "nestudio_v2", [])).toHaveLength(0);
  });

  it("stores provider + model metadata on samples (V3.3)", () => {
    const dry = buildStyleSamples(goldenItem("chair")!, "nestudio_v2", { provider: "openai", model: "gpt-image-1" });
    expect(dry.every((s) => s.provider === "openai" && s.model === "gpt-image-1")).toBe(true);
    const real = realStyleSamples(goldenItem("chair")!, "nestudio_v2", ["https://x/a.png"], { provider: "replicate", model: "flux" });
    expect(real[0].provider).toBe("replicate");
    expect(real[0].model).toBe("flux");
  });

  it("shootout: two provider results coexist for the same item + style", () => {
    const item = goldenItem("chair")!;
    const replicate = realStyleSamples(item, "nestudio_v2", ["https://r/1.png"], { provider: "replicate", model: "flux" });
    const openai = realStyleSamples(item, "nestudio_v2", ["https://o/1.png"], { provider: "openai", model: "gpt-image-1" });
    const both = [...replicate, ...openai];
    expect(both).toHaveLength(2);
    expect(new Set(both.map((s) => s.provider))).toEqual(new Set(["replicate", "openai"]));
    expect(new Set(both.map((s) => s.id)).size).toBe(2); // distinct ids (provider in id)
  });

  it("parseStyleResult: ok+urls → ok, ok+empty → error, !ok → error", () => {
    expect(parseStyleResult(true, { imageUrls: ["https://x/a.png"] })).toEqual({ ok: true, imageUrls: ["https://x/a.png"] });
    expect(parseStyleResult(true, { imageUrls: [] }).ok).toBe(false);
    expect(parseStyleResult(true, { imageUrls: ["", null] }).ok).toBe(false);
    const fail = parseStyleResult(false, { error: "Generation is disabled." });
    expect(fail).toEqual({ ok: false, error: "Generation is disabled." });
  });

  it("marks one closest per item, toggled", () => {
    let s = buildStyleSamples(goldenItem("desk")!);
    s = markClosest(s, s[0].id);
    expect(s.filter((x) => x.closest)).toHaveLength(1);
    s = markClosest(s, s[1].id); // moves the closest pick
    expect(s.filter((x) => x.closest)).toHaveLength(1);
    expect(s.find((x) => x.closest)!.id).toBe(s[1].id);
    s = markClosest(s, s[1].id); // toggles off
    expect(s.filter((x) => x.closest)).toHaveLength(0);
  });

  it("attaches scores + notes to a sample (pure)", () => {
    let s = buildStyleSamples(goldenItem("plant")!);
    s = scoreSample(s, s[0].id, fullScores);
    s = noteSample(s, s[0].id, "reads at 64px");
    expect(s[0].scores).toEqual(fullScores);
    expect(s[0].note).toBe("reads at 64px");
    expect(s[1].scores).toBeUndefined();
  });

  it("per-item calibration counts an approved + closest", () => {
    let s = buildStyleSamples(goldenItem("computer")!);
    s = decideSample(s, s[0].id, "approved");
    s = markClosest(s, s[0].id);
    expect(scoreStyleLab(s).itemsCalibrated).toBe(1);
    expect(goldenPicks(s)).toHaveLength(1);
  });
});
