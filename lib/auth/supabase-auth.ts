import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { AuthClient, AuthCredentials, SessionUser, SignUpInput } from "@/lib/auth/types";
import { nameFromEmail } from "@/lib/auth/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Production auth — real Supabase Auth (email + password) behind the unified
// AuthClient. Session persistence + token refresh are handled by @supabase/ssr
// (browser client stores the session; middleware refreshes the cookie on the
// server). The client is injectable so this is unit-testable without a network.

function mapUser(user: User | null): SessionUser | null {
  if (!user || !user.email) return null;
  const metaName = (user.user_metadata?.name as string | undefined)?.trim();
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

  async signUp(input: SignUpInput): Promise<SessionUser> {
    const { data, error } = await this.client.auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { name: input.name?.trim() || nameFromEmail(input.email) } },
    });
    if (error) throw error;
    const user = mapUser(data.user);
    if (!user) throw new Error("Sign-up succeeded but no user/session was returned (email confirmation may be required).");
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

  subscribe(callback: (user: SessionUser | null) => void) {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      callback(mapUser(session?.user ?? null));
    });
    return () => data.subscription.unsubscribe();
  }
}
