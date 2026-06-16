import { type AssetCandidate, type AssetPack, type GenerationJob, type ReviewAction } from "@/lib/types";
import { sampleCandidates } from "@/lib/sample-data";
import { buildSamplePacks } from "@/lib/sample-packs";

// Client-side store for candidates, mirroring the main app's localStorage demo
// pattern: SSR-guarded read/write, try/catch, and a change event for reactivity.
// Used as the demo/fallback layer; the Supabase shared backend (V2) is reached via
// the server API routes instead (see lib/repo/*).

const KEY = "nestudio-asset-factory";
const SEED_KEY = "nestudio-asset-factory-seeded";
const ACTIONS_KEY = "nestudio-asset-factory-actions";
const PACKS_KEY = "nestudio-asset-factory-packs";
const PACKS_SEED_KEY = "nestudio-asset-factory-packs-seeded";
const JOBS_KEY = "nestudio-asset-factory-jobs";
export const CHANGE_EVENT = "nestudio-asset-factory-changed";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function emitChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

/** Load all candidates. Seeds the 30 samples on first run, then persists them. */
export function loadCandidates(): AssetCandidate[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AssetCandidate[];
      if (Array.isArray(parsed)) return parsed;
    }
    if (!window.localStorage.getItem(SEED_KEY)) {
      const seeded = sampleCandidates();
      window.localStorage.setItem(KEY, JSON.stringify(seeded));
      window.localStorage.setItem(SEED_KEY, "1");
      return seeded;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveCandidates(candidates: AssetCandidate[]): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(candidates));
    window.localStorage.setItem(SEED_KEY, "1");
    emitChange();
  } catch {
    // ignore quota / serialization errors
  }
}

/** Replace one candidate by id and persist. Returns the new array. */
export function updateCandidate(
  candidates: AssetCandidate[],
  next: AssetCandidate,
): AssetCandidate[] {
  const updated = candidates.map((c) => (c.id === next.id ? next : c));
  saveCandidates(updated);
  return updated;
}

/** Add new candidates (skipping ids that already exist) and persist. */
export function addCandidates(
  candidates: AssetCandidate[],
  incoming: AssetCandidate[],
): AssetCandidate[] {
  const existing = new Set(candidates.map((c) => c.id));
  const fresh = incoming.filter((c) => !existing.has(c.id));
  const updated = [...fresh, ...candidates];
  saveCandidates(updated);
  return updated;
}

/** Wipe the store and re-seed the samples. */
export function resetStore(): AssetCandidate[] {
  if (!canUseStorage()) return sampleCandidates();
  try {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(SEED_KEY);
    window.localStorage.removeItem(ACTIONS_KEY);
    window.localStorage.removeItem(PACKS_KEY);
    window.localStorage.removeItem(PACKS_SEED_KEY);
    window.localStorage.removeItem(JOBS_KEY);
  } catch {
    // ignore
  }
  const seeded = sampleCandidates();
  saveCandidates(seeded);
  return seeded;
}

// ── Generation jobs (V3, local layer) ────────────────────────────────────────

export function loadJobs(): GenerationJob[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(JOBS_KEY);
    const parsed = raw ? (JSON.parse(raw) as GenerationJob[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveJobs(jobs: GenerationJob[]): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(JOBS_KEY, JSON.stringify(jobs.slice(0, 200)));
    emitChange();
  } catch {
    // ignore
  }
}

/** Upsert one job (newest first) and persist. */
export function upsertJob(jobs: GenerationJob[], next: GenerationJob): GenerationJob[] {
  const exists = jobs.some((j) => j.id === next.id);
  const updated = exists ? jobs.map((j) => (j.id === next.id ? next : j)) : [next, ...jobs];
  saveJobs(updated);
  return updated;
}

// ── Asset packs (V2.5, local layer) ──────────────────────────────────────────

/** Load packs. Seeds the five starter packs on first run, then persists them. */
export function loadPacks(): AssetPack[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(PACKS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AssetPack[];
      if (Array.isArray(parsed)) return parsed;
    }
    if (!window.localStorage.getItem(PACKS_SEED_KEY)) {
      const seeded = buildSamplePacks(loadCandidates());
      window.localStorage.setItem(PACKS_KEY, JSON.stringify(seeded));
      window.localStorage.setItem(PACKS_SEED_KEY, "1");
      return seeded;
    }
    return [];
  } catch {
    return [];
  }
}

export function savePacks(packs: AssetPack[]): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(PACKS_KEY, JSON.stringify(packs));
    window.localStorage.setItem(PACKS_SEED_KEY, "1");
    emitChange();
  } catch {
    // ignore
  }
}

/** Upsert one pack by id and persist. Returns the new array. */
export function upsertPack(packs: AssetPack[], next: AssetPack): AssetPack[] {
  const exists = packs.some((p) => p.id === next.id);
  const updated = exists ? packs.map((p) => (p.id === next.id ? next : p)) : [next, ...packs];
  savePacks(updated);
  return updated;
}

/** Delete a pack by id and persist. Returns the new array. */
export function deletePack(packs: AssetPack[], id: string): AssetPack[] {
  const updated = packs.filter((p) => p.id !== id);
  savePacks(updated);
  return updated;
}

// ── Review activity log (V2, local layer) ────────────────────────────────────

/** Load the local review activity log (newest first). */
export function loadActions(): ReviewAction[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(ACTIONS_KEY);
    const parsed = raw ? (JSON.parse(raw) as ReviewAction[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Prepend a review action and persist. Returns the new (capped) log. */
export function appendAction(action: ReviewAction): ReviewAction[] {
  const next = [action, ...loadActions()].slice(0, 200);
  if (canUseStorage()) {
    try {
      window.localStorage.setItem(ACTIONS_KEY, JSON.stringify(next));
      emitChange();
    } catch {
      // ignore
    }
  }
  return next;
}
