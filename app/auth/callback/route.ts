import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { callbackErrorUrl, callbackRedirectUrl } from "@/lib/auth/callback-redirect";

// ── OAuth / email PKCE callback ──────────────────────────────────────────────
//
// Client-initiated auth (Google, email confirmation) returns here with `?code=`.
// We exchange the code for a session and write the Supabase SSR cookies onto the
// REDIRECT response, then bounce to a neutral non-prefetched route (never straight
// to a protected page). Every redirect is built on the SAME origin this request
// arrived on (`request.nextUrl.origin`) — so a Preview login returns to its own
// hostname, with no host hard-coded here.

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // never cache an auth exchange

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0, must-revalidate" };

export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  // Surface a provider error (e.g. user cancelled) verbatim, on the same origin.
  const providerError = searchParams.get("error_description") || searchParams.get("error");

  if (providerError) {
    return NextResponse.redirect(callbackErrorUrl(origin, "oauth_" + slug(providerError)), { headers: NO_STORE });
  }
  if (!code) {
    return NextResponse.redirect(callbackErrorUrl(origin, "missing_code"), { headers: NO_STORE });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.redirect(callbackErrorUrl(origin, "auth_unconfigured"), { headers: NO_STORE });
  }

  // Build the success redirect FIRST so the exchanged session cookies are written onto it.
  const response = NextResponse.redirect(callbackRedirectUrl(origin, next), { headers: NO_STORE });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Write the session cookies onto the outgoing redirect response.
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(callbackErrorUrl(origin, "exchange_failed"), { headers: NO_STORE });
  }
  return response;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "error";
}
