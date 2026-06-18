import { describe, it, expect } from "vitest";
import { type StyleSample, type SampleScores } from "@/lib/types";
import { GOLDEN_ITEMS, realStyleSamples, decideSample, scoreSample, markClosest, noteSample } from "@/lib/style-lab";
import {
  SCORE_DIMENSIONS,
  MAX_TOTAL,
  emptyScores,
  clampScores,
  scoreTotal,
  sampleOverall,
  calibrationSamples,
  representativeSample,
  calibrationScore,
  styleLockStatus,
  calibrationReport,
  STYLE_LOCK_THRESHOLD,
  CALIBRATION_PROVIDER,
} from "@/lib/calibration";

const nines: SampleScores = { consistency: 9, readability: 9, silhouette: 9, styleFit: 9, productionReadiness: 9 };
const eights: SampleScores = { consistency: 8, readability: 8, silhouette: 8, styleFit: 8, productionReadiness: 8 };

/** One approved + scored OpenAI nestudio_v2 sample for each golden item. */
function approvedScoredSet(scores: SampleScores, provider = CALIBRATION_PROVIDER): StyleSample[] {
  let all: StyleSample[] = [];
  for (const item of GOLDEN_ITEMS) {
    let s = realStyleSamples(item, "nestudio_v2", [`https://o/${item.key}.png`], { provider, model: "gpt-image-1" });
    s = decideSample(s, s[0].id, "approved");
    s = scoreSample(s, s[0].id, scores);
    all = [...all, ...s];
  }
  return all;
}

describe("scoring math (Task 6)", () => {
  it("defines five dimensions out of 50", () => {
    expect(SCORE_DIMENSIONS).toHaveLength(5);
    expect(MAX_TOTAL).toBe(50);
  });

  it("totals and normalizes to 0–100", () => {
    expect(scoreTotal(nines)).toBe(45);
    expect(sampleOverall(nines)).toBe(90);
    expect(sampleOverall(emptyScores())).toBe(0);
    expect(sampleOverall({ consistency: 10, readability: 10, silhouette: 10, styleFit: 10, productionReadiness: 10 })).toBe(100);
  });

  it("clamps out-of-range dimensions", () => {
    const c = clampScores({ consistency: -3, readability: 99, silhouette: 5.6, styleFit: 0, productionReadiness: 7 });
    expect(c).toEqual({ consistency: 0, readability: 10, silhouette: 6, styleFit: 0, productionReadiness: 7 });
  });
});

describe("calibration scope (OpenAI nestudio_v2 only)", () => {
  it("ignores replicate samples entirely", () => {
    const replicateSet = approvedScoredSet(nines, "replicate");
    expect(calibrationSamples(replicateSet)).toHaveLength(0);
    const score = calibrationScore(replicateSet);
    expect(score.itemsApproved).toBe(0);
    expect(score.overall).toBe(0);
  });

  it("a replicate sample never affects an otherwise-locked set", () => {
    const openai = approvedScoredSet(nines);
    const extra = realStyleSamples(GOLDEN_ITEMS[0], "nestudio_v2", ["https://r/x.png"], { provider: "replicate", model: "flux" });
    const both = [...openai, ...decideSample(extra, extra[0].id, "approved")];
    expect(styleLockStatus(both).locked).toBe(true);
    expect(calibrationScore(both).itemsApproved).toBe(10);
  });
});

describe("representative sample", () => {
  it("prefers the closest pick over a higher-scoring sample", () => {
    let s = realStyleSamples(GOLDEN_ITEMS[0], "nestudio_v2", ["https://o/a.png", "https://o/b.png"], { provider: "openai", model: "m" });
    s = decideSample(s, s[0].id, "approved");
    s = decideSample(s, s[1].id, "approved");
    s = scoreSample(s, s[0].id, eights); // closest, lower score
    s = scoreSample(s, s[1].id, nines); // higher score, not closest
    s = markClosest(s, s[0].id);
    expect(representativeSample(s, GOLDEN_ITEMS[0].key)!.id).toBe(s[0].id);
  });

  it("falls back to the highest-scoring approved sample when none is closest", () => {
    let s = realStyleSamples(GOLDEN_ITEMS[0], "nestudio_v2", ["https://o/a.png", "https://o/b.png"], { provider: "openai", model: "m" });
    s = decideSample(s, s[0].id, "approved");
    s = decideSample(s, s[1].id, "approved");
    s = scoreSample(s, s[0].id, eights);
    s = scoreSample(s, s[1].id, nines);
    expect(representativeSample(s, GOLDEN_ITEMS[0].key)!.id).toBe(s[1].id);
  });

  it("is undefined when nothing is approved", () => {
    let s = realStyleSamples(GOLDEN_ITEMS[0], "nestudio_v2", ["https://o/a.png"], { provider: "openai", model: "m" });
    s = scoreSample(s, s[0].id, nines);
    expect(representativeSample(s, GOLDEN_ITEMS[0].key)).toBeUndefined();
  });
});

