import { NextResponse } from "next/server";
import { getServerUser, type AuthedUser } from "@/lib/auth/server-session";

// ── Server-side END-USER gate ────────────────────────────────────────────────
//
// Any signed-in Supabase user. Reads identity through the ONE server session layer
// (getServerUser) — never its own getUser(). Fails CLOSED. Data isolation between
// users is enforced by RLS on user_avatars + the private bucket, not this gate alone.

export type { AuthedUser };

type GateResult = { user: AuthedUser } | { response: NextResponse };

export async function requireUser(opts?: { allowAnonymous?: boolean }): Promise<GateResult> {
  const auth = await getServerUser();
  if ("status" in auth) {
    if (auth.status === "unconfigured") {
      return { response: NextResponse.json({ error: "Sign-in is temporarily unavailable. Please try again shortly.", code: "auth_unavailable" }, { status: 503 }) };
    }
    return { response: NextResponse.json({ error: "Please sign in to create your avatar.", code: "signin_required", authorized: false }, { status: 401 }) };
  }
  if (auth.user.isAnonymous && !opts?.allowAnonymous) {
    return { response: NextResponse.json({ error: "Please sign in to create your avatar.", code: "signin_required", authorized: false }, { status: 401 }) };
  }
  return { user: auth.user };
}
