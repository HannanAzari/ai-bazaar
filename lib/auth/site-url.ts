// ── Origin resolution for auth redirects ─────────────────────────────────────
//
// The mobile Preview login bug: OAuth/email redirects were pinned to a single
// URL (window.location.href / a dashboard Site URL), so a login started on
// `branch-abc.vercel.app` came back to the wrong host and the PKCE code was never
// exchanged there. The fix: ALWAYS resolve the origin from where the request is
// actually happening.
//
//  • Client-initiated auth uses `window.location.origin` — the exact Preview host
//    the user is on, so any deployment URL works without pre-listing it.
//  • Server code (no `window`) falls back to env: NEXT_PUBLIC_SITE_URL is the stable
//    Production origin; NEXT_PUBLIC_VERCEL_URL (or VERCEL_URL) is the per-deployment
//    Preview origin. Set SITE_URL only in the Production environment so Preview
//    naturally falls through to the Vercel URL.

function normalizeOrigin(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Server-side origin from env — Production (SITE_URL) first, then Preview (VERCEL_URL). Pure/testable. */
export function resolveServerSiteUrl(env: {
  NEXT_PUBLIC_SITE_URL?: string;
  NEXT_PUBLIC_VERCEL_URL?: string;
  VERCEL_URL?: string;
}): string {
  return (
    normalizeOrigin(env.NEXT_PUBLIC_SITE_URL) ?? // Production canonical
    normalizeOrigin(env.NEXT_PUBLIC_VERCEL_URL ?? env.VERCEL_URL) ?? // Preview / branch deployment
    "http://localhost:3000" // local dev fallback (never a hard-coded prod/preview host)
  );
}

/** The site origin for the current context. Browser → the live origin; server → env. */
export function getSiteUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return resolveServerSiteUrl({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_VERCEL_URL: process.env.NEXT_PUBLIC_VERCEL_URL,
    VERCEL_URL: process.env.VERCEL_URL,
  });
}

/** Absolute `/auth/callback` URL on the current origin, carrying a safe same-origin `next`. */
export function authCallbackUrl(next?: string | null): string {
  const url = new URL("/auth/callback", getSiteUrl());
  if (next && next.startsWith("/") && !next.startsWith("//")) url.searchParams.set("next", next);
  return url.toString();
}
