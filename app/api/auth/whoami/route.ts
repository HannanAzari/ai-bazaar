import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/server-session";
import { isFounder } from "@/lib/founder-role";

// Diagnostic: what user does the SERVER resolve from the request's Supabase cookies?
// Hit this in the browser AFTER logging in — if `authenticated:true` with your id, the
// server sees the same session as the client (the Part-1 success criterion). `projectRef`
// lets you confirm client + server point at the SAME Supabase project. No secrets leaked.
//
//   GET /api/auth/whoami

export const runtime = "nodejs";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const projectRef = url.replace(/^https?:\/\//, "").split(".")[0] || null; // e.g. "srrmkdsvldlyllsxyhtq"
  const configured = Boolean(url && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const auth = await getServerUser();
  if ("status" in auth) {
    return NextResponse.json({
      configured,
      projectRef,
      backend: process.env.NEXT_PUBLIC_NEST_BACKEND ?? null,
      authenticated: false,
      reason: auth.status, // "unconfigured" (env missing) | "no_session" (no cookie)
    });
  }
  return NextResponse.json({
    configured,
    projectRef,
    backend: process.env.NEXT_PUBLIC_NEST_BACKEND ?? null,
    authenticated: true,
    userId: auth.user.id,
    email: auth.user.email,
    isFounder: isFounder(auth.user), // role resolves AFTER auth — the correct order
  });
}
