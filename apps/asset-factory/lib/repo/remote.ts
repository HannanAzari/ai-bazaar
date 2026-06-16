import { type AssetCandidate, type AssetPack, type ReviewAction } from "@/lib/types";
import { type CandidateRepository } from "@/lib/repo/types";

// Remote repository — talks to the password-gated server API routes, which use the
// Supabase service role. The browser never touches the database directly. All
// methods send cookies (same-origin) so the gate is enforced server-side.

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export function createRemoteRepository(): CandidateRepository {
  return {
    mode: "supabase",
    canReset: false,

    async list() {
      const data = await jsonFetch<{ candidates: AssetCandidate[] }>("/api/candidates");
      return data.candidates;
    },

    async saveCandidate(candidate: AssetCandidate) {
      await jsonFetch("/api/candidates", {
        method: "POST",
        body: JSON.stringify({ candidate }),
      });
    },

    async addCandidates(incoming: AssetCandidate[]) {
      const data = await jsonFetch<{ candidates: AssetCandidate[] }>("/api/candidates", {
        method: "POST",
        body: JSON.stringify({ candidates: incoming }),
      });
      return data.candidates;
    },

    async applyAction(next: AssetCandidate, action: ReviewAction) {
      await jsonFetch("/api/candidates/transition", {
        method: "POST",
        body: JSON.stringify({ candidate: next, action }),
      });
    },

    async listActions() {
      const data = await jsonFetch<{ actions: ReviewAction[] }>("/api/actions");
      return data.actions;
    },

    async reset(): Promise<AssetCandidate[]> {
      throw new Error("Reset is disabled in shared (Supabase) mode.");
    },

    async listPacks() {
      const data = await jsonFetch<{ packs: AssetPack[] }>("/api/packs");
      return data.packs;
    },

    async savePack(pack: AssetPack) {
      await jsonFetch("/api/packs", { method: "POST", body: JSON.stringify({ pack }) });
    },

    async deletePack(id: string) {
      await jsonFetch(`/api/packs?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  };
}
