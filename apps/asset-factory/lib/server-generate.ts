import {
  type AssetCandidate,
  type AssetPack,
  type GenerationJob,
  type FactoryCategory,
} from "@/lib/types";
import {
  clampBatchForProvider,
  estimateCostForProvider,
  type GenerationConfig,
} from "@/lib/generation-config";
import { type ProviderId } from "@/lib/providers";
import {
  createGenerationJob,
  dryRunCandidates,
  generatedCandidates,
  type CreateJobInput,
} from "@/lib/generation-job";
import {
  getProviderRunner,
  friendlyProviderError,
  localImageStore,
  type ProviderRunner,
  type ImageStore,
} from "@/lib/image-provider";
import {
  validateGenerated,
  summarizeValidations,
  type CandidateValidation,
  type GeneratedValidationSummary,
} from "@/lib/generation-validate";

// Orchestrates one generation job (V3 → V3.3 multi-provider). Pure control flow
// with an INJECTED provider runner + image store so it is fully unit-testable
// without the network. Real generation is the only place a provider is called;
// dry-run never touches it. Errors are captured on the job (status "failed") rather
// than thrown, so a provider hiccup can't crash. The image store materializes a
// final URL: hosted URLs pass through (or re-host in shared mode); base64 bytes
// (OpenAI) become a data URL locally or a bucket upload in shared mode.

export type GenerateParams = {
  input: CreateJobInput;
  existing: AssetCandidate[];
  pack?: AssetPack;
  /** Defaults to the real runner for the job's provider; tests inject a mock. */
  runner?: ProviderRunner;
  /** Defaults to localImageStore; the route passes bucketImageStore in shared mode. */
  storeImage?: ImageStore;
};

export type GenerateResult = {
  job: GenerationJob;
  candidates: AssetCandidate[];
  validations: CandidateValidation[];
  summary: GeneratedValidationSummary;
};

async function materialize(
  images: { url?: string; b64?: string; contentType?: string }[],
  store: ImageStore,
  baseName: string,
): Promise<string[]> {
  const urls = await Promise.all(
    images.map(async (img, i) => {
      try {
        return await store(img, `${baseName}-${i + 1}`);
      } catch (err) {
        console.error("[asset-factory gen] store failed", err);
        return null;
      }
    }),
  );
  return urls.filter((u): u is string => typeof u === "string" && u.length > 0);
}

export async function executeGeneration(params: GenerateParams): Promise<GenerateResult> {
  const { input, existing, pack } = params;
  const config = input.config;
  const provider: ProviderId = input.provider ?? config.provider;
  // Safety: clamp the count regardless of caller (dry-run bypasses the route guard).
  const count = clampBatchForProvider(input.count, config, provider);

  let job = createGenerationJob({ ...input, count, provider });
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
      const runner = params.runner ?? getProviderRunner(provider);
      const store = params.storeImage ?? localImageStore;
      const result = await runner(
        { prompt: job.prompt, negativePrompt: job.negativePrompt, count, model: job.modelName, transparent: true },
        { dryRun: false, config },
      );
      const urls = await materialize(result.images, store, job.subject || job.category);

      candidates = generatedCandidates(job, urls, existing);
      if (candidates.length === 0) {
        job = { ...job, status: "failed", error: "No images were returned by the provider.", completedAt: new Date().toISOString() };
      } else {
        job = {
          ...job,
          status: "completed",
          actualCost: estimateCostForProvider(candidates.length, config, provider),
          generatedCandidateIds: candidates.map((c) => c.id),
          completedAt: new Date().toISOString(),
        };
      }
    } catch (err) {
      console.error("[asset-factory gen] provider error", err);
      const raw = err instanceof Error ? err.message : "Generation failed.";
      job = { ...job, status: "failed", error: friendlyProviderError(provider, raw), completedAt: new Date().toISOString() };
      candidates = [];
    }
  }

  const all = [...existing, ...candidates];
  const packMembers = pack ? existing.filter((c) => pack.assetIds.includes(c.id)) : [];
  const validations = candidates.map((c) => validateGenerated(c, all, pack, packMembers));

  return { job, candidates, validations, summary: summarizeValidations(validations) };
}

// ── Style Lab generation (V3.2 → V3.3 multi-provider) ────────────────────────
// Produces variation images for ONE golden item + style + provider — calibration
// only, never catalog candidates. Returns ONLY real image URLs (never placeholders),
// so an empty result means "failed" to the caller.

export type StyleGenerateParams = {
  category: FactoryCategory;
  subject: string;
  styleId: string;
  count: number;
  config: GenerationConfig;
  provider?: ProviderId;
  runner?: ProviderRunner;
  storeImage?: ImageStore;
};

export type StyleGenerateResult = {
  job: GenerationJob;
  imageUrls: string[];
  ok: boolean;
};

export async function executeStyleGeneration(params: StyleGenerateParams): Promise<StyleGenerateResult> {
  const { config } = params;
  const provider: ProviderId = params.provider ?? config.provider;
  const count = clampBatchForProvider(params.count, config, provider);

  let job = createGenerationJob({
    category: params.category, pack: "style-lab", count, subject: params.subject,
    requestedBy: "style-lab", dryRun: false, config, styleId: params.styleId, provider,
  });
  job = { ...job, status: "running", startedAt: new Date().toISOString() };

  let imageUrls: string[] = [];
  try {
    const runner = params.runner ?? getProviderRunner(provider);
    const store = params.storeImage ?? localImageStore;
    const result = await runner(
      { prompt: job.prompt, negativePrompt: job.negativePrompt, count, model: job.modelName, transparent: true },
      { dryRun: false, config },
    );
    imageUrls = await materialize(result.images, store, `style-${params.category}-${params.styleId}-${provider}`);

    job = {
      ...job,
      status: imageUrls.length > 0 ? "completed" : "failed",
      actualCost: estimateCostForProvider(imageUrls.length, config, provider),
      completedAt: new Date().toISOString(),
      error: imageUrls.length === 0 ? "The provider returned no images." : undefined,
    };
  } catch (err) {
    // Log the RAW provider error; surface a friendly (but not hidden) message.
    console.error("[asset-factory style-gen] provider error", err);
    const raw = err instanceof Error ? err.message : "Generation failed.";
    job = { ...job, status: "failed", error: friendlyProviderError(provider, raw), completedAt: new Date().toISOString() };
    imageUrls = [];
  }

  return { job, imageUrls, ok: imageUrls.length > 0 };
}
