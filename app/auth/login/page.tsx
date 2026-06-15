"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, KeyRound, Mail, Store } from "lucide-react";
import { useSession } from "@/components/providers/auth-provider";
import { isDemoMode } from "@/lib/runtime-mode";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn({ email, password });
      router.push("/studio");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
      setBusy(false);
    }
  };

  return (
    <section className="shell grid min-h-[calc(100vh-4rem)] place-items-center py-12">
      <div className="card w-full max-w-md rounded-[2.5rem] p-7 sm:p-9">
        <span className="grid size-12 place-items-center rounded-2xl bg-terracotta text-white"><Store size={22} /></span>
        <p className="mt-7 text-xs font-black uppercase tracking-[.2em] text-terracotta">Welcome back</p>
        <h1 className="display mt-2 text-4xl">Open your village door.</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink/50">{isDemoMode() ? "Demo mode: any email signs you in locally (no password needed)." : "Sign in with your email and password."}</p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-bold">Email</span>
            <span className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4">
              <Mail size={18} className="text-ink/30" />
              <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="h-13 min-h-14 w-full bg-transparent outline-none" />
            </span>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold">Password</span>
            <span className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4">
              <KeyRound size={18} className="text-ink/30" />
              <input required={!isDemoMode()} type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isDemoMode() ? "Not needed in demo" : "At least 6 characters"} className="h-13 min-h-14 w-full bg-transparent outline-none" />
            </span>
          </label>
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-terracotta">{error}</p>}
          <Button type="submit" variant="accent" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Log in"} <ArrowRight size={18} /></Button>
        </form>
        <p className="mt-6 text-center text-sm text-ink/45">New to the bazaar? <Link href="/auth/sign-up" className="font-bold text-teal">Claim your invitation</Link></p>
      </div>
    </section>
  );
}
