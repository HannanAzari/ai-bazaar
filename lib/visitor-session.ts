// Anonymous visitor session lifecycle (Analytics + Discovery V1).
//
// Tracks, with no authentication and lightweight opaque ids (lib/visitor-id.ts):
//   - first visit vs returning visit (per persistent visitor record)
//   - session start  → `session_started` event (metadata.returning)
//   - session end    → `session_ended` event   (metadata.durationMs)
//
// Sessions feed the creator insights dashboard (unique visitors, average session
// duration) and the visitor funnel. The SQL mirror is `visitor_sessions`; here
// the durable record is the event stream (each event carries visitorId/sessionId
// via lib/events.ts), so demo and production share one aggregation path.

import { useEffect } from "react";
import { trackEvent } from "@/lib/events";
import {
  type SessionRecord,
  clearSession,
  loadSession,
  loadVisitor,
  newId,
  saveSession,
  saveVisitor,
} from "@/lib/visitor-id";

export type StartedSession = {
  visitorId: string;
  sessionId: string;
  isReturning: boolean;
  /** False when an active session was reused (e.g. navigating between rooms). */
  isNew: boolean;
};

/** Ensure a persistent visitor record exists; returns it plus whether this is a
 * returning visitor (i.e. the record already existed before this call). */
function ensureVisitor(): { id: string; isReturning: boolean } {
  const now = new Date().toISOString();
  const existing = loadVisitor();
  if (existing?.id) {
    return { id: existing.id, isReturning: true };
  }
  const id = newId("vis");
  saveVisitor({ id, firstSeenAt: now, lastSeenAt: now, sessions: 0 });
  return { id, isReturning: false };
}

/**
 * Start (or reuse) the current browsing session. Idempotent within a session:
 * if a session is already active it is returned untouched, so remounts and
 * room-to-room navigation don't inflate session counts. A genuinely new session
 * bumps the visitor's session count and emits `session_started`.
 */
export function startSession(shopId?: string): StartedSession | null {
  if (typeof window === "undefined") return null;
  const visitor = ensureVisitor();

  const active = loadSession();
  if (active?.id) {
    return { visitorId: visitor.id, sessionId: active.id, isReturning: visitor.isReturning, isNew: false };
  }

  const session: SessionRecord = { id: newId("ses"), startedAt: new Date().toISOString(), shopId };
  saveSession(session);

  // Bump the visitor's session count + lastSeenAt now that a real session began.
  const record = loadVisitor();
  if (record) saveVisitor({ ...record, lastSeenAt: session.startedAt, sessions: record.sessions + 1 });

  trackEvent("session_started", { shopId, metadata: { returning: visitor.isReturning } });
  return { visitorId: visitor.id, sessionId: session.id, isReturning: visitor.isReturning, isNew: true };
}

/** End the active session (if any), emitting `session_ended` with its duration. */
export function endSession(): { sessionId: string; durationMs: number } | null {
  if (typeof window === "undefined") return null;
  const session = loadSession();
  if (!session?.id) return null;
  const durationMs = Math.max(0, Date.now() - new Date(session.startedAt).getTime());
  trackEvent("session_ended", { shopId: session.shopId, metadata: { durationMs } });
  clearSession();
  return { sessionId: session.id, durationMs };
}

/**
 * React hook for the public room surface: start a session on mount and end it
 * when the visitor leaves (unmount, tab hidden, or page hide). Restarts when the
 * tab becomes visible again so a fresh session is counted after a long pause.
 */
export function useVisitorSession(shopId?: string): void {
  useEffect(() => {
    startSession(shopId);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") endSession();
      else startSession(shopId);
    };
    const onPageHide = () => endSession();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      endSession();
    };
  }, [shopId]);
}
