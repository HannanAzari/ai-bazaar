import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client for the factory. Uses the SERVICE ROLE key so all
// DB/storage access is server-side, behind the password gate (the anon key never
// touches these tables). RLS denies anon; the service role bypasses it.
//
// NEVER import this from a client component — it would leak the service key.

export const CANDIDATE_BUCKET = "asset-candidates";

let cached: SupabaseClient | null = null;

/** The configured server credentials, or null when not fully set. */
export function serverSupabaseConfig(): { url: string; serviceKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return { url, serviceKey };
}

/** Whether the server is fully configured to talk to Supabase. */
export function isServerSupabaseReady(): boolean {
  return serverSupabaseConfig() !== null;
}

/** Lazily build (and cache) the service-role client. Throws if not configured. */
export function getServerSupabase(): SupabaseClient {
  if (cached) return cached;
  const config = serverSupabaseConfig();
  if (!config) {
    throw new Error(
      "Supabase server is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  cached = createClient(config.url, config.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
