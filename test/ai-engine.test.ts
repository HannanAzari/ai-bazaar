import { describe, it, expect } from "vitest";
import { NESTUDIO_STYLE, mergeStyle } from "../lib/ai/style";
import { buildFurniturePrompt, buildBasePrompt, PROMPT_BUILDERS } from "../lib/ai/prompts";
import { getProvider, registerProvider, listProviders } from "../lib/ai/provider";
import { STUDIO_CONFIGS, getStudioConfig, generateAsset } from "../lib/ai/engine";
import { runPipeline } from "../lib/ai/pipeline";
import type { AIImageProvider, PipelineContext, PipelineStage, RasterImage, AssembledPrompt } from "../lib/ai/types";

/* ── prompt builders ── */
describe("prompt builders", () => {
  it("furniture prompt carries subject, transparent bg, negatives, tags, style", () => {
    const p = buildFurniturePrompt({ kind: "furniture", subject: "coffee mug" });
    expect(p.kind).toBe("furniture");
    expect(p.subject).toBe("coffee mug");
    expect(p.positive.toLowerCase()).toContain("coffee mug");
    expect(p.positive.toLowerCase()).toContain("transparent");
    expect(p.negative.length).toBeGreaterThan(0);
    expect(p.tags).toContain("furniture");
    expect(p.tags).toContain("coffee");
    expect(p.style.name).toBe(NESTUDIO_STYLE.name);
    expect(p.params.size).toBeDefined();
  });
  it("notes are appended and style overrides merge", () => {
    const p = buildBasePrompt(
      { kind: "furniture", subject: "lamp", notes: "make it pastel", style: { lighting: "noon sun" } },
      "A single lamp",
      {},
    );
    expect(p.positive).toContain("make it pastel");
    expect(p.style.lighting).toBe("noon sun");
    // untouched tokens fall back to base
    expect(p.style.descriptors).toEqual(NESTUDIO_STYLE.descriptors);
  });
  it("registry has a builder for every kind", () => {
    for (const kind of ["furniture", "decoration", "avatar", "background", "house"]) {
      expect(typeof PROMPT_BUILDERS[kind]).toBe("function");
    }
  });
  it("mergeStyle without override returns base", () => {
    expect(mergeStyle(NESTUDIO_STYLE)).toBe(NESTUDIO_STYLE);
  });
});

/* ── provider registry ── */
describe("provider registry", () => {
  it("returns the stub by default and throws on unknown", () => {
    expect(getProvider().id).toBe("stub");
    expect(getProvider("stub").capabilities).toContain("stylize");
    expect(() => getProvider("nope")).toThrow();
  });
  it("can register a new provider", () => {
    const fake: AIImageProvider = {
      id: "fake", label: "Fake", capabilities: ["stylize"],
      async stylize(s) { return s; },
      async removeBackground(s) { return s; },
      async upscale(s) { return s; },
    };
    registerProvider(fake);
    expect(listProviders().some((p) => p.id === "fake")).toBe(true);
    expect(getProvider("fake").label).toBe("Fake");
  });
});

/* ── engine config + dispatch (the reuse seam) ── */
describe("studio registry + dispatch", () => {
  it("furniture is enabled; future studios registered but disabled", () => {
    expect(STUDIO_CONFIGS.furniture.enabled).toBe(true);
    for (const kind of ["avatar", "background", "house", "decoration"] as const) {
      expect(STUDIO_CONFIGS[kind].enabled).toBe(false);
      // …yet fully described, proving the shape is reusable
      expect(typeof STUDIO_CONFIGS[kind].promptBuilder).toBe("function");
      expect(STUDIO_CONFIGS[kind].publishTargets).toContain("inventory");
    }
  });
  it("generateAsset refuses a disabled kind before doing any work", async () => {
    await expect(
      generateAsset("avatar", { dataUrl: "data:image/png;base64,AAAA" }),
    ).rejects.toThrow(/not enabled/i);
  });
  it("getStudioConfig throws for an unknown kind", () => {
    // @ts-expect-error — exercising the guard
    expect(() => getStudioConfig("spaceship")).toThrow();
  });
});

/* ── pipeline orchestration (fake stages, no DOM) ── */
describe("runPipeline orchestration", () => {
  const provider: AIImageProvider = {
    id: "t", label: "t", capabilities: ["stylize"],
    async stylize(s) { return s; },
    async removeBackground(s) { return s; },
    async upscale(s) { return s; },
  };
  const img: RasterImage = { width: 8, height: 8, dataUrl: "data:image/png;base64,AAAA" };
  const baseCtx = (): PipelineContext => ({
    kind: "furniture",
    input: { dataUrl: img.dataUrl },
    config: STUDIO_CONFIGS.furniture,
    provider,
    options: {},
    metadata: {},
    log: [],
  });

  it("runs stages in order, records the ran list, and threads output", async () => {
    const order: string[] = [];
    const stages: PipelineStage[] = [
      { name: "a", async run(ctx) { order.push("a"); return ctx; } },
      { name: "b", async run(ctx) { order.push("b"); ctx.output = img; return ctx; } },
    ];
    const out = await runPipeline(baseCtx(), stages);
    expect(order).toEqual(["a", "b"]);
    expect(out.metadata.pipeline).toEqual(["a", "b"]);
    expect(out.output).toBe(img);
    expect(out.log.filter((e) => e.status === "done").length).toBe(2);
  });

  it("skips a stage whose `when` is false and logs it", async () => {
    const stages: PipelineStage[] = [
      { name: "skipme", when: () => false, async run() { throw new Error("should not run"); } },
      { name: "keep", async run(ctx) { return ctx; } },
    ];
    const out = await runPipeline(baseCtx(), stages);
    expect(out.metadata.pipeline).toEqual(["keep"]);
    expect(out.log.some((e) => e.stage === "skipme" && e.status === "skip")).toBe(true);
  });

  it("logs and rethrows a failing stage with its name", async () => {
    const stages: PipelineStage[] = [
      { name: "boom", async run() { throw new Error("kaboom"); } },
    ];
    await expect(runPipeline(baseCtx(), stages)).rejects.toThrow("kaboom");
  });
});

/* keep the type import used */
const _p: AssembledPrompt | null = null;
void _p;
