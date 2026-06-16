import { CATEGORY_META, type AssetCandidate, type CategoryGroup } from "@/lib/types";
import { NESTUDIO_ZONE_TYPES, categoryAllowedInZone } from "@/lib/zones";

// Catalog Quality Score (Task 6) — an internal 0–100 readiness gauge for the whole
// catalog or a single pack. Pure + deterministic. Five sub-metrics combine into the
// overall score; the breakdown is shown so a low score is actionable.

export type QualityScore = {
  overall: number;
  metadataCompleteness: number;
  tagQuality: number;
  zoneCoverage: number;
  categoryBalance: number;
  approvedRatio: number;
  total: number;
  approvedCount: number;
};

const GROUPS: CategoryGroup[] = ["interior", "exterior", "avatar", "business"];

const WEIGHTS = {
  metadataCompleteness: 0.3,
  tagQuality: 0.15,
  zoneCoverage: 0.25,
  categoryBalance: 0.15,
  approvedRatio: 0.15,
};

const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Score a candidate set. Sub-metrics are computed over the **approved** assets
 * (the ones that would ship); approvedRatio is over the whole set passed in.
 */
export function computeQualityScore(candidates: AssetCandidate[]): QualityScore {
  const total = candidates.length;
  const approved = candidates.filter((c) => c.status === "approved");
  const n = approved.length;

  const empty: QualityScore = {
    overall: 0, metadataCompleteness: 0, tagQuality: 0, zoneCoverage: 0,
    categoryBalance: 0, approvedRatio: 0, total, approvedCount: 0,
  };
  if (n === 0) return empty;

  // Metadata completeness: each approved asset fully specified.
  const complete = approved.filter(
    (c) => c.name.trim() && (c.imageUrl.trim() || c.localPath?.trim()) && c.tags.length >= 1 && c.compatibleZones.length >= 1 && c.defaultScale > 0,
  ).length;
  const metadataCompleteness = (complete / n) * 100;

  // Tag quality: average tags/asset, normalized against a target of 3.
  const avgTags = approved.reduce((sum, c) => sum + c.tags.length, 0) / n;
  const tagQuality = Math.min(avgTags / 3, 1) * 100;

  // Zone coverage: how many of the nine zones an approved asset can occupy.
  const coveredZones = NESTUDIO_ZONE_TYPES.filter((z) =>
    approved.some((c) => {
      const meta = CATEGORY_META[c.category];
      return meta && c.compatibleZones.includes(z) && categoryAllowedInZone(meta.nestudioCategory, z);
    }),
  ).length;
  const zoneCoverage = (coveredZones / NESTUDIO_ZONE_TYPES.length) * 100;

  // Category balance: spread of approved assets across the four groups.
  const groupCounts = GROUPS.map((g) => approved.filter((c) => CATEGORY_META[c.category]?.group === g).length);
  const present = groupCounts.filter((c) => c > 0);
  const balance = present.length === 0
    ? 0
    : (present.length / GROUPS.length) * (Math.min(...present) / Math.max(...present)) * 100;

  // Approved ratio over the whole set.
  const approvedRatio = (n / total) * 100;

  const overall =
    metadataCompleteness * WEIGHTS.metadataCompleteness +
    tagQuality * WEIGHTS.tagQuality +
    zoneCoverage * WEIGHTS.zoneCoverage +
    balance * WEIGHTS.categoryBalance +
    approvedRatio * WEIGHTS.approvedRatio;

  return {
    overall: clamp100(overall),
    metadataCompleteness: clamp100(metadataCompleteness),
    tagQuality: clamp100(tagQuality),
    zoneCoverage: clamp100(zoneCoverage),
    categoryBalance: clamp100(balance),
    approvedRatio: clamp100(approvedRatio),
    total,
    approvedCount: n,
  };
}
