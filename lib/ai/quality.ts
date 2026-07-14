/**
 * lib/ai/quality.ts — automated asset quality gates.
 * -----------------------------------------------------------------------------
 * Before an asset is auto-approvable it must pass these checks: transparent
 * background, centered, correct padding, minimum resolution, no clipped edges,
 * and the object fills the expected area. `validateAsset` is PURE (it scores an
 * `AlphaStats` measurement, computed via canvas elsewhere), so it is fully unit-
 * tested and reusable by every studio and the Admin Factory. A failing report is
 * what drives prompt refinement + retry (see refine.ts).
 */

import type { AlphaStats } from "./canvas";

export type QualitySeverity = "fail" | "warn";
export type QualityIssue = { code: string; message: string; severity: QualitySeverity };

export type QualityReport = {
  /** No `fail` issues → safe to auto-approve. */
  ok: boolean;
  /** 0..1 overall quality score (also used to pick the best refinement pass). */
  score: number;
  issues: QualityIssue[];
  stats: AlphaStats;
};

export type QualityConfig = {
  minResolution: number;
  /** How far the content centroid may sit from centre (fraction). */
  centerTolerance: number;
  /** Smallest allowed transparent margin on any side (fraction). */
  minPadding: number;
  /** Largest allowed margin (object mustn't be tiny/lost). */
  maxPadding: number;
  /** Allowed bbox-area fraction of the frame [min, max]. */
  minFill: number;
  maxFill: number;
};

export const DEFAULT_QUALITY_CONFIG: QualityConfig = {
  minResolution: 256,
  centerTolerance: 0.16,
  minPadding: 0.015,
  maxPadding: 0.34,
  minFill: 0.14,
  maxFill: 0.92,
};

/** Validate a measured asset. Pure: same stats → same report. */
export function validateAsset(stats: AlphaStats, config: QualityConfig = DEFAULT_QUALITY_CONFIG): QualityReport {
  const issues: QualityIssue[] = [];
  const add = (severity: QualitySeverity, code: string, message: string) => issues.push({ severity, code, message });

  // transparent background
  if (!stats.transparentCorners) add("fail", "transparent_bg", "Background is not fully transparent");

  // has content at all
  if (stats.coverage <= 0) {
    add("fail", "empty", "No visible object");
    return { ok: false, score: 0, issues, stats };
  }

  // minimum resolution
  if (Math.min(stats.width, stats.height) < config.minResolution) {
    add("fail", "resolution", `Below minimum resolution (${config.minResolution}px)`);
  }

  // no clipped edges
  if (stats.edgeTouch) add("fail", "clipped", "Object is clipped at the frame edge");

  // centered
  const dx = Math.abs(stats.centroid.x - 0.5);
  const dy = Math.abs(stats.centroid.y - 0.5);
  if (dx > config.centerTolerance || dy > config.centerTolerance) {
    add("warn", "off_center", "Object is off-centre");
  }

  // padding — every side must keep a margin (also implies no clip)
  const { minX, minY, maxX, maxY } = stats.bbox;
  const margins = [minX / stats.width, minY / stats.height, (stats.width - 1 - maxX) / stats.width, (stats.height - 1 - maxY) / stats.height];
  const minMargin = Math.min(...margins);
  if (minMargin < config.minPadding) add("fail", "padding", "Insufficient padding around the object");
  if (minMargin > config.maxPadding) add("warn", "too_small", "Object is too small in the frame");

  // fills the expected area
  const fill = ((maxX - minX + 1) * (maxY - minY + 1)) / (stats.width * stats.height);
  if (fill < config.minFill) add("warn", "underfilled", "Object does not fill the frame enough");
  if (fill > config.maxFill) add("warn", "overfilled", "Object fills too much of the frame");

  const fails = issues.filter((i) => i.severity === "fail").length;
  const warns = issues.filter((i) => i.severity === "warn").length;
  const score = clamp01(1 - fails * 0.34 - warns * 0.12);
  return { ok: fails === 0, score, issues, stats };
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
