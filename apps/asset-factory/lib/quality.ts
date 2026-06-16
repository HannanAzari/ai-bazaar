import { CATEGORY_META, type AssetCandidate } from "@/lib/types";

// Automated quality checks (Task 7). Critical issues block approval; warnings are
// advisory. Nothing here mutates the candidate.

export type IssueSeverity = "critical" | "warning";

export type QualityIssue = {
  code: string;
  severity: IssueSeverity;
  message: string;
};

// Recommended size bounds for a 2.5D room asset (px). Outside → a warning.
export const MIN_DIMENSION = 256;
export const MAX_DIMENSION = 2048;

/**
 * Categories that may not enter the Nestudio catalog. Empty by default — this is
 * the single place to blocklist a category without touching the taxonomy. A
 * candidate whose category is unknown (not in CATEGORY_META) is also treated as
 * forbidden.
 */
export const FORBIDDEN_CATEGORIES: ReadonlySet<string> = new Set<string>([]);

export function isCategoryForbidden(category: string): boolean {
  return FORBIDDEN_CATEGORIES.has(category) || !(category in CATEGORY_META);
}

/**
 * Run automated quality checks for a candidate against the full set (for
 * duplicate detection).
 */
export function runQualityChecks(
  candidate: AssetCandidate,
  all: AssetCandidate[] = [],
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const others = all.filter((c) => c.id !== candidate.id);

  const imageRef = candidate.imageUrl?.trim() || candidate.localPath?.trim() || "";
  if (!imageRef) {
    issues.push({ code: "missing_image", severity: "critical", message: "No image URL or local path." });
  }
  if (!candidate.name?.trim()) {
    issues.push({ code: "missing_name", severity: "critical", message: "Name is missing." });
  }
  if (!(candidate.category in CATEGORY_META)) {
    issues.push({ code: "missing_category", severity: "critical", message: "Category is missing or unknown." });
  } else if (isCategoryForbidden(candidate.category)) {
    issues.push({ code: "forbidden_category", severity: "warning", message: "Category is on the forbidden list." });
  }

  if (!candidate.tags || candidate.tags.length === 0) {
    issues.push({ code: "missing_tags", severity: "warning", message: "No tags — add some for discovery." });
  }
  if (candidate.transparent === false) {
    issues.push({ code: "non_transparent", severity: "warning", message: "Background is not transparent." });
  }
  if (candidate.width && candidate.height) {
    const min = Math.min(candidate.width, candidate.height);
    const max = Math.max(candidate.width, candidate.height);
    if (min < MIN_DIMENSION) {
      issues.push({ code: "too_small", severity: "warning", message: `Smaller than ${MIN_DIMENSION}px — may look blurry.` });
    }
    if (max > MAX_DIMENSION) {
      issues.push({ code: "too_large", severity: "warning", message: `Larger than ${MAX_DIMENSION}px — consider downscaling.` });
    }
  }
  if (!candidate.compatibleZones || candidate.compatibleZones.length === 0) {
    issues.push({ code: "missing_zones", severity: "warning", message: "No compatible zones set." });
  }

  if (imageRef && others.some((c) => (c.imageUrl?.trim() || c.localPath?.trim()) === imageRef)) {
    issues.push({ code: "duplicate_image", severity: "warning", message: "Another candidate uses this image." });
  }
  if (candidate.slug && others.some((c) => c.slug === candidate.slug)) {
    issues.push({ code: "duplicate_slug", severity: "warning", message: "Another candidate has this slug." });
  }

  return issues;
}

/** Critical issues mean approval is blocked. */
export function hasCriticalIssues(issues: QualityIssue[]): boolean {
  return issues.some((i) => i.severity === "critical");
}

/** A candidate may be approved only if it has no critical issues. */
export function canApprove(candidate: AssetCandidate, all: AssetCandidate[] = []): boolean {
  return !hasCriticalIssues(runQualityChecks(candidate, all));
}
