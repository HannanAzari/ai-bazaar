// ── Art Engine — Validators ───────────────────────────────────────────────────
//
// The Visual DNA compiles into REVIEW CRITERIA too, not just prompts. These are the
// founder/admin review dimensions (and hooks for automated spec checks) — NOT a
// consumer-facing scorecard. Shared criteria come from the one Visual DNA; type criteria
// come from each Type DNA. Same source → the dimensions can never drift apart.

import type { ArtType } from "@/lib/art-engine/type-dna";

// Shared across the world (derived from Visual DNA).
export const SHARED_CRITERIA = [
  "warmth", "matte material response", "soft ambient occlusion", "silhouette clarity",
  "edge treatment", "saturation discipline", "premium feel", "thumbnail readability",
] as const;

export const AVATAR_CRITERIA = ["resemblance", "hair fidelity", "anatomy / hands", "expression", "identity continuity"] as const;
export const ASSET_CRITERIA = ["material truth", "canonical pose", "transparency", "category readability"] as const;
export const NEST_CRITERIA = ["canonical camera", "geometry", "empty placement zones", "architectural usability"] as const;

const TYPE_CRITERIA: Record<ArtType, readonly string[]> = {
  avatar: AVATAR_CRITERIA,
  asset: ASSET_CRITERIA,
  nest: NEST_CRITERIA,
};

export type ReviewCriterion = { key: string; scope: "shared" | "type" };

/** The full founder-review checklist for a type (shared world dimensions + type dimensions). */
export function reviewCriteria(type: ArtType): ReviewCriterion[] {
  return [
    ...SHARED_CRITERIA.map((key) => ({ key, scope: "shared" as const })),
    ...TYPE_CRITERIA[type].map((key) => ({ key, scope: "type" as const })),
  ];
}
