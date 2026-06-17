import {
  CATEGORY_META,
  type AssetCandidate,
  type FactoryCategory,
  type GenerationJob,
} from "@/lib/types";
import { slugify } from "@/lib/slug";
import { buildStyledPromptPair, DEFAULT_STYLE_FAMILY, getStyleFamily } from "@/lib/styles";
import { estimateCost, type GenerationConfig } from "@/lib/generation-config";

// Pure generation-job builders (V3). No I/O, no provider calls — fully testable.
// Candidate builders produce `needs_review` candidates (placeholder for dry-run,
// real for generated); they are NEVER approved here.

export type CreateJobInput = {
  category: FactoryCategory;
  pack: string;
  count: number;
  subject: string;
  requestedBy: string;
  dryRun: boolean;
  config: GenerationConfig;
  /** Style family (V3.2). Defaults to the default family when omitted. */
  styleId?: string;
};

/** Build a job (status "draft") with its style-specific prompt + estimated cost. */
export function createGenerationJob(input: CreateJobInput): GenerationJob {
  const styleId = getStyleFamily(input.styleId ?? DEFAULT_STYLE_FAMILY).id;
  const { prompt, negativePrompt } = buildStyledPromptPair(input.category, styleId, { subject: input.subject });
  const now = new Date().toISOString();
  return {
    id: `job-${input.category}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    status: "draft",
    category: input.category,
    pack: input.pack,
    count: Math.max(1, Math.floor(input.count)),
    subject: input.subject.trim(),
    styleId,
    prompt,
    negativePrompt,
    modelProvider: input.config.provider,
    modelName: input.config.model,
    requestedBy: input.requestedBy.trim() || "anonymous",
    estimatedCost: estimateCost(Math.max(1, Math.floor(input.count)), input.config),
    dryRun: input.dryRun,
    generatedCandidateIds: [],
    createdAt: now,
  };
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function uniqueSlug(base: string, used: Set<string>): string {
  let slug = base || "asset";
  if (used.has(slug)) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }
  used.add(slug);
  return slug;
}

type BuildOpts = { imageUrl: string | null; index: number; used: Set<string> };

/** Shared candidate factory for placeholder + generated outputs. */
function buildCandidate(job: GenerationJob, opts: BuildOpts): AssetCandidate {
  const meta = CATEGORY_META[job.category];
  const baseName = (job.subject || meta.label).trim();
  const name = `${titleCase(baseName)} ${opts.index + 1}`;
  const slug = uniqueSlug(slugify(name), opts.used);
  const derived = Array.from(new Set(slug.split("-").filter((w) => w.length >= 3))).slice(0, 3);
  const tags = derived.length ? derived : [meta.group];
  const now = new Date().toISOString();

  return {
    id: `gen-${slug}`,
    name,
    slug,
    category: job.category,
    pack: job.pack,
    status: "needs_review",
    imageUrl: opts.imageUrl ?? `/samples/placeholder-${slug}.png`,
    prompt: job.prompt,
    negativePrompt: job.negativePrompt,
    modelProvider: job.modelProvider,
    modelName: job.modelName,
    seed: 0,
    width: 1024,
    height: 1024,
    // Raw AI output is not transparent — surfaced as a quality warning on review
    // (background removal is a V4 concern). Dry-run placeholders are marked clean.
    transparent: job.dryRun,
    tags,
    compatibleZones: meta.compatibleZones,
    placementType: meta.placement,
    defaultScale: meta.defaultScale,
    defaultActionType: meta.defaultActionType,
    styleScore: 0,
    qualityNotes: job.dryRun
      ? "Dry-run placeholder — no image generated."
      : "AI-generated (Replicate). Needs a transparent-background pass before approval.",
    reviewer: "",
    reviewedAt: "",
    createdAt: now,
  };
}

/** Placeholder candidates for a dry-run job (no provider call). */
export function dryRunCandidates(job: GenerationJob, existing: AssetCandidate[] = []): AssetCandidate[] {
  const used = new Set(existing.map((c) => c.slug));
  return Array.from({ length: job.count }, (_, i) => buildCandidate(job, { imageUrl: null, index: i, used }));
}

/** Real candidates from generated image URLs (missing urls are skipped, not crashed). */
export function generatedCandidates(
  job: GenerationJob,
  imageUrls: (string | null | undefined)[],
  existing: AssetCandidate[] = [],
): AssetCandidate[] {
  const used = new Set(existing.map((c) => c.slug));
  const out: AssetCandidate[] = [];
  imageUrls.forEach((url, i) => {
    if (!url) return; // missing image handling — skip, don't crash
    out.push(buildCandidate(job, { imageUrl: url, index: i, used }));
  });
  return out;
}

// ── Usage / cost tracking (pure) ─────────────────────────────────────────────

function sameDay(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth() && d.getUTCDate() === now.getUTCDate();
}
function sameMonth(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
}

export type UsageStats = {
  generatedToday: number;
  estSpendToday: number;
  actualSpendToday: number;
  generatedThisMonth: number;
  estSpendThisMonth: number;
};

/** Only REAL (non-dry-run) completed jobs count toward usage + spend. */
export function usageStats(jobs: GenerationJob[], now: Date = new Date()): UsageStats {
  const real = jobs.filter((j) => !j.dryRun && j.status === "completed");
  const today = real.filter((j) => sameDay(j.createdAt, now));
  const month = real.filter((j) => sameMonth(j.createdAt, now));
  const sum = (arr: GenerationJob[], pick: (j: GenerationJob) => number) => arr.reduce((s, j) => s + pick(j), 0);
  return {
    generatedToday: sum(today, (j) => j.generatedCandidateIds.length || j.count),
    estSpendToday: Math.round(sum(today, (j) => j.estimatedCost) * 1000) / 1000,
    actualSpendToday: Math.round(sum(today, (j) => j.actualCost ?? 0) * 1000) / 1000,
    generatedThisMonth: sum(month, (j) => j.generatedCandidateIds.length || j.count),
    estSpendThisMonth: Math.round(sum(month, (j) => j.estimatedCost) * 1000) / 1000,
  };
}

/** Real images generated today (drives the daily-limit guard). */
export function generatedToday(jobs: GenerationJob[], now: Date = new Date()): number {
  return usageStats(jobs, now).generatedToday;
}
