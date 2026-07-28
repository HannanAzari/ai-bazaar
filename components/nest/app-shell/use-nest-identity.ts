"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  type ProfileLink,
} from "@/lib/nest-profile-store";
import { migrateLocalWorkToAccount } from "@/lib/nest-migration";
import { nestBackend } from "@/lib/nest-repo";
import * as profileRepo from "@/lib/nest/supabase-profile-repo";
import { clearLocalSessionState } from "@/lib/nest-session-reset";

// M16 → M23B — the ONE hook the app shell reads for identity.
//
// It joins the Nest account (Supabase Auth, or the local demo store) with that account's
// **profile**. The change in M23B is where the profile comes from: on the Supabase
// backend it is the shared `profiles` row, so a creator's display name, @handle and
// chosen house are the same for every visitor on every device. The localStorage profile
// store remains only for the local/demo backend.
//
// It also owns the onboarding gate: `needsOnboarding` is true until the creator has a
// display name, a username AND a house.

export type IdentityProfile = NestProfile & {
  /** `profiles.house_style` — the one house this creator lives in. */
  houseStyle?: string;
};

const isSupabase = () => nestBackend() === "supabase";

/** Server profile → the shape every existing screen already reads. */
function toIdentityProfile(p: profileRepo.CreatorProfile): IdentityProfile {
  return {
    userId: p.id,
    username: p.username,
    displayName: p.displayName,
    bio: p.bio,
    avatarUrl: p.avatarUrl,
    links: p.links,
    houseStyle: p.houseStyle,
  };
}

export function useNestIdentity() {
  const [account, setAccount] = useState<NestAccount | null>(null);
  const [profile, setProfile] = useState<IdentityProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  // Guards against a slow profile fetch resolving after sign-out and re-populating it.
  const generation = useRef(0);

  const loadProfile = useCallback(async (acct: NestAccount) => {
    const gen = ++generation.current;
    if (!isSupabase()) {
      migrateLocalWorkToAccount(acct.id, acct.email);
      setProfile(ensureNestProfile(acct.id, acct.email.split("@")[0]));
      return;
    }
    try {
      const p = await profileRepo.getProfile(acct.id);
      if (gen !== generation.current) return;
      setProfileError(null);
      // No row yet ⇒ a brand-new account that has not been through onboarding. We do NOT
      // invent a profile here: onboarding writes the row, so "no row" stays meaningful.
      setProfile(p ? toIdentityProfile(p) : null);
    } catch (e) {
      if (gen !== generation.current) return;
      // Loud, per D-10. A profile that cannot be read must not look like a profile that
      // does not exist — that would push a configured creator back into onboarding.
      setProfileError(e instanceof Error ? e.message : "Your profile could not be loaded.");
      setProfile(null);
    }
  }, []);

  const onAuthed = useCallback(
    (acct: NestAccount) => {
      setAccount(acct);
      void loadProfile(acct);
    },
    [loadProfile],
  );

  // Restore the session on mount (Supabase token or local session).
  useEffect(() => {
    let alive = true;
    getCurrentAccount()
      .then((acct) => {
        if (!alive) return;
        if (acct) onAuthed(acct);
        setLoading(false);
      })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [onAuthed]);

  // React to external auth changes (other tabs, Supabase refresh, sign-out).
  useEffect(() => {
    return onAccountChange(() => {
      void getCurrentAccount().then((acct) => {
        if (acct) onAuthed(acct);
        else { generation.current++; setAccount(null); setProfile(null); }
      });
    });
  }, [onAuthed]);

  // Local backend only: keep the profile fresh when the localStorage store changes.
  useEffect(() => {
    if (!account || isSupabase()) return;
    return onNestProfilesChanged(() => setProfile(getNestProfile(account.id)));
  }, [account]);

  const refreshProfile = useCallback(async () => {
    if (account) await loadProfile(account);
  }, [account, loadProfile]);

  const signUp = useCallback(
    async (email: string, password: string, name?: string): Promise<AuthResult> => {
      const r = await accountSignUp(email, password, name);
      if (r.ok) onAuthed(r.account);
      return r;
    },
    [onAuthed],
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const r = await accountSignIn(email, password);
      if (r.ok) onAuthed(r.account);
      return r;
    },
    [onAuthed],
  );

  /**
   * A real sign-out: end the Supabase session, then drop every cached trace of who was
   * signed in. Public content (published Nests) lives on the server and is untouched.
   */
  const signOut = useCallback(async () => {
    generation.current++;
    await accountSignOut();
    clearLocalSessionState();
    setAccount(null);
    setProfile(null);
    setProfileError(null);
  }, []);

  // ── Onboarding writes ──────────────────────────────────────────────────────

  /** Step 1 — display name + unique username, claimed against the server. */
  const saveIdentity = useCallback(
    async (displayName: string, username: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!account) return { ok: false, error: "Sign in first." };
      try {
        if (isSupabase()) {
          const p = await profileRepo.saveIdentity({ userId: account.id, displayName, username });
          setProfile(toIdentityProfile(p));
          return { ok: true };
        }
        const claim = claimUsernameStore(account.id, username);
        if (!claim.ok) return { ok: false, error: claim.error };
        setProfile(updateNestProfile(account.id, { displayName: displayName.trim() }));
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Could not save your identity." };
      }
    },
    [account],
  );

  /** Step 2 — the one house. */
  const saveHouse = useCallback(
    async (houseStyle: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!account) return { ok: false, error: "Sign in first." };
      try {
        if (isSupabase()) {
          const p = await profileRepo.saveHouseStyle(account.id, houseStyle);
          setProfile(toIdentityProfile(p));
          return { ok: true };
        }
        setProfile((prev) => (prev ? { ...prev, houseStyle } : prev));
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Could not save your house." };
      }
    },
    [account],
  );

  const claimUsername = useCallback(
    (username: string): ClaimResult => {
      if (!account) return { ok: false, error: "Sign in to claim a username." };
      const r = claimUsernameStore(account.id, username);
      if (r.ok) setProfile(r.profile);
      return r;
    },
    [account],
  );

  const updateProfile = useCallback(
    async (patch: Partial<Pick<IdentityProfile, "displayName" | "bio" | "avatarUrl" | "socials" | "links">>) => {
      if (!account) return;
      if (isSupabase()) {
        try {
          const p = await profileRepo.updateProfileFields(account.id, {
            displayName: patch.displayName,
            bio: patch.bio,
            avatarUrl: patch.avatarUrl,
            links: patch.links,
          });
          setProfile(toIdentityProfile(p));
        } catch (e) {
          setProfileError(e instanceof Error ? e.message : "Could not save your profile.");
        }
        return;
      }
      setProfile(updateNestProfile(account.id, patch));
    },
    [account],
  );

  const onboardingStep = profile
    ? profileRepo.nextOnboardingStep({
        id: profile.userId,
        displayName: profile.displayName ?? "",
        username: profile.username,
        houseStyle: profile.houseStyle,
      })
    : "identity";

  return {
    account,
    profile,
    loading,
    profileError,
    signedIn: !!account,
    ownerId: account?.id,
    /** True once we know the account is signed in but its profile is incomplete. */
    needsOnboarding: !loading && !!account && !profileError && onboardingStep !== null,
    onboardingStep,
    houseStyle: profile?.houseStyle,
    signUp,
    signIn,
    signOut,
    saveIdentity,
    saveHouse,
    claimUsername,
    updateProfile,
    refreshProfile,
  };
}

export type { NestSocials, ProfileLink };
