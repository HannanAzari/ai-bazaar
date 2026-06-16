import { describe, it, expect } from "vitest";
import { validateForNestudio, validateCatalog } from "@/lib/import-validation";
import { candidateFromImport } from "@/lib/validation";
import { sampleCandidates } from "@/lib/sample-data";
import { ALL_CATEGORIES, CATEGORY_META, type AssetCandidate } from "@/lib/types";
import { categoryAllowedInZone } from "@/lib/zones";

function valid(): AssetCandidate {
  return candidateFromImport({
    name: "Validation Chair",
    category: "chair",
    imageUrl: "https://cdn.example.com/validation-chair.png",
    width: 1024,
    height: 1024,
    transparent: true,
    tags: ["chair", "cozy"],
  });
}

function codes(c: AssetCandidate) {
  const v = validateForNestudio(c);
  return { errors: v.errors.map((e) => e.code), warnings: v.warnings.map((w) => w.code), ok: v.ok };
}

describe("Nestudio import validation", () => {
  it("passes a well-formed candidate", () => {
    const v = validateForNestudio(valid());
    expect(v.ok).toBe(true);
    expect(v.errors).toHaveLength(0);
  });

  it("errors on missing name and image", () => {
    const r = codes({ ...valid(), name: "", imageUrl: "", localPath: undefined });
    expect(r.errors).toEqual(expect.arrayContaining(["missing_name", "missing_image"]));
    expect(r.ok).toBe(false);
  });

  it("errors on invalid placement", () => {
    expect(codes({ ...valid(), placementType: "nowhere" as AssetCandidate["placementType"] }).errors).toContain("invalid_placement");
  });

  it("errors on missing compatible zones", () => {
    expect(codes({ ...valid(), compatibleZones: [] }).errors).toContain("missing_zones");
  });

  it("errors on an unknown zone", () => {
    expect(codes({ ...valid(), compatibleZones: ["atrium" as never] }).errors).toContain("invalid_zone");
  });

  it("errors on an invalid action type", () => {
    expect(codes({ ...valid(), defaultActionType: "teleport" as AssetCandidate["defaultActionType"] }).errors).toContain("invalid_action");
  });

  it("errors on out-of-range scale", () => {
    expect(codes({ ...valid(), defaultScale: 0 }).errors).toContain("invalid_scale");
    expect(codes({ ...valid(), defaultScale: 9 }).errors).toContain("invalid_scale");
  });

  it("warns (not errors) on missing tags and single-tag metadata", () => {
    expect(codes({ ...valid(), tags: [] }).warnings).toContain("missing_tags");
    const single = codes({ ...valid(), tags: ["chair"] });
    expect(single.warnings).toContain("weak_metadata");
    expect(single.ok).toBe(true);
  });

  it("every category maps to a Nestudio category accepted by its compatible zones", () => {
    // Regression guard: a category whose nestudioCategory no listed zone accepts
    // can never be placed (the bug V2.5 validation caught).
    for (const cat of ALL_CATEGORIES) {
      const meta = CATEGORY_META[cat];
      const placeable = meta.compatibleZones.some((z) => categoryAllowedInZone(meta.nestudioCategory, z));
      expect(placeable, `${cat} → ${meta.nestudioCategory} has no accepting zone`).toBe(true);
    }
  });

  it("approved sample assets all pass validation (zero errors)", () => {
    const report = validateCatalog(sampleCandidates(), { approvedOnly: true });
    expect(report.total).toBeGreaterThan(0);
    expect(report.failed).toBe(0);
    expect(report.passed).toBe(report.total);
    // The deliberately weak entries (no tags) surface as warnings.
    expect(report.withWarnings).toBeGreaterThan(0);
    expect(report.warningCounts.missing_tags ?? 0).toBeGreaterThan(0);
  });
});
