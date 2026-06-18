import { type StyleSample, type SampleScores } from "@/lib/types";
import { GOLDEN_ITEMS } from "@/lib/style-lab";
import { DEFAULT_STYLE_FAMILY } from "@/lib/styles";

// Calibration engine (V3.4). The OpenAI-first calibration of the ONE locked
// identity (`nestudio_v2`): a five-dimension scoring system (Task 6), the Style
// Lock gate (Task 7), and the Calibration Report (Task 8). All pure + testable.
//
// Scope decision (locked): calibration + the lock gate consider ONLY OpenAI
// `nestudio_v2` samples. Replicate stays available for comparison but never affects
// the calibration score or the lock.

export const CALIBRATION_PROVIDER = "openai";
export const CALIBRATION_STYLE = DEFAULT_STYLE_FAMILY;

/** The score that, together with all 10 golden assets approved, unlocks V4. */
export const STYLE_LOCK_THRESHOLD = 85;

export type ScoreDimension = { key: keyof SampleScores; label: string };

/** The five scoring dimensions (Task 6), each 0–10. */
export const SCORE_DIMENSIONS: ScoreDimension[] = [
  { key: "consistency", label: "Consistency" },
  { key: "readability", label: "Readability" },
  { key: "silhouette", label: "Silhouette" },
  { key: "styleFit", label: "Style Fit" },
  { key: "productionReadiness", label: "Production Readiness" },
];

export const MAX_PER_DIMENSION = 10;
export const MAX_TOTAL = SCORE_DIMENSIONS.length * MAX_PER_DIMENSION; // 50

export function emptyScores(): SampleScores {
  return { consistency: 0, readability: 0, silhouette: 0, styleFit: 0, productionReadiness: 0 };
}

function clampDim(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_PER_DIMENSION, Math.round(n)));
}

/** Clamp every dimension into [0, 10]. */
export function clampScores(scores: SampleScores): SampleScores {
  return {
    consistency: clampDim(scores.consistency),
    readability: clampDim(scores.readability),
    silhouette: clampDim(scores.silhouette),
    styleFit: clampDim(scores.styleFit),
    productionReadiness: clampDim(scores.productionReadiness),
  };
}

/** Sum of the five dimensions (0–50). */
export function scoreTotal(scores: SampleScores): number {
  const c = clampScores(scores);
  return c.consistency + c.readability + c.silhouette + c.styleFit + c.productionReadiness;
}

/** A single sample's overall, normalized to 0–100. */
export function sampleOverall(scores: SampleScores): number {
  return Math.round((scoreTotal(scores) / MAX_TOTAL) * 100);
}

/** Calibration samples: OpenAI + the locked style only. */
export function calibrationSamples(samples: StyleSample[]): StyleSample[] {
  return samples.filter((s) => s.provider === CALIBRATION_PROVIDER && s.styleId === CALIBRATION_STYLE);
}

/**
 * The representative approved sample for a golden item: prefer the one marked
 * closest, else the highest-scoring approved sample. Returns undefined when the
 * item has no approved calibration sample yet.
 */
export function representativeSample(samples: StyleSample[], itemKey: string): StyleSample | undefined {
  const approved = calibrationSamples(samples).filter((s) => s.itemKey === itemKey && s.decision === "approved");
  if (approved.length === 0) return undefined;
  const closest = approved.find((s) => s.closest);
  if (closest) return closest;
  return [...approved].sort((a, b) => sampleOverall(b.scores ?? emptyScores()) - sampleOverall(a.scores ?? emptyScores()))[0];
}

export type CalibrationItem = {
  key: string;
  label: string;
  generated: number;
  approved: boolean;
  scored: boolean;
  /** 0–100 overall for the representative approved sample (0 when none/unscored). */
  overall: number;
};

export type CalibrationScore = {
  items: CalibrationItem[];
  itemsTotal: number;
  itemsApproved: number;
  itemsScored: number;
  /** Average dimension scores (0–10) across scored representative samples. */
  dimensionAverages: SampleScores;
  /** Overall Calibration Score 0–100 (Task 6) — averaged over ALL ten items, so a
   *  missing/unscored item drags the score down. */
  overall: number;
};

/** Compute the Calibration Score across the golden set (OpenAI nestudio_v2 only). */
export function calibrationScore(samples: StyleSample[]): CalibrationScore {
  const cal = calibrationSamples(samples);
  const dimTotals = emptyScores();
  let scoredCount = 0;

  const items: CalibrationItem[] = GOLDEN_ITEMS.map((item) => {
    const mine = cal.filter((s) => s.itemKey === item.key);
    const rep = representativeSample(samples, item.key);
    const scored = !!rep?.scores;
    if (rep?.scores) {
      const c = clampScores(rep.scores);
      dimTotals.consistency += c.consistency;
      dimTotals.readability += c.readability;
      dimTotals.silhouette += c.silhouette;
      dimTotals.styleFit += c.styleFit;
      dimTotals.productionReadiness += c.productionReadiness;
      scoredCount += 1;
    }
    return {
      key: item.key,
      label: item.label,
      generated: mine.length,
      approved: !!rep,
      scored,
      overall: rep?.scores ? sampleOverall(rep.scores) : 0,
    };
  });

  const itemsApproved = items.filter((i) => i.approved).length;
  const itemsScored = items.filter((i) => i.scored).length;
  // Overall = mean of each item's overall across ALL ten golden items.
  const overall = Math.round(items.reduce((sum, i) => sum + i.overall, 0) / GOLDEN_ITEMS.length);

  const avg = (total: number) => (scoredCount > 0 ? Math.round((total / scoredCount) * 10) / 10 : 0);
  const dimensionAverages: SampleScores = {
    consistency: avg(dimTotals.consistency),
    readability: avg(dimTotals.readability),
    silhouette: avg(dimTotals.silhouette),
    styleFit: avg(dimTotals.styleFit),
    productionReadiness: avg(dimTotals.productionReadiness),
  };

  return { items, itemsTotal: GOLDEN_ITEMS.length, itemsApproved, itemsScored, dimensionAverages, overall };
}

