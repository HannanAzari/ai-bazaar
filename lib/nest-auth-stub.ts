// ── Nestudio — auth STUB (M11) ───────────────────────────────────────────────
//
// A local, no-backend stand-in for auth. It exists only to (1) gate publishing
// behind "create an account", (2) stamp an ownerId on published docs, and (3) let
// private nests resolve for their owner but not for a different browser/session.
// This is NOT real auth — replaced by Supabase auth in a later sprint.

export type NestSession = { userId: string; username: string };

const KEY = "nestudio-session";
const isBrowser = () => typeof window !== "undefined";

export function getSession(): NestSession | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as NestSession) : null;
  } catch {
    return null;
  }
}

/** "Create an account" — stub. Reuses an existing session if the username matches. */
export function signUp(username: string): NestSession {
  const existing = getSession();
  if (existing && existing.username === username) return existing;
  const session: NestSession = {
    userId: `user-${Math.random().toString(36).slice(2, 10)}`,
    username: username.trim() || "creator",
  };
  if (isBrowser()) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(session));
    } catch {
      /* ignore */
    }
  }
  return session;
}

export function signOut() {
  if (isBrowser()) window.localStorage.removeItem(KEY);
}
