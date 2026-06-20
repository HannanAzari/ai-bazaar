import { describe, it, expect } from "vitest";
import {
  goldenItem,
  realStyleSamples,
  buildStyleSamples,
  decideSample,
  markClosest,
  sampleToCandidate,
  approvedSamplesToCandidates,
  savedFromStyleLab,
  isSampleSaved,
  categoryCounts,
} from "@/lib/style-lab";
import { realDnaSamples } from "@/lib/sofa-dna";
import { exportJson, exportCandidatesJson, toNestudioAsset } from "@/lib/export";
import { CATEGORY_META } from "@/lib/types";

function approvedRealSofa(urls: string[], batch = "b1") {
  let s = realStyleSamples(goldenItem("sofa")!, "nestudio_v2", urls, { provider: "openai", model: "gpt-image-1", batch });
  s = s.map((x) => ({ ...x }));
  return s;
}

describe("Style Lab → candidate library (V3.7.2)", () => {
  it("approving a real Style Lab sample creates an AssetCandidate", () => {
    let s = approvedRealSofa(["https://o/a.png"]);
    s = decideSample(s, s[0].id, "approved");
    const cands = approvedSamplesToCandidates(s, []);
    expect(cands).toHaveLength(1);
    const c = cands[0];
    expect(c.status).toBe("approved");
    expect(c.source).toBe("style_lab");
    expect(c.sourceSampleId).toBe(s[0].id);
    expect(c.modelProvider).toBe("openai");
    expect(c.modelName).toBe("gpt-image-1");
    expect(c.imageUrl).toBe("https://o/a.png");
    expect(c.prompt).toBe(s[0].prompt);
    expect(c.id).toBe(`sl-${s[0].id}`);
    expect(c.slug).toBeTruthy();
  });

  it("carries personality from collection samples", () => {
    let s = realDnaSamples("sofa", ["https://o/p.png"], { provider: "openai", model: "gpt-image-1" });
    s = decideSample(s, s[0].id, "approved");
    const c = approvedSamplesToCandidates(s, [])[0];
    expect(c.personality).toBe("Minimalist");
    expect(c.tags).toContain("minimalist");
  });

  it("a dry-run sample cannot be saved (even if approved)", () => {
    let d = buildStyleSamples(goldenItem("sofa")!); // dry-run placeholders
    d = decideSample(d, d[0].id, "approved");
    expect(approvedSamplesToCandidates(d, [])).toHaveLength(0);
  });

  it("starred (not just approved) real samples are saveable", () => {
    let s = approvedRealSofa(["https://o/star.png"]);
    s = markClosest(s, s[0].id);
    expect(approvedSamplesToCandidates(s, [])).toHaveLength(1);
  });

  it("duplicate save is ignored — same sampleId and same imageUrl", () => {
    let s = approvedRealSofa(["https://o/a.png"]);
    s = decideSample(s, s[0].id, "approved");
    const first = approvedSamplesToCandidates(s, []);
    expect(first).toHaveLength(1);
    // re-saving the same sample → nothing new
    expect(approvedSamplesToCandidates(s, first)).toHaveLength(0);
    // a DIFFERENT sample with the SAME imageUrl → still skipped (no dup image)
    let s2 = approvedRealSofa(["https://o/a.png"], "b2");
    s2 = decideSample(s2, s2[0].id, "approved");
    expect(s2[0].id).not.toBe(s[0].id);
    expect(approvedSamplesToCandidates(s2, first)).toHaveLength(0);
    // a different image IS allowed (a new version)
    let s3 = approvedRealSofa(["https://o/c.png"], "b3");
    s3 = decideSample(s3, s3[0].id, "approved");
    expect(approvedSamplesToCandidates(s3, first)).toHaveLength(1);
  });

  it("rejected samples are not saved or exported", () => {
    let s = approvedRealSofa(["https://o/a.png", "https://o/b.png"]);
    s = decideSample(s, s[0].id, "approved");
    s = decideSample(s, s[1].id, "rejected");
    const cands = approvedSamplesToCandidates(s, []);
    expect(cands).toHaveLength(1);
    const parsed = JSON.parse(exportJson(cands));
    expect(parsed.every((a: { imageUrl: string }) => a.imageUrl !== "https://o/b.png")).toBe(true);
  });

  it("exported approved JSON includes saved samples", () => {
    let s = approvedRealSofa(["https://o/a.png"]);
    s = decideSample(s, s[0].id, "approved");
    const cands = approvedSamplesToCandidates(s, []);
    const parsed = JSON.parse(exportJson(cands)) as { id: string; imageUrl: string }[];
    expect(parsed.some((a) => a.imageUrl === "https://o/a.png")).toBe(true);
    expect(parsed[0].id.startsWith("ast-")).toBe(true);
  });

  it("catalog-candidates JSON includes all saved candidates (any status)", () => {
    let s = approvedRealSofa(["https://o/a.png", "https://o/b.png"]);
    s = decideSample(s, s[0].id, "approved");
    s = markClosest(s, s[1].id); // starred, pending → needs_review when saved
    const cands = approvedSamplesToCandidates(s, []);
    const parsed = JSON.parse(exportCandidatesJson(cands)) as { id: string; status: string }[];
    expect(parsed).toHaveLength(2);
    expect(parsed.some((c) => c.status === "approved")).toBe(true);
    expect(parsed.some((c) => c.status === "needs_review")).toBe(true);
  });

  it("generated metadata maps to the CatalogAsset shape correctly", () => {
    let s = approvedRealSofa(["https://o/a.png"]);
    s = decideSample(s, s[0].id, "approved");
    const c = sampleToCandidate(s[0]);
    const asset = toNestudioAsset(c);
    expect(asset.id).toBe(`ast-${c.slug}`);
    expect(asset.name).toBe(c.name);
    expect(asset.category).toBe(CATEGORY_META.sofa.nestudioCategory);
    expect(asset.placement).toBe(c.placementType);
    expect(asset.imageUrl).toBe("https://o/a.png");
    expect(asset.compatibleZones).toEqual(c.compatibleZones);
    expect(asset.defaultScale).toBe(c.defaultScale);
  });

  it("library helpers: savedFromStyleLab, isSampleSaved, categoryCounts", () => {
    let s = approvedRealSofa(["https://o/a.png"]);
    s = decideSample(s, s[0].id, "approved");
    const cands = approvedSamplesToCandidates(s, []);
    expect(savedFromStyleLab(cands)).toHaveLength(1);
    expect(isSampleSaved(s[0], cands)).toBe(true);
    expect(isSampleSaved({ ...s[0], id: "other" }, cands)).toBe(false);
    expect(categoryCounts(cands)).toEqual({ sofa: 1 });
  });
});