describe("calibration score across the golden set", () => {
  it("empty → zero", () => {
    const score = calibrationScore([]);
    expect(score.overall).toBe(0);
    expect(score.itemsApproved).toBe(0);
    expect(score.itemsScored).toBe(0);
  });

  it("all ten approved + scored 9s → 90", () => {
    const score = calibrationScore(approvedScoredSet(nines));
    expect(score.itemsApproved).toBe(10);
    expect(score.itemsScored).toBe(10);
    expect(score.overall).toBe(90);
    expect(score.dimensionAverages.consistency).toBe(9);
  });

  it("a missing item drags the average down", () => {
    const set = approvedScoredSet(nines).filter((s) => s.itemKey !== "guitar");
    const score = calibrationScore(set);
    expect(score.itemsApproved).toBe(9);
    // 9 items × 90 / 10 items = 81
    expect(score.overall).toBe(81);
  });
});

describe("style lock (Task 7)", () => {
  it("locks only when all 10 approved AND score ≥ 85", () => {
    const lock = styleLockStatus(approvedScoredSet(nines));
    expect(lock.locked).toBe(true);
    expect(lock.allApproved).toBe(true);
    expect(lock.score).toBeGreaterThanOrEqual(STYLE_LOCK_THRESHOLD);
    expect(lock.reasons).toHaveLength(0);
  });

  it("stays locked-out below the score threshold", () => {
    const lock = styleLockStatus(approvedScoredSet(eights)); // 80
    expect(lock.allApproved).toBe(true);
    expect(lock.locked).toBe(false);
    expect(lock.reasons.some((r) => r.includes(`${STYLE_LOCK_THRESHOLD}`))).toBe(true);
  });

  it("stays locked-out when assets are missing", () => {
    const set = approvedScoredSet(nines).filter((s) => s.itemKey !== "tv");
    const lock = styleLockStatus(set);
    expect(lock.locked).toBe(false);
    expect(lock.itemsApproved).toBe(9);
    expect(lock.reasons.some((r) => r.includes("not yet approved"))).toBe(true);
  });
});

describe("calibration report (Task 8)", () => {
  it("summarizes approved, rejected, average, and lock", () => {
    let set = approvedScoredSet(nines);
    // Reject an extra chair sample to populate the rejected list.
    let extra = realStyleSamples(GOLDEN_ITEMS[0], "nestudio_v2", ["https://o/reject.png"], { provider: "openai", model: "m" });
    extra = decideSample(extra, extra[0].id, "rejected");
    extra = noteSample(extra, extra[0].id, "too glossy");
    set = [...set, ...extra];

    const report = calibrationReport(set);
    expect(report.approved).toHaveLength(10);
    expect(report.rejected).toHaveLength(1);
    expect(report.rejected[0].note).toBe("too glossy");
    expect(report.averageScore).toBe(90);
    expect(report.lock.locked).toBe(true);
    expect(report.remainingIssues).toHaveLength(0);
    expect(report.consistencyNotes.length).toBeGreaterThan(0);
  });

  it("flags remaining issues when not locked", () => {
    const report = calibrationReport(approvedScoredSet(eights));
    expect(report.lock.locked).toBe(false);
    expect(report.remainingIssues.length).toBeGreaterThan(0);
  });

  it("notes no scored assets on an empty set", () => {
    const report = calibrationReport([]);
    expect(report.averageScore).toBe(0);
    expect(report.consistencyNotes[0]).toContain("No assets scored");
  });
});
