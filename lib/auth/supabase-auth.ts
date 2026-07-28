import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { AuthClient, AuthCredentials, SessionUser, SignUpInput } from "@/lib/auth/types";
import { nameFromEmail } from "@/lib/auth/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { authCallbackUrl } from "@/lib/auth/site-url";

// Production auth — real Supabase Auth (email + password) behind the unified
// AuthClient. Session persistence + token refresh are handled by @supabase/ssr
// (browser client stores the session; middleware refreshes the cookie on the
// server). The client is injectable so this is unit-testable without a network.

function mapUser(user: User | null): SessionUser | null {
  if (!user || !user.email) return null;
  // The DB trigger names the profile from `display_name`; read it first, then a
  // legacy `name`, then derive from the email.
  const meta = user.user_metadata ?? {};
  const metaName = ((meta.display_name as string | undefined) ?? (meta.name as string | undefined))?.trim();
  return { id: user.id, email: user.email, name: metaName || nameFromEmail(user.email) };
}

export class SupabaseAuthClient implements AuthClient {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient | null) {
    const resolved = client ?? createSupabaseBrowserClient();
    if (!resolved) throw new Error("Supabase client unavailable — SupabaseAuthClient requires Supabase env vars.");
    this.client = resolved;
  }

  async getInitialUser(): Promise<SessionUser | null> {
    const { data } = await this.client.auth.getUser();
    return mapUser(data.user ?? null);
  }

  /**
   * Create an account, and only report success if Supabase genuinely created one.
   *
   * HOTFIX (M23B.2): the founder created an account through the UI, was taken to
   * onboarding, and the user did not exist in Authentication → Users. Every branch below
   * exists so that can never be reported as success again — the checks are ordered from
   * "definitely didn't happen" to "happened but isn't usable yet".
   */
  async signUp(input: SignUpInput): Promise<SessionUser> {
    const displayName = input.name?.trim() || nameFromEmail(input.email);
    const { data, error } = await this.client.auth.signUp({
      email: input.email,
      password: input.password,
      // The on_auth_user_created trigger reads `display_name` to name the profile.
      // Email-confirmation links return to /auth/callback on the initiating host (Preview-safe).
      options: { data: { display_name: displayName, name: displayName }, emailRedirectTo: authCallbackUrl("/onboarding") },
    });
    if (error) throw error;

    // 1. No user object at all ⇒ nothing was created. Previously this fell through to the
    //    session check and produced a misleading "confirm your email" message.
    if (!data.user?.id) {
      throw new Error("Sign-up did not create an account. Please try again.");
    }

    // 2. Supabase's anti-enumeration response for an email that ALREADY exists: a
    //    user-shaped object with an EMPTY `identities` array and no session. Without this
    //    check it looks like a brand-new signup that merely needs confirming — so the
    //    person is told to check an email that never arrives, for an account they already
    //    have. (This project currently returns a plain 422 instead, but the obfuscated
    //    form turns on with a project setting, so we handle both.)
    const identities = (data.user as { identities?: unknown[] }).identities;
    if (Array.isArray(identities) && identities.length === 0) {
      throw new Error("An account with this email already exists. Sign in instead.");
    }

    // 3. A user exists but there is no session ⇒ email confirmation is ON. Real, but not
    //    usable yet: an unconfirmed user has no session cookie, so every RLS-guarded call
    //    would fail. The caller renders this as "check your email", not as signed-in.
    if (!data.session?.access_token) {
      throw new Error("Check your email to confirm your account, then sign in.");
    }

    const user = mapUser(data.user);
    if (!user) throw new Error("Sign-up returned no user.");
    return user;
  }

  async signIn(input: AuthCredentials): Promise<SessionUser> {
    const { data, error } = await this.client.auth.signInWithPassword(input);
    if (error) throw error;
    const user = mapUser(data.user);
    if (!user) throw new Error("Sign-in returned no user.");
    return user;
  }

  async signOut() {
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
  }

  /**
   * The current session's user WITHOUT a network round-trip or a token refresh.
   *
   * HOTFIX (M23B.1): `getUser()` calls the Auth server and takes the auth Web Lock.
   * Callers that only need "who is signed in right now" (identity bootstrap, the
   * auth-state-change handler) use this instead, so they never queue behind — or
   * deadlock against — a lock that sign-in is already holding.
   */
  async getCachedUser(): Promise<SessionUser | null> {
    const { data } = await this.client.auth.getSession();
    return mapUser(data.session?.user ?? null);
  }

  subscribe(callback: (user: SessionUser | null) => void) {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      // HOTFIX (M23B.1): supabase-js invokes these callbacks while HOLDING the auth
      // lock, so calling any other supabase method from inside one deadlocks. The
      // session is already handed to us here — we use it and never call back into the
      // client. `setTimeout(0)` additionally pushes the subscriber's own work off the
      // lock-holding call stack, which is the pattern Supabase documents.
      const user = mapUser(session?.user ?? null);
      setTimeout(() => callback(user), 0);
    });
    return () => data.subscription.unsubscribe();
  }
}
