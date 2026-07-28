"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Home, KeyRound, Loader2, Mail, TriangleAlert } from "lucide-react";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import { isDemoMode } from "@/lib/runtime-mode";
import { createSignInFlow, type SignInFlowResult } from "@/lib/auth/sign-in-flow";
import { Button } from "@/components/ui/button";

// ── HOTFIX M23B.1 — the button always leaves its loading state ───────────────
//
// This form used to do:
//
//     setBusy(true);
//     const r = await signIn(email, password);
//     if (!r.ok) { setError(r.error); setBusy(false); return; }
//     router.push(...)
//
// Three ways that freezes, all of which were happening:
//   1. `signIn` never settling (supabase-js queued behind its own auth lock) — nothing
//      after the `await` ever runs, so `busy` stays true forever with no error shown.
//   2. Any throw — there was no try/catch at all, so a rejection left `busy` stuck true.
//   3. `router.push` failing or being a no-op — `busy` was only ever cleared on the
//      failure branch, so success-then-no-navigation is also a permanent spinner.
//
// It is now `try / catch / finally` around the whole flow, with the reset in `finally`
// and NOT dependent on navigation succeeding. Authentication and bootstrap are handled as
// separate outcomes so a missing table can never be reported as a bad password.

export default function LoginPage() {
  const router = useRouter();
  // ONE client auth layer — the same hook the header, editor, profile and studios use.
  const { signIn, signOut, retryBootstrap } = useNestIdentity();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The whole flow lives in lib/auth/sign-in-flow.ts — dependency-injected and unit
  // tested, because "the button always stops spinning" is not something you can assert
  // from inside a component. This page only renders what the flow reports.
  const flow = useRef(createSignInFlow()).current;

  const deps = () => ({
    navigate: (to: string) => router.push(to),
    onBusy: setBusy,
    returnTo: typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") : null,
  });

  /** Render whatever the flow reported. `navigated` and `ignored-duplicate` need no UI. */
  const apply = (result: SignInFlowResult) => {
    if (result.kind === "auth-error" || result.kind === "unexpected-error") setError(result.message);
    else if (result.kind === "bootstrap-error") setBootstrapError(result.message);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBootstrapError(null);
    apply(await flow.submit(email, password, { signIn, ...deps() }));
  };

  const retry = async () => {
    apply(await flow.retry(retryBootstrap, deps()));
  };

  // ── Signed in, but bootstrap failed ────────────────────────────────────────
  // Truthful and recoverable: the session is real, so we say so, offer Retry, and offer
  // Sign out as the way back rather than stranding them.
  if (bootstrapError) {
    return (
      <section className="shell grid min-h-[calc(100vh-4rem)] place-items-center py-12">
        <div className="card w-full max-w-md rounded-[2.5rem] p-7 sm:p-9">
          <span className="grid size-12 place-items-center rounded-2xl bg-rose-100 text-rose-600"><TriangleAlert size={22} /></span>
          <h1 className="display mt-6 text-3xl">Almost there.</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink/60">
            You&rsquo;re signed in, but we couldn&rsquo;t load your Nestudio profile. Please try again.
          </p>
          <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{bootstrapError}</p>
          <div className="mt-6 space-y-2">
            <Button onClick={retry} variant="accent" className="w-full" disabled={busy}>
              {busy ? <><Loader2 size={16} className="animate-spin" /> Retrying…</> : <>Try again <ArrowRight size={18} /></>}
            </Button>
            <button
              onClick={async () => { await signOut(); setBootstrapError(null); }}
              className="min-h-[44px] w-full rounded-2xl border border-ink/10 text-sm font-bold text-ink/60"
            >
              Sign out
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="shell grid min-h-[calc(100vh-4rem)] place-items-center py-12">
      <div className="card w-full max-w-md rounded-[2.5rem] p-7 sm:p-9">
        <span className="grid size-12 place-items-center rounded-2xl bg-terracotta text-white"><Home size={22} /></span>
        <p className="mt-7 text-xs font-black uppercase tracking-[.2em] text-terracotta">Nestudio</p>
        <h1 className="display mt-2 text-4xl">Welcome back to your Nest.</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink/50">{isDemoMode() ? "Demo mode: any email signs you in locally (no password needed)." : "Sign in with your email and password."}</p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-bold">Email</span>
            <span className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4">
              <Mail size={18} className="text-ink/30" />
              <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} placeholder="you@example.com" className="h-13 min-h-14 w-full bg-transparent outline-none disabled:opacity-60" />
            </span>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold">Password</span>
            <span className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4">
              <KeyRound size={18} className="text-ink/30" />
              <input required={!isDemoMode()} type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} placeholder={isDemoMode() ? "Not needed in demo" : "At least 8 characters"} className="h-13 min-h-14 w-full bg-transparent outline-none disabled:opacity-60" />
            </span>
          </label>
          {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-terracotta">{error}</p>}
          <Button type="submit" variant="accent" className="w-full" disabled={busy}>
            {busy ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : <>Log in <ArrowRight size={18} /></>}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-ink/45">New to Nestudio? <Link href="/auth/sign-up" className="font-bold text-teal">Create your account</Link></p>
      </div>
    </section>
  );
}
