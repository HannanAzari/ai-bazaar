"use client";

import { useCallback, useEffect, useState } from "react";
import { getNestSession, localSignUp, type NestSession } from "@/lib/nest-auth";
import { nestBackend } from "@/lib/nest-repo";
import {
  claimUsername as claimUsernameStore,
  ensureNestProfile,
  getNestProfile,
  onNestProfilesChanged,
  updateNestProfile,
  type ClaimResult,
  type NestProfile,
} from "@/lib/nest-profile-store";

// One hook the app shell (Home · Create · profile · /@handle) reads to answer
// "who is signed in, and what's their Nest identity". It joins the nest-auth
// session with the local nest-profile store and keeps them in sync.
export function useNestIdentity() {
  const [session, setSession] = useState<NestSession | null>(null);
  const [profile, setProfile] = useState<NestProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getNestSession().then((s) => {
      if (!alive) return;
      setSession(s);
      if (s && !s.isGuest) setProfile(ensureNestProfile(s.userId, s.username));
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Reflect external profile edits (e.g. another tab, or the claim flow).
  useEffect(() => {
    if (!session || session.isGuest) return;
    const sync = () => setProfile(getNestProfile(session.userId));
    return onNestProfilesChanged(sync);
  }, [session]);

  const claimUsername = useCallback(
    (username: string): ClaimResult => {
      if (!session) return { ok: false, error: "Sign in to claim a username." };
      const r = claimUsernameStore(session.userId, username);
      if (r.ok) setProfile(r.profile);
      return r;
    },
    [session],
  );

  const updateProfile = useCallback(
    (patch: Partial<Pick<NestProfile, "displayName" | "bio" | "avatarUrl">>) => {
      if (!session) return;
      setProfile(updateNestProfile(session.userId, patch));
    },
    [session],
  );

  // Guest → signed-in on the local backend: claim a username without leaving Home.
  // (On the Supabase backend, identity is created through the publish gate's real
  // sign-up, so this is intentionally local-only.)
  const startLocalIdentity = useCallback((username: string): ClaimResult => {
    if (nestBackend() !== "local") return { ok: false, error: "Sign up from the editor to publish." };
    const s = localSignUp(username);
    const r = claimUsernameStore(s.userId, username);
    if (r.ok) {
      setSession({ userId: s.userId, username: r.profile.username, isGuest: false });
      setProfile(r.profile);
    }
    return r;
  }, []);

  const signedIn = !!session && !session.isGuest;
  return { session, profile, loading, signedIn, claimUsername, updateProfile, startLocalIdentity };
}
