"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Mail, Sparkles, UserRound } from "lucide-react";
import { useDemo } from "@/components/providers/demo-provider";
import { Button } from "@/components/ui/button";

export default function SignUpPage() {
  const router = useRouter();
  const { login } = useDemo();
  const [email, setEmail] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login(email);
    router.push("/bazaar");
  };

  return (
    <section className="shell grid min-h-[calc(100vh-4rem)] place-items-center py-12">
      <div className="card w-full max-w-md rounded-[2.5rem] p-7 sm:p-9">
        <span className="grid size-12 place-items-center rounded-2xl bg-teal text-white"><Sparkles size={22} /></span>
        <p className="mt-7 text-xs font-black uppercase tracking-[.2em] text-teal">Your invitation</p>
        <h1 className="display mt-2 text-4xl">Join the bazaar.</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink/50">Create your profile, then choose one open village door to call your own.</p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-bold">Display name</span>
            <span className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4"><UserRound size={18} className="text-ink/30" /><input required placeholder="Your name" className="min-h-14 w-full bg-transparent outline-none" /></span>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold">Email</span>
            <span className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4"><Mail size={18} className="text-ink/30" /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="min-h-14 w-full bg-transparent outline-none" /></span>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold">Password</span>
            <input required type="password" minLength={6} placeholder="At least 6 characters" className="min-h-14 w-full rounded-2xl border border-ink/10 bg-white px-4 outline-none" />
          </label>
          <Button type="submit" variant="accent" className="w-full">Create account <ArrowRight size={18} /></Button>
        </form>
        <p className="mt-6 text-center text-sm text-ink/45">Already have a key? <Link href="/auth/login" className="font-bold text-teal">Log in</Link></p>
      </div>
    </section>
  );
}
