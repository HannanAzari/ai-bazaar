// ── HOTFIX M23B.1 — nothing may spin forever ─────────────────────────────────
//
// The frozen "Signing in…" was a promise that never settled: supabase-js was queued
// behind its own auth Web Lock, so `await signIn(...)` had no resolution and no rejection,
// and the button's `setBusy(false)` was simply never reached.
//
// The lock contention itself is fixed (one memoised client, no Supabase calls from inside
// onAuthStateChange). This is the backstop for everything we have not thought of: any
// bootstrap request that has not settled in time REJECTS, so the caller's `catch`/`finally`
// runs and the UI recovers with a Retry.
//
// It is deliberately NOT used to paper over errors — the timeout produces its own distinct
// error, and the underlying failure, if it ever arrives, is still logged.

export class TimeoutError extends Error {
  constructor(readonly operation: string, readonly ms: number) {
    super(`${operation} timed out after ${ms}ms.`);
    this.name = "TimeoutError";
  }
}

export function isTimeoutError(e: unknown): e is TimeoutError {
  return e instanceof TimeoutError || (e instanceof Error && e.name === "TimeoutError");
}

/**
 * Reject if `promise` has not settled within `ms`.
 *
 * The underlying promise is not cancelled (a fetch already in flight will still complete);
 * we simply stop waiting on it, and log it if it later rejects so a real backend error is
 * never swallowed by the timeout.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  let settled = false;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      if (!settled) reject(new TimeoutError(operation, ms));
    }, ms);
  });

  promise.catch((e: unknown) => {
    // If it eventually fails AFTER we gave up, say so rather than losing it entirely.
    if (settled) return;
    console.error(`[timeout] ${operation} rejected:`, e);
  });

  return Promise.race([promise, timeout]).finally(() => {
    settled = true;
    clearTimeout(timer);
  }) as Promise<T>;
}

/** How long identity bootstrap may take before the UI offers a Retry. */
export const BOOTSTRAP_TIMEOUT_MS = 10_000;
