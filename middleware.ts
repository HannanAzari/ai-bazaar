import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { extractSubdomain, subdomainRewritePath } from "@/lib/subdomain";

// Edge middleware for the production cutover. Two responsibilities, both no-ops in
// demo mode (no Supabase env): (1) refresh the Supabase auth session cookie and
// protect the V1 onboarding; (2) rewrite `<handle>.nestud.io` → /u/<handle>.
// Demo mode keeps localStorage auth, so route protection is client-side there.
//
// M15: /studio is no longer protected — it now just redirects to the public /home
// (the Nest app shell). Gating it here bounced creators to /auth/login, which is the
// confusing post-publish login wall Phase 5 removes.
const PROTECTED = ["/onboarding"];

// Routes that render per-user / session-dependent content must never be cached by a
// shared CDN — a cached authenticated page can leak one user's view to another. Auth
// routes (code exchange, bounce) must never be cached either.
const NO_STORE_PREFIXES = ["/auth", "/profile", "/onboarding", "/creator-studio", "/nest-studio", "/asset-factory", "/nest-factory", "/api/auth", "/api/avatar", "/api/founder"];

function applyNoStore(req: NextRequest, res: NextResponse): NextResponse {
  if (NO_STORE_PREFIXES.some((p) => req.nextUrl.pathname.startsWith(p))) {
    res.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  }
  return res;
}

export async function middleware(req: NextRequest) {
  // 1. Subdomain rewrite (works in any mode; harmless when there's no subdomain).
  const handle = extractSubdomain(req.headers.get("host"));
  if (handle && req.nextUrl.pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = subdomainRewritePath(handle);
    return NextResponse.rewrite(url);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Demo mode: no server session to manage; client guards the studio.
  if (!url || !key) return applyNoStore(req, NextResponse.next({ request: req }));

  // 2. Production: refresh the session cookie and gate protected routes.
  const res = NextResponse.next({ request: req });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const isProtected = PROTECTED.some((p) => req.nextUrl.pathname.startsWith(p));
  if (!user && isProtected) {
    const redirect = req.nextUrl.clone();
    redirect.pathname = "/auth/login";
    redirect.searchParams.set("next", req.nextUrl.pathname);
    return applyNoStore(req, NextResponse.redirect(redirect));
  }
  return applyNoStore(req, res);
}

export const config = {
  // Run on everything except static assets / images / favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
