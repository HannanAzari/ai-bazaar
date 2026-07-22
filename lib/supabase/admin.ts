import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ── Server-only Supabase admin client (service-role) ─────────────────────────
//
// The service-role key bypasses RLS, so this MUST NEVER be imported into client
// code. It is used by server routes that write curated/global content (reference
// images, generated assets) to Storage + catalog tables on Vercel's ephemeral
// filesystem — where writing to /public is not durable. Storage is the source of
// truth; the filesystem is not.
//
// Returns null when env is missing so callers can fail honestly (501), never fake.

let cached: SupabaseClient | null = null;

export function createSupabaseAdminClient(): SupabaseClient | null {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  cached = createClient(url, serviceKey, { auth: { persistSession: false } });
  return cached;
}

/** Canonical live bucket for all Nestudio-generated media (audit-confirmed). */
export const NESTUDIO_BUCKET = "nestudio-assets";
