import { describe, it, expect, vi } from "vitest";
import { executeGeneration, executeStyleGeneration } from "@/lib/server-generate";
import { getGenerationConfig, type GenerationConfig } from "@/lib/generation-config";
import { type CreateJobInput } from "@/lib/generation-job";
import { type ProviderRunner, type ImageStore } from "@/lib/image-provider";

const config: GenerationConfig = {
  ...getGenerationConfig(),
  enabled: true, tokenConfigured: true, openaiEnabled: true, openaiTokenConfigured: true,
  maxBatchSize: 5, maxBatchOpenai: 3,
};

function input(over: Partial<CreateJobInput> = {}): CreateJobInput {
  return { category: "chair", pack: "cozy", count: 2, subject: "a cozy armchair", requestedBy: "h", dryRun: false, config, ...over };
}

// Provider runner returning the normalized { images } shape.
const urlRunner = (urls: string[]): ProviderRunner => async () => ({ images: urls.map((url) => ({ url })) });
const okRunner = urlRunner(["https://img/1.png", "https://img/2.png"]);

describe("executeGeneration", () => {
  it("dry-run produces placeholder candidates with zero cost, no provider call", async () => {
    const runner = vi.fn();
    const out = await executeGeneration({ input: input({ dryRun: true }), existing: [], runner: runner as unknown as ProviderRunner });
    expect(out.job.status).toBe("completed");
    expect(out.job.dryRun).toBe(true);
    expect(out.job.actualCost).toBe(0);
    expect(out.candidates).toHaveLength(2);
    expect(out.candidates.every((c) => c.status === "needs_review")).toBe(true);
    expect(runner).not.toHaveBeenCalled();
    expect(out.validations).toHaveLength(2);
  });

  it("real run creates needs_review candidates from a mocked provider", async () => {
    const out = await executeGeneration({ input: input(), existing: [], runner: okRunner });
    expect(out.job.status).toBe("completed");
    expect(out.candidates).toHaveLength(2);
    expect(out.candidates[0].imageUrl).toBe("https://img/1.png");
    expect(out.job.actualCost).toBeGreaterThan(0);
    expect(out.job.generatedCandidateIds).toHaveLength(2);
  });

  it("marks the job failed when no images are returned (no throw)", async () => {
    const out = await executeGeneration({ input: input(), existing: [], runner: urlRunner([]) });
    expect(out.job.status).toBe("failed");
    expect(out.job.error).toMatch(/no images/i);
    expect(out.candidates).toHaveLength(0);
  });

  it("captures a provider error on the job instead of throwing", async () => {
    const boom: ProviderRunner = async () => { throw new Error("provider exploded"); };
    const out = await executeGeneration({ input: input(), existing: [], runner: boom });
    expect(out.job.status).toBe("failed");
    expect(out.job.error).toMatch(/provider exploded/);
  });

  it("clamps the batch to the provider max size", async () => {
    const out = await executeGeneration({ input: input({ dryRun: true, count: 99 }), existing: [] });
    expect(out.candidates).toHaveLength(config.maxBatchSize); // replicate default
  });

  it("stores provider images via the image store (shared mode)", async () => {
    const store: ImageStore = vi.fn(async (_img, name) => `https://bucket/${name}.png`);
    const out = await executeGeneration({ input: input({ count: 1 }), existing: [], runner: urlRunner(["https://provider/x.png"]), storeImage: store });
    expect(store).toHaveBeenCalledTimes(1);
    expect(out.candidates[0].imageUrl).toMatch(/^https:\/\/bucket\//);
  });

  it("handles an OpenAI provider (base64) job → stores bytes, records model/provider", async () => {
    const b64Runner: ProviderRunner = async () => ({ images: [{ b64: "AAAA", contentType: "image/png" }] });
    const store: ImageStore = async (img, name) => (img.b64 ? `https://bucket/${name}.png` : null);
    const out = await executeGeneration({ input: input({ count: 1, provider: "openai" }), existing: [], runner: b64Runner, storeImage: store });
    expect(out.job.modelProvider).toBe("openai");
    expect(out.job.modelName).toBe(config.openaiModel);
    expect(out.candidates[0].imageUrl).toMatch(/^https:\/\/bucket\//);
  });

  it("runs validation on every generated candidate", async () => {
    const out = await executeGeneration({ input: input(), existing: [], runner: okRunner });
    expect(out.validations.every((v) => v.quality.some((q) => q.code === "non_transparent"))).toBe(true);
    expect(out.summary.total).toBe(2);
  });
});

describe("executeStyleGeneration (Style Lab real generation)", () => {
  const styleArgs = { category: "chair" as const, subject: "accent chair", styleId: "nestudio_v2", count: 1, config };

  it("returns the provider's real image URLs (no placeholders)", async () => {
    const out = await executeStyleGeneration({ ...styleArgs, runner: urlRunner(["https://cdn/r/1.png"]) });
    expect(out.ok).toBe(true);
    expect(out.imageUrls).toEqual(["https://cdn/r/1.png"]);
    expect(out.imageUrls.some((u) => u.startsWith("/samples/"))).toBe(false);
    expect(out.job.status).toBe("completed");
    expect(out.job.pack).toBe("style-lab");
  });

  it("records provider + model on the job (OpenAI)", async () => {
    const b64Runner: ProviderRunner = async () => ({ images: [{ b64: "AAAA", contentType: "image/png" }] });
    const store: ImageStore = async (_img, name) => `https://bucket/${name}.png`;
    const out = await executeStyleGeneration({ ...styleArgs, provider: "openai", runner: b64Runner, storeImage: store });
    expect(out.ok).toBe(true);
    expect(out.job.modelProvider).toBe("openai");
    expect(out.job.modelName).toBe(config.openaiModel);
  });

  it("stores images via the store when provided (shared mode)", async () => {
    const store: ImageStore = vi.fn(async (_u, name) => `https://bucket/${name}.png`);
    const out = await executeStyleGeneration({ ...styleArgs, runner: urlRunner(["https://provider/x.png"]), storeImage: store });
    expect(store).toHaveBeenCalledTimes(1);
    expect(out.imageUrls[0]).toMatch(/^https:\/\/bucket\//);
  });

  it("fails (ok:false, empty urls, job error) when the provider returns nothing", async () => {
    const out = await executeStyleGeneration({ ...styleArgs, runner: urlRunner([]) });
    expect(out.ok).toBe(false);
    expect(out.imageUrls).toEqual([]);
    expect(out.job.status).toBe("failed");
    expect(out.job.error).toMatch(/no images/i);
  });

  it("maps a Replicate 429 to a friendly message; OpenAI quota to its own", async () => {
    const r429: ProviderRunner = async () => { throw new Error("Replicate request failed (429): rate limit"); };
    const r = await executeStyleGeneration({ ...styleArgs, provider: "replicate", runner: r429 });
    expect(r.job.error).toBe("Replicate rate limit hit. Wait a minute or add credit, then retry.");

    const oQuota: ProviderRunner = async () => { throw new Error("OpenAI request failed (429): insufficient_quota"); };
    const o = await executeStyleGeneration({ ...styleArgs, provider: "openai", runner: oQuota });
    expect(o.job.error).toBe("OpenAI quota exceeded — add credit, then retry.");
  });
});
