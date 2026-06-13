// Runtime backend mode. AI Bazaar runs as a localStorage **demo** until the
// Supabase env vars are present, at which point it is configured for a
// **production** backend. This is the single source of truth other layers
// (e.g. the repository factory in lib/repos) read to choose an implementation.
//
// As with lib/flags.ts, Next inlines NEXT_PUBLIC_* at build time, so the lookups
// use the full literal keys rather than a computed `process.env[name]`.

export type RuntimeMode = "demo" | "production";

/** Whether both public Supabase env vars are configured. */
export function hasSupabaseEnv(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return !!url && !!key;
}

/** "production" when Supabase is configured, else "demo". */
export function getRuntimeMode(): RuntimeMode {
  return hasSupabaseEnv() ? "production" : "demo";
}

export function isProductionBackend(): boolean {
  return getRuntimeMode() === "production";
}

export function isDemoMode(): boolean {
  return getRuntimeMode() === "demo";
}

/** Short label for the dev-only badge. */
export function runtimeModeLabel(mode: RuntimeMode = getRuntimeMode()): string {
  return mode === "production" ? "LIVE · Supabase" : "DEMO · localStorage";
}
