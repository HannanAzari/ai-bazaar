// ── PKCE callback redirect logic (pure, testable) ────────────────────────────
//
// After exchanging the code the user must land on a NEUTRAL, non-prefetched route
// FIRST — never straight onto a protected page. Protected pages are often prefetched
// (RSC) with the pre-login cookie; bouncing through a neutral route lets the freshly
// written session cookie take effect before the protected navigation happens.
//
// Every URL here is built on the SAME origin the callback was hit on, so a Preview
// login returns to its initiating hostname — no fixed prod/localhost host is baked in.

export const NEUTRAL_ROUTE = "/auth/complete";

/** Only allow same-origin relative paths as `next` (blocks `//evil.com`, absolute URLs, etc.). */
export function safeNext(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

/** Post-exchange destination: the neutral route on `origin`, carrying a sanitised `next`. */
export function callbackRedirectUrl(origin: string, next: string | null | undefined): string {
  const url = new URL(NEUTRAL_ROUTE, origin);
  const safe = safeNext(next);
  if (safe) url.searchParams.set("next", safe);
  return url.toString();
}

/** Failure destination: back to login on the SAME origin, with a reason flag. */
export function callbackErrorUrl(origin: string, reason: string): string {
  const url = new URL("/auth/login", origin);
  url.searchParams.set("error", reason);
  return url.toString();
}
