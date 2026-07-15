/**
 * lib/ai/pipeline.ts — the modular asset pipeline.
 * -----------------------------------------------------------------------------
 * Upload → Validation → Resize → Background removal → Prompt assembly →
 * Generation → Post-processing → Transparent PNG → (Metadata assembled by engine).
 *
 * Each stage is an independent, named, skippable step operating on one shared
 * PipelineContext. `DEFAULT_STAGES` is the standard order; a studio can override
 * `StudioConfig.stages` to reorder/subset without touching this file. Because
 * every stage reads the context and the provider (never a hardcoded backend or
 * use case), Avatar/Background/House studios reuse the exact same pipeline.
 *
 * DOM is only touched via lib/ai/canvas inside stage bodies (client-side).
 */

import type { PipelineContext, PipelineStage } from "./types";
import { resizeMax, containSquare, trimTransparent, padSquare, rasterFromDataUrl, alphaStats } from "./canvas";

const MAX_SOURCE_BYTES = 12 * 1024 * 1024; // ~12MB data URL guard
const WORKING_MAX = 1024;

/** Rough byte size of a data URL (base64 → bytes). */
function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}

export const validateStage: PipelineStage = {
  name: "validate",
  async run(ctx) {
    const { dataUrl, mimeType } = ctx.input;
    if (!dataUrl || !/^data:image\//.test(dataUrl)) {
      throw new Error("Upload must be an image data URL");
    }
    if (mimeType && !/^image\/(png|jpe?g|webp|svg\+xml)$/.test(mimeType)) {
      throw new Error(`Unsupported image type: ${mimeType}`);
    }
    if (dataUrlBytes(dataUrl) > MAX_SOURCE_BYTES) {
      throw new Error("Image is too large (max ~12MB)");
    }
    return ctx;
  },
};

export const resizeStage: PipelineStage = {
  name: "resize",
  async run(ctx) {
    const source = await rasterFromDataUrl(ctx.input.dataUrl);
    ctx.source = source;
    ctx.working = await resizeMax(source, WORKING_MAX);
    ctx.metadata.source = { fileName: ctx.input.fileName, width: source.width, height: source.height };
    return ctx;
  },
};

export const removeBackgroundStage: PipelineStage = {
  name: "removeBackground",
  when: (ctx) => ctx.config.removeBackground,
  async run(ctx) {
    ctx.working = await ctx.provider.removeBackground(ctx.working ?? ctx.source!, {});
    return ctx;
  },
};

export const assemblePromptStage: PipelineStage = {
  name: "assemblePrompt",
  async run(ctx) {
    ctx.prompt = ctx.config.promptBuilder({
      kind: ctx.kind,
      subject: (ctx.metadata.subject ?? ctx.config.defaultSubject) as string,
      notes: (ctx.metadata as { notes?: string }).notes,
    });
    return ctx;
  },
};

export const generateStage: PipelineStage = {
  name: "generate",
  async run(ctx) {
    const framed = await containSquare(ctx.working ?? ctx.source!, ctx.config.outputSize);
    ctx.working = await ctx.provider.stylize(framed, ctx.prompt!, {
      size: ctx.config.outputSize,
      seed: ctx.options.seed,
    });
    return ctx;
  },
};

export const postProcessStage: PipelineStage = {
  name: "postProcess",
  async run(ctx) {
    let img = ctx.working!;
    // Cut out the GENERATED background so the final asset is a TRUE transparent PNG.
    // Hosted models (Gemini) frequently return an OPAQUE image — sometimes with a
    // *painted* transparency-checker — instead of real alpha. Detect that (opaque
    // corners) and run the real cut-out; skip it only when the model already returned
    // genuine transparency, so we never ship a fake checkerboard as "transparent."
    if (ctx.config.removeBackground) {
      const stats = await alphaStats(img);
      if (!stats.transparentCorners) {
        img = await ctx.provider.removeBackground(img, {});
      }
    }
    const trimmed = await trimTransparent(img);
    ctx.output = await padSquare(trimmed, ctx.config.outputSize, ctx.config.padding);
    ctx.metadata.output = { width: ctx.output.width, height: ctx.output.height };
    return ctx;
  },
};

/** The standard stage order. Studios may subset/reorder via config.stages. */
export const DEFAULT_STAGES: PipelineStage[] = [
  validateStage,
  resizeStage,
  removeBackgroundStage,
  assemblePromptStage,
  generateStage,
  postProcessStage,
];

const STAGE_BY_NAME: Record<string, PipelineStage> = Object.fromEntries(
  DEFAULT_STAGES.map((s) => [s.name, s]),
);

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : 0;
}

/**
 * Run the pipeline over a context. Stages run in order; a stage whose `when`
 * returns false is skipped and logged. Errors are logged and rethrown so the UI
 * can surface exactly which stage failed.
 */
export async function runPipeline(ctx: PipelineContext, stages: PipelineStage[] = DEFAULT_STAGES): Promise<PipelineContext> {
  const ran: string[] = [];
  for (const stage of stages) {
    if (stage.when && !stage.when(ctx)) {
      ctx.log.push({ stage: stage.name, status: "skip" });
      continue;
    }
    const t0 = now();
    ctx.log.push({ stage: stage.name, status: "start" });
    try {
      ctx = await stage.run(ctx);
      ctx.log.push({ stage: stage.name, status: "done", ms: Math.round(now() - t0) });
      ran.push(stage.name);
    } catch (err) {
      ctx.log.push({ stage: stage.name, status: "error", ms: Math.round(now() - t0), message: (err as Error).message });
      throw err;
    }
  }
  ctx.metadata.pipeline = ran;
  return ctx;
}

/** Resolve a studio's stage list (names) to stage objects, defaulting to all. */
export function resolveStages(names?: string[]): PipelineStage[] {
  if (!names) return DEFAULT_STAGES;
  return names.map((n) => {
    const s = STAGE_BY_NAME[n];
    if (!s) throw new Error(`Unknown pipeline stage: ${n}`);
    return s;
  });
}
