import { describe, it, expect } from "vitest";
import {
  REVIEW_AXES,
  MATERIAL_AXIS,
  scoreAxis,
  overallVerdict,
  allCriterionIds,
  type Scores,
} from "@/lib/asset-pipeline/calibration-review";
import { CALIBRATION_BATCH, benchmarkObject, nonBenchmarkObjects } from "@/lib/asset-pipeline/calibration";

// The scientific review framework: the human scores by eye; the framework does the
// arithmetic + verdict. These lock the verdict rules so scoring stays honest.

const allPass = (): Scores => Object.fromEntries(allCriterionIds().map((id) => [id, 2]));

describe("axis scoring", () => {
  it("computes earned / max / pct and completeness", () => {
    const scores: Scores = {};
    for (const c of MATERIAL_AXIS.criteria) scores[c.id] = 2;
    const r = scoreAxis(MATERIAL_AXIS, scores);
    expect(r.earned).toBe(MATERIAL_AXIS.criteria.length * 2);
    expect(r.pct).toBe(100);
    expect(r.complete).toBe(true);
    expect(r.pass).toBe(true);
  });

  it("a critical zero fails the axis even with a high total", () => {
    const scores: Scores = {};
    for (const c of MATERIAL_AXIS.criteria) scores[c.id] = 2;
    // mat-truth is critical
    scores["mat-truth"] = 0;
    const r = scoreAxis(MATERIAL_AXIS, scores);
    expect(r.criticalFail).toBe(true);
    expect(r.pass).toBe(false);
  });

  it("an unscored criterion leaves the axis incomplete (and unable to pass)", () => {
    const scores: Scores = {};
    const [first, ...rest] = MATERIAL_AXIS.criteria;
    for (const c of rest) scores[c.id] = 2;
    void first;
    const r = scoreAxis(MATERIAL_AXIS, scores);
    expect(r.complete).toBe(false);
    expect(r.pass).toBe(false);
  });
});

describe("overall verdict", () => {
  it("is incomplete until every criterion is scored", () => {
    const v = overallVerdict({ "dna-camera": 2 });
    expect(v.recommendation).toBe("incomplete");
    expect(v.complete).toBe(false);
    expect(v.blockers.length).toBeGreaterThan(0);
  });

  it("is a PASS only when all three axes pass", () => {
    const v = overallVerdict(allPass());
    expect(v.recommendation).toBe("pass");
    expect(v.overallPct).toBe(100);
    expect(v.blockers).toEqual([]);
  });

  it("is a FAIL when a critical material criterion is zero (the wooden-bleed guard)", () => {
    const scores = { ...allPass(), "mat-no-wood": 0 as const };
    const v = overallVerdict(scores);
    expect(v.recommendation).toBe("fail");
    expect(v.material.pass).toBe(false);
    expect(v.blockers.join(" ")).toMatch(/Material/);
  });

  it("weights Material heaviest (the Sprint-1 focus)", () => {
    expect(MATERIAL_AXIS.weight).toBeGreaterThan(REVIEW_AXES.filter((a) => a.key !== "material")[0].weight);
  });
});

describe("calibration manifest — scientific fields", () => {
  it("every object carries a hypothesis and at least one probe", () => {
    for (const o of CALIBRATION_BATCH) {
      expect(o.hypothesis.length).toBeGreaterThan(20);
      expect(o.probes.length).toBeGreaterThan(0);
    }
  });

  it("the Laptop is the single benchmark; the other nine wait for it", () => {
    expect(benchmarkObject().id).toBe("laptop");
    expect(CALIBRATION_BATCH.filter((o) => o.benchmark)).toHaveLength(1);
    expect(nonBenchmarkObjects()).toHaveLength(9);
  });
});
