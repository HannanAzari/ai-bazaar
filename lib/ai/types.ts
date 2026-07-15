/**
 * lib/ai/types.ts — the shared contracts for Nestudio's ONE AI engine.
 * -----------------------------------------------------------------------------
 * Every future studio — Avatar, Background, House, Decoration, and the Admin Asset
 * Factory — is expected to reuse this file WITHOUT modification. The reuse seam is
 * `StudioConfig`: a studio is just a config (a kind, a prompt builder, output
 * options, and where approved assets may be published). The engine, the pipeline,
 * the providers, the Studio UI and the inventory are all shared.
 *
 * NOTHING here imports React, the DOM, or a provider SDK — it is pure data so it
 * can be used on the client, in an API route, in a script, or in a test.
 */

/** The kinds of asset the engine can produce. Only `furniture` is enabled in M20;
 *  the rest are registered but disabled — adding one later is a config + a prompt
 *  builder, never an engine change. */
export type AssetKind = "furniture" | "decoration" | "avatar" | "background" | "house";

/** Where an approved asset may be sent. Users get `inventory`; the Admin Asset
 *  Factory later adds `globalLibrary` — the ONLY difference between the two flows. */
export type PublishTarget = "inventory" | "globalLibrary";

/* ── Images ────────────────────────────────────────────────────────────────── */

/** A portable raster image: dimensions + a data URL. Providers convert to/from
 *  their own representation (canvas, tensor, remote URL) internally. Passing data
 *  URLs keeps the engine transport- and environment-agnostic. */
export type RasterImage = {
  width: number;
  height: number;
  /** `data:image/png;base64,...` (or jpeg for sources). */
  dataUrl: string;
};

/** What the user hands in — an uploaded file or a bundled sample. */
export type ImageInput = {
  dataUrl: string;
  fileName?: string;
  mimeType?: string;
};

/* ── Style + prompts ───────────────────────────────────────────────────────── */

/** The Nestudio art direction, as structured tokens (never a hardcoded string in
 *  a component). Shared by every prompt builder; a studio may override parts. */
export type StyleTokens = {
  name: string;
  /** Positive descriptors — "soft 3D", "cozy", "hand-crafted"… */
  descriptors: string[];
  /** Guiding palette words. */
  palette: string[];
  lighting: string;
  framing: string;
  /** Always transparent for placeable assets. */
  background: "transparent";
  /** Things to steer away from. */
  negative: string[];
};

/** Input to a prompt builder. Studios pass the subject + optional user notes. */
export type PromptInput = {
  kind: AssetKind;
  /** What the thing is — "coffee mug", "armchair". May be user- or vision-derived. */
  subject: string;
  /** Freeform user guidance ("make it pastel"). */
  notes?: string;
  /** Per-request style overrides merged onto the base tokens. */
  style?: Partial<StyleTokens>;
};

/** The fully assembled, provider-agnostic prompt. Providers map `params` onto
 *  their own API (size, guidance, steps…). */
export type AssembledPrompt = {
  kind: AssetKind;
  subject: string;
  positive: string;
  negative: string;
  style: StyleTokens;
  tags: string[];
  params: Record<string, string | number | boolean>;
  /** Which versioned builder produced this prompt (e.g. "furniture@2"), tracked
   *  onto the asset so we know exactly what generated it. */
  promptVersion: string;
};

/** A prompt builder is a pure function of intent → assembled prompt. One per kind:
 *  buildFurniturePrompt, buildAvatarPrompt (later), … */
export type PromptBuilder = (input: PromptInput) => AssembledPrompt;

/* ── Provider ──────────────────────────────────────────────────────────────── */

export type ProviderCapability = "stylize" | "removeBackground" | "upscale";

export type GenerateOptions = {
  /** Target square output size in px. */
  size?: number;
  /** Deterministic seed where the provider supports it (the stub always does). */
  seed?: number;
  /** Force a specific provider id; otherwise the configured default is used. */
  provider?: string;
  signal?: AbortSignal;
};

export type RemoveBgOptions = {
  /** 0–255 colour distance tolerance for background detection. */
  tolerance?: number;
};

/**
 * The one interface every image backend implements — the Canvas stub today, a
 * hosted model (OpenAI/Replicate/…) tomorrow. The engine only ever talks to this,
 * so swapping backends never touches a studio or the UI.
 */
