import type { UserProfile } from "@/lib/types";
import type { SessionUser } from "@/lib/auth/types";

// Demo profile store — the localStorage parity of the Supabase `profiles` table.
// Keyed by user id so it mirrors the auth-linked production row. SSR-guarded with
// the usual try/catch + change event, matching the other demo libs.

const KEY = "ai-bazaar-profiles";

type Store = Record<string, UserProfile>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

function write(store: Store) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(store));
  window.dispatchEvent(new Event("ai-bazaar-profiles-changed"));
}

/** A handle from a display name/email: lowercase, alnum + dashes. */
export function handleFromName(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return base || "creator";
}

export function getProfile(id: string): UserProfile | null {
  return read()[id] ?? null;
}

export function ensureProfile(user: SessionUser): UserProfile {
  const store = read();
  const existing = store[user.id];
  if (existing) return existing;
  const profile: UserProfile = {
    id: user.id,
    displayName: user.name,
    username: handleFromName(user.name || user.email),
    isAdmin: false,
  };
  store[user.id] = profile;
  write(store);
  return profile;
}

export function updateProfile(id: string, patch: Partial<Omit<UserProfile, "id" | "isAdmin">>): UserProfile {
  const store = read();
  const current = store[id] ?? { id, displayName: "Creator", isAdmin: false };
  const next: UserProfile = { ...current, ...patch, id, isAdmin: current.isAdmin };
  store[id] = next;
  write(store);
  return next;
}
