// Generation config (V3, Task 1). Pure module read from env. Generation is OFF by
// default; real calls require ASSET_GENERATION_ENABLED=true AND a Replicate token.
// This module contains NO secret — `tokenConfigured` is a boolean only, so the
// whole config is safe to return to the client.

import { type ProviderId } from "@/lib/providers";

export type GenerationConfig = {
  /** The default/selected provider (GENERATION_PROVIDER). */
  provider: ProviderId;
  /** Replicate model id. */
  model: string;
  maxBatchSize: number;
  maxDailyGenerations: number;
  estimatedCostPerImage: number;
  enabled: boolean;
  /** Whether REPLICATE_API_TOKEN is present (boolean only — never the token). */
  tokenConfigured: boolean;
  timeoutMs: number;
  retryLimit: number;
  /** Delay between sequential provider calls (ms) to respect rate limits. */
  requestDelayMs: number;
  // ── OpenAI provider (V3.3) ──
  /** OpenAI image model (OPENAI_IMAGE_MODEL). */
  openaiModel: string;
  /** Whether OPENAI_API_KEY is present (boolean only — never the key). */
  openaiTokenConfigured: boolean;
  /** Extra gate for OpenAI generation (OPENAI_GENERATION_ENABLED). */
  openaiEnabled: boolean;
  openaiCostPerImage: number;
  /** Small cap until OpenAI quality/cost is understood. */
  maxBatchOpenai: number;
};

