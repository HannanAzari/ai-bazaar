import { type AssetCandidate, type AssetPack, type ReviewAction } from "@/lib/types";
import {
  loadCandidates,
  addCandidates as addToStore,
  updateCandidate,
  resetStore,
  loadActions,
  appendAction,
  loadPacks,
  upsertPack,
  deletePack as deletePackInStore,
} from "@/lib/store";
import { type CandidateRepository } from "@/lib/repo/types";

// Local repository — wraps the localStorage store (the demo/fallback layer).
// Everything resolves synchronously, wrapped in promises to match the contract.
export function createLocalRepository(): CandidateRepository {
  return {
    mode: "demo",
    canReset: true,

    async list() {
      return loadCandidates();
    },

    async saveCandidate(candidate: AssetCandidate) {
      updateCandidate(loadCandidates(), candidate);
    },

    async addCandidates(incoming: AssetCandidate[]) {
      return addToStore(loadCandidates(), incoming);
    },

    async applyAction(next: AssetCandidate, action: ReviewAction) {
      updateCandidate(loadCandidates(), next);
      appendAction(action);
    },

    async listActions() {
      return loadActions();
    },

    async reset() {
      return resetStore();
    },

    async listPacks() {
      return loadPacks();
    },

    async savePack(pack: AssetPack) {
      upsertPack(loadPacks(), pack);
    },

    async deletePack(id: string) {
      deletePackInStore(loadPacks(), id);
    },
  };
}
