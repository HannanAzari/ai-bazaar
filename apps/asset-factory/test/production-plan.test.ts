import { describe, it, expect } from "vitest";
import {
  PRODUCTION_CATEGORIES,
  PERSONALITY_COUNT,
  TARGET_ROOMS,
  CANDIDATES_PER_ASSET,
  keptAssetCount,
  tierCount,
  heroSeatingCount,
  imagesToGenerate,
  estimatedCostUsd,
  batchOrder,
  productionPlanSummary,
} from "@/lib/production-plan";

describe("Nestudio production plan (V3.7 lock)", () => {
  it("targets 20 rooms across 10 personalities", () => {
    expect(PERSONALITY_COUNT).toBe(10);
    expect(TARGET_ROOMS).toBe(20);
  });

  it("keeps the minimal asset set (58 = 47 Tier 1 + 11 Tier 2)", () => {
    expect(keptAssetCount()).toBe(58);
    expect(tierCount(1)).toBe(47);
    expect(tierCount(2)).toBe(11);
  });

  it("generates hero seating per personality, everything else shared", () => {
    const perPersona = PRODUCTION_CATEGORIES.filter((c) => c.strategy === "per_personality");
    expect(perPersona.map((c) => c.key)).toEqual(["sofa", "armchair"]);
    expect(perPersona.every((c) => c.variants === PERSONALITY_COUNT)).toBe(true);
    expect(heroSeatingCount()).toBe(20);
    expect(PRODUCTION_CATEGORIES.every((c) => c.variants > 0)).toBe(true);
  });

  it("computes image count + cost (2 candidates per asset, $0.04/image)", () => {
    expect(imagesToGenerate(2)).toBe(116);
    expect(estimatedCostUsd(2, 0.04)).toBeCloseTo(4.64, 2);
    expect(estimatedCostUsd(1, 0.04)).toBeCloseTo(2.32, 2);
  });

  it("orders the batch hero-first, then shared Tier 1, then Tier 2", () => {
    const order = batchOrder();
    expect(order[0].strategy).toBe("per_personality");
    expect(order[order.length - 1].tier).toBe(2);
  });

  it("the kept set covers the target rooms", () => {
    const s = productionPlanSummary();
    expect(s.coversTarget).toBe(true);
    expect(s.keptAssets).toBe(58);
    expect(s.candidatesPerAsset).toBe(CANDIDATES_PER_ASSET);
    expect(s.images).toBe(116);
    expect(s.costUsd).toBeCloseTo(4.64, 2);
  });
});
