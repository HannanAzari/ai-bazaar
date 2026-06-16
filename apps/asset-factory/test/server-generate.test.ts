import { describe, it, expect, vi } from "vitest";
import { executeGeneration, type ReplicateRunner } from "@/lib/server-generate";
import { getGenerationConfig, type GenerationConfig } from "@/lib/generation-config";
import { type CreateJobInput } from "@/lib/generation-job";

const config: GenerationConfig = { ...getGenerationConfig(), enabled: true, tokenConfigured: true, maxBatchSize: 5 };

function input(over: Partial<CreateJobInput> = {}): CreateJobInput {
  return { category: "chair", pack: "cozy", count: 2, subject: "a cozy armchair", requestedBy: "h", dryRun: false, config, ...over };
}

const okRunner: ReplicateRunner = async (_in, _opts) => ({ imageUrls: ["https://img/1.png", "https://img/2.png"] });

describe("executeGeneration", () => {
  it("dry-run produces placeholder candidates with zero cost, no provider call", async () => {
    const runner = vi.fn();
    const out = await executeGeneration({ input: input({ dryRun: true }), existing: [], replicate: runner as unknown as ReplicateRunner });
    expect(out.job.status).toBe("completed");
    expect(out.job.dryRun).toBe(true);
    expect(out.job.actualCost).toBe(0);
    expect(out.candidates).toHaveLength(2);
    expect(out.candidates.every((c) => c.status === "needs_review")).toBe(true);
    expect(runner).not.toHaveBeenCalled();
    expect(out.validations).toHaveLength(2);
  });

  it("real run creates needs_review candidates from a mocked provider", async () => {
    const out = await executeGeneration({ input: input(), existing: [], replicate: okRunner });
    expect(out.job.status).toBe("completed");
    expect(out.job.dryRun).toBe(false);
    expect(out.candidates).toHaveLength(2);
    expect(out.candidates[0].imageUrl).toBe("https://img/1.png");
    expect(out.candidates.every((c) => c.status === "needs_review")).toBe(true);
    expect(out.job.actualCost).toBeGreaterThan(0);
    expect(out.job.generatedCandidateIds).toHaveLength(2);
  });

  it("marks the job failed when no images are returned (no throw)", async () => {
    const empty: ReplicateRunner = async () => ({ imageUrls: [] });
    const out = await executeGeneration({ input: input(), existing: [], replicate: empty });
    expect(out.job.status).toBe("failed");
    expect(out.job.error).toMatch(/no images/i);
    expect(out.candidates).toHaveLength(0);
  });

  it("captures a provider error on the job instead of throwing", async () => {
    const boom: ReplicateRunner = async () => {
      throw new Error("provider exploded");
    };
    const out = await executeGeneration({ input: input(), existing: [], replicate: boom });
    expect(out.job.status).toBe("failed");
    expect(out.job.error).toMatch(/provider exploded/);
  });

  it("clamps the batch to the max size", async () => {
    const out = await executeGeneration({ input: input({ dryRun: true, count: 99 }), existing: [] });
    expect(out.candidates).toHaveLength(config.maxBatchSize);
  });

  it("re-hosts provider images via the uploader (shared mode)", async () => {
    const uploader = vi.fn(async (_url: string, name: string) => `https://bucket/${name}.png`);
    const out = await executeGeneration({ input: input({ count: 1 }), existing: [], replicate: async () => ({ imageUrls: ["https://provider/x.png"] }), uploader });
    expect(uploader).toHaveBeenCalledTimes(1);
    expect(out.candidates[0].imageUrl).toMatch(/^https:\/\/bucket\//);
  });

  it("runs validation on every generated candidate", async () => {
    const out = await executeGeneration({ input: input(), existing: [], replicate: okRunner });
    // Real outputs are non-transparent → a non_transparent quality warning.
    expect(out.validations.every((v) => v.quality.some((q) => q.code === "non_transparent"))).toBe(true);
    expect(out.summary.total).toBe(2);
  });
});
