import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

// ── ONE browser client per tab ───────────────────────────────────────────────
//
// HOTFIX (M23B.1): this used to call `createBrowserClient(url, key)` on EVERY
// invocation, and callers invoke it constantly — `nest-account.ts` builds a fresh
// `SupabaseAuthClient` for every auth operation, every repo module calls `sb()` per
// query, and `useNestIdentity` subscribes through yet another one.
//
// Each of those constructs a separate GoTrueClient over the SAME storage key, and
// supabase-js serialises token access with a Web Lock named
// `lock:sb-<project-ref>-auth-token`. With N clients you get N contenders for one lock.
// Observed live during the repro: the lock was held continuously with 3–9 pending
// waiters and `signInWithPassword` never resolved. That is the frozen "Signing in…".
//
// Memoising fixes it at the source: one GoTrueClient, one lock holder, no queue. It also
// silences the "Multiple GoTrueClient instances detected" warning that was pointing at
// this the whole time.
//
// Keyed by url+key so a config change in dev (HMR) rebuilds rather than handing back a
// client pointed at the wrong project.

let cached: { key: string; client: SupabaseClient } | null = null;

export function createSupabaseBrowserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const cacheKey = `${url}::${key}`;
  if (cached && cached.key === cacheKey) return cached.client;

  const client = createBrowserClient(url, key);
  cached = { key: cacheKey, client };
  return client;
}
