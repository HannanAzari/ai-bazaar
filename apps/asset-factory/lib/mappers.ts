import {
  type AssetCandidate,
  type AssetPack,
  type AssetPackStatus,
  type AssetStatus,
  type FactoryCategory,
  type GenerationJob,
  type GenerationJobStatus,
  type ReviewAction,
  type ReviewActionType,
  type RoomActionType,
  type RoomZoneType,
  type AssetPlacement,
} from "@/lib/types";

// Pure row <-> domain mappers for the Supabase tables (V2). Kept pure + isolated
// so they are unit-testable without a live database. Column names are snake_case
// (Postgres), domain fields are camelCase.

export type CandidateRow = {
  id: string;
  name: string;
  slug: string;
  category: string;
  pack: string;
  status: string;
  image_url: string;
  local_path: string | null;
  prompt: string;
  negative_prompt: string;
  model_provider: string;
  model_name: string;
  seed: number;
  width: number;
  height: number;
  transparent: boolean;
  tags: string[];
  compatible_zones: string[];
  placement_type: string;
  default_scale: number;
  default_action_type: string;
  style_score: number;
  quality_notes: string;
  reviewer: string;
  reviewed_at: string;
  personality: string | null;
  source: string | null;
  source_sample_id: string | null;
  created_at: string;
};

export function candidateToRow(c: AssetCandidate): CandidateRow {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    category: c.category,
    pack: c.pack,
    status: c.status,
    image_url: c.imageUrl,
    local_path: c.localPath ?? null,
    prompt: c.prompt,
    negative_prompt: c.negativePrompt,
    model_provider: c.modelProvider,
    model_name: c.modelName,
    seed: c.seed,
    width: c.width,
    height: c.height,
    transparent: c.transparent,
    tags: c.tags,
    compatible_zones: c.compatibleZones,
    placement_type: c.placementType,
    default_scale: c.defaultScale,
    default_action_type: c.defaultActionType,
    style_score: c.styleScore,
    quality_notes: c.qualityNotes,
    reviewer: c.reviewer,
    reviewed_at: c.reviewedAt,
    personality: c.personality ?? null,
    source: c.source ?? null,
    source_sample_id: c.sourceSampleId ?? null,
    created_at: c.createdAt,
  };
}

export function rowToCandidate(r: CandidateRow): AssetCandidate {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    category: r.category as FactoryCategory,
    pack: r.pack,
    status: r.status as AssetStatus,
    imageUrl: r.image_url,
    localPath: r.local_path ?? undefined,
    prompt: r.prompt,
    negativePrompt: r.negative_prompt,
    modelProvider: r.model_provider,
    modelName: r.model_name,
    seed: r.seed,
    width: r.width,
    height: r.height,
    transparent: r.transparent,
    tags: r.tags ?? [],
    compatibleZones: (r.compatible_zones ?? []) as RoomZoneType[],
    placementType: r.placement_type as AssetPlacement,
    defaultScale: r.default_scale,
    defaultActionType: r.default_action_type as RoomActionType,
    styleScore: r.style_score,
    qualityNotes: r.quality_notes,
    reviewer: r.reviewer,
    reviewedAt: r.reviewed_at,
    personality: r.personality ?? undefined,
    source: r.source ?? undefined,
    sourceSampleId: r.source_sample_id ?? undefined,
    createdAt: r.created_at,
  };
}

export type ReviewActionRow = {
  id: string;
  candidate_id: string;
  candidate_name: string;
  action: string;
  reviewer: string;
  note: string | null;
  created_at: string;
};

export function actionToRow(a: ReviewAction): ReviewActionRow {
  return {
    id: a.id,
    candidate_id: a.candidateId,
    candidate_name: a.candidateName,
    action: a.action,
    reviewer: a.reviewer,
    note: a.note ?? null,
    created_at: a.createdAt,
  };
}

export function rowToAction(r: ReviewActionRow): ReviewAction {
  return {
    id: r.id,
    candidateId: r.candidate_id,
    candidateName: r.candidate_name,
    action: r.action as ReviewActionType,
    reviewer: r.reviewer,
    note: r.note ?? undefined,
    createdAt: r.created_at,
  };
}

export type AssetPackRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  theme: string;
  status: string;
  asset_ids: string[];
  created_at: string;
};

export function packToRow(p: AssetPack): AssetPackRow {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    theme: p.theme,
    status: p.status,
    asset_ids: p.assetIds,
    created_at: p.createdAt,
  };
}

export function rowToPack(r: AssetPackRow): AssetPack {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    theme: r.theme,
    status: r.status as AssetPackStatus,
    assetIds: r.asset_ids ?? [],
    createdAt: r.created_at,
  };
}

export type GenerationJobRow = {
  id: string;
  status: string;
  category: string;
  pack: string;
  count: number;
  subject: string;
  style_id: string;
  prompt: string;
  negative_prompt: string;
  model_provider: string;
  model_name: string;
  requested_by: string;
  estimated_cost: number;
  actual_cost: number | null;
  dry_run: boolean;
  generated_candidate_ids: string[];
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export function jobToRow(j: GenerationJob): GenerationJobRow {
  return {
    id: j.id,
    status: j.status,
    category: j.category,
    pack: j.pack,
    count: j.count,
    subject: j.subject,
    style_id: j.styleId,
    prompt: j.prompt,
    negative_prompt: j.negativePrompt,
    model_provider: j.modelProvider,
    model_name: j.modelName,
    requested_by: j.requestedBy,
    estimated_cost: j.estimatedCost,
    actual_cost: j.actualCost ?? null,
    dry_run: j.dryRun,
    generated_candidate_ids: j.generatedCandidateIds,
    error: j.error ?? null,
    created_at: j.createdAt,
    started_at: j.startedAt ?? null,
    completed_at: j.completedAt ?? null,
  };
}

export function rowToJob(r: GenerationJobRow): GenerationJob {
  return {
    id: r.id,
    status: r.status as GenerationJobStatus,
    category: r.category as FactoryCategory,
    pack: r.pack,
    count: r.count,
    subject: r.subject,
    styleId: r.style_id ?? "nestudio_v2",
    prompt: r.prompt,
    negativePrompt: r.negative_prompt,
    modelProvider: r.model_provider,
    modelName: r.model_name,
    requestedBy: r.requested_by,
    estimatedCost: r.estimated_cost,
    actualCost: r.actual_cost ?? undefined,
    dryRun: r.dry_run,
    generatedCandidateIds: r.generated_candidate_ids ?? [],
    error: r.error ?? undefined,
    createdAt: r.created_at,
    startedAt: r.started_at ?? undefined,
    completedAt: r.completed_at ?? undefined,
  };
}
