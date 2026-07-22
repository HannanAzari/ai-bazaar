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
    return { response: NextResponse.json({ error: "Auth is not configured on the server.", configured: false }, { status: 503 }) };
  }
  const { data, error } = await supabase.auth.getUser();
  const u = data?.user;
  if (error || !u) {
    return { response: NextResponse.json({ error: "Sign in required.", authorized: false }, { status: 401 }) };
  }
  const isAnonymous = (u as { is_anonymous?: boolean }).is_anonymous ?? false;
  // Personal photos + identity: an anonymous guest is not an acceptable owner by default.
  if (isAnonymous && !opts?.allowAnonymous) {
    return { response: NextResponse.json({ error: "A signed-in account is required for avatars.", authorized: false }, { status: 401 }) };
  }
  return { user: { id: u.id, email: u.email ?? null, isAnonymous } };
}
