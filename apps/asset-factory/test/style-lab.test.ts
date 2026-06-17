import { describe, it, expect } from "vitest";
import {
  GOLDEN_ITEMS,
  VARIATIONS_PER_ITEM,
  buildStyleSamples,
  realStyleSamples,
  parseStyleResult,
  decideSample,
  markClosest,
  scoreStyleLab,
  compareStyles,
  goldenPicks,
  goldenItem,
} from "@/lib/style-lab";
import { MASTER_PROMPT } from "@/lib/prompts";
import { STYLE_FAMILY_IDS } from "@/lib/styles";

describe("style lab (multi-style)", () => {
  it("defines the ten golden items", () => {
    expect(GOLDEN_ITEMS).toHaveLength(10);
    expect(GOLDEN_ITEMS.map((i) => i.key)).toEqual([
      "chair", "sofa", "desk", "lamp", "bookshelf", "plant", "microphone", "monitor", "coffee_table", "rug",
    ]);
  });

  it("builds 5 variations per style carrying the master prompt + style id", () => {
    const samples = buildStyleSamples(goldenItem("chair")!, "royal_match");
    expect(samples).toHaveLength(VARIATIONS_PER_ITEM);
    expect(samples.every((s) => s.styleId === "royal_match")).toBe(true);
    expect(samples.every((s) => s.prompt.startsWith(MASTER_PROMPT))).toBe(true);
    expect(new Set(samples.map((s) => s.id)).size).toBe(5);
  });

  it("produces distinct ids and prompts across styles for the same item", () => {
    const a = buildStyleSamples(goldenItem("sofa")!, "royal_match");
    const b = buildStyleSamples(goldenItem("sofa")!, "clash");
    expect(a[0].id).not.toBe(b[0].id);
    expect(a[0].prompt).not.toBe(b[0].prompt); // different style descriptors
  });

  it("dry-run samples use placeholder /samples/ paths", () => {
    const samples = buildStyleSamples(goldenItem("lamp")!, "modern_designer");
    expect(samples.every((s) => s.imageUrl.startsWith("/samples/"))).toBe(true);
  });

  it("real samples use ONLY provider urls and never placeholders", () => {
    const samples = realStyleSamples(goldenItem("lamp")!, "modern_designer", [
      "https://cdn/replicate/a.png",
      "",
      null,
      "https://cdn/replicate/b.png",
    ]);
    // Empty / null urls are skipped — no placeholder padding.
    expect(samples).toHaveLength(2);
    expect(samples.map((s) => s.imageUrl)).toEqual(["https://cdn/replicate/a.png", "https://cdn/replicate/b.png"]);
    expect(samples.some((s) => s.imageUrl.startsWith("/samples/"))).toBe(false);
  });

  it("real samples are empty when the provider returned nothing", () => {
    expect(realStyleSamples(goldenItem("lamp")!, "clash", [])).toHaveLength(0);
  });

  it("stores provider + model metadata on samples (V3.3)", () => {
    const dry = buildStyleSamples(goldenItem("chair")!, "royal_match", { provider: "openai", model: "gpt-image-1" });
    expect(dry.every((s) => s.provider === "openai" && s.model === "gpt-image-1")).toBe(true);
    const real = realStyleSamples(goldenItem("chair")!, "royal_match", ["https://x/a.png"], { provider: "replicate", model: "flux" });
    expect(real[0].provider).toBe("replicate");
    expect(real[0].model).toBe("flux");
  });

  it("shootout: two provider results coexist for the same item + style", () => {
    const item = goldenItem("chair")!;
    const replicate = realStyleSamples(item, "modern_designer", ["https://r/1.png"], { provider: "replicate", model: "flux" });
    const openai = realStyleSamples(item, "modern_designer", ["https://o/1.png"], { provider: "openai", model: "gpt-image-1" });
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

  it("marks one closest per (item, style) independently", () => {
    let s = [
      ...buildStyleSamples(goldenItem("desk")!, "royal_match"),
      ...buildStyleSamples(goldenItem("desk")!, "clash"),
    ];
    s = markClosest(s, s.find((x) => x.styleId === "royal_match")!.id);
    s = markClosest(s, s.find((x) => x.styleId === "clash")!.id);
    // One closest in each style → two total for the item.
    expect(s.filter((x) => x.closest)).toHaveLength(2);
    expect(s.filter((x) => x.closest && x.styleId === "royal_match")).toHaveLength(1);
    expect(s.filter((x) => x.closest && x.styleId === "clash")).toHaveLength(1);
  });

  it("scores per-style: approved, closest selections, winner", () => {
    let s = [
      ...buildStyleSamples(goldenItem("plant")!, "royal_match"),
      ...buildStyleSamples(goldenItem("plant")!, "clash"),
    ];
    // Royal Match: 2 approved + closest. Clash: 1 approved, no closest.
    s = decideSample(s, s.filter((x) => x.styleId === "royal_match")[0].id, "approved");
    s = decideSample(s, s.filter((x) => x.styleId === "royal_match")[1].id, "approved");
    s = markClosest(s, s.filter((x) => x.styleId === "royal_match")[0].id);
    s = decideSample(s, s.filter((x) => x.styleId === "clash")[0].id, "approved");

    const cmp = compareStyles(s);
    const royal = cmp.families.find((f) => f.styleId === "royal_match")!;
    const clash = cmp.families.find((f) => f.styleId === "clash")!;
    expect(royal.approved).toBe(2);
    expect(royal.closestSelections).toBe(1);
    expect(clash.approved).toBe(1);
    expect(clash.closestSelections).toBe(0);
    expect(cmp.winningStyle).toBe("royal_match"); // most closest selections
    expect(cmp.families).toHaveLength(STYLE_FAMILY_IDS.length);
    expect(goldenPicks(s)).toHaveLength(1);
  });

  it("returns no winner with no decisions", () => {
    const s = buildStyleSamples(goldenItem("rug")!, "modern_designer");
    expect(compareStyles(s).winningStyle).toBe(null);
  });

  it("per-item calibration counts an approved + closest in any style", () => {
    let s = buildStyleSamples(goldenItem("monitor")!, "clash");
    s = decideSample(s, s[0].id, "approved");
    s = markClosest(s, s[0].id);
    expect(scoreStyleLab(s).itemsCalibrated).toBe(1);
  });
});
