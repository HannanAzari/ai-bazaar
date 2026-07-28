"use client";

import { AlertTriangle, Database } from "lucide-react";
import { nestBackend } from "@/lib/nest-repo";
import { authDiagnostics } from "@/lib/supabase/project-info";

// ── HOTFIX M23B.2 — you can always see where your account is going ───────────
//
// The founder created an account, the app said success, and the user was not in
// Supabase Authentication → Users. The deployment had quietly fallen back to the
// localStorage demo backend and NOTHING on screen said so.
//
// Every auth surface now renders this. It has three states, and the important one is the
// middle: a build that is SUPPOSED to be real but is not.

export function AuthEnvironmentNotice({ className = "" }: { className?: string }) {
  const backend = nestBackend();
  const d = authDiagnostics(backend);

  // 1. Misconfiguration: Supabase env is present but something forces local. Accounts
  //    would be written to this browser and never reach the project. Say so, loudly, in
  //    every environment — this must never be a silent state again.
  if (backend === "local" && d.hasUrl) {
    return (
      <div className={`flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 ${className}`}>
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600" />
        <p className="text-[12px] leading-snug text-rose-900">
          <strong className="font-black">Accounts are not being saved to Supabase.</strong> This build is
          forced to the local demo backend (<code>NEXT_PUBLIC_NEST_BACKEND={String(d.configuredBackend)}</code>)
          even though project <code>{d.projectRef}</code> is configured. Anything you create here stays in
          this browser.
        </p>
      </div>
    );
  }

  // 2. Genuinely unconfigured (local dev with no env, or a Preview missing its variables
  //    at BUILD time). Demo mode is legitimate here, but it must be unmistakable.
  if (backend === "local") {
    return (
      <div className={`flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 ${className}`}>
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
        <p className="text-[12px] leading-snug text-amber-900">
          <strong className="font-black">Demo mode.</strong> <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> were missing when this build was made, so accounts are
          stored in this browser only and will <strong>not</strong> appear in Supabase. Set them for this
          environment and redeploy — a restart is not enough.
        </p>
      </div>
    );
  }

  // 3. Real. In development we still name the project, so "which database am I on?" is
  //    never a guess. Hidden in production: correct behaviour needs no annotation.
  if (process.env.NODE_ENV === "production") return null;
  return (
    <p className={`flex items-center gap-1.5 text-[11px] font-medium text-ink/40 ${className}`}>
      <Database className="size-3" /> Supabase project <code className="font-bold">{d.projectRef}</code>
    </p>
  );
}
