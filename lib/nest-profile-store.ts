// ── Nestudio — Nest profile + username ownership (M15 · M16) ─────────────────
//
// The profile attached to a Nest account (see lib/nest-account.ts), keyed by the
// account id. It owns the **username** (unique, validated, immutable once claimed)
// plus display name, bio, avatar, and optional social links. This is the local layer;
// the Supabase layer is the `profiles` table (username has a unique index) reached via
// lib/repos — both share these validation rules.

const PROFILES_KEY = "nestudio-profiles"; // Record<userId, NestProfile>
export const NEST_PROFILES_CHANGED = "nestudio-profiles-changed";

const isBrowser = () => typeof window !== "undefined";

export type NestSocials = {
  website?: string;
  github?: string;
  twitter?: string;
  youtube?: string;
};

/** M20 — an arbitrary creator link. Platforms are never hard-coded: a creator may add
 *  Spotify, Steam, Discord, Patreon, a shop… The label is optional (we derive one). */
export type ProfileLink = { label?: string; url: string };

export type NestProfile = {
  /** = the Nest account id. */
  userId: string;
  /** Canonical, lowercase, unique handle at /@<username>. Claimed once, then immutable. */
  username?: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  /** Legacy fixed four. Still read so existing profiles keep working. */
  socials?: NestSocials;
  /** M20 — unlimited creator links. */
  links?: ProfileLink[];
};

function read(): Record<string, NestProfile> {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(PROFILES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, NestProfile>) : {};
  } catch {
    return {};
  }
}

function write(store: Record<string, NestProfile>) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(PROFILES_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent(NEST_PROFILES_CHANGED));
  } catch {
    /* ignore */
  }
}

// ── Username rules (Phase 3: lowercase · 3–20 · letters/numbers/underscore) ────
const USERNAME_MIN = 3;
const USERNAME_MAX = 20;
const RESERVED = new Set(["home", "explore", "create", "updates", "notifications", "nest", "admin", "api", "studio", "onboarding", "design", "u", "auth", "profile", "signin", "signup", "login"]);

/** Normalize any input toward a legal handle (lowercase, [a-z0-9_]). */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, USERNAME_MAX);
}

/** null when valid; otherwise a human-readable reason. Ignores case. */
export function validateUsername(input: string): string | null {
  const u = normalizeUsername(input);
  if (u.length < USERNAME_MIN) return `Use at least ${USERNAME_MIN} characters (letters, numbers, underscore).`;
  if (RESERVED.has(u)) return "That username is reserved.";
  return null;
}

// ── Reads ──────────────────────────────────────────────────────────────────--
export function getNestProfile(userId: string): NestProfile | null {
  return read()[userId] ?? null;
}

/** Resolve a profile by its /@handle. Case-insensitive. */
export function resolveByUsername(username: string): NestProfile | null {
  const u = normalizeUsername(username);
  return Object.values(read()).find((p) => p.username === u) ?? null;
}

/** True when no OTHER user already holds this username. */
export function isUsernameAvailable(input: string, forUserId?: string): boolean {
  const u = normalizeUsername(input);
  const owner = Object.values(read()).find((p) => p.username === u);
  return !owner || owner.userId === forUserId;
}

// ── Writes ───────────────────────────────────────────────────────────────────
export type ClaimResult = { ok: true; profile: NestProfile } | { ok: false; error: string };

/**
 * Claim a username for an account. Enforces validity + uniqueness, and — because
 * usernames are **immutable for now** — refuses to change one that's already set.
 */
export function claimUsername(userId: string, input: string): ClaimResult {
  const reason = validateUsername(input);
  if (reason) return { ok: false, error: reason };
  const u = normalizeUsername(input);
  const store = read();
  const current = store[userId];
  if (current?.username && current.username !== u) {
    return { ok: false, error: "Your username is permanent for now and can't be changed." };
  }
  if (!isUsernameAvailable(u, userId)) return { ok: false, error: "That username is taken." };
  store[userId] = { ...(current ?? { userId }), userId, username: u };
  write(store);
  return { ok: true, profile: store[userId] };
}

/** Ensure a profile row exists for an account (username stays UNCLAIMED until chosen). */
export function ensureNestProfile(userId: string, displayName?: string): NestProfile {
  const store = read();
  if (store[userId]) return store[userId];
  const profile: NestProfile = { userId, displayName: displayName?.trim() || undefined };
  store[userId] = profile;
  write(store);
  return profile;
}

/** Patch mutable profile fields (NOT the username — use claimUsername for that). */
export function updateNestProfile(
  userId: string,
  patch: Partial<Pick<NestProfile, "displayName" | "bio" | "avatarUrl" | "socials" | "links">>,
): NestProfile {
  const store = read();
  const current = store[userId] ?? { userId };
  const next: NestProfile = {
    ...current,
    ...patch,
    userId,
    username: current.username, // never mutated here
    socials: patch.socials ? { ...current.socials, ...patch.socials } : current.socials,
  };
  store[userId] = next;
  write(store);
  return next;
}

/**
 * Move a legacy profile (M15 stub identity) onto a real account id, keeping the
 * username + fields and removing the old row so uniqueness stays intact. Used by the
 * sign-in migration. No-op if the account already has a username.
 */
export function adoptLegacyProfile(accountId: string, legacyUserId: string): NestProfile | null {
  if (accountId === legacyUserId) return getNestProfile(accountId);
  const store = read();
  const legacy = store[legacyUserId];
  if (!legacy) return store[accountId] ?? null;
  const account = store[accountId] ?? { userId: accountId };
  const merged: NestProfile = {
    userId: accountId,
    username: account.username ?? legacy.username,
    displayName: account.displayName ?? legacy.displayName,
    bio: account.bio ?? legacy.bio,
    avatarUrl: account.avatarUrl ?? legacy.avatarUrl,
    socials: account.socials ?? legacy.socials,
  };
  store[accountId] = merged;
  delete store[legacyUserId]; // free the username from the stub id
  write(store);
  return merged;
}

export function onNestProfilesChanged(cb: () => void): () => void {
  if (!isBrowser()) return () => {};
  const h = () => cb();
  window.addEventListener(NEST_PROFILES_CHANGED, h);
  window.addEventListener("storage", h);
  return () => {
    window.removeEventListener(NEST_PROFILES_CHANGED, h);
    window.removeEventListener("storage", h);
  };
}