// ── Style Lock (Task 7) ──────────────────────────────────────────────────────

export type StyleLockStatus = {
  locked: boolean;
  allApproved: boolean;
  score: number;
  threshold: number;
  itemsApproved: number;
  itemsTotal: number;
  /** Plain-language reasons the style is NOT yet locked (empty when locked). */
  reasons: string[];
};

/**
 * The Style Lock gate. Locked ONLY when all ten golden assets are approved AND the
 * Calibration Score ≥ 85. Until locked, V4 mass generation must not proceed.
 */
export function styleLockStatus(samples: StyleSample[]): StyleLockStatus {
  const score = calibrationScore(samples);
  const allApproved = score.itemsApproved === score.itemsTotal;
  const meetsScore = score.overall >= STYLE_LOCK_THRESHOLD;
  const reasons: string[] = [];
  if (!allApproved) {
    reasons.push(`${score.itemsTotal - score.itemsApproved} of ${score.itemsTotal} golden assets not yet approved.`);
  }
  if (score.itemsScored < score.itemsTotal) {
    reasons.push(`${score.itemsTotal - score.itemsScored} of ${score.itemsTotal} golden assets not yet scored.`);
  }
  if (!meetsScore) {
    reasons.push(`Calibration score ${score.overall} is below the ${STYLE_LOCK_THRESHOLD} threshold.`);
  }
  return {
    locked: allApproved && meetsScore,
    allApproved,
    score: score.overall,
    threshold: STYLE_LOCK_THRESHOLD,
    itemsApproved: score.itemsApproved,
    itemsTotal: score.itemsTotal,
    reasons,
  };
}

// ── Calibration Report (Task 8) ──────────────────────────────────────────────

export type ReportRow = { itemKey: string; label: string; provider: string; model: string; overall: number; note?: string };

export type CalibrationReport = {
  approved: ReportRow[];
  rejected: ReportRow[];
  /** Average overall (0–100) across scored, approved representative samples. */
  averageScore: number;
  /** Plain-language visual-consistency observations. */
  consistencyNotes: string[];
  /** Outstanding blockers before the style can lock. */
  remainingIssues: string[];
  lock: StyleLockStatus;
};

function labelFor(itemKey: string): string {
  return GOLDEN_ITEMS.find((i) => i.key === itemKey)?.label ?? itemKey;
}

function rowFor(s: StyleSample): ReportRow {
  return {
    itemKey: s.itemKey,
    label: labelFor(s.itemKey),
    provider: s.provider,
    model: s.model,
    overall: s.scores ? sampleOverall(s.scores) : 0,
    note: s.note,
  };
}

/** Build the Calibration Report from the current samples (OpenAI nestudio_v2). */
export function calibrationReport(samples: StyleSample[]): CalibrationReport {
  const cal = calibrationSamples(samples);
  const score = calibrationScore(samples);
  const lock = styleLockStatus(samples);

  const approvedReps = GOLDEN_ITEMS
    .map((item) => representativeSample(samples, item.key))
    .filter((s): s is StyleSample => !!s);
  const approved = approvedReps.map(rowFor);
  const rejected = cal.filter((s) => s.decision === "rejected").map(rowFor);

  const scoredOveralls = approvedReps.filter((s) => s.scores).map((s) => sampleOverall(s.scores!));
  const averageScore = scoredOveralls.length
    ? Math.round(scoredOveralls.reduce((a, b) => a + b, 0) / scoredOveralls.length)
    : 0;

  // Visual-consistency notes derived from the dimension averages.
  const consistencyNotes: string[] = [];
  const d = score.dimensionAverages;
  if (score.itemsScored > 0) {
    consistencyNotes.push(`Average consistency ${d.consistency}/10 and silhouette ${d.silhouette}/10 across ${score.itemsScored} scored items.`);
    consistencyNotes.push(`Average readability ${d.readability}/10 and style fit ${d.styleFit}/10.`);
    consistencyNotes.push(`Average production readiness ${d.productionReadiness}/10.`);
    const weakest = [...SCORE_DIMENSIONS].sort((a, b) => (d[a.key] as number) - (d[b.key] as number))[0];
    consistencyNotes.push(`Weakest dimension: ${weakest.label} (${d[weakest.key]}/10).`);
  } else {
    consistencyNotes.push("No assets scored yet — run a Calibration Session and score the golden set.");
  }

  // Remaining issues: lock blockers + any approved-but-unscored items.
  const remainingIssues = [...lock.reasons];
  const approvedUnscored = score.items.filter((i) => i.approved && !i.scored).map((i) => i.label);
  if (approvedUnscored.length) {
    remainingIssues.push(`Approved but unscored: ${approvedUnscored.join(", ")}.`);
  }

  return { approved, rejected, averageScore, consistencyNotes, remainingIssues, lock };
}
