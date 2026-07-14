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
import { PROMPT_BUILDERS } from "./prompts";
import { getProvider } from "./provider";
import { runPipeline, resolveStages } from "./pipeline";

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
  now?: () => string;
  id?: () => string;
};

function defaultId(): string {
  const rand = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.floor((Date.now() % 1e9)).toString(36);
  return `ai_${Date.now().toString(36)}_${rand}`;
}

/**
 * THE core call. Validate → resize → remove bg → assemble prompt → generate →
 * post-process → transparent PNG → metadata. Returns an approvable asset.
 */
export async function generateAsset(kind: AssetKind, input: ImageInput, opts: GenerateAssetOptions = {}): Promise<GeneratedAsset> {
  const config = getStudioConfig(kind);
  if (!config.enabled) {
    throw new Error(`The ${config.label} studio is not enabled yet (M20 ships Furniture only).`);
  }
  const provider = getProvider(opts.provider);
  const subject = (opts.subject && opts.subject.trim()) || config.defaultSubject;

  const ctx: PipelineContext = {
    kind,
    input,
    config,
    provider,
    options: { size: config.outputSize, seed: opts.seed, provider: opts.provider, signal: opts.signal },
    metadata: { kind, subject, name: titleFor(subject), ...(opts.notes ? { notes: opts.notes } : {}) } as PipelineContext["metadata"],
    log: [],
  };

  const result = await runPipeline(ctx, resolveStages(config.stages));
  if (!result.output) throw new Error("Pipeline produced no output image");

  const id = (opts.id ?? defaultId)();
  const createdAt = (opts.now ?? (() => new Date().toISOString()))();
  const prompt = result.prompt as AssembledPrompt;

  return {
    id,
    kind,
    png: result.output,
    metadata: {
      id,
      kind,
      name: titleFor(subject),
      subject,
      prompt,
      provider: provider.id,
      source: result.metadata.source ?? { width: 0, height: 0 },
      output: result.metadata.output ?? { width: result.output.width, height: result.output.height },
      createdAt,
      pipeline: result.metadata.pipeline ?? [],
      version: 1,
    },
    log: result.log,
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
