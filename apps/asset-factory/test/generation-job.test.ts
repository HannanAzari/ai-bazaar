import { describe, it, expect } from "vitest";
import {
  createGenerationJob,
  dryRunCandidates,
  generatedCandidates,
  usageStats,
  generatedToday,
} from "@/lib/generation-job";
import { MASTER_PROMPT, NEGATIVE_PROMPT } from "@/lib/prompts";
import { type GenerationJob } from "@/lib/types";
import { getGenerationConfig, type GenerationConfig } from "@/lib/generation-config";

const config: GenerationConfig = { ...getGenerationConfig(), estimatedCostPerImage: 0.01, maxBatchSize: 5 };

function job(over: Partial<Parameters<typeof createGenerationJob>[0]> = {}) {
  return createGenerationJob({
    category: "chair", pack: "cozy", count: 3, subject: "a walnut armchair",
    requestedBy: "Hannah", dryRun: true, config, ...over,
  });
}

describe("generation job builder", () => {
  it("builds a draft job with prompt + estimated cost", () => {
    const j = job();
    expect(j.status).toBe("draft");
    expect(j.prompt.startsWith(MASTER_PROMPT)).toBe(true);
    expect(j.prompt).toContain("a walnut armchair");
    expect(j.negativePrompt).toBe(NEGATIVE_PROMPT);
    expect(j.estimatedCost).toBeCloseTo(0.03, 5);
    expect(j.modelProvider).toBe("replicate");
    expect(j.styleId).toBe("nestudio_v2"); // the single locked identity
  });

  it("resolves any styleId to the locked nestudio_v2 identity", () => {
    const j = job({ styleId: "anything" });
    expect(j.styleId).toBe("nestudio_v2");
    expect(j.prompt).toContain("Scandinavian"); // the DNA identity layer
  });

  it("dry-run candidates are needs_review placeholders with unique slugs", () => {
    const cands = dryRunCandidates(job({ count: 4 }));
    expect(cands).toHaveLength(4);
    expect(cands.every((c) => c.status === "needs_review")).toBe(true);
    expect(cands.every((c) => c.transparent === true)).toBe(true); // placeholders marked clean
    expect(new Set(cands.map((c) => c.slug)).size).toBe(4);
    expect(cands.every((c) => c.modelProvider === "replicate")).toBe(true);
  });

  it("avoids slug collisions with existing candidates", () => {
    const first = dryRunCandidates(job({ count: 1 }));
    const second = dryRunCandidates(job({ count: 1 }), first);
    expect(second[0].slug).not.toBe(first[0].slug);
  });

  it("generated candidates skip missing images and are non-transparent", () => {
    const realJob = { ...job({ dryRun: false }), dryRun: false };
    const cands = generatedCandidates(realJob, ["https://img/1.png", null, undefined, "https://img/2.png"]);
    expect(cands).toHaveLength(2);
    expect(cands.every((c) => c.status === "needs_review")).toBe(true);
    expect(cands.every((c) => c.transparent === false)).toBe(true);
    expect(cands[0].imageUrl).toBe("https://img/1.png");
  });

  it("tracks usage from real completed jobs only", () => {
    const now = new Date();
    const make = (over: Partial<GenerationJob>): GenerationJob => ({
      ...job({ dryRun: false }), status: "completed", dryRun: false, estimatedCost: 0.03,
      generatedCandidateIds: ["a", "b", "c"], createdAt: now.toISOString(), ...over,
    });
    const jobs = [
      make({ id: "1" }),
      make({ id: "2", dryRun: true }), // dry-run excluded
      make({ id: "3", status: "failed", generatedCandidateIds: [] }), // not completed
    ];
    const stats = usageStats(jobs, now);
    expect(stats.generatedToday).toBe(3);
    expect(stats.estSpendToday).toBeCloseTo(0.03, 5);
    expect(generatedToday(jobs, now)).toBe(3);
  });
});
