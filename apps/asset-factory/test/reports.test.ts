import { describe, it, expect } from "vitest";
import { buildCatalogReport } from "@/lib/reports";
import { buildSamplePacks } from "@/lib/sample-packs";
import { sampleCandidates } from "@/lib/sample-data";

describe("catalog reports", () => {
  const candidates = sampleCandidates();
  const packs = buildSamplePacks(candidates);
  const report = buildCatalogReport(candidates, packs);

  it("summarizes the catalog by status", () => {
    expect(report.summary.total).toBe(90);
    expect(report.summary.approved).toBe(44);
    expect(report.summary.packsCount).toBe(5);
    const { approved, rejected, needsReview, needsEdit, generated, queued } = report.summary;
    expect(approved + rejected + needsReview + needsEdit + generated + queued).toBe(90);
  });

  it("reports coverage per group matching the target distribution", () => {
    expect(report.coverage.interior).toBe(50);
    expect(report.coverage.exterior).toBe(20);
    expect(report.coverage.business).toBe(10);
    expect(report.coverage.avatar).toBe(10);
  });

  it("partitions approved assets into room-readiness buckets", () => {
    const { roomReady, missingMetadata, failingValidation } = report.readiness;
    expect(roomReady + missingMetadata + failingValidation).toBe(report.summary.approved);
    expect(failingValidation).toBe(0); // approved sample assets are all valid
    expect(missingMetadata).toBeGreaterThan(0); // weak-metadata (no-tag) entries
    expect(roomReady).toBeGreaterThan(0);
  });
});
