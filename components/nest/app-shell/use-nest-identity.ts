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
import { BOOTSTRAP_TIMEOUT_MS, isTimeoutError, withTimeout } from "@/lib/with-timeout";
import type { BootstrapState } from "@/lib/auth/post-sign-in-route";

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

/**
 * What `signIn` resolves to. Authentication and bootstrap are separate outcomes: `ok:true`
 * means the session exists, and `bootstrap` says whether the profile behind it loaded.
 */
export type SignInOutcome =
  | (Extract<AuthResult, { ok: true }> & { bootstrap: BootstrapState })
  | Extract<AuthResult, { ok: false }>;

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
  // `true` once bootstrap has SETTLED for the current account — the difference between
  // "no profile" and "we don't know yet", which is what the redirect loop conflated.
  const [profileLoaded, setProfileLoaded] = useState(false);
  // Guards against a slow profile fetch resolving after sign-out and re-populating it.
  const generation = useRef(0);
  const lastAccountId = useRef<string | null>(null);

  const loadProfile = useCallback(async (acct: NestAccount): Promise<BootstrapState> => {
    const gen = ++generation.current;
    if (!isSupabase()) {
      migrateLocalWorkToAccount(acct.id, acct.email);
      const local = ensureNestProfile(acct.id, acct.email.split("@")[0]);
      setProfile(local);
      setProfileLoaded(true);
      return {
        status: "ready",
        profile: { id: local.userId, displayName: local.displayName ?? "", username: local.username },
      };
    }
    setProfileLoaded(false);
    try {
      // HOTFIX (M23B.1): bounded. A bootstrap query that never settles used to leave the
      // whole app — and the sign-in button — spinning with no way out.
      const p = await withTimeout(profileRepo.getProfile(acct.id), BOOTSTRAP_TIMEOUT_MS, "Loading your profile");
      if (gen !== generation.current) return { status: "loading" };
      setProfileError(null);
      // No row yet ⇒ a brand-new account that has not been through onboarding. We do NOT
      // invent a profile here: onboarding writes the row, so "no row" stays meaningful.
      setProfile(p ? toIdentityProfile(p) : null);
      return { status: "ready", profile: p };
    } catch (e) {
      if (gen !== generation.current) return { status: "loading" };
      // Loud, per D-10. A profile that cannot be READ must not look like a profile that
      // does not EXIST — that would push a configured creator back into onboarding.
      const message = isTimeoutError(e)
        ? "Loading your profile is taking longer than expected."
        : e instanceof Error
          ? e.message
          : "Your profile could not be loaded.";
      setProfileError(message);
      setProfile(null);
      return { status: "error", message };
    } finally {
      // Always — this is what guarantees the UI leaves its loading state.
      if (gen === generation.current) setProfileLoaded(true);
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
        if (acct) { lastAccountId.current = acct.id; onAuthed(acct); }
        else setProfileLoaded(true);
        setLoading(false);
      })
      .catch(() => { if (alive) { setProfileLoaded(true); setLoading(false); } });
    return () => { alive = false; };
  }, [onAuthed]);

  // React to external auth changes (other tabs, Supabase token refresh, sign-out).
  //
  // HOTFIX (M23B.1): the callback now RECEIVES the account. It used to call
  // `getCurrentAccount()` — i.e. call back into Supabase from inside `onAuthStateChange`,
  // which supabase-js dispatches while holding the auth lock. That deadlocked, and it is
  // the reason sign-in never returned.
  //
  // It also ignores events for the account we already have. Supabase emits INITIAL_SESSION
  // and periodic TOKEN_REFRESHED; re-running bootstrap on each of those re-queried the
  // profile forever.
  useEffect(() => {
    return onAccountChange((acct) => {
      if (acct) {
        if (lastAccountId.current === acct.id) return; // same user, nothing to re-bootstrap
        lastAccountId.current = acct.id;
        onAuthed(acct);
      } else {
        generation.current++;
        lastAccountId.current = null;
        setAccount(null);
        setProfile(null);
        setProfileLoaded(true);
      }
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
      if (r.ok) { lastAccountId.current = r.account.id; setAccount(r.account); await loadProfile(r.account); }
      return r;
    },
    [loadProfile],
  );

  /**
   * Authenticate, then bootstrap — as two distinct, awaited steps.
   *
   * The caller gets `{ ok: true }` only once the session exists, and can then read
   * `profile` / `profileError` to decide where to go. Bootstrap failure is NOT reported as
   * an auth failure: `ok` stays true and the profile error is surfaced separately, so a
   * signed-in creator is never told their password was wrong because a table was missing.
   */
  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInOutcome> => {
      const r = await accountSignIn(email, password);
      if (!r.ok) return r;
      lastAccountId.current = r.account.id;
      setAccount(r.account);
      // Awaited (and internally bounded) so the caller routes on a SETTLED state rather
      // than racing a redirect against a query that has not come back. The bootstrap is
      // returned rather than read from React state, which the caller cannot see yet.
      const bootstrapResult = await loadProfile(r.account);
      return { ...r, bootstrap: bootstrapResult };
    },
    [loadProfile],
  );

  /**
   * A real sign-out: end the Supabase session, then drop every cached trace of who was
   * signed in. Public content (published Nests) lives on the server and is untouched.
   */
  const signOut = useCallback(async () => {
    generation.current++;
    lastAccountId.current = null;
    await accountSignOut();
    clearLocalSessionState();
    setAccount(null);
    setProfile(null);
    setProfileError(null);
    setProfileLoaded(true);
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

  /**
   * Retry bootstrap after a failure, WITHOUT re-authenticating. The valid session is
   * preserved — a profile query that failed is not a reason to throw away a good login.
   */
  const retryBootstrap = useCallback(async (): Promise<BootstrapState> => {
    if (!account) return { status: "loading" };
    return loadProfile(account);
  }, [account, loadProfile]);

  // The single object every screen reads to decide what to render/route (see
  // lib/auth/post-sign-in-route.ts). Distinguishing "loading" from "error" from "ready
  // with no profile" is what stopped /profile and /onboarding fighting each other.
  const bootstrap: BootstrapState = !account || loading || !profileLoaded
    ? { status: "loading" }
    : profileError
      ? { status: "error", message: profileError }
      : {
          status: "ready",
          profile: profile
            ? {
                id: profile.userId,
                displayName: profile.displayName ?? "",
                username: profile.username,
                houseStyle: profile.houseStyle,
              }
            : null,
        };

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
    bootstrap,
    profileLoaded,
    retryBootstrap,
    /** True once bootstrap has SETTLED and the profile is genuinely incomplete. */
    needsOnboarding: bootstrap.status === "ready" && onboardingStep !== null,
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
