import { type AssetCandidate, type AssetStatus } from "@/lib/types";
import { canApprove } from "@/lib/quality";

// Review state transitions (Task 5). Pure: every function returns a new candidate
// (or the same reference on a no-op) and never mutates its input.

/** Allowed status transitions. Any status may move to any review outcome; the
 * generation states (queued/generated) flow forward into review. */
const ALLOWED: Record<AssetStatus, AssetStatus[]> = {
  queued: ["generated", "needs_review", "rejected"],
  generated: ["needs_review", "approved", "rejected", "needs_edit"],
  needs_review: ["approved", "rejected", "needs_edit"],
  needs_edit: ["needs_review", "approved", "rejected"],
  approved: ["needs_review", "needs_edit", "rejected"],
  rejected: ["needs_review", "needs_edit"],
};

export function canTransition(from: AssetStatus, to: AssetStatus): boolean {
  if (from === to) return false;
  return ALLOWED[from]?.includes(to) ?? false;
}

/**
 * Apply a status transition, stamping reviewer + reviewedAt for review outcomes.
 * Returns the same candidate unchanged if the transition isn't allowed, or if
 * approving a candidate with critical quality issues (approval is guarded).
 */
export function applyTransition(
  candidate: AssetCandidate,
  to: AssetStatus,
  reviewer: string,
  all: AssetCandidate[] = [],
): AssetCandidate {
  if (!canTransition(candidate.status, to)) return candidate;
  if (to === "approved" && !canApprove(candidate, all)) return candidate;

  const stampsReview: AssetStatus[] = ["approved", "rejected", "needs_edit"];
  return {
    ...candidate,
    status: to,
    reviewer: stampsReview.includes(to) ? reviewer || candidate.reviewer : candidate.reviewer,
    reviewedAt: stampsReview.includes(to) ? new Date().toISOString() : candidate.reviewedAt,
  };
}

export const approve = (c: AssetCandidate, reviewer: string, all: AssetCandidate[] = []) =>
  applyTransition(c, "approved", reviewer, all);
export const reject = (c: AssetCandidate, reviewer: string) =>
  applyTransition(c, "rejected", reviewer);
export const needsEdit = (c: AssetCandidate, reviewer: string) =>
  applyTransition(c, "needs_edit", reviewer);
