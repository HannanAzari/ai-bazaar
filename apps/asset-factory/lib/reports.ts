import { CATEGORY_META, type AssetCandidate, type AssetPack, type CategoryGroup } from "@/lib/types";
import { validateForNestudio } from "@/lib/import-validation";

// Catalog reports (Task 7): summary, coverage, and room-readiness — the evidence
// for the "are we ready for V3?" question. Pure + deterministic.

export type CatalogSummary = {
  total: number;
  approved: number;
  rejected: number;
  needsReview: number;
  needsEdit: number;
  generated: number;
  queued: number;
  packsCount: number;
};

export type Coverage = Record<CategoryGroup, number>;

export type RoomReadiness = {
  roomReady: number; // approved + passes validation
  missingMetadata: number; // approved + warnings only
  failingValidation: number; // approved + ≥1 error
};

export type CatalogReport = {
  summary: CatalogSummary;
  coverage: Coverage;
  readiness: RoomReadiness;
};

export function buildCatalogReport(candidates: AssetCandidate[], packs: AssetPack[]): CatalogReport {
  const count = (s: string) => candidates.filter((c) => c.status === s).length;

  const summary: CatalogSummary = {
    total: candidates.length,
    approved: count("approved"),
    rejected: count("rejected"),
    needsReview: count("needs_review"),
    needsEdit: count("needs_edit"),
    generated: count("generated"),
    queued: count("queued"),
    packsCount: packs.length,
  };

  const coverage: Coverage = { interior: 0, exterior: 0, avatar: 0, business: 0 };
  for (const c of candidates) {
    const group = CATEGORY_META[c.category]?.group;
    if (group) coverage[group] += 1;
  }

  const approved = candidates.filter((c) => c.status === "approved");
  let roomReady = 0;
  let missingMetadata = 0;
  let failingValidation = 0;
  for (const c of approved) {
    const v = validateForNestudio(c);
    if (!v.ok) failingValidation += 1;
    else if (v.warnings.length > 0) missingMetadata += 1;
    else roomReady += 1;
  }

  return { summary, coverage, readiness: { roomReady, missingMetadata, failingValidation } };
}
