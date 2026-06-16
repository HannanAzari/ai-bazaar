import { type AssetCandidate, type AssetPack, type GenerationJob, type ReviewAction } from "@/lib/types";
import { type FactoryMode } from "@/lib/runtime-mode";

// The async repository contract shared by the local (localStorage) and remote
// (Supabase via server API) implementations (V2). Async so the same contract fits
// both the synchronous demo store and real network I/O.
export interface CandidateRepository {
  readonly mode: FactoryMode;
  /** Reset re-seeds the samples — only meaningful for the local store. */
  readonly canReset: boolean;

  list(): Promise<AssetCandidate[]>;
  /** Upsert one candidate (e.g. a metadata edit). */
  saveCandidate(candidate: AssetCandidate): Promise<void>;
  /** Add new candidates (skipping existing ids); returns the full list. */
  addCandidates(incoming: AssetCandidate[]): Promise<AssetCandidate[]>;
  /** Persist a status transition and append its activity-log entry. */
  applyAction(next: AssetCandidate, action: ReviewAction): Promise<void>;
  /** The review activity log, newest first. */
  listActions(): Promise<ReviewAction[]>;
  /** Wipe + re-seed (local only). */
  reset(): Promise<AssetCandidate[]>;

  // ── Asset packs (V2.5) ──
  listPacks(): Promise<AssetPack[]>;
  /** Create or update a pack. */
  savePack(pack: AssetPack): Promise<void>;
  deletePack(id: string): Promise<void>;

  // ── Generation jobs (V3) ──
  listJobs(): Promise<GenerationJob[]>;
  saveJob(job: GenerationJob): Promise<void>;
}
