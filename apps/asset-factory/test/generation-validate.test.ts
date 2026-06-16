import { describe, it, expect } from "vitest";
import { validateGenerated, summarizeValidations } from "@/lib/generation-validate";
import { candidateFromImport } from "@/lib/validation";
import { buildSamplePacks } from "@/lib/sample-packs";
import { sampleCandidates } from "@/lib/sample-data";
import type { AssetCandidate } from "@/lib/types";

function gen(over: Partial<AssetCandidate> = {}): AssetCandidate {
  return {
    ...candidateFromImport({
      name: "Generated Chair",
      category: "chair",
      imageUrl: "https://bucket/generated-chair.png",
      width: 1024,
      height: 1024,
      transparent: true,
      tags: ["chair", "cozy"],
    }),
    ...over,
  };
}

describe("validation after generation", () => {
  it("passes a clean generated candidate (placeable, no critical issues)", () => {
    const v = validateGenerated(gen(), []);
    expect(v.ok).toBe(true);
    expect(v.nestudio.ok).toBe(true);
    expect(v.packCompatible).toBe(true);
  });

  it("flags a non-transparent image as a warning but stays placeable", () => {
    const v = validateGenerated(gen({ transparent: false }), []);
    expect(v.quality.some((q) => q.code === "non_transparent")).toBe(true);
    expect(v.ok).toBe(true); // warning, not critical
    expect(v.packCompatible).toBe(true);
  });

  it("fails and is not pack-compatible when the image is missing", () => {
    const v = validateGenerated(gen({ imageUrl: "", localPath: undefined }), []);
    expect(v.ok).toBe(false);
    expect(v.nestudio.ok).toBe(false);
    expect(v.packCompatible).toBe(false);
  });

  it("notes a new category for a target pack", () => {
    const candidates = sampleCandidates();
    const pack = buildSamplePacks(candidates).find((p) => p.slug === "cafe")!;
    const members = candidates.filter((c) => pack.assetIds.includes(c.id));
    // A chair isn't in the cafe pack → a pack note (but still placeable).
    const v = validateGenerated(gen({ category: "chair" }), candidates, pack, members);
    expect(v.packNotes.length).toBeGreaterThan(0);
  });

  it("summarizes a batch into passed / warnings / failed", () => {
    const summary = summarizeValidations([
      validateGenerated(gen(), []),
      validateGenerated(gen({ name: "B", slug: "b", transparent: false }), []),
      validateGenerated(gen({ name: "C", slug: "c", imageUrl: "", localPath: undefined }), []),
    ]);
    expect(summary.total).toBe(3);
    expect(summary.passed).toBe(1);
    expect(summary.withWarnings).toBe(1);
    expect(summary.failed).toBe(1);
  });
});
