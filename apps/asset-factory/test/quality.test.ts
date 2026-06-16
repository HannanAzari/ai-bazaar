import { describe, it, expect } from "vitest";
import {
  runQualityChecks,
  hasCriticalIssues,
  canApprove,
  MIN_DIMENSION,
  MAX_DIMENSION,
} from "@/lib/quality";
import { candidateFromImport } from "@/lib/validation";
import type { AssetCandidate } from "@/lib/types";

function base(): AssetCandidate {
  return candidateFromImport({
    name: "Clean Chair",
    category: "chair",
    imageUrl: "https://cdn.example.com/clean-chair.png",
    width: 1024,
    height: 1024,
    transparent: true,
    tags: ["chair"],
  });
}

function codes(c: AssetCandidate, all: AssetCandidate[] = []) {
  return runQualityChecks(c, all).map((i) => i.code);
}

describe("quality checks", () => {
  it("a complete candidate has no issues", () => {
    expect(runQualityChecks(base())).toHaveLength(0);
    expect(canApprove(base())).toBe(true);
  });

  it("flags a missing image as critical and blocks approval", () => {
    const c = { ...base(), imageUrl: "", localPath: undefined };
    const issues = runQualityChecks(c);
    expect(issues.some((i) => i.code === "missing_image" && i.severity === "critical")).toBe(true);
    expect(hasCriticalIssues(issues)).toBe(true);
    expect(canApprove(c)).toBe(false);
  });

  it("treats missing name and unknown category as critical", () => {
    const c = { ...base(), name: "", category: "spaceship" as AssetCandidate["category"] };
    expect(codes(c)).toEqual(expect.arrayContaining(["missing_name", "missing_category"]));
    expect(canApprove(c)).toBe(false);
  });

  it("warns on missing tags, opaque background and missing zones", () => {
    const c = { ...base(), tags: [], transparent: false, compatibleZones: [] };
    expect(codes(c)).toEqual(expect.arrayContaining(["missing_tags", "non_transparent", "missing_zones"]));
    // none of those are critical, so approval is still allowed
    expect(canApprove(c)).toBe(true);
  });

  it("warns when too small or too large", () => {
    expect(codes({ ...base(), width: MIN_DIMENSION - 1, height: 1024 })).toContain("too_small");
    expect(codes({ ...base(), width: MAX_DIMENSION + 1, height: 1024 })).toContain("too_large");
  });

  it("detects duplicate slug and duplicate image across candidates", () => {
    const a = base();
    const b = { ...base(), id: "other" }; // same slug + image
    expect(codes(a, [a, b])).toEqual(expect.arrayContaining(["duplicate_slug", "duplicate_image"]));
  });
});
