// Low-level anonymous visitor + session identity (Analytics + Discovery V1).
//
// No auth, no PII: a visitor is a random opaque id persisted in localStorage; a
// session is a random opaque id persisted in sessionStorage (per browser tab/
// session, falling back to localStorage where sessionStorage is unavailable, e.g.
// the test env). This module has **no imports** so both lib/events.ts (which
// enriches every event with the current ids) and lib/visitor-session.ts (which
// owns the lifecycle) can depend on it without an import cycle.

export const VISITOR_KEY = "ai-bazaar-visitor";
export const SESSION_KEY = "ai-bazaar-session";

export type VisitorRecord = {
  id: string;
  firstSeenAt: string;
  lastSeenAt: string;
  /** Number of sessions this visitor has started (1 on first ever visit). */
  sessions: number;
};

export type SessionRecord = {
  id: string;
  startedAt: string;
  shopId?: string;
};

/** Random opaque id. Called from effects/handlers only (never in render), so
 * Math.random is safe here per ADR-008. */
export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function sessionStore(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage ?? (window.localStorage as Storage);
  } catch {
    return null;
  }
}

export function loadVisitor(): VisitorRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(VISITOR_KEY);
    return raw ? (JSON.parse(raw) as VisitorRecord) : null;
  } catch {
    return null;
  }
}

export function saveVisitor(record: VisitorRecord): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VISITOR_KEY, JSON.stringify(record));
  } catch {
    /* storage full / unavailable — analytics are best-effort */
  }
}

export function loadSession(): SessionRecord | null {
  const store = sessionStore();
  if (!store) return null;
  try {
    const raw = store.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionRecord) : null;
  } catch {
    return null;
  }
}

export function saveSession(record: SessionRecord): void {
  const store = sessionStore();
  if (!store) return;
  try {
    store.setItem(SESSION_KEY, JSON.stringify(record));
  } catch {
    /* best-effort */
  }
}

export function clearSession(): void {
  const store = sessionStore();
  if (!store) return;
  try {
    store.removeItem(SESSION_KEY);
  } catch {
    /* best-effort */
  }
}

/** The current visitor id if one exists (read-only; never creates). */
export function readVisitorId(): string | undefined {
  return loadVisitor()?.id;
}

/** The current session id if a session is active (read-only; never creates). */
export function readSessionId(): string | undefined {
  return loadSession()?.id;
}
