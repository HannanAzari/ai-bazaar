import { NextResponse } from "next/server";
import { getServerUser, type AuthedUser } from "@/lib/auth/server-session";
import { isFounder } from "@/lib/founder-role";

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

/**
 * Avatar generation access. PRODUCTION GATING: until the founder approves Visual DNA v1 and
 * sets AVATAR_PUBLIC_ENABLED=1, avatar generation is founder-only (Beta) — normal users are
 * signed in but not yet exposed to the unproven style. Then it opens to any signed-in user.
 */
export async function requireAvatarAccess(): Promise<GateResult> {
  const gate = await requireUser();
  if ("response" in gate) return gate;
  if (process.env.AVATAR_PUBLIC_ENABLED !== "1" && !isFounder(gate.user)) {
    return { response: NextResponse.json({ error: "Avatar Studio is in founder testing right now — check back soon.", code: "avatar_beta", authorized: false }, { status: 403 }) };
  }
  return gate;
}
