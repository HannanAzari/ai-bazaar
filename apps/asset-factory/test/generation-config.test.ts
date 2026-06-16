import { describe, it, expect, afterEach } from "vitest";
import {
  getGenerationConfig,
  estimateCost,
  clampBatch,
  checkGenerationAllowed,
  GENERATION_DEFAULTS,
  type GenerationConfig,
} from "@/lib/generation-config";

const ENV_KEYS = [
  "ASSET_GENERATION_ENABLED", "REPLICATE_API_TOKEN", "GENERATION_MODEL",
  "GENERATION_COST_PER_IMAGE", "ASSET_GENERATION_MAX_BATCH", "ASSET_GENERATION_DAILY_LIMIT",
];
const ORIGINAL = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (ORIGINAL[k] === undefined) delete process.env[k];
    else process.env[k] = ORIGINAL[k];
  }
});

function cfg(over: Partial<GenerationConfig> = {}): GenerationConfig {
  return {
    provider: "replicate", model: "m", maxBatchSize: 5, maxDailyGenerations: 50,
    estimatedCostPerImage: 0.003, enabled: true, tokenConfigured: true,
    timeoutMs: 60000, retryLimit: 1, ...over,
  };
}

describe("generation config", () => {
  it("defaults to disabled with no token", () => {
    delete process.env.ASSET_GENERATION_ENABLED;
    delete process.env.REPLICATE_API_TOKEN;
    const c = getGenerationConfig();
    expect(c.enabled).toBe(false);
    expect(c.tokenConfigured).toBe(false);
    expect(c.provider).toBe("replicate");
    expect(c.maxBatchSize).toBe(GENERATION_DEFAULTS.maxBatchSize);
    expect(c.maxDailyGenerations).toBe(GENERATION_DEFAULTS.maxDailyGenerations);
  });

  it("enables only when the flag is exactly 'true' and reflects token presence", () => {
    process.env.ASSET_GENERATION_ENABLED = "true";
    process.env.REPLICATE_API_TOKEN = "r8_secret";
    const c = getGenerationConfig();
    expect(c.enabled).toBe(true);
    expect(c.tokenConfigured).toBe(true);
    process.env.ASSET_GENERATION_ENABLED = "1";
    expect(getGenerationConfig().enabled).toBe(false);
  });

  it("never exposes the token value in the config object", () => {
    process.env.REPLICATE_API_TOKEN = "r8_secret";
    const c = getGenerationConfig();
    expect(JSON.stringify(c)).not.toContain("r8_secret");
  });

  it("reads numeric overrides", () => {
    process.env.ASSET_GENERATION_MAX_BATCH = "3";
    process.env.ASSET_GENERATION_DAILY_LIMIT = "20";
    process.env.GENERATION_COST_PER_IMAGE = "0.01";
    const c = getGenerationConfig();
    expect(c.maxBatchSize).toBe(3);
    expect(c.maxDailyGenerations).toBe(20);
    expect(c.estimatedCostPerImage).toBe(0.01);
  });

  it("estimates cost and clamps batch size", () => {
    expect(estimateCost(4, cfg({ estimatedCostPerImage: 0.01 }))).toBe(0.04);
    expect(clampBatch(99, cfg({ maxBatchSize: 5 }))).toBe(5);
    expect(clampBatch(0, cfg())).toBe(1);
    expect(clampBatch(3, cfg())).toBe(3);
  });
});

describe("generation guard", () => {
  it("blocks when disabled", () => {
    const r = checkGenerationAllowed(cfg({ enabled: false }), 1, 0);
    expect(r).toEqual({ ok: false, status: 403, error: expect.stringContaining("disabled") });
  });
  it("blocks when token missing", () => {
    expect(checkGenerationAllowed(cfg({ tokenConfigured: false }), 1, 0)).toMatchObject({ ok: false, status: 500 });
  });
  it("blocks count below 1 and above batch size", () => {
    expect(checkGenerationAllowed(cfg(), 0, 0)).toMatchObject({ ok: false, status: 400 });
    expect(checkGenerationAllowed(cfg({ maxBatchSize: 5 }), 6, 0)).toMatchObject({ ok: false, status: 400 });
  });
  it("blocks when the daily limit would be exceeded", () => {
    expect(checkGenerationAllowed(cfg({ maxDailyGenerations: 50 }), 3, 48)).toMatchObject({ ok: false, status: 429 });
  });
  it("allows a valid request within limits", () => {
    expect(checkGenerationAllowed(cfg(), 2, 10)).toEqual({ ok: true });
  });
});
