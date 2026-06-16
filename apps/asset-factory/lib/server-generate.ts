import {
  type AssetCandidate,
  type AssetPack,
  type GenerationJob,
} from "@/lib/types";
import { clampBatch, estimateCost } from "@/lib/generation-config";
import {
  createGenerationJob,
  dryRunCandidates,
  generatedCandidates,
  type CreateJobInput,
} from "@/lib/generation-job";
import { runReplicate, type ReplicateResult, type ReplicateRunInput, type RunOptions } from "@/lib/replicate-server";
import {
  validateGenerated,
  summarizeValidations,
  type CandidateValidation,
  type GeneratedValidationSummary,
} from "@/lib/generation-validate";

// Orchestrates one generation job (V3). Pure control flow with INJECTED provider +
// uploader so it is fully unit-testable without the network. Real generation is the
// only place Replicate is called; dry-run never touches it. Errors are captured on
// the job (status "failed") rather than thrown, so a provider hiccup can't crash.

export type ReplicateRunner = (input: ReplicateRunInput, options: RunOptions) => Promise<ReplicateResult>;
export type Uploader = (sourceUrl: string, name: string) => Promise<string>;

export type GenerateParams = {
  input: CreateJobInput;
  existing: AssetCandidate[];
  pack?: AssetPack;
  /** Defaults to the real Replicate client; tests inject a mock. */
  replicate?: ReplicateRunner;
  /** Shared mode: re-host the provider image into the candidate bucket. */
  uploader?: Uploader;
};

export type GenerateResult = {
  job: GenerationJob;
  candidates: AssetCandidate[];
  validations: CandidateValidation[];
  summary: GeneratedValidationSummary;
};

export async function executeGeneration(params: GenerateParams): Promise<GenerateResult> {
  const { input, existing, pack } = params;
  const config = input.config;
  // Safety: clamp the count regardless of caller (dry-run bypasses the route guard).
  const count = clampBatch(input.count, config);

  let job = createGenerationJob({ ...input, count });
  job = { ...job, status: "running", startedAt: new Date().toISOString() };

  let candidates: AssetCandidate[] = [];

  if (job.dryRun) {
    candidates = dryRunCandidates(job, existing);
    job = {
      ...job,
      status: "completed",
      actualCost: 0,
      generatedCandidateIds: candidates.map((c) => c.id),
      completedAt: new Date().toISOString(),
    };
  } else {
    try {
      const runner = params.replicate ?? runReplicate;
      const result = await runner(
        { prompt: job.prompt, negativePrompt: job.negativePrompt, count, model: job.modelName },
        { dryRun: false, config },
      );

      // Re-host images into our storage when an uploader is provided (shared mode).
      let urls: (string | null)[] = result.imageUrls;
      if (params.uploader) {
        urls = await Promise.all(
          result.imageUrls.map(async (u, i) => {
            try {
              return await params.uploader!(u, `${job.subject || job.category}-${i + 1}`);
            } catch {
              return null; // upload failed → treat as missing image, don't crash
            }
          }),
        );
      }

      candidates = generatedCandidates(job, urls, existing);
      if (candidates.length === 0) {
        job = { ...job, status: "failed", error: "No images were returned by the provider.", completedAt: new Date().toISOString() };
      } else {
        job = {
          ...job,
          status: "completed",
          actualCost: estimateCost(candidates.length, config),
          generatedCandidateIds: candidates.map((c) => c.id),
          completedAt: new Date().toISOString(),
        };
      }
    } catch (err) {
      job = {
        ...job,
        status: "failed",
        error: err instanceof Error ? err.message : "Generation failed.",
        completedAt: new Date().toISOString(),
      };
      candidates = [];
    }
  }

  const all = [...existing, ...candidates];
  const packMembers = pack ? existing.filter((c) => pack.assetIds.includes(c.id)) : [];
  const validations = candidates.map((c) => validateGenerated(c, all, pack, packMembers));

  return { job, candidates, validations, summary: summarizeValidations(validations) };
}
