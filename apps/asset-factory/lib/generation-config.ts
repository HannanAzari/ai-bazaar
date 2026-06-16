// Generation config (V3, Task 1). Pure module read from env. Generation is OFF by
// default; real calls require ASSET_GENERATION_ENABLED=true AND a Replicate token.
// This module contains NO secret — `tokenConfigured` is a boolean only, so the
// whole config is safe to return to the client.

export type GenerationConfig = {
  provider: "replicate";
  model: string;
  maxBatchSize: number;
  maxDailyGenerations: number;
  estimatedCostPerImage: number;
  enabled: boolean;
  /** Whether REPLICATE_API_TOKEN is present (boolean only — never the token). */
  tokenConfigured: boolean;
  timeoutMs: number;
  retryLimit: number;
};

export const GENERATION_DEFAULTS = {
  provider: "replicate" as const,
  model: "black-forest-labs/flux-schnell",
  maxBatchSize: 5,
  maxDailyGenerations: 50,
  estimatedCostPerImage: 0.003, // USD, flux-schnell ballpark
  timeoutMs: 60_000,
  retryLimit: 1,
};

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Read the current generation config from env. Server + client safe (no secret). */
export function getGenerationConfig(): GenerationConfig {
  return {
    provider: "replicate",
    model: process.env.GENERATION_MODEL || GENERATION_DEFAULTS.model,
    maxBatchSize: num(process.env.ASSET_GENERATION_MAX_BATCH, GENERATION_DEFAULTS.maxBatchSize),
    maxDailyGenerations: num(process.env.ASSET_GENERATION_DAILY_LIMIT, GENERATION_DEFAULTS.maxDailyGenerations),
    estimatedCostPerImage: num(process.env.GENERATION_COST_PER_IMAGE, GENERATION_DEFAULTS.estimatedCostPerImage),
    enabled: process.env.ASSET_GENERATION_ENABLED === "true",
    tokenConfigured: !!process.env.REPLICATE_API_TOKEN,
    timeoutMs: num(process.env.GENERATION_TIMEOUT_MS, GENERATION_DEFAULTS.timeoutMs),
    retryLimit: num(process.env.GENERATION_RETRY_LIMIT, GENERATION_DEFAULTS.retryLimit),
  };
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
 * The single safety gate for REAL generation (dry-run bypasses it — no provider
 * call, no cost). Order matters: disabled → no token → bad count → batch → daily.
 */
export function checkGenerationAllowed(
  config: GenerationConfig,
  count: number,
  generatedToday: number,
): GuardResult {
  if (!config.enabled) {
    return { ok: false, status: 403, error: "Generation is disabled. Set ASSET_GENERATION_ENABLED=true." };
  }
  if (!config.tokenConfigured) {
    return { ok: false, status: 500, error: "REPLICATE_API_TOKEN is not configured." };
  }
  if (!Number.isFinite(count) || count < 1) {
    return { ok: false, status: 400, error: "Count must be at least 1." };
  }
  if (count > config.maxBatchSize) {
    return { ok: false, status: 400, error: `Batch size ${count} exceeds the max of ${config.maxBatchSize}.` };
  }
  if (generatedToday + count > config.maxDailyGenerations) {
    return { ok: false, status: 429, error: `Daily limit reached (${generatedToday}/${config.maxDailyGenerations}).` };
  }
  return { ok: true };
}
