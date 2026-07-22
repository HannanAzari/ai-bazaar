"use client";

// ── Client-side founder token holder ─────────────────────────────────────────
//
// Mirrors lib/founder-gate.ts on the client. The token is entered once in the
// Creation Studio gate screen and kept in localStorage; every call to a founder
// route attaches it as `x-founder-token`. This is a capability key, NOT a secret
// baked into the bundle — nothing here is inlined at build time.

const KEY = "nestudio:founder-token:v1";

export function getFounderToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function setFounderToken(token: string): void {
  try {
    localStorage.setItem(KEY, token.trim());
  } catch {
    /* private mode / storage disabled — the request will just 401 */
  }
}

export function clearFounderToken(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function hasFounderToken(): boolean {
  return getFounderToken().length > 0;
}

/** Merge the founder header into an existing header bag for a fetch(). */
export function founderHeaders(extra?: Record<string, string>): Record<string, string> {
  return { ...(extra ?? {}), "x-founder-token": getFounderToken() };
}
