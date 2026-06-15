import type { AuthClient } from "@/lib/auth/types";
import { DemoAuthClient } from "@/lib/auth/demo-auth";
import { SupabaseAuthClient } from "@/lib/auth/supabase-auth";
import { type RuntimeMode, getRuntimeMode } from "@/lib/runtime-mode";

// Auth factory — runtime mode → AuthClient, mirroring getRepositories() and
// getImageStorage(). Production uses Supabase Auth; demo uses localStorage.

export function getAuthClient(mode: RuntimeMode = getRuntimeMode()): AuthClient {
  return mode === "production" ? new SupabaseAuthClient() : new DemoAuthClient();
}

export type { AuthClient, SessionUser } from "@/lib/auth/types";