export const GENERATION_DEFAULTS = {
  provider: "replicate" as ProviderId,
  model: "black-forest-labs/flux-schnell",
  maxBatchSize: 5,
  maxDailyGenerations: 50,
  estimatedCostPerImage: 0.003, // USD, flux-schnell ballpark
  timeoutMs: 60_000,
  retryLimit: 1,
  // Replicate free tier is ~6 req/min, burst 1 → ~12s between calls is safe.
  requestDelayMs: 12_000,
  // OpenAI GPT Image (current recommended image model in the OpenAI API docs).
  openaiModel: "gpt-image-1",
  openaiCostPerImage: 0.04, // USD, gpt-image-1 1024² ballpark — confirm on your plan
  maxBatchOpenai: 3,
};

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Like `num` but allows 0 (e.g. a zero request delay in tests). */
function numAllowZero(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Read the current generation config from env. Server + client safe (no secret). */
export function getGenerationConfig(): GenerationConfig {
  const envProvider = process.env.GENERATION_PROVIDER;
  const provider: ProviderId = envProvider === "openai" ? "openai" : "replicate";
  return {
    provider,
    model: process.env.GENERATION_MODEL || GENERATION_DEFAULTS.model,
    maxBatchSize: num(process.env.ASSET_GENERATION_MAX_BATCH, GENERATION_DEFAULTS.maxBatchSize),
    maxDailyGenerations: num(process.env.ASSET_GENERATION_DAILY_LIMIT, GENERATION_DEFAULTS.maxDailyGenerations),
    estimatedCostPerImage: num(process.env.GENERATION_COST_PER_IMAGE, GENERATION_DEFAULTS.estimatedCostPerImage),
    enabled: process.env.ASSET_GENERATION_ENABLED === "true",
    tokenConfigured: !!process.env.REPLICATE_API_TOKEN,
    timeoutMs: num(process.env.GENERATION_TIMEOUT_MS, GENERATION_DEFAULTS.timeoutMs),
    retryLimit: num(process.env.GENERATION_RETRY_LIMIT, GENERATION_DEFAULTS.retryLimit),
    requestDelayMs: numAllowZero(process.env.GENERATION_REQUEST_DELAY_MS, GENERATION_DEFAULTS.requestDelayMs),
    openaiModel: process.env.OPENAI_IMAGE_MODEL || GENERATION_DEFAULTS.openaiModel,
    openaiTokenConfigured: !!process.env.OPENAI_API_KEY,
    openaiEnabled: process.env.OPENAI_GENERATION_ENABLED === "true",
    openaiCostPerImage: num(process.env.OPENAI_COST_PER_IMAGE, GENERATION_DEFAULTS.openaiCostPerImage),
    maxBatchOpenai: num(process.env.OPENAI_MAX_BATCH, GENERATION_DEFAULTS.maxBatchOpenai),
  };
}

// ── Provider-aware helpers (V3.3) ────────────────────────────────────────────

export function modelForProvider(config: GenerationConfig, provider: ProviderId): string {
  return provider === "openai" ? config.openaiModel : config.model;
}

export function costPerImageForProvider(config: GenerationConfig, provider: ProviderId): number {
  return provider === "openai" ? config.openaiCostPerImage : config.estimatedCostPerImage;
}

export function maxBatchForProvider(config: GenerationConfig, provider: ProviderId): number {
  return provider === "openai" ? config.maxBatchOpenai : config.maxBatchSize;
}

export function providerTokenConfigured(config: GenerationConfig, provider: ProviderId): boolean {
  return provider === "openai" ? config.openaiTokenConfigured : config.tokenConfigured;
}

/** A provider is usable when the global flag is on AND (for OpenAI) its own flag is on. */
export function providerEnabled(config: GenerationConfig, provider: ProviderId): boolean {
  return config.enabled && (provider === "openai" ? config.openaiEnabled : true);
}

export function estimateCostForProvider(count: number, config: GenerationConfig, provider: ProviderId): number {
  return Math.round(count * costPerImageForProvider(config, provider) * 1000) / 1000;
}

export function clampBatchForProvider(count: number, config: GenerationConfig, provider: ProviderId): number {
  if (!Number.isFinite(count) || count < 1) return 1;
  return Math.min(Math.floor(count), maxBatchForProvider(config, provider));
}

export function estimateCost(count: number, config: GenerationConfig): number {
  return Math.round(count * config.estimatedCostPerImage * 1000) / 1000;
}

/** Clamp a requested count to [1, maxBatchSize]. */
export function clampBatch(count: number, config: GenerationConfig): number {
  if (!Number.isFinite(count) || count < 1) return 1;
  return Math.min(Math.floor(count), config.maxBatchSize);
}

export type GuardResult = { ok: true } | { ok: false; status: number; error: string };

/**
 * The safety gate for REAL generation, per provider (dry-run bypasses it — no
 * provider call, no cost). Order: global disabled → provider disabled → missing key
 * → bad count → batch cap → daily limit.
 */
export function checkProviderAllowed(
  config: GenerationConfig,
  provider: ProviderId,
  count: number,
  generatedToday: number,
): GuardResult {
  if (!config.enabled) {
    return { ok: false, status: 403, error: "Generation is disabled. Set ASSET_GENERATION_ENABLED=true." };
  }
  if (provider === "openai" && !config.openaiEnabled) {
    return { ok: false, status: 403, error: "OpenAI generation is disabled. Set OPENAI_GENERATION_ENABLED=true." };
  }
  if (!providerTokenConfigured(config, provider)) {
    return {
      ok: false,
      status: 500,
      error: provider === "openai" ? "OPENAI_API_KEY is not configured." : "REPLICATE_API_TOKEN is not configured.",
    };
  }
  if (!Number.isFinite(count) || count < 1) {
    return { ok: false, status: 400, error: "Count must be at least 1." };
  }
  const maxBatch = maxBatchForProvider(config, provider);
  if (count > maxBatch) {
    return { ok: false, status: 400, error: `Batch size ${count} exceeds the ${provider} max of ${maxBatch}.` };
  }
  if (generatedToday + count > config.maxDailyGenerations) {
    return { ok: false, status: 429, error: `Daily limit reached (${generatedToday}/${config.maxDailyGenerations}).` };
  }
  return { ok: true };
}

/** Back-compat replicate-only guard (delegates to the provider-aware gate). */
export function checkGenerationAllowed(
  config: GenerationConfig,
  count: number,
  generatedToday: number,
): GuardResult {
  return checkProviderAllowed(config, "replicate", count, generatedToday);
}
