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
import { type GenerationConfig } from "@/lib/generation-config";
import { type FactoryCategory } from "@/lib/types";
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

// ── Style Lab generation (V3.2) ──────────────────────────────────────────────
// Produces variation images for ONE golden item + style — for calibration only,
// never catalog candidates. Like executeGeneration: injected provider/uploader,
// errors captured on the job (never thrown). Returns ONLY real image URLs — it
// never fabricates placeholders, so an empty result means "failed" to the caller.

export type StyleGenerateParams = {
  category: FactoryCategory;
  subject: string;
  styleId: string;
  count: number;
  config: GenerationConfig;
  replicate?: ReplicateRunner;
  uploader?: Uploader;
};

export type StyleGenerateResult = {
  job: GenerationJob;
  imageUrls: string[];
  ok: boolean;
};

export async function executeStyleGeneration(params: StyleGenerateParams): Promise<StyleGenerateResult> {
  const { config } = params;
  const count = clampBatch(params.count, config);

  let job = createGenerationJob({
    category: params.category, pack: "style-lab", count, subject: params.subject,
    requestedBy: "style-lab", dryRun: false, config, styleId: params.styleId,
  });
  job = { ...job, status: "running", startedAt: new Date().toISOString() };

  let imageUrls: string[] = [];
  try {
    const runner = params.replicate ?? runReplicate;
    const result = await runner(
      { prompt: job.prompt, negativePrompt: job.negativePrompt, count, model: job.modelName },
      { dryRun: false, config },
    );
    imageUrls = result.imageUrls.filter((u): u is string => typeof u === "string" && u.length > 0);

    if (params.uploader && imageUrls.length > 0) {
      imageUrls = (
        await Promise.all(
          imageUrls.map(async (u, i) => {
            try {
              return await params.uploader!(u, `style-${params.category}-${params.styleId}-${i + 1}`);
            } catch (err) {
              console.error("[asset-factory style-gen] upload failed", err);
              return null;
            }
          }),
        )
      ).filter((u): u is string => !!u);
    }

    job = {
      ...job,
      status: imageUrls.length > 0 ? "completed" : "failed",
      actualCost: estimateCost(imageUrls.length, config),
      completedAt: new Date().toISOString(),
      error: imageUrls.length === 0 ? "The provider returned no images." : undefined,
    };
  } catch (err) {
    console.error("[asset-factory style-gen] provider error", err);
    job = { ...job, status: "failed", error: err instanceof Error ? err.message : "Generation failed.", completedAt: new Date().toISOString() };
    imageUrls = [];
  }

  return { job, imageUrls, ok: imageUrls.length > 0 };
}
