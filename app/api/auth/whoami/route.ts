import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/server-session";
import { isFounder } from "@/lib/founder-role";

// ── The one-URL answer to "which Supabase project is this deployment using?" ──
//
// Open this on ANY environment — Preview, Production, localhost:
//
//   GET /api/auth/whoami
//
// HOTFIX (M23B.2): extended after a founder created an account that never appeared in
// Authentication → Users. The cause was environment, not code — the build had fallen back
// to the localStorage demo backend — and there was no way to see that from the outside.
//
// `resolvedBackend` is the field that matters. `configuredBackend` is what the env var
// says; `resolvedBackend` is what the app will actually DO. When resolvedBackend is
// "local", accounts created in that deployment go to the browser and never reach Supabase.
//
// Leaks nothing: the project ref is part of the public API URL, and keys are reported only
// as booleans.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveBackend(hasEnv: boolean): "local" | "supabase" {
  // Must mirror lib/nest-repo.ts `nestBackend()` exactly.
  const explicit = process.env.NEXT_PUBLIC_NEST_BACKEND;
  if (explicit === "local") return "local";
  if (explicit === "supabase") return "supabase";
  return hasEnv ? "supabase" : "local";
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const host = url.replace(/^https?:\/\//, "").split("/")[0] || null;
  const projectRef = host ? host.split(".")[0] : null; // e.g. "srrmkdsvldlyllsxyhtq"
  const hasUrl = Boolean(url);
  const hasAnonKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const configured = hasUrl && hasAnonKey;
  const resolvedBackend = resolveBackend(configured);

  const env = {
    configured,
    projectRef,
    host,
    /** Raw NEXT_PUBLIC_NEST_BACKEND — null means it was never set for this environment. */
    configuredBackend: process.env.NEXT_PUBLIC_NEST_BACKEND ?? null,
    /** What the app WILL DO. If this is "local", accounts never reach Supabase. */
    resolvedBackend,
    hasUrl,
    hasAnonKey,
    /** Service-role key presence (server-only features: account deletion, admin writes). */
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    vercelEnv: process.env.VERCEL_ENV ?? null, // "preview" | "production" | "development"
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    /** Present only when something is wrong, so a healthy deployment reads clean. */
    ...(resolvedBackend === "local"
      ? {
          WARNING: hasUrl
            ? `Accounts will NOT reach Supabase: NEXT_PUBLIC_NEST_BACKEND="${process.env.NEXT_PUBLIC_NEST_BACKEND}" forces the local demo backend even though project ${projectRef} is configured.`
            : "Accounts will NOT reach Supabase: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY were missing at BUILD time for this environment. Set them and REDEPLOY (a restart is not enough).",
        }
      : {}),
  };

  const auth = await getServerUser();
  if ("status" in auth) {
    return NextResponse.json(
      { ...env, authenticated: false, reason: auth.status },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
  return NextResponse.json(
    {
      ...env,
      authenticated: true,
      userId: auth.user.id,
      email: auth.user.email,
      isFounder: isFounder(auth.user), // role resolves AFTER auth — the correct order
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
