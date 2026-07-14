/**
 * lib/ai/engine.ts — one engine, many use cases.
 * -----------------------------------------------------------------------------
 * The public entry points every studio and the Admin Asset Factory call. The UI
 * NEVER touches a provider or a prompt string — it calls these. A new studio
 * (Avatar, Background, House) is added by flipping `enabled` on its `StudioConfig`
 * and pointing it at a prompt builder; nothing here changes. That is the whole
 * architecture.
 */

import type {
  AssetKind,
  AssembledPrompt,
  GenerateOptions,
  GeneratedAsset,
  ImageInput,
  PipelineContext,
  RasterImage,
  RemoveBgOptions,
  StudioConfig,
} from "./types";
import { PROMPT_BUILDERS, getPromptBuilder } from "./prompts";
import { getProvider, FALLBACK_PROVIDER_ID } from "./provider";
import { validateStage, resizeStage, removeBackgroundStage, generateStage, postProcessStage } from "./pipeline";
import { getPreset } from "./presets";
import { generateWithRefinement } from "./refine";
import { validateAsset, DEFAULT_QUALITY_CONFIG } from "./quality";
import { inferInsights } from "./metadata";
import { alphaStats, dominantColors, addContactShadow } from "./canvas";

/**
 * The studio registry — the ONE place a use case is described. M20 enables
 * `furniture` only; the rest are registered (proving the shape) but disabled.
 * Admin variants reuse these with `publishTargets` extended to `globalLibrary`.
 */
export const STUDIO_CONFIGS: Record<AssetKind, StudioConfig> = {
  furniture: {
    kind: "furniture",
    label: "Furniture & Objects",
    enabled: true,
    promptBuilder: PROMPT_BUILDERS.furniture,
    outputSize: 640,
    padding: 0.08,
    removeBackground: true,
    contactShadow: true,
    refinePasses: 1,
    publishTargets: ["inventory"],
    defaultSubject: "cozy object",
  },
  decoration: {
    kind: "decoration",
    label: "Decorations",
    enabled: false,
    promptBuilder: PROMPT_BUILDERS.decoration,
    outputSize: 512,
    padding: 0.1,
    removeBackground: true,
    publishTargets: ["inventory"],
    defaultSubject: "small trinket",
  },
  avatar: {
    kind: "avatar",
    label: "Avatars",
    enabled: false,
    promptBuilder: PROMPT_BUILDERS.avatar,
    outputSize: 640,
    padding: 0.06,
    removeBackground: true,
    publishTargets: ["inventory"],
    defaultSubject: "a friendly character",
  },
  background: {
    kind: "background",
    label: "Backgrounds",
    enabled: false,
    promptBuilder: PROMPT_BUILDERS.background,
    outputSize: 1024,
    padding: 0,
    removeBackground: false,
    publishTargets: ["inventory"],
    defaultSubject: "a cozy room",
  },
  house: {
    kind: "house",
    label: "Houses",
    enabled: false,
    promptBuilder: PROMPT_BUILDERS.house,
    outputSize: 768,
    padding: 0.05,
    removeBackground: true,
    publishTargets: ["inventory"],
    defaultSubject: "a storybook cottage",
  },
};

export function getStudioConfig(kind: AssetKind): StudioConfig {
  const config = STUDIO_CONFIGS[kind];
  if (!config) throw new Error(`No studio configured for kind: ${kind}`);
  return config;
}

/** Injectable clock/id so tests are deterministic; defaults to real time. */
export type GenerateAssetOptions = GenerateOptions & {
  subject?: string;
  notes?: string;
  /** Style preset id (e.g. "classic"). */
  preset?: string;
  /** Override the studio's refinement pass count. */
  refinePasses?: number;
  now?: () => string;
  id?: () => string;
};

function defaultId(): string {
  const rand = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.floor((Date.now() % 1e9)).toString(36);
  return `ai_${Date.now().toString(36)}_${rand}`;
}

/**
 * THE core call. Validate → resize → remove bg (once) → assemble prompt (preset +
 * versioned) → [generate → quality-score → improve prompt → regenerate] keep-best
 * → grounded contact shadow → metadata + insights. Returns an approvable asset.
 */
