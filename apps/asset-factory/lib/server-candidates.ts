// Server-only module (imported solely by API route handlers). The service-role
// client lives in lib/supabase-server.ts; its key is a non-public env var, so it
// is never inlined into client bundles even if this module were imported there.
import { type AssetCandidate, type AssetPack, type GenerationJob, type ReviewAction } from "@/lib/types";
import { getServerSupabase } from "@/lib/supabase-server";
import {
  candidateToRow,
  rowToCandidate,
  actionToRow,
  rowToAction,
  packToRow,
  rowToPack,
  jobToRow,
  rowToJob,
  type CandidateRow,
  type ReviewActionRow,
  type AssetPackRow,
  type GenerationJobRow,
} from "@/lib/mappers";
import { sampleCandidates } from "@/lib/sample-data";
import { buildSamplePacks } from "@/lib/sample-packs";

// Server-side data access for the shared Supabase backend (V2). Used only by the
// password-gated API routes via the service-role client. The browser never calls
// these directly.

const CANDIDATES = "asset_candidates";
const ACTIONS = "asset_review_actions";
const PACKS = "asset_packs";
const JOBS = "asset_generation_jobs";

/** List all candidates (newest first). Seeds the 30 samples on a fresh, empty DB. */
export async function listCandidates(): Promise<AssetCandidate[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from(CANDIDATES)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  if (!data || data.length === 0) {
    return seedCandidates();
  }
  return (data as CandidateRow[]).map(rowToCandidate);
}

/** Insert the sample candidates into a fresh DB and return them. */
async function seedCandidates(): Promise<AssetCandidate[]> {
  const samples = sampleCandidates();
  const supabase = getServerSupabase();
  const { error } = await supabase.from(CANDIDATES).upsert(samples.map(candidateToRow), { onConflict: "id" });
  if (error) throw new Error(error.message);
  return samples;
}

/** Upsert one candidate. */
export async function saveCandidate(candidate: AssetCandidate): Promise<void> {
  const supabase = getServerSupabase();
  const { error } = await supabase.from(CANDIDATES).upsert(candidateToRow(candidate), { onConflict: "id" });
  if (error) throw new Error(error.message);
}

/** Add new candidates (skipping ids that already exist); returns the full list. */
export async function addCandidates(incoming: AssetCandidate[]): Promise<AssetCandidate[]> {
  const current = await listCandidates();
  const existing = new Set(current.map((c) => c.id));
  const fresh = incoming.filter((c) => !existing.has(c.id));
  if (fresh.length > 0) {
    const supabase = getServerSupabase();
    const { error } = await supabase.from(CANDIDATES).upsert(fresh.map(candidateToRow), { onConflict: "id" });
    if (error) throw new Error(error.message);
  }
  return [...fresh, ...current];
}

/** Persist a status transition + append its activity entry. */
export async function applyAction(next: AssetCandidate, action: ReviewAction): Promise<void> {
  await saveCandidate(next);
  const supabase = getServerSupabase();
  const { error } = await supabase.from(ACTIONS).insert(actionToRow(action));
  if (error) throw new Error(error.message);
}

/** The review activity log, newest first (capped). */
export async function listActions(): Promise<ReviewAction[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from(ACTIONS)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return ((data as ReviewActionRow[]) ?? []).map(rowToAction);
}

// ── Asset packs ──────────────────────────────────────────────────────────────

/** List packs (newest first). Seeds the five starter packs on a fresh DB. */
export async function listPacks(): Promise<AssetPack[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from(PACKS)
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  if (!data || data.length === 0) {
    const seeded = buildSamplePacks(await listCandidates());
    if (seeded.length > 0) {
      const { error: seedErr } = await supabase.from(PACKS).upsert(seeded.map(packToRow), { onConflict: "id" });
      if (seedErr) throw new Error(seedErr.message);
    }
    return seeded;
  }
  return (data as AssetPackRow[]).map(rowToPack);
}

export async function savePack(pack: AssetPack): Promise<void> {
  const supabase = getServerSupabase();
  const { error } = await supabase.from(PACKS).upsert(packToRow(pack), { onConflict: "id" });
  if (error) throw new Error(error.message);
}

export async function deletePack(id: string): Promise<void> {
  const supabase = getServerSupabase();
  const { error } = await supabase.from(PACKS).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Generation jobs (V3) ─────────────────────────────────────────────────────

export async function listJobs(): Promise<GenerationJob[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from(JOBS)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return ((data as GenerationJobRow[]) ?? []).map(rowToJob);
}

export async function saveJob(job: GenerationJob): Promise<void> {
  const supabase = getServerSupabase();
  const { error } = await supabase.from(JOBS).upsert(jobToRow(job), { onConflict: "id" });
  if (error) throw new Error(error.message);
}
