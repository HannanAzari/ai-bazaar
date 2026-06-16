import { type AssetCandidate } from "@/lib/types";
import { sampleCandidates } from "@/lib/sample-data";

// Client-side store for candidates, mirroring the main app's localStorage demo
// pattern: SSR-guarded read/write, try/catch, and a change event for reactivity.
// V1 keeps everything local — no backend. The shape is Supabase-ready (see README
// "Future V2").

const KEY = "nestudio-asset-factory";
const SEED_KEY = "nestudio-asset-factory-seeded";
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
  } catch {
    // ignore
  }
  const seeded = sampleCandidates();
  saveCandidates(seeded);
  return seeded;
}
