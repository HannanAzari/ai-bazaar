import { describe, it, expect } from "vitest";
import { validateAsset, type QualityReport } from "../lib/ai/quality";
import { improvePrompt, generateWithRefinement } from "../lib/ai/refine";
import { getPreset, STYLE_PRESETS, DEFAULT_PRESET } from "../lib/ai/presets";
import { inferInsights } from "../lib/ai/metadata";
import { getPromptBuilder, PROMPT_REGISTRY, ACTIVE_PROMPT_VERSION, buildFurniturePrompt } from "../lib/ai/prompts";
import type { AlphaStats } from "../lib/ai/canvas";
import type { AssembledPrompt } from "../lib/ai/types";

function stats(over: Partial<AlphaStats> = {}): AlphaStats {
  return {
    width: 640,
    height: 640,
    coverage: 0.3,
    bbox: { minX: 120, minY: 120, maxX: 520, maxY: 520 },
    centroid: { x: 0.5, y: 0.5 },
    transparentCorners: true,
    edgeTouch: false,
    ...over,
  };
}

/* ── quality gates ── */
describe("validateAsset", () => {
  it("passes a clean, centered, well-padded asset", () => {
    const r = validateAsset(stats());
    expect(r.ok).toBe(true);
    expect(r.score).toBeGreaterThan(0.9);
    expect(r.issues.filter((i) => i.severity === "fail")).toHaveLength(0);
  });
  it("fails when the background is not transparent", () => {
    const r = validateAsset(stats({ transparentCorners: false }));
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "transparent_bg")).toBe(true);
  });
  it("fails when the object is clipped at the edge", () => {
    const r = validateAsset(stats({ edgeTouch: true, bbox: { minX: 0, minY: 10, maxX: 639, maxY: 600 } }));
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "clipped" || i.code === "padding")).toBe(true);
  });
  it("warns when off-centre but does not fail", () => {
    const r = validateAsset(stats({ centroid: { x: 0.78, y: 0.5 } }));
    expect(r.ok).toBe(true);
    expect(r.issues.some((i) => i.code === "off_center" && i.severity === "warn")).toBe(true);
  });
  it("fails an empty image", () => {
    const r = validateAsset(stats({ coverage: 0 }));
    expect(r.ok).toBe(false);
    expect(r.score).toBe(0);
  });
});

/* ── refine loop ── */
describe("improvePrompt + refinement", () => {
  const base: AssembledPrompt = buildFurniturePrompt({ kind: "furniture", subject: "mug" });

  it("adds corrective directives for failures and bumps the pass counter", () => {
    const report: QualityReport = { ok: false, score: 0.4, stats: stats(), issues: [
      { code: "transparent_bg", message: "", severity: "fail" },
      { code: "off_center", message: "", severity: "warn" },
    ] };
    const improved = improvePrompt(base, report);
    expect(improved.positive).toMatch(/Correction:/);
    expect(improved.positive.toLowerCase()).toContain("transparent");
    expect(improved.positive.toLowerCase()).toContain("centered");
    expect(improved.params.refinePass).toBe(1);
  });

  it("keeps the best candidate and stops early once one passes", async () => {
    const scores = [0.4, 0.95]; // second pass passes
    let i = 0;
    const result = await generateWithRefinement<string>({
      initialPrompt: base,
      passes: 3,
      generate: async () => `img${i}`,
      score: async () => {
        const s = scores[Math.min(i, scores.length - 1)];
        const r: QualityReport = { ok: s > 0.9, score: s, issues: [], stats: stats() };
        i++;
        return r;
      },
    });
    expect(result.attempts.length).toBe(2); // stopped early after the passing pass
    expect(result.best.report.score).toBe(0.95);
  });

  it("runs all passes and keeps the highest score when none pass", async () => {
    const scores = [0.3, 0.6, 0.5];
    let i = 0;
    const result = await generateWithRefinement<string>({
      initialPrompt: base,
      passes: 2,
      generate: async () => `img${i}`,
      score: async () => {
        const r: QualityReport = { ok: false, score: scores[i], issues: [{ code: "off_center", message: "", severity: "warn" }], stats: stats() };
        i++;
        return r;
      },
    });
    expect(result.attempts.length).toBe(3);
    expect(result.best.report.score).toBe(0.6);
  });
});

/* ── presets ── */
describe("style presets", () => {
  it("Classic is enabled and is the default; others are defined but disabled", () => {
    expect(getPreset().id).toBe("classic");
    expect(STYLE_PRESETS[DEFAULT_PRESET].enabled).toBe(true);
    for (const id of ["clay", "soft", "illustration"]) {
      expect(STYLE_PRESETS[id]).toBeDefined();
      expect(STYLE_PRESETS[id].enabled).toBe(false);
    }
  });
  it("falls back to Classic for an unknown id", () => {
    expect(getPreset("nope").id).toBe("classic");
  });
});

/* ── metadata inference ── */
describe("inferInsights", () => {
  it("classifies known objects (mug → ceramic/kitchen/table/small)", () => {
    const m = inferInsights({ subject: "coffee mug", kind: "furniture", colors: ["#c86f52"] });
    expect(m.material).toContain("ceramic");
    expect(m.recommendedRoom).toBe("kitchen");
    expect(m.surfaceType).toBe("table");
    expect(m.scaleHint).toBe("small");
    expect(m.colors).toEqual(["#c86f52"]);
    expect(m.tags).toContain("furniture");
  });
  it("classifies a chair as floor furniture", () => {
    const m = inferInsights({ subject: "armchair", kind: "furniture" });
    expect(m.category).toBe("furniture");
    expect(m.surfaceType).toBe("floor");
    expect(m.scaleHint).toBe("large");
  });
  it("derives a bottom-centre anchor from stats", () => {
    const m = inferInsights({ subject: "mug", kind: "furniture", stats: stats() });
    expect(m.anchor.x).toBeCloseTo(0.5, 1);
    expect(m.anchor.y).toBeGreaterThan(0.7); // bottom of bbox
  });
  it("is deterministic", () => {
    expect(inferInsights({ subject: "guitar", kind: "furniture" })).toEqual(inferInsights({ subject: "guitar", kind: "furniture" }));
  });
});

/* ── versioned prompts ── */
describe("versioned prompt library", () => {
  it("furniture active version is v2 and stamps promptVersion", () => {
    expect(ACTIVE_PROMPT_VERSION.furniture).toBe("furniture@2");
    const p = getPromptBuilder("furniture")({ kind: "furniture", subject: "lamp" });
    expect(p.promptVersion).toBe("furniture@2");
    expect(p.positive.toLowerCase()).toContain("warm key light");
  });
  it("both furniture versions are registered and pinnable", () => {
    expect(typeof PROMPT_REGISTRY["furniture@1"]).toBe("function");
    expect(typeof PROMPT_REGISTRY["furniture@2"]).toBe("function");
    expect(getPromptBuilder("furniture", "furniture@1")({ kind: "furniture", subject: "x" }).promptVersion).toBe("furniture@1");
  });
  it("throws on an unknown version", () => {
    expect(() => getPromptBuilder("furniture", "furniture@99")).toThrow();
  });
});
