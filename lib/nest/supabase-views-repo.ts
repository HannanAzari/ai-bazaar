// ── M24 §2 — Views, persisted and deduplicated ───────────────────────────────
//
// View counts were localStorage-only, so they were per-browser and read 0 for everyone
// else. These are the shared counters, backed by `nest_views` / `profile_views`
// (supabase/provision/m24_views_provision.sql).
//
// The dedup rule — one view per viewer per Nest per UTC day — is enforced by a unique
// index, so recording a view is a single atomic `insert … on conflict do nothing`. No
// read-then-write, so two tabs opening the same Nest cannot both count.
//
// This module is deliberately quiet: a view counter must never break a page or block a
// render. Failures are logged in development and swallowed otherwise.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const ANON_KEY_STORAGE = "nestudio:viewer-key:v1";

function sb(): SupabaseClient | null {
  return createSupabaseBrowserClient();
}

function quietly(op: string, error: unknown): void {
  if (process.env.NODE_ENV !== "production") console.warn(`[views] ${op}:`, error);
}

/**
 * A stable, privacy-safe id for an anonymous viewer.
 *
 * Random and stored in this browser only. It is NOT an IP address, a fingerprint, or
 * anything derived from the person — it exists solely so the same browser doesn't count
 * twice in a day, and it disappears when they clear site data.
 */
export function anonymousViewerKey(): string {
  if (typeof window === "undefined") return "server";
  try {
    const existing = window.localStorage.getItem(ANON_KEY_STORAGE);
    if (existing) return existing;
    const key = `anon-${crypto.randomUUID()}`;
    window.localStorage.setItem(ANON_KEY_STORAGE, key);
    return key;
  } catch {
    // Private mode with storage disabled: fall back to a per-session key. The viewer may
    // count once per page load rather than once per day, which is the harmless direction.
    return `anon-ephemeral-${Math.random().toString(36).slice(2)}`;
  }
}

/** The signed-in user's id, or the anonymous browser key. */
export function viewerKey(userId?: string): string {
  return userId ?? anonymousViewerKey();
}

// ── Nest views ───────────────────────────────────────────────────────────────

/**
 * Record one view of a published Nest.
 *
 * Returns true when a NEW row was written (i.e. this viewer had not already been counted
 * today), so the caller can bump its cached count without a refetch.
 */
export async function recordNestView(nestSlug: string, userId?: string): Promise<boolean> {
  const client = sb();
  if (!client || !nestSlug) return false;
  const { data, error } = await client
    .from("nest_views")
    .insert({ nest_slug: nestSlug, viewer_key: viewerKey(userId) })
    .select("id");
  if (error) {
    // 23505 = the unique index doing its job: already counted today. Not a failure.
    if ((error as { code?: string }).code !== "23505") quietly("recordNestView", error);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

export async function nestViewCount(nestSlug: string): Promise<number> {
  const client = sb();
  if (!client) return 0;
  const { count, error } = await client
    .from("nest_views")
    .select("id", { count: "exact", head: true })
    .eq("nest_slug", nestSlug);
  if (error) { quietly("nestViewCount", error); return 0; }
  return count ?? 0;
}

/** Total views across a set of the creator's Nests — the number shown on their Profile. */
export async function viewCountForSlugs(slugs: string[]): Promise<number> {
  const client = sb();
  if (!client || slugs.length === 0) return 0;
  const { count, error } = await client
    .from("nest_views")
    .select("id", { count: "exact", head: true })
    .in("nest_slug", slugs);
  if (error) { quietly("viewCountForSlugs", error); return 0; }
  return count ?? 0;
}

// ── Profile / House views ────────────────────────────────────────────────────

/**
 * Record a view of a creator's Profile or House.
 *
 * The owner viewing their own Profile is excluded here rather than at the call site, so
 * every current and future entry point inherits the rule.
 */
export async function recordProfileView(profileId: string, viewerId?: string): Promise<boolean> {
  const client = sb();
  if (!client || !profileId) return false;
  if (viewerId && viewerId === profileId) return false; // never count your own
  const { data, error } = await client
    .from("profile_views")
    .insert({ profile_id: profileId, viewer_key: viewerKey(viewerId) })
    .select("id");
  if (error) {
    if ((error as { code?: string }).code !== "23505") quietly("recordProfileView", error);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

export async function profileViewCount(profileId: string): Promise<number> {
  const client = sb();
  if (!client || !profileId) return 0;
  const { count, error } = await client
    .from("profile_views")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId);
  if (error) { quietly("profileViewCount", error); return 0; }
  return count ?? 0;
}
