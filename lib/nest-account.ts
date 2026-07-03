// ── M16 — Nest account facade (local | Supabase Auth) ────────────────────────
//
// The real identity spine for the Nestudio app shell. It replaces the M11
// `nest-auth-stub` single-session model with a proper multi-account system:
// email sign-up / sign-in / sign-out, session persistence + restoration, chosen by
// backend (like nest-repo / nest-auth):
//
//   • local   (default, preview): a faithful multi-account store in localStorage —
//     no external deps, so the full ownership flow is verifiable with no email
//     round-trip. This is the DEMO layer (passwords are lightly hashed, NOT secure);
//     it stands in for Supabase Auth exactly as DemoAuthClient stands in for it in V1.
//   • supabase (cutover): real Supabase Auth via the existing SupabaseAuthClient
//     (email + password, @supabase/ssr session persistence, token refresh).
//
// Flip both identity + document persistence to real infra with NEXT_PUBLIC_NEST_BACKEND=supabase.

import { nestBackend } from "@/lib/nest-repo";
import { SupabaseAuthClient } from "@/lib/auth/supabase-auth";

export type NestAccount = { id: string; email: string; createdAt: string };
export type AuthResult =
  | { ok: true; account: NestAccount }
  | { ok: false; error: string }
  | { ok: false; needsConfirmation: true; error: string };

const ACCOUNTS_KEY = "nestudio-accounts"; // Record<emailLower, StoredAccount>
const SESSION_KEY = "nestudio-account-session"; // accountId
export const NEST_ACCOUNT_CHANGED = "nestudio-account-changed";

const isBrowser = () => typeof window !== "undefined";
const now = () => new Date().toISOString();
const rid = () => `acct-${Math.random().toString(36).slice(2, 10)}`;

// ── Validation ─────────────────────────────────────────────────────────────--
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function validateEmail(email: string): string | null {
  return EMAIL_RE.test(email.trim()) ? null : "Enter a valid email address.";
}
export function validatePassword(password: string): string | null {
  return password.length >= 8 ? null : "Use at least 8 characters.";
}

// ── Local (demo) backend ───────────────────────────────────────────────────--
// A deliberately simple, NON-cryptographic obfuscation. This is the demo stand-in
// for Supabase Auth — never a real password store.
function demoHash(password: string): string {
  let h = 0;
  for (let i = 0; i < password.length; i += 1) h = (Math.imul(31, h) + password.charCodeAt(i)) | 0;
  return `d${h}`;
}

type StoredAccount = { id: string; email: string; ph: string; createdAt: string };

function readAccounts(): Record<string, StoredAccount> {
  if (!isBrowser()) return {};
  try {
    return JSON.parse(window.localStorage.getItem(ACCOUNTS_KEY) ?? "{}") as Record<string, StoredAccount>;
  } catch {
    return {};
  }
}
function writeAccounts(store: Record<string, StoredAccount>) {
  if (isBrowser()) window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(store));
}
function setSession(id: string | null) {
  if (!isBrowser()) return;
  if (id) window.localStorage.setItem(SESSION_KEY, id);
  else window.localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent(NEST_ACCOUNT_CHANGED));
}
function toAccount(s: StoredAccount): NestAccount {
  return { id: s.id, email: s.email, createdAt: s.createdAt };
}

function localCurrent(): NestAccount | null {
  if (!isBrowser()) return null;
  const id = window.localStorage.getItem(SESSION_KEY);
  if (!id) return null;
  const found = Object.values(readAccounts()).find((a) => a.id === id);
  return found ? toAccount(found) : null;
}

function localSignUp(email: string, password: string): AuthResult {
  const e = email.trim().toLowerCase();
  const emailErr = validateEmail(e);
  if (emailErr) return { ok: false, error: emailErr };
  const pwErr = validatePassword(password);
  if (pwErr) return { ok: false, error: pwErr };
  const accounts = readAccounts();
  if (accounts[e]) return { ok: false, error: "An account with this email already exists. Sign in instead." };
  const account: StoredAccount = { id: rid(), email: e, ph: demoHash(password), createdAt: now() };
  accounts[e] = account;
  writeAccounts(accounts);
  setSession(account.id);
  return { ok: true, account: toAccount(account) };
}

function localSignIn(email: string, password: string): AuthResult {
  const e = email.trim().toLowerCase();
  const account = readAccounts()[e];
  if (!account || account.ph !== demoHash(password)) return { ok: false, error: "Wrong email or password." };
  setSession(account.id);
  return { ok: true, account: toAccount(account) };
}

// ── Supabase backend ───────────────────────────────────────────────────────--
function supa(): SupabaseAuthClient {
  return new SupabaseAuthClient();
}

// ── Public API (backend-aware) ───────────────────────────────────────────────
const isSupabase = () => nestBackend() === "supabase";

export async function getCurrentAccount(): Promise<NestAccount | null> {
  if (isSupabase()) {
    try {
      const u = await supa().getInitialUser();
      return u ? { id: u.id, email: u.email, createdAt: "" } : null;
    } catch {
      return null;
    }
  }
  return localCurrent();
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  if (isSupabase()) {
    try {
      const u = await supa().signUp({ email, password });
      return { ok: true, account: { id: u.id, email: u.email, createdAt: "" } };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sign-up failed.";
      // SupabaseAuthClient throws this exact message when email confirmation is ON.
      if (/confirm/i.test(msg)) return { ok: false, needsConfirmation: true, error: msg };
      return { ok: false, error: msg };
    }
  }
  return localSignUp(email, password);
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (isSupabase()) {
    try {
      const u = await supa().signIn({ email, password });
      return { ok: true, account: { id: u.id, email: u.email, createdAt: "" } };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Sign-in failed." };
    }
  }
  return localSignIn(email, password);
}

export async function signOut(): Promise<void> {
  if (isSupabase()) {
    try { await supa().signOut(); } catch { /* ignore */ }
    return;
  }
  setSession(null);
}

/** Subscribe to account changes (this tab + others). Returns an unsubscribe fn. */
export function onAccountChange(cb: () => void): () => void {
  if (!isBrowser()) return () => {};
  if (isSupabase()) {
    try { return supa().subscribe(() => cb()); } catch { return () => {}; }
  }
  const h = () => cb();
  window.addEventListener(NEST_ACCOUNT_CHANGED, h);
  window.addEventListener("storage", h);
  return () => {
    window.removeEventListener(NEST_ACCOUNT_CHANGED, h);
    window.removeEventListener("storage", h);
  };
}
