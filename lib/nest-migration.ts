// ── M16 — Local-work migration (Phase 4) ─────────────────────────────────────
//
// When someone signs into a real Nest account, their existing browser-local work
// (drafts, published Nests, the M15 stub username/bio) must NOT be lost. This adopts
// all of it into the account: re-stamps ownership and transfers the legacy profile.
//
// Everything is idempotent and additive — running it twice does nothing the second
// time, and it never deletes a Nest.

import { adoptLocalWork, countAdoptableWork } from "@/lib/nest-document-store";
import { adoptLegacyProfile } from "@/lib/nest-profile-store";

const LEGACY_SESSION_KEY = "nestudio-session"; // M11/M15 nest-auth-stub session

/** The legacy stub owner id left by the M15 shell, if any. */
export function legacyStubOwnerId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(LEGACY_SESSION_KEY);
    if (!raw) return undefined;
    return (JSON.parse(raw) as { userId?: string }).userId;
  } catch {
    return undefined;
  }
}

export type MigrationSummary = { drafts: number; published: number; adoptedUsername?: string };

/** How much un-owned / legacy work is waiting to be adopted by this account. */
export function pendingLocalWork(accountId: string): { drafts: number; published: number } {
  return countAdoptableWork(accountId, legacyStubOwnerId());
}

/**
 * Adopt this browser's local work into the signed-in account. Safe to call on every
 * sign-in (idempotent). Preserves drafts, publish history, overlays/stickers, and links
 * (those live inside each NestDocument, which is re-stamped whole, not rebuilt).
 */
export function migrateLocalWorkToAccount(accountId: string, accountDisplayName?: string): MigrationSummary {
  const legacyId = legacyStubOwnerId();
  const moved = adoptLocalWork(accountId, legacyId);

  let adoptedUsername: string | undefined;
  if (legacyId) {
    const profile = adoptLegacyProfile(accountId, legacyId);
    adoptedUsername = profile?.username;
  }

  // Retire the stub session so it can't re-own anything later.
  if (typeof window !== "undefined") {
    try { window.localStorage.removeItem(LEGACY_SESSION_KEY); } catch { /* ignore */ }
  }

  void accountDisplayName; // reserved: seed display name from the account on first adopt
  return { ...moved, adoptedUsername };
}