export async function generateAsset(kind: AssetKind, input: ImageInput, opts: GenerateAssetOptions = {}): Promise<GeneratedAsset> {
  const config = getStudioConfig(kind);
  if (!config.enabled) {
    throw new Error(`The ${config.label} studio is not enabled yet (M20 ships Furniture only).`);
  }
  const provider = getProvider(opts.provider);
  const preset = getPreset(opts.preset);
  const subject = (opts.subject && opts.subject.trim()) || config.defaultSubject;

  // ── Prep once: validate → measure/resize → remove background. ──
  let ctx: PipelineContext = {
    kind,
    input,
    config,
    provider,
    options: { size: config.outputSize, seed: opts.seed, provider: opts.provider, signal: opts.signal },
    metadata: { kind, subject, name: titleFor(subject), ...(opts.notes ? { notes: opts.notes } : {}) } as PipelineContext["metadata"],
    log: [],
  };
  ctx = await validateStage.run(ctx);
  ctx = await resizeStage.run(ctx);
  if (removeBackgroundStage.when?.(ctx) !== false && config.removeBackground) ctx = await removeBackgroundStage.run(ctx);
  const prepped = ctx.working ?? ctx.source!;

  // ── Preset- + version-aware prompt. ──
  const builder = getPromptBuilder(kind);
  const initialPrompt: AssembledPrompt = {
    ...builder({ kind, subject, notes: opts.notes, style: preset.style }),
    params: { ...builder({ kind, subject, style: preset.style }).params, ...preset.params, size: config.outputSize },
  };

  // ── Iterative generate → score → improve → keep best. ──
  const passes = opts.refinePasses ?? config.refinePasses ?? 1;
  const refined = await generateWithRefinement<RasterImage>({
    initialPrompt,
    passes,
    generate: async (prompt) => {
      const passCtx: PipelineContext = { ...ctx, prompt, working: prepped, output: undefined };
      try {
        const g = await generateStage.run(passCtx);
        const p = await postProcessStage.run(g);
        return p.output!;
      } catch (err) {
        // Hosted provider unavailable/failed → fall back to the local provider so
        // the Studio always produces an asset. The DNA prompt + tonal params are
        // the same, so the look stays consistent.
        if (provider.id === FALLBACK_PROVIDER_ID) throw err;
        const fallbackCtx: PipelineContext = { ...ctx, prompt, working: prepped, output: undefined, provider: getProvider(FALLBACK_PROVIDER_ID) };
        const g = await generateStage.run(fallbackCtx);
        const p = await postProcessStage.run(g);
        return p.output!;
      }
    },
    score: async (image) => validateAsset(await alphaStats(image), DEFAULT_QUALITY_CONFIG),
  });

  const chosen = refined.best;
  const finalPng = config.contactShadow ? await addContactShadow(chosen.image) : chosen.image;

  // ── Insights (colours + heuristics). ──
  const colors = await dominantColors(finalPng, 4);
  const insights = inferInsights({ subject, kind, colors, stats: chosen.report.stats });

  const id = (opts.id ?? defaultId)();
  const createdAt = (opts.now ?? (() => new Date().toISOString()))();

  return {
    id,
    kind,
    png: finalPng,
    metadata: {
      id,
      kind,
      name: titleFor(subject),
      subject,
      prompt: chosen.prompt,
      provider: provider.id,
      source: ctx.metadata.source ?? { width: 0, height: 0 },
      output: { width: finalPng.width, height: finalPng.height },
      createdAt,
      pipeline: ["validate", "resize", ...(config.removeBackground ? ["removeBackground"] : []), "assemblePrompt", "generate", "postProcess", ...(config.contactShadow ? ["contactShadow"] : [])],
      version: 1,
      promptVersion: chosen.prompt.promptVersion,
      preset: preset.id,
      quality: { ok: chosen.report.ok, score: chosen.report.score, issues: chosen.report.issues },
      refinePasses: chosen.pass,
      insights: insights as unknown as Record<string, unknown>,
    },
    log: ctx.log,
  };
}

/* ── Thin, reusable engine primitives (also provider-routed) ───────────────── */

export function removeBackground(source: RasterImage, opts?: RemoveBgOptions & { provider?: string }): Promise<RasterImage> {
  return getProvider(opts?.provider).removeBackground(source, opts);
}

export function stylizeAsset(source: RasterImage, prompt: AssembledPrompt, opts: GenerateOptions = {}): Promise<RasterImage> {
  return getProvider(opts.provider).stylize(source, prompt, opts);
}

export function upscaleAsset(source: RasterImage, factor = 2, opts: { provider?: string } = {}): Promise<RasterImage> {
  return getProvider(opts.provider).upscale(source, factor);
}

function titleFor(subject: string): string {
  return subject
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
