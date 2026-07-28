// ── Which Supabase project is this build actually talking to? ────────────────
//
// HOTFIX (M23B.2): a founder created an account through the UI, the app reported
// success, and the user did not exist in Supabase Authentication → Users. The cause was
// not a failing request — it was that the app never sent one, because the deployment had
// silently fallen back to the localStorage demo backend. Nothing on screen said so.
//
// You cannot debug that without knowing, at a glance, WHICH project a running build is
// pointed at. These helpers are that answer, and they are safe to show and log: the
// project ref is part of the public API URL and the anon key is never included.

/** e.g. "https://srrmkdsvldlyllsxyhtq.supabase.co" → "srrmkdsvldlyllsxyhtq". */
export function supabaseProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  const host = url.replace(/^https?:\/\//, "").split("/")[0];
  const ref = host.split(".")[0];
  return ref || null;
}

/** e.g. "srrmkdsvldlyllsxyhtq.supabase.co". Null when unconfigured. */
export function supabaseHost(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  return url.replace(/^https?:\/\//, "").split("/")[0] || null;
}

/** Were BOTH public Supabase vars inlined at build time? */
export function hasSupabaseEnv(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export type AuthDiagnostics = {
  /** The project this build will authenticate against, or null if unconfigured. */
  projectRef: string | null;
  host: string | null;
  /** Raw value of NEXT_PUBLIC_NEST_BACKEND — `null` when it was never set. */
  configuredBackend: string | null;
  /** What the app will ACTUALLY do, after resolution. */
  resolvedBackend: "local" | "supabase";
  hasUrl: boolean;
  hasAnonKey: boolean;
};

/**
 * One object describing exactly where auth will go. Logged on every sign-up/sign-in in
 * development, returned by /api/auth/whoami, and rendered on the auth screens in dev.
 *
 * `resolvedBackend` is deliberately separate from `configuredBackend`: the bug was that
 * those two could disagree and nothing surfaced it.
 */
export function authDiagnostics(resolvedBackend: "local" | "supabase"): AuthDiagnostics {
  return {
    projectRef: supabaseProjectRef(),
    host: supabaseHost(),
    configuredBackend: process.env.NEXT_PUBLIC_NEST_BACKEND ?? null,
    resolvedBackend,
    hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  };
}

/** A one-line, log-safe summary. No keys, no tokens. */
export function describeAuthTarget(d: AuthDiagnostics): string {
  if (d.resolvedBackend === "local") {
    return d.hasUrl
      ? `LOCAL demo backend (localStorage) — Supabase IS configured (${d.host}) but NEXT_PUBLIC_NEST_BACKEND="${d.configuredBackend}" forces local. Accounts will NOT reach Supabase.`
      : `LOCAL demo backend (localStorage) — NEXT_PUBLIC_SUPABASE_URL/ANON_KEY were missing at BUILD time. Accounts will NOT reach Supabase.`;
  }
  return `Supabase project ${d.projectRef} (${d.host})`;
}
