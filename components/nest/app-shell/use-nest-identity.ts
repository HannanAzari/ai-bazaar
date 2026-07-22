"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getCurrentAccount,
  onAccountChange,
  signIn as accountSignIn,
  signOut as accountSignOut,
  signUp as accountSignUp,
  type AuthResult,
  type NestAccount,
} from "@/lib/nest-account";
import {
  claimUsername as claimUsernameStore,
  ensureNestProfile,
  getNestProfile,
  onNestProfilesChanged,
  updateNestProfile,
  type ClaimResult,
  type NestProfile,
  type NestSocials,
} from "@/lib/nest-profile-store";
import { migrateLocalWorkToAccount } from "@/lib/nest-migration";

// M16 — the one hook the app shell reads for identity. It joins the real Nest
// account (lib/nest-account: local multi-account | Supabase Auth) with the account's
// profile, and runs the local-work migration on sign-in so no draft/publish is lost.
export function useNestIdentity() {
  const [account, setAccount] = useState<NestAccount | null>(null);
  const [profile, setProfile] = useState<NestProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Adopt local work + ensure a profile whenever an account becomes active.
  const onAuthed = useCallback((acct: NestAccount) => {
    migrateLocalWorkToAccount(acct.id, acct.email);
    setAccount(acct);
    setProfile(ensureNestProfile(acct.id, acct.email.split("@")[0]));
  }, []);

  // Restore the session on mount (Supabase token or local session).
  useEffect(() => {
    let alive = true;
    getCurrentAccount().then((acct) => {
      if (!alive) return;
      if (acct) onAuthed(acct);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [onAuthed]);

  // React to external auth changes (other tabs, Supabase refresh, sign-out).
  useEffect(() => {
    return onAccountChange(() => {
      getCurrentAccount().then((acct) => {
        if (acct) onAuthed(acct);
        else { setAccount(null); setProfile(null); }
      });
    });
  }, [onAuthed]);

  // Keep the profile fresh when it changes (claim, edit).
  useEffect(() => {
    if (!account) return;
    return onNestProfilesChanged(() => setProfile(getNestProfile(account.id)));
  }, [account]);

  const signUp = useCallback(async (email: string, password: string, name?: string): Promise<AuthResult> => {
    const r = await accountSignUp(email, password, name);
    if (r.ok) {
      onAuthed(r.account);
      if (name && name.trim()) setProfile(updateNestProfile(r.account.id, { displayName: name.trim() }));
    }
    return r;
  }, [onAuthed]);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const r = await accountSignIn(email, password);
    if (r.ok) onAuthed(r.account);
    return r;
  }, [onAuthed]);

  const signOut = useCallback(async () => {
    await accountSignOut();
    setAccount(null);
    setProfile(null);
  }, []);

  const claimUsername = useCallback((username: string): ClaimResult => {
    if (!account) return { ok: false, error: "Sign in to claim a username." };
    const r = claimUsernameStore(account.id, username);
    if (r.ok) setProfile(r.profile);
    return r;
  }, [account]);

  const updateProfile = useCallback(
    (patch: Partial<Pick<NestProfile, "displayName" | "bio" | "avatarUrl" | "socials">>) => {
      if (!account) return;
      setProfile(updateNestProfile(account.id, patch));
    },
    [account],
  );

  return {
    account,
    profile,
    loading,
    signedIn: !!account,
    ownerId: account?.id,
    signUp,
    signIn,
    signOut,
    claimUsername,
    updateProfile,
  };
}

export type { NestSocials };
