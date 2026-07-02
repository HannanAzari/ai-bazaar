// ── Nestudio — Nest profile + username ownership (M15) ───────────────────────
//
// The identity spine for the app shell (Home · profile summary · /@handle). It is
// keyed by the **nest-auth** userId — the same identity that owns NestDocuments and
// published nests — NOT the V1 AuthProvider account. This is deliberately a light
// localStorage store (no auth rewrite): it owns the canonical username (with
// uniqueness), a bio, and an avatar. Real server persistence lands with Supabase.

const PROFILES_KEY = "nestudio-profiles"; // Record<userId, NestProfile>
export const NEST_PROFILES_CHANGED = "nestudio-profiles-changed";

const isBrowser = () => typeof window !== "undefined";

export type NestProfile = {
  userId: string;
  /** Canonical, lowercase, unique handle used at /@<username>. */
  username: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
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

// ── Username rules ─────────────────────────────────────────────────────────────
const USERNAME_MIN = 3;
const USERNAME_MAX = 20;
const RESERVED = new Set(["home", "explore", "create", "updates", "nest", "admin", "api", "studio", "onboarding", "design", "u", "auth"]);

/** Normalize any input toward a legal handle (lowercase, [a-z0-9_-]). */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, USERNAME_MAX);
}

/** null when valid; otherwise a human-readable reason. Ignores case. */
export function validateUsername(input: string): string | null {
  const u = normalizeUsername(input);
  if (u.length < USERNAME_MIN) return `Use at least ${USERNAME_MIN} characters.`;
  if (RESERVED.has(u)) return "That username is reserved.";
  return null;
}

// ── Reads ──────────────────────────────────────────────────────────────────────
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

// ── Writes ───────────────────────────────────────────────────────────────────--
export type ClaimResult = { ok: true; profile: NestProfile } | { ok: false; error: string };

/** Claim (or re-claim) a username for a user. Enforces validity + uniqueness. */
export function claimUsername(userId: string, input: string): ClaimResult {
  const reason = validateUsername(input);
  if (reason) return { ok: false, error: reason };
  const u = normalizeUsername(input);
  if (!isUsernameAvailable(u, userId)) return { ok: false, error: "That username is taken." };
  const store = read();
  const current = store[userId];
  store[userId] = { userId, username: u, displayName: current?.displayName, bio: current?.bio, avatarUrl: current?.avatarUrl };
  write(store);
  return { ok: true, profile: store[userId] };
}

/** Ensure a profile row exists for a session, giving it a starter username if empty. */
export function ensureNestProfile(userId: string, fallbackUsername: string): NestProfile {
  const store = read();
  if (store[userId]) return store[userId];
  // Derive a free username from the fallback (append a suffix if the base is taken).
  let candidate = normalizeUsername(fallbackUsername) || "creator";
  if (candidate.length < USERNAME_MIN) candidate = `${candidate}-nest`.slice(0, USERNAME_MAX);
  if (!isUsernameAvailable(candidate, userId)) candidate = `${candidate}-${Math.random().toString(36).slice(2, 5)}`.slice(0, USERNAME_MAX);
  const profile: NestProfile = { userId, username: candidate };
  store[userId] = profile;
  write(store);
  return profile;
}

/** Patch display fields (not the username — use claimUsername for that). */
export function updateNestProfile(userId: string, patch: Partial<Pick<NestProfile, "displayName" | "bio" | "avatarUrl">>): NestProfile {
  const store = read();
  const current = store[userId] ?? ensureNestProfile(userId, "creator");
  const next: NestProfile = { ...current, ...patch, userId, username: current.username };
  store[userId] = next;
  write(store);
  return next;
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
