import { createSupabaseServerClient } from "@/lib/supabase/server";

// ── THE single server-side auth read ─────────────────────────────────────────
//
// One source of truth for "who is calling this server route". Every server gate
// (requireUser, requireFounder) and any route that needs the user reads the session
// through here — never its own getUser(). This guarantees the header, editor, studios
// and APIs all resolve identity from the same Supabase session.
//
// Returns a plain discriminated result (no HTTP shaping) so each gate can format its
// own status/message.

export type AuthedUser = { id: string; email: string | null; isAnonymous: boolean };
export type ServerAuth =
  | { user: AuthedUser }
  | { status: "unconfigured" } // Supabase env missing at runtime — server misconfig
  | { status: "no_session" }; // no authenticated user

export async function getServerUser(): Promise<ServerAuth> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    // Common cause: NEXT_PUBLIC_SUPABASE_URL/ANON_KEY missing for this Vercel environment
    // (or no redeploy after adding them). Log the detail; callers show an admin-safe message.
    console.error("[auth] Supabase server client unavailable — NEXT_PUBLIC_SUPABASE_URL/ANON_KEY missing at runtime.");
    return { status: "unconfigured" };
  }
  const { data, error } = await supabase.auth.getUser();
  const u = data?.user;
  if (error || !u) return { status: "no_session" };
  return { user: { id: u.id, email: u.email ?? null, isAnonymous: (u as { is_anonymous?: boolean }).is_anonymous ?? false } };
}
