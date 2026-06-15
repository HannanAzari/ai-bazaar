"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getAuthClient } from "@/lib/auth";
import type { AuthClient, AuthCredentials, SessionUser, SignUpInput } from "@/lib/auth/types";
import { getRepositories } from "@/lib/repos";

// The unified session provider. Mode-aware (demo localStorage vs Supabase Auth),
// it owns the single source of truth for "who is signed in". DemoProvider reads
// from it so every existing `useDemo().user` consumer keeps working unchanged.

type SessionContextValue = {
  user: SessionUser | null;
  loading: boolean;
  signUp: (input: SignUpInput) => Promise<SessionUser>;
  signIn: (input: AuthCredentials) => Promise<SessionUser>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const clientRef = useRef<AuthClient | null>(null);

  if (!clientRef.current) clientRef.current = getAuthClient();
  const client = clientRef.current;

  // Best-effort profile creation on first sign-in. No-op-safe in demo mode.
  const ensureProfile = async (next: SessionUser | null) => {
    if (!next) return;
    try {
      await getRepositories().profiles.ensureProfile(next);
    } catch {
      // Profile bootstrap is non-fatal for the session.
    }
  };

  useEffect(() => {
    let active = true;
    client
      .getInitialUser()
      .then((u) => {
        if (!active) return;
        setUser(u);
        setLoading(false);
        void ensureProfile(u);
      })
      .catch(() => active && setLoading(false));
    const unsub = client.subscribe?.((u) => {
      setUser(u);
      void ensureProfile(u);
    });
    return () => {
      active = false;
      unsub?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      loading,
      signUp: async (input) => {
        const u = await client.signUp(input);
        setUser(u);
        await ensureProfile(u);
        return u;
      },
      signIn: async (input) => {
        const u = await client.signIn(input);
        setUser(u);
        await ensureProfile(u);
        return u;
      },
      signOut: async () => {
        await client.signOut();
        setUser(null);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, loading],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside AuthProvider");
  return value;
}
