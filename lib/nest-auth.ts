// ── M12 — Nest auth facade (local stub | Supabase Auth) ──────────────────────
//
// Backend-aware auth for the publish gate. Local backend uses the M11 username
// stub (verified). Supabase backend uses real Supabase Auth: anonymous guests can
// draft; publishing prompts an upgrade to email or Google. Delayed signup preserved.

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSession as localGetSession, signUp as localSignUpStub, signOut as localSignOut } from "@/lib/nest-auth-stub";
import { nestBackend } from "@/lib/nest-repo";

export type NestSession = { userId: string; username: string; isGuest: boolean };

const isSupabaseBackend = () => nestBackend() === "supabase";

export async function getNestSession(): Promise<NestSession | null> {
  if (isSupabaseBackend()) {
    const client = createSupabaseBrowserClient();
    if (!client) return null;
    const { data } = await client.auth.getUser();
    const u = data.user;
    if (!u) return null;
    const meta = u.user_metadata ?? {};
    const username = (meta.username as string) || (meta.display_name as string) || u.email?.split("@")[0] || "guest";
    // is_anonymous is present on anonymous sessions.
    return { userId: u.id, username, isGuest: (u as { is_anonymous?: boolean }).is_anonymous ?? false };
  }
  const s = localGetSession();
  return s ? { userId: s.userId, username: s.username, isGuest: false } : null;
}

/** Local backend: claim a username (M11 stub). */
export function localSignUp(username: string): NestSession {
  const s = localSignUpStub(username);
  return { userId: s.userId, username: s.username, isGuest: false };
}

/** Supabase backend: sign up / sign in with email + password. */
export async function signUpWithEmail(email: string, password: string): Promise<void> {
  const client = createSupabaseBrowserClient();
  if (!client) throw new Error("Supabase unavailable.");
  const { error } = await client.auth.signUp({
    email, password,
    options: { data: { username: email.split("@")[0] } },
  });
  if (error) throw error;
}

/** Supabase backend: OAuth (Google now; Apple later). Redirects the browser. */
export async function signInWithGoogle(): Promise<void> {
  const client = createSupabaseBrowserClient();
  if (!client) throw new Error("Supabase unavailable.");
  const redirectTo = typeof window !== "undefined" ? window.location.href : undefined;
  const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  if (isSupabaseBackend()) {
    const client = createSupabaseBrowserClient();
    if (client) await client.auth.signOut();
    return;
  }
  localSignOut();
}
