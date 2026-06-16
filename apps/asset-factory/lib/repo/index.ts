import { getFactoryMode } from "@/lib/runtime-mode";
import { type CandidateRepository } from "@/lib/repo/types";
import { createLocalRepository } from "@/lib/repo/local";
import { createRemoteRepository } from "@/lib/repo/remote";

// Select the repository by runtime mode (V2): the shared Supabase backend when the
// public env is set, otherwise the localStorage fallback. Mirrors the main app's
// getRepositories() seam.
export function getCandidateRepository(): CandidateRepository {
  return getFactoryMode() === "supabase" ? createRemoteRepository() : createLocalRepository();
}

export { type CandidateRepository } from "@/lib/repo/types";
