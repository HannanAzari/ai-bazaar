import { describe, it, expect } from "vitest";
import {
  buildStyleSamples,
  realStyleSamples,
  goldenItem,
  decideSample,
  markClosest,
  scoreSample,
  noteSample,
  appendSamples,
  replaceDryRunSamples,
  removeSample,
  clearDryRunSamples,
  isDryRunSample,
  isRealSample,
  approvedLibrary,
  exportApprovedSamples,
} from "@/lib/style-lab";
import { dryRunDnaSamples, realDnaSamples } from "@/lib/sofa-dna";
import { type SampleScores } from "@/lib/types";

const nines: SampleScores = { consistency: 9, readability: 9, silhouette: 9, styleFit: 9, productionReadiness: 9 };

function realSofa(batch: string) {
  return realStyleSamples(goldenItem("sofa")!, "nestudio_v2", ["https://o/a.png", "https://o/b.png"], { provider: "openai", model: "gpt-image-1", batch });
}

describe("Style Lab persistence (V3.7)", () => {
  it("tags real vs dry-run samples", () => {
    expect(buildStyleSamples(goldenItem("sofa")!).every(isDryRunSample)).toBe(true);
    expect(realSofa("b1").every(isRealSample)).toBe(true);
    expect(dryRunDnaSamples("chair").every(isDryRunSample)).toBe(true);
    expect(realDnaSamples("chair", ["https://o/x.png"]).every(isRealSample)).toBe(true);
  });

  it("append does NOT overwrite existing samples", () => {
    const first = realSofa("b1");
    const second = realSofa("b2");
    const all = appendSamples(first, second);
    expect(all).toHaveLength(first.length + second.length);
    // every original id survives
    expect(first.every((s) => all.some((x) => x.id === s.id))).toBe(true);
  });

  it("append de-dupes by id (no double-add of the same sample)", () => {
    const first = realSofa("b1");
    const all = appendSamples(first, first);
    expect(all).toHaveLength(first.length);
  });

  it("dry-run does NOT replace real samples (only other dry-runs for the item)", () => {
    const real = realSofa("b1");                       // 2 real sofas
    const dryOld = buildStyleSamples(goldenItem("sofa")!); // old dry-run sofas
    const existing = [...real, ...dryOld];
    const dryNew = buildStyleSamples(goldenItem("sofa")!, "nestudio_v2", { batch: "new" });
    const next = replaceDryRunSamples(existing, dryNew);
    // all real preserved
    expect(real.every((s) => next.some((x) => x.id === s.id))).toBe(true);
    // old dry-run gone, new dry-run present
    expect(dryOld.some((s) => next.some((x) => x.id === s.id))).toBe(false);
    expect(dryNew.every((s) => next.some((x) => x.id === s.id))).toBe(true);
    expect(next.filter(isRealSample)).toHaveLength(real.length);
  });

  it("dry-run for one item leaves another item's real samples untouched", () => {
    const sofaReal = realSofa("b1");
    const chairDry = dryRunDnaSamples("chair");
    const next = replaceDryRunSamples([...sofaReal], chairDry);
    expect(sofaReal.every((s) => next.some((x) => x.id === s.id))).toBe(true);
    expect(next.filter((s) => s.itemKey === "chair")).toHaveLength(chairDry.length);
  });

  it("preserves approval / star / score / notes across an append (reload-safe shape)", () => {
    let existing = realSofa("b1");
    existing = decideSample(existing, existing[0].id, "approved");
    existing = markClosest(existing, existing[0].id);
    existing = scoreSample(existing, existing[0].id, nines);
    existing = noteSample(existing, existing[0].id, "library keeper");
    const afterAppend = appendSamples(existing, realSofa("b2"));
    const kept = afterAppend.find((s) => s.id === existing[0].id)!;
    expect(kept.decision).toBe("approved");
    expect(kept.closest).toBe(true);
    expect(kept.scores).toEqual(nines);
    expect(kept.note).toBe("library keeper");
  });

  it("explicit remove deletes one sample; clearDryRun keeps real", () => {
    const real = realSofa("b1");
    const dry = buildStyleSamples(goldenItem("sofa")!);
    const all = [...real, ...dry];
    expect(removeSample(all, real[0].id).some((s) => s.id === real[0].id)).toBe(false);
    const cleared = clearDryRunSamples(all);
    expect(cleared.every(isRealSample)).toBe(true);
    expect(cleared).toHaveLength(real.length);
  });

  it("library = real samples that are approved OR starred", () => {
    let s = realSofa("b1");                  // 2 real
    s = [...s, ...buildStyleSamples(goldenItem("sofa")!)]; // + dry-run
    s = decideSample(s, s[0].id, "approved");
    s = markClosest(s, s[1].id);
    const lib = approvedLibrary(s);
    expect(lib).toHaveLength(2); // approved real + starred real, no dry-run
    expect(lib.every(isRealSample)).toBe(true);
  });

  it("export EXCLUDES dry-run placeholders and INCLUDES approved real samples only", () => {
    let s = realSofa("b1"); // real a, b
    s = [...s, ...buildStyleSamples(goldenItem("sofa")!)]; // dry-run (approve one to prove it's excluded)
    const dryId = s.find(isDryRunSample)!.id;
    s = decideSample(s, dryId, "approved");          // approved BUT dry-run → excluded
    s = decideSample(s, s[0].id, "approved");        // approved real → included
    s = scoreSample(s, s[0].id, nines);
    s = noteSample(s, s[0].id, "ship it");
    const rows = exportApprovedSamples(s);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("real");
    expect(rows[0].imageUrl).toBe("https://o/a.png");
    expect(rows[0].score).toBe(90);
    expect(rows[0].notes).toBe("ship it");
    expect(rows[0].category).toBe("sofa");
    expect(rows[0].placement).toBeTruthy();
    // no dry-run image url leaked into the export
    expect(rows.some((r) => r.imageUrl.startsWith("/samples/"))).toBe(false);
  });

  it("export carries personality for collection samples", () => {
    let s = realDnaSamples("sofa", ["https://o/p.png"], { provider: "openai", model: "gpt-image-1" });
    s = decideSample(s, s[0].id, "approved");
    const rows = exportApprovedSamples(s);
    expect(rows[0].personality).toBe("Minimalist"); // first personality in the line
    expect(rows[0].name).toContain("Minimalist");
  });
});
