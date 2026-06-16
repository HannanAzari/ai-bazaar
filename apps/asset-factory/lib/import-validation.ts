import { CATEGORY_META, type AssetCandidate } from "@/lib/types";
import {
  NESTUDIO_CATEGORIES,
  NESTUDIO_PLACEMENTS,
  NESTUDIO_ACTION_TYPES,
  isKnownZone,
  categoryAllowedInZone,
  categoryHasZone,
} from "@/lib/zones";

// Nestudio import-compatibility validation (Task 4). For every (approved) asset it
// verifies the fields the main catalog + room engine require. Errors block import;
// warnings inform. Pure + deterministic.

export type ValidationSeverity = "error" | "warning";

export type ValidationIssue = {
  code: string;
  severity: ValidationSeverity;
  message: string;
};

export type AssetValidation = {
  id: string;
  name: string;
  ok: boolean; // no errors
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

const MAX_SCALE = 5;
const MIN_SCALE = 0.1;

/** Validate one candidate against the Nestudio catalog/room contract. */
export function validateForNestudio(c: AssetCandidate): AssetValidation {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const err = (code: string, message: string) => errors.push({ code, severity: "error", message });
  const warn = (code: string, message: string) => warnings.push({ code, severity: "warning", message });

  // Required fields.
  if (!c.name?.trim()) err("missing_name", "Name is required.");
  if (!c.slug?.trim()) err("missing_slug", "Slug is required.");
  if (!(c.imageUrl?.trim() || c.localPath?.trim())) err("missing_image", "An image URL or local path is required.");

  // Category → drives the Nestudio category.
  const meta = CATEGORY_META[c.category];
  if (!meta) {
    err("invalid_category", `Unknown category "${c.category}".`);
  } else if (!NESTUDIO_CATEGORIES.includes(meta.nestudioCategory)) {
    err("invalid_category", `Maps to an invalid Nestudio category "${meta.nestudioCategory}".`);
  }

  // Placement.
  if (!NESTUDIO_PLACEMENTS.includes(c.placementType)) {
    err("invalid_placement", `Invalid placement "${c.placementType}".`);
  }

  // Compatible zones.
  if (!c.compatibleZones || c.compatibleZones.length === 0) {
    err("missing_zones", "No compatible zones — the asset can never be placed.");
  } else {
    const unknown = c.compatibleZones.filter((z) => !isKnownZone(z));
    if (unknown.length > 0) err("invalid_zone", `Unknown zone(s): ${unknown.join(", ")}.`);

    if (meta) {
      // The category must be allowed somewhere in the template…
      if (!categoryHasZone(meta.nestudioCategory)) {
        err("unplaceable_category", `No room zone accepts category "${meta.nestudioCategory}".`);
      }
      // …and at least one *listed* zone must actually accept it.
      const accepting = c.compatibleZones.filter((z) => isKnownZone(z) && categoryAllowedInZone(meta.nestudioCategory, z));
      if (accepting.length === 0 && categoryHasZone(meta.nestudioCategory)) {
        err("zone_category_mismatch", `None of the listed zones accept category "${meta.nestudioCategory}".`);
      } else {
        const mismatched = c.compatibleZones.filter((z) => isKnownZone(z) && !categoryAllowedInZone(meta.nestudioCategory, z));
        if (mismatched.length > 0) warn("partial_zone_mismatch", `Some listed zones don't accept this category: ${mismatched.join(", ")}.`);
      }
    }
  }

  // Action type.
  if (!NESTUDIO_ACTION_TYPES.includes(c.defaultActionType)) {
    err("invalid_action", `Invalid action type "${c.defaultActionType}".`);
  }

  // Scale.
  if (!Number.isFinite(c.defaultScale) || c.defaultScale < MIN_SCALE || c.defaultScale > MAX_SCALE) {
    err("invalid_scale", `Scale ${c.defaultScale} is out of range (${MIN_SCALE}–${MAX_SCALE}).`);
  }

  // Tags.
  if (!c.tags || c.tags.length === 0) {
    warn("missing_tags", "No tags — add discovery keywords.");
  } else if (c.tags.length < 2) {
    warn("weak_metadata", "Only one tag — weak metadata for discovery.");
  }

  return { id: c.id, name: c.name, ok: errors.length === 0, errors, warnings };
}

export type CatalogValidationReport = {
  total: number;
  passed: number; // no errors
  withWarnings: number;
  failed: number; // ≥1 error
  results: AssetValidation[];
  errorCounts: Record<string, number>;
  warningCounts: Record<string, number>;
};

/** Validate a set of candidates (approved-only by default). */
export function validateCatalog(
  candidates: AssetCandidate[],
  options: { approvedOnly?: boolean } = {},
): CatalogValidationReport {
  const approvedOnly = options.approvedOnly ?? true;
  const subject = approvedOnly ? candidates.filter((c) => c.status === "approved") : candidates;
  const results = subject.map(validateForNestudio);

  const errorCounts: Record<string, number> = {};
  const warningCounts: Record<string, number> = {};
  for (const r of results) {
    for (const e of r.errors) errorCounts[e.code] = (errorCounts[e.code] ?? 0) + 1;
    for (const w of r.warnings) warningCounts[w.code] = (warningCounts[w.code] ?? 0) + 1;
  }

  return {
    total: results.length,
    passed: results.filter((r) => r.ok).length,
    withWarnings: results.filter((r) => r.warnings.length > 0).length,
    failed: results.filter((r) => !r.ok).length,
    results,
    errorCounts,
    warningCounts,
  };
}
