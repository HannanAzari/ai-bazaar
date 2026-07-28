// ── M23B — what sign-out actually clears ─────────────────────────────────────
//
// Ending the Supabase session is necessary but not sufficient: this app cached a lot of
// per-user state in localStorage, and leaving it behind meant the next person on the
// same device saw the previous creator's drafts, handle, likes and notifications — and
// owner-only controls kept rendering because the profile was still in memory.
//
// So sign-out clears exactly the keys that describe *who was signed in* and what they
// were doing. It deliberately does NOT clear:
//   • published content — that lives on the server and belongs to the account, not the device
//   • the curated library cache — public reference data, identical for everyone
//   • admin/founder tokens — those are separately gated and separately revoked
//
// Kept in its own module so the list is auditable in one place and testable without a
// React tree.

/** Keys wiped on sign-out. Each one is per-user state, not shared reference data. */
export const SESSION_SCOPED_KEYS = [
  "nestudio-account-session", // the local/demo session pointer
  "nestudio-profiles", // cached profile (display name, handle, bio)
  "nestudio-nest-documents", // locally-cached Nest documents
  "nestudio-published", // the local publish registry
  "nestudio-likes",
  "nestudio-follows",
  "nestudio-comments",
  "nestudio-views",
  "nestudio-notifications",
  "nestudio-admin-mode",
] as const;

/** Prefixes wiped on sign-out (one key per document — the editor's autosave). */
export const SESSION_SCOPED_PREFIXES = ["nestudio:nest-editor:v1:"] as const;

/**
 * Drop every trace of the signed-out user from this browser. Safe to call when nothing
 * is stored, and safe to call on the server (it is a no-op there).
 */
export function clearLocalSessionState(): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of SESSION_SCOPED_KEYS) window.localStorage.removeItem(key);
    // Snapshot the key list first — removing while iterating shifts the indices.
    const all: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k) all.push(k);
    }
    for (const k of all) {
      if (SESSION_SCOPED_PREFIXES.some((p) => k.startsWith(p))) window.localStorage.removeItem(k);
    }
  } catch {
    // A private-mode/quota failure must not block sign-out itself — the Supabase session
    // is already ended by the time we get here, which is the part that matters.
  }
}
