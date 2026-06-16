import { describe, it, expect } from "vitest";
import { computeQualityScore } from "@/lib/quality-score";
import { candidateFromImport } from "@/lib/validation";
import { sampleCandidates } from "@/lib/sample-data";
import type { AssetCandidate, FactoryCategory } from "@/lib/types";

function approved(category: FactoryCategory, name: string, tags: string[]): AssetCandidate {
  return {
    ...candidateFromImport({
      name,
      category,
      imageUrl: `https://cdn.example.com/${name}.png`,
      width: 1024,
      height: 1024,
      tags,
    }),
    status: "approved",
  };
}

describe("catalog quality score", () => {
  it("scores an empty set as zero", () => {
    const s = computeQualityScore([]);
    expect(s.overall).toBe(0);
    expect(s.approvedCount).toBe(0);
  });

  it("scores the sample catalog with sensible bounds", () => {
    const s = computeQualityScore(sampleCandidates());
    expect(s.total).toBe(90);
    expect(s.approvedCount).toBe(44);
    for (const v of [s.overall, s.metadataCompleteness, s.tagQuality, s.zoneCoverage, s.categoryBalance, s.approvedRatio]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    expect(s.overall).toBeGreaterThan(0);
  });

  it("rewards category balance across groups", () => {
    const singleGroup = computeQualityScore([
      approved("chair", "A Chair", ["a"]),
      approved("sofa", "A Sofa", ["b"]),
    ]);
    const fourGroups = computeQualityScore([
      approved("chair", "B Chair", ["x"]), // interior
      approved("tree", "B Tree", ["y"]), // exterior
      approved("cafe_counter", "B Counter", ["z"]), // business
      approved("pet", "B Pet", ["w"]), // avatar
    ]);
    expect(fourGroups.categoryBalance).toBeGreaterThan(singleGroup.categoryBalance);
  });

  it("reflects the approved ratio", () => {
    const mixed = [
      approved("chair", "Yes Chair", ["a", "b"]),
      { ...approved("sofa", "No Sofa", ["c"]), status: "needs_review" as const },
    ];
    const s = computeQualityScore(mixed);
    expect(s.approvedRatio).toBe(50);
  });
});
