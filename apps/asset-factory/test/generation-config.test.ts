import { describe, it, expect, afterEach } from "vitest";
import {
  getGenerationConfig,
  estimateCost,
  clampBatch,
  checkGenerationAllowed,
  checkProviderAllowed,
  modelForProvider,
  maxBatchForProvider,
  GENERATION_DEFAULTS,
  type GenerationConfig,
} from "@/lib/generation-config";

const ENV_KEYS = [
  "ASSET_GENERATION_ENABLED", "REPLICATE_API_TOKEN", "GENERATION_MODEL",
  "GENERATION_COST_PER_IMAGE", "ASSET_GENERATION_MAX_BATCH", "ASSET_GENERATION_DAILY_LIMIT",
  "GENERATION_REQUEST_DELAY_MS", "GENERATION_PROVIDER", "OPENAI_API_KEY",
  "OPENAI_IMAGE_MODEL", "OPENAI_GENERATION_ENABLED",
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
    timeoutMs: 60000, retryLimit: 1, requestDelayMs: 12000,
    openaiModel: "gpt-image-1", openaiTokenConfigured: true, openaiEnabled: true,
    openaiCostPerImage: 0.04, maxBatchOpenai: 3, ...over,
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

  it("defaults the request delay to 12000ms and honours overrides (incl. 0)", () => {
    delete process.env.GENERATION_REQUEST_DELAY_MS;
    expect(getGenerationConfig().requestDelayMs).toBe(12000);
    process.env.GENERATION_REQUEST_DELAY_MS = "5000";
    expect(getGenerationConfig().requestDelayMs).toBe(5000);
    process.env.GENERATION_REQUEST_DELAY_MS = "0";
    expect(getGenerationConfig().requestDelayMs).toBe(0); // 0 allowed (fast tests)
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

describe("provider config + selection (V3.3)", () => {
  it("selects the provider from GENERATION_PROVIDER (default replicate)", () => {
    delete process.env.GENERATION_PROVIDER;
    expect(getGenerationConfig().provider).toBe("replicate");
    process.env.GENERATION_PROVIDER = "openai";
    expect(getGenerationConfig().provider).toBe("openai");
    process.env.GENERATION_PROVIDER = "bogus";
    expect(getGenerationConfig().provider).toBe("replicate"); // unknown → replicate
  });

  it("reads OpenAI config (model + token + enable flag) and defaults", () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_GENERATION_ENABLED;
    delete process.env.OPENAI_IMAGE_MODEL;
    const c = getGenerationConfig();
    expect(c.openaiModel).toBe(GENERATION_DEFAULTS.openaiModel);
    expect(c.openaiTokenConfigured).toBe(false);
    expect(c.openaiEnabled).toBe(false);
    expect(c.maxBatchOpenai).toBe(3);
    process.env.OPENAI_API_KEY = "sk-secret";
    process.env.OPENAI_GENERATION_ENABLED = "true";
    process.env.OPENAI_IMAGE_MODEL = "gpt-image-1";
    const c2 = getGenerationConfig();
    expect(c2.openaiTokenConfigured).toBe(true);
    expect(c2.openaiEnabled).toBe(true);
  });

  it("NEVER exposes API keys in the config object (boolean flags only)", () => {
    process.env.REPLICATE_API_TOKEN = "r8_secret";
    process.env.OPENAI_API_KEY = "sk-secret";
    const json = JSON.stringify(getGenerationConfig());
    expect(json).not.toContain("r8_secret");
    expect(json).not.toContain("sk-secret");
  });

  it("resolves model + batch cap per provider", () => {
    expect(modelForProvider(cfg(), "replicate")).toBe("m");
    expect(modelForProvider(cfg({ openaiModel: "gpt-image-1" }), "openai")).toBe("gpt-image-1");
    expect(maxBatchForProvider(cfg({ maxBatchSize: 5, maxBatchOpenai: 3 }), "openai")).toBe(3);
  });

  it("OpenAI guard: own enable flag + key + small batch cap", () => {
    expect(checkProviderAllowed(cfg({ openaiEnabled: false }), "openai", 1, 0)).toMatchObject({ ok: false, status: 403 });
    expect(checkProviderAllowed(cfg({ openaiTokenConfigured: false }), "openai", 1, 0)).toMatchObject({ ok: false, status: 500 });
    expect(checkProviderAllowed(cfg({ maxBatchOpenai: 3 }), "openai", 4, 0)).toMatchObject({ ok: false, status: 400 });
    expect(checkProviderAllowed(cfg(), "openai", 2, 0)).toEqual({ ok: true });
    // Replicate is unaffected by OpenAI flags.
    expect(checkProviderAllowed(cfg({ openaiEnabled: false }), "replicate", 2, 0)).toEqual({ ok: true });
  });
});
