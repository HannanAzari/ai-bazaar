import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { timingSafeEqual } from "node:crypto";

// ── Server-side FOUNDER/ADMIN gate (real auth + role) ────────────────────────
//
// Replaces the temporary founder-token screen for global generation/publishing.
// Requires BOTH: (1) a real authenticated Supabase user, AND (2) that user is on the
// server-only founder allowlist (FOUNDER_USER_IDS or FOUNDER_EMAILS). Never trusts the
// browser for the role. The allowlist is server-only (no NEXT_PUBLIC_).
//
// Emergency fallback (OFF by default): if FOUNDER_TOKEN_EMERGENCY=1 and a valid
// x-founder-token is presented, allow — for the rare case auth itself is down. Logged.

export type FounderUser = { id: string; email: string | null };
type Result = { user: FounderUser } | { response: NextResponse };

function list(env?: string): string[] {
  return (env ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function tokenMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided), b = Buffer.from(expected);
  if (a.length !== b.length) { timingSafeEqual(a, a); return false; }
  return timingSafeEqual(a, b);
}

/** 401 = sign in; 403 = signed in but not a founder; 503 = server auth misconfigured. */
export async function requireFounder(request: Request): Promise<Result> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    // Server misconfig (Supabase env missing at runtime). Log detail; don't leak it.
    console.error("[requireFounder] Supabase server client unavailable — NEXT_PUBLIC_SUPABASE_URL/ANON_KEY missing at runtime.");
    // Emergency token backstop (explicitly enabled only).
    const token = request.headers.get("x-founder-token");
    if (process.env.FOUNDER_TOKEN_EMERGENCY === "1" && token && process.env.FOUNDER_ACCESS_TOKEN && tokenMatch(token, process.env.FOUNDER_ACCESS_TOKEN)) {
      console.warn("[requireFounder] EMERGENCY founder-token fallback used.");
      return { user: { id: "emergency-founder", email: null } };
    }
    return { response: NextResponse.json({ error: "Sign-in is temporarily unavailable. Please try again shortly.", code: "auth_unavailable" }, { status: 503 }) };
  }

  const { data, error } = await supabase.auth.getUser();
  const u = data?.user;
  if (error || !u) {
    return { response: NextResponse.json({ error: "Please sign in.", code: "signin_required", authorized: false }, { status: 401 }) };
  }

  const ids = list(process.env.FOUNDER_USER_IDS);
  const emails = list(process.env.FOUNDER_EMAILS);
  const isFounder = ids.includes(u.id.toLowerCase()) || (u.email ? emails.includes(u.email.toLowerCase()) : false);
  if (!isFounder) {
    return { response: NextResponse.json({ error: "This studio is for founders only.", code: "founder_required", authorized: false }, { status: 403 }) };
  }
  return { user: { id: u.id, email: u.email ?? null } };
}
