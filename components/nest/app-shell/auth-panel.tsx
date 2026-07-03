"use client";

import { useState } from "react";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";

// M16 — a small email sign-up / sign-in panel (real Nest account). Shared by the
// Profile guest state and the publish gate so identity is claimed the same way
// everywhere. Handles the Supabase "confirm your email" case gracefully.
export function AuthPanel({ onAuthed, intro }: { onAuthed?: () => void; intro?: string }) {
  const { signUp, signIn } = useNestIdentity();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    const r = mode === "signup" ? await signUp(email, password) : await signIn(email, password);
    setBusy(false);
    if (r.ok) { onAuthed?.(); return; }
    if ("needsConfirmation" in r) { setNotice(r.error); return; }
    setError(r.error);
  }

  return (
    <div className="space-y-3">
      {intro ? <p className="text-sm text-ink/55">{intro}</p> : null}
      <div className="flex rounded-full bg-parchment p-1 text-sm font-bold">
        <button onClick={() => { setMode("signup"); setError(undefined); setNotice(undefined); }} className={`flex-1 rounded-full py-1.5 transition ${mode === "signup" ? "bg-white text-ink shadow-soft" : "text-ink/50"}`}>Sign up</button>
        <button onClick={() => { setMode("signin"); setError(undefined); setNotice(undefined); }} className={`flex-1 rounded-full py-1.5 transition ${mode === "signin" ? "bg-white text-ink shadow-soft" : "text-ink/50"}`}>Sign in</button>
      </div>
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@email.com" aria-label="Email" autoComplete="email" style={{ fontSize: 16 }} className="w-full rounded-xl border border-timber/20 bg-white px-3 py-2.5 outline-none" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password (8+ characters)" aria-label="Password" autoComplete={mode === "signup" ? "new-password" : "current-password"} style={{ fontSize: 16 }} className="w-full rounded-xl border border-timber/20 bg-white px-3 py-2.5 outline-none" />
      <button onClick={submit} disabled={busy || !email || !password} className="w-full rounded-xl bg-terracotta px-4 py-3 text-sm font-bold text-parchment disabled:opacity-50">
        {busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}
      </button>
      {error ? <p className="text-center text-xs font-bold text-terracotta">{error}</p> : null}
      {notice ? <p className="rounded-xl bg-[#e7efe3] px-3 py-2 text-center text-xs font-bold text-[#4d7358]">{notice}</p> : null}
    </div>
  );
}
