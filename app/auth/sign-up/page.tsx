"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Mail, Sparkles, UserRound } from "lucide-react";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import { isDemoMode } from "@/lib/runtime-mode";
import { trackEvent } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { AuthEnvironmentNotice } from "@/components/auth/auth-environment-notice";
import { nestBackend } from "@/lib/nest-repo";
import { authDiagnostics, describeAuthTarget } from "@/lib/supabase/project-info";

export default function SignUpPage() {
  const router = useRouter();
  // ONE client auth layer — same hook the header, editor, profile and studios use.
  const { signUp } = useNestIdentity();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    // HOTFIX (M23B.1): same discipline as the login form — one request at a time, and the
    // button always leaves its loading state via `finally`, whatever happens.
    if (inFlight.current) return;
    inFlight.current = true;
    setError(""); setNotice("");
    setBusy(true);
    try {
      const r = await signUp(email, password, name);
      if (r.ok) {
        // HOTFIX (M23B.2): do NOT report success or continue unless the account was
        // genuinely created in Supabase. `backend === "local"` means it went to
        // localStorage — which is exactly how a founder ended up on the onboarding screen
        // for an account that did not exist in Authentication → Users.
        if (r.backend !== "supabase" && authDiagnostics(nestBackend()).hasUrl) {
          console.error("[sign-up] refused to continue:", describeAuthTarget(authDiagnostics(nestBackend())));
          setError(
            "Your account was not saved to Supabase, so we haven't signed you in. " +
              "This deployment is misconfigured — please tell the Nestudio team.",
          );
          return;
        }
        trackEvent("signup_completed");
        // M23B: a new account has no name, handle or house yet — send them to onboarding,
        // never straight to Home or the editor. Onboarding forwards to /profile when done,
        // and bounces anyone already configured straight back out.
        router.push("/onboarding");
        return;
      }
      // With email confirmation ON, sign-up succeeds but returns no session.
      if ("needsConfirmation" in r) setNotice("Check your email to confirm your account, then sign in.");
      else setError(r.error);
    } catch (e) {
      console.error("[sign-up] failed:", e);
      setError(e instanceof Error ? e.message : "Something went wrong creating your account. Please try again.");
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  };

  return (
    <section className="shell grid min-h-[calc(100vh-4rem)] place-items-center py-12">
      <div className="card w-full max-w-md rounded-[2.5rem] p-7 sm:p-9">
        <span className="grid size-12 place-items-center rounded-2xl bg-teal text-white"><Sparkles size={22} /></span>
        <p className="mt-7 text-xs font-black uppercase tracking-[.2em] text-teal">Nestudio</p>
        <h1 className="display mt-2 text-4xl">Create your Nest.</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink/50">Make your account, then step into a space that feels like you.</p>
        <AuthEnvironmentNotice className="mt-5" />
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-bold">Display name</span>
            <span className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4"><UserRound size={18} className="text-ink/30" /><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" className="min-h-14 w-full bg-transparent outline-none" /></span>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold">Email</span>
            <span className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4"><Mail size={18} className="text-ink/30" /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="min-h-14 w-full bg-transparent outline-none" /></span>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold">Password</span>
            <input required={!isDemoMode()} type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isDemoMode() ? "Not needed in demo" : "At least 8 characters"} className="min-h-14 w-full rounded-2xl border border-ink/10 bg-white px-4 outline-none" />
          </label>
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-terracotta">{error}</p>}
          {notice && <p className="rounded-xl bg-teal/10 px-3 py-2 text-sm font-bold text-teal">{notice}</p>}
          <Button type="submit" variant="accent" className="w-full" disabled={busy}>{busy ? "Creating…" : "Create account"} <ArrowRight size={18} /></Button>
        </form>
        <p className="mt-6 text-center text-sm text-ink/45">Already have an account? <Link href="/auth/login" className="font-bold text-teal">Log in</Link></p>
      </div>
    </section>
  );
}
