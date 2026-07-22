import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getServerUser, type AuthedUser } from "@/lib/auth/server-session";

// ── Server-side FOUNDER/ADMIN gate (real auth + role) ────────────────────────
//
// Requires BOTH a real authenticated Supabase user (via the ONE server session layer,
// getServerUser) AND membership of the server-only founder allowlist (FOUNDER_USER_IDS
// or FOUNDER_EMAILS). Never trusts the browser for the role; the allowlist is server-only.
//
// Emergency fallback (OFF by default): if FOUNDER_TOKEN_EMERGENCY=1 and a valid
// x-founder-token is presented while the session is unavailable, allow — logged.

export type FounderUser = AuthedUser;
type Result = { user: FounderUser } | { response: NextResponse };

function list(env?: string): string[] {
  return (env ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}
function tokenMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided), b = Buffer.from(expected);
  if (a.length !== b.length) { timingSafeEqual(a, a); return false; }
  return timingSafeEqual(a, b);
}
function emergencyToken(request: Request): boolean {
  const token = request.headers.get("x-founder-token");
  return Boolean(process.env.FOUNDER_TOKEN_EMERGENCY === "1" && token && process.env.FOUNDER_ACCESS_TOKEN && tokenMatch(token, process.env.FOUNDER_ACCESS_TOKEN));
}

export function isFounder(user: AuthedUser): boolean {
  const ids = list(process.env.FOUNDER_USER_IDS);
  const emails = list(process.env.FOUNDER_EMAILS);
  return ids.includes(user.id.toLowerCase()) || (user.email ? emails.includes(user.email.toLowerCase()) : false);
}

/** 401 = sign in; 403 = signed in but not a founder; 503 = server auth misconfigured. */
export async function requireFounder(request: Request): Promise<Result> {
  const auth = await getServerUser();
  if ("status" in auth) {
    // Session unavailable — allow the explicit emergency backstop only.
    if (emergencyToken(request)) { console.warn("[requireFounder] EMERGENCY founder-token fallback used."); return { user: { id: "emergency-founder", email: null, isAnonymous: false } }; }
    if (auth.status === "unconfigured") {
      return { response: NextResponse.json({ error: "Sign-in is temporarily unavailable. Please try again shortly.", code: "auth_unavailable" }, { status: 503 }) };
    }
    return { response: NextResponse.json({ error: "Please sign in.", code: "signin_required", authorized: false }, { status: 401 }) };
  }
  if (!isFounder(auth.user)) {
    return { response: NextResponse.json({ error: "This studio is for founders only.", code: "founder_required", authorized: false }, { status: 403 }) };
  }
  return { user: auth.user };
}
