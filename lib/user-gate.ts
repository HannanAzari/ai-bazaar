import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ── Server-side END-USER gate (real Supabase session, NOT the founder token) ──
//
// Avatar Factory is user-owned: every avatar route must act as the AUTHENTICATED USER,
// never the founder capability token and never a fabricated id. This reads the real
// Supabase session from the request cookies (the same mechanism middleware uses) and
// returns the genuine `auth.users.id`. Fails CLOSED (401) when there is no session.
//
// IMPORTANT: this authenticates identity only. Data isolation between users is enforced
// by RLS on user_avatars + the private bucket (writes must go through a user-scoped
// client or an ownership check), NOT by this gate alone.

export type AuthedUser = { id: string; email: string | null; isAnonymous: boolean };

type GateResult = { user: AuthedUser } | { response: NextResponse };

export async function requireUser(opts?: { allowAnonymous?: boolean }): Promise<GateResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    // Server misconfig — the Supabase public env vars are missing at RUNTIME (common cause:
    // NEXT_PUBLIC_SUPABASE_URL/ANON_KEY not set for this Vercel environment, or no redeploy
    // after adding them). Log the detail; show the user an admin-safe message, never internals.
    console.error("[requireUser] Supabase server client unavailable — NEXT_PUBLIC_SUPABASE_URL/ANON_KEY missing at runtime.");
    return { response: NextResponse.json({ error: "Sign-in is temporarily unavailable. Please try again shortly.", code: "auth_unavailable" }, { status: 503 }) };
  }
  const { data, error } = await supabase.auth.getUser();
  const u = data?.user;
  if (error || !u) {
    return { response: NextResponse.json({ error: "Please sign in to create your avatar.", code: "signin_required", authorized: false }, { status: 401 }) };
  }
  const isAnonymous = (u as { is_anonymous?: boolean }).is_anonymous ?? false;
  // Personal photos + identity: an anonymous guest is not an acceptable owner by default.
  if (isAnonymous && !opts?.allowAnonymous) {
    return { response: NextResponse.json({ error: "Please sign in to create your avatar.", code: "signin_required", authorized: false }, { status: 401 }) };
  }
  return { user: { id: u.id, email: u.email ?? null, isAnonymous } };
}
