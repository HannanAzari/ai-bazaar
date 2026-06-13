import type { Repositories } from "@/lib/repos/types";
import { createLocalRepositories } from "@/lib/repos/local";
import { createSupabaseRepositories } from "@/lib/repos/supabase";
import { type RuntimeMode, getRuntimeMode } from "@/lib/runtime-mode";

// Repository factory — the one place that maps runtime mode → implementation,
// mirroring lib/storage/index.ts's `getImageStorage()`. Swapping the whole app
// from demo to Supabase is then a single env-driven decision, not a code change
// scattered across components.

const cache = new Map<RuntimeMode, Repositories>();

/** Repositories for a given mode (defaults to the detected runtime mode). */
export function getRepositories(mode: RuntimeMode = getRuntimeMode()): Repositories {
  const cached = cache.get(mode);
  if (cached) return cached;
  const repos = mode === "production" ? createSupabaseRepositories() : createLocalRepositories();
  cache.set(mode, repos);
  return repos;
}

export type { Repositories } from "@/lib/repos/types";
