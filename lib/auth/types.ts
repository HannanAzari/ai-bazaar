// Unified session model for the demo → production cutover. The same shape backs
// both the localStorage demo session and a real Supabase Auth session, so UI
// (login/sign-up, the studio guard, onboarding) reads one `useSession()` API and
// the runtime mode picks the implementation — mirroring lib/repos + lib/storage.

export type SessionUser = {
  /** Stable user id. Supabase `auth.users.id`; a fixed id in demo mode. */
  id: string;
  email: string;
  /** Display name (from sign-up, user metadata, or derived from the email). */
  name: string;
};

export type AuthCredentials = { email: string; password: string };
export type SignUpInput = AuthCredentials & { name?: string };

export interface AuthClient {
  /** The session user on load (reads localStorage in demo, the session in prod). */
  getInitialUser(): Promise<SessionUser | null>;
  signUp(input: SignUpInput): Promise<SessionUser>;
  signIn(input: AuthCredentials): Promise<SessionUser>;
  signOut(): Promise<void>;
  /** Subscribe to external auth changes (Supabase token refresh / multi-tab). */
  subscribe?(callback: (user: SessionUser | null) => void): () => void;
}

/** Derive a friendly display name from an email local-part when none is given. */
export function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const cleaned = local.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "Creator";
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}
