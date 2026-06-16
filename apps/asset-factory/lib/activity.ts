import { type AssetCandidate, type ReviewAction, type ReviewActionType } from "@/lib/types";

// Build a review activity entry (V2). Pure — id is unique per call. The status
// transition itself lives in lib/transitions.ts; this just records that it
// happened, who did it, and an optional note.
export function makeReviewAction(
  candidate: AssetCandidate,
  action: ReviewActionType,
  reviewer: string,
  note?: string,
): ReviewAction {
  return {
    id: `${candidate.id}-${action}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    candidateId: candidate.id,
    candidateName: candidate.name,
    action,
    reviewer: reviewer.trim() || "anonymous",
    note: note?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };
}
