// Subdomain routing helpers for `username.nestud.io` (prep — no DNS deployed).
//
// A creator's space is reachable at `<handle>.nestud.io`, which the middleware
// rewrites to the existing `/u/<handle>` route — no new pages, no visual change.
// Pure + tested so the host→handle mapping is verifiable without a network.

/** Root domains we treat as "the app" (everything else on them is a handle). */
export const ROOT_DOMAINS = ["nestud.io", "localhost"];

/** Hostnames that are app surfaces, never a creator handle. */
const RESERVED = new Set(["www", "app", "api", "studio", "admin", "staging"]);

/**
 * The creator handle encoded in a host, or null for an app/root host.
 * Examples: `jane.nestud.io` → "jane"; `nestud.io`/`www.nestud.io` → null;
 * `jane.localhost:3000` → "jane" (local dev).
 */
export function extractSubdomain(host: string | null | undefined): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0].toLowerCase().trim();
  if (!hostname) return null;
  for (const root of ROOT_DOMAINS) {
    if (hostname === root || hostname === `www.${root}`) return null;
    if (hostname.endsWith(`.${root}`)) {
      const sub = hostname.slice(0, hostname.length - (root.length + 1));
      // Only the left-most label is the handle (ignore deeper nesting).
      const handle = sub.split(".")[0];
      if (!handle || RESERVED.has(handle)) return null;
      return handle;
    }
  }
  return null;
}

/** The internal path a handle subdomain maps to (the existing creator profile). */
export function subdomainRewritePath(handle: string): string {
  return `/u/${handle}`;
}