export interface AIImageProvider {
  id: string;
  label: string;
  capabilities: ProviderCapability[];
  /** Turn a source image + assembled prompt into a stylized RGBA image. */
  stylize(source: RasterImage, prompt: AssembledPrompt, opts: GenerateOptions): Promise<RasterImage>;
  /** Produce an image with the background knocked out to transparency. */
  removeBackground(source: RasterImage, opts?: RemoveBgOptions): Promise<RasterImage>;
  /** Scale an image up by an integer-ish factor. */
  upscale(source: RasterImage, factor: number): Promise<RasterImage>;
}

/* ── Pipeline ──────────────────────────────────────────────────────────────── */

export type PipelineEventStatus = "start" | "done" | "skip" | "error";
export type PipelineEvent = {
  stage: string;
  status: PipelineEventStatus;
  ms?: number;
  message?: string;
};

/** The mutable bag threaded through the pipeline stages. Each stage reads what it
 *  needs and writes its output; the final `output` + `metadata` become the asset. */
export type PipelineContext = {
  kind: AssetKind;
  input: ImageInput;
  config: StudioConfig;
  provider: AIImageProvider;
  options: GenerateOptions;
  /** normalized/validated source. */
  source?: RasterImage;
  /** current working image between stages. */
  working?: RasterImage;
  prompt?: AssembledPrompt;
  /** the final transparent PNG. */
  output?: RasterImage;
  metadata: Partial<AssetMetadata>;
  log: PipelineEvent[];
};

/** A single modular step. Stages are composed into the pipeline in order and can
 *  be reordered/overridden per studio via `StudioConfig.stages`. */
export type PipelineStage = {
  name: string;
  /** Return false to skip (e.g. removeBackground when the studio disables it). */
  when?: (ctx: PipelineContext) => boolean;
  run: (ctx: PipelineContext) => Promise<PipelineContext>;
};

/* ── Studio config — THE reuse seam ────────────────────────────────────────── */

/**
 * A studio described entirely as data. Avatar Studio = the same shape with
 * `kind: "avatar"` and `promptBuilder: buildAvatarPrompt`. The engine reads this;
 * it never hardcodes a use case.
 */
export type StudioConfig = {
  kind: AssetKind;
  label: string;
  /** Only enabled kinds may be generated. M20 ships furniture enabled. */
  enabled: boolean;
  promptBuilder: PromptBuilder;
  /** Square output size (px). */
  outputSize: number;
  /** Transparent padding around the trimmed subject, as a fraction of size. */
  padding: number;
  /** Whether the background-removal stage runs for this kind. */
  removeBackground: boolean;
  /** Add a soft grounded contact shadow to the final PNG. */
  contactShadow?: boolean;
  /** Extra refinement passes (generate→score→improve→regenerate). 0 = one shot. */
  refinePasses?: number;
  /** Optional override of the pipeline stage order (names). Defaults to all. */
  stages?: string[];
  /** Where a user may publish approved assets. Admin config adds `globalLibrary`. */
  publishTargets: PublishTarget[];
  /** A gentle default subject shown in the UI. */
  defaultSubject: string;
};

/* ── Result ────────────────────────────────────────────────────────────────── */

export type AssetMetadata = {
  id: string;
  kind: AssetKind;
  name: string;
  subject: string;
  prompt: AssembledPrompt;
  /** The provider that ACTUALLY produced the chosen image (never the requested one
   *  if a fallback happened) — so a local fallback is never mislabeled as hosted. */
  provider: string;
  /** The provider that was requested (may differ from `provider` on fallback). */
  requestedProvider?: string;
  /** True when the requested (hosted) provider failed and local produced the image. */
  usedFallback?: boolean;
  /** The hosted provider's error message, surfaced rather than hidden. */
  providerError?: string;
  source: { fileName?: string; width: number; height: number };
  output: { width: number; height: number };
  /** ISO timestamp — stamped by the caller (kept out of pure code for determinism). */
  createdAt: string;
  /** Names of the stages that actually ran. */
  pipeline: string[];
  version: number;
  /** Which versioned prompt produced this asset (e.g. "furniture@2"). */
  promptVersion?: string;
  /** Style preset used (e.g. "classic"). */
  preset?: string;
  /** Quality gate outcome for the chosen candidate. */
  quality?: { ok: boolean; score: number; issues: { code: string; message: string; severity: string }[] };
  /** How many refinement passes ran (0 = single shot). */
  refinePasses?: number;
  /** Inferred insights (category/material/colours/room/anchor…). Loosely typed
   *  here so lib/ai has no dependency on metadata.ts internals. */
  insights?: Record<string, unknown>;
};

export type GeneratedAsset = {
  id: string;
  kind: AssetKind;
  /** The transparent PNG ready to place in a room. */
  png: RasterImage;
  metadata: AssetMetadata;
  log: PipelineEvent[];
};
