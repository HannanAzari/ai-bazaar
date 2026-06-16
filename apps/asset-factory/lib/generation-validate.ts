import { type AssetCandidate, type AssetPack } from "@/lib/types";
import { runQualityChecks, hasCriticalIssues, type QualityIssue } from "@/lib/quality";
import { validateForNestudio, type AssetValidation } from "@/lib/import-validation";

// Validation-after-generation (V3, Task 8). Every generated candidate runs the same
// metadata + quality + Nestudio import checks as any other asset, plus a pack
// compatibility check. Nothing is auto-approved — this only surfaces warnings.

export type CandidateValidation = {
  id: string;
  name: string;
  quality: QualityIssue[];
  nestudio: AssetValidation;
  /** Placeable into a room (and therefore into any pack/room). */
  packCompatible: boolean;
  /** Notes about pack fit (e.g. category not yet in the target pack). */
  packNotes: string[];
  /** No critical quality issues and no Nestudio errors. */
  ok: boolean;
};

export function validateGenerated(
  candidate: AssetCandidate,
  all: AssetCandidate[],
  pack?: AssetPack,
  packMembers: AssetCandidate[] = [],
): CandidateValidation {
  const quality = runQualityChecks(candidate, all);
  const nestudio = validateForNestudio(candidate);

  const packNotes: string[] = [];
  if (pack) {
    const groups = new Set(packMembers.map((m) => m.category));
    if (groups.size > 0 && !groups.has(candidate.category)) {
      packNotes.push(`New category "${candidate.category}" for pack "${pack.name}".`);
    }
  }
  // Pack-compatible = placeable in a room (the room engine's only hard requirement).
  const packCompatible = nestudio.ok;

  return {
    id: candidate.id,
    name: candidate.name,
    quality,
    nestudio,
    packCompatible,
    packNotes,
    ok: nestudio.ok && !hasCriticalIssues(quality),
  };
}

export type GeneratedValidationSummary = {
  total: number;
  passed: number;
  withWarnings: number;
  failed: number;
};

export function summarizeValidations(validations: CandidateValidation[]): GeneratedValidationSummary {
  return {
    total: validations.length,
    passed: validations.filter((v) => v.ok && v.quality.length === 0 && v.nestudio.warnings.length === 0).length,
    withWarnings: validations.filter((v) => v.ok && (v.quality.length > 0 || v.nestudio.warnings.length > 0)).length,
    failed: validations.filter((v) => !v.ok).length,
  };
}
