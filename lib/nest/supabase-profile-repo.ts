// ── M23B — Supabase profile repository ───────────────────────────────────────
//
// A creator's public identity: display name, unique username, bio, avatar, and the ONE
// house style they selected during onboarding. This is what makes a normal user
// discoverable by a different account — `profiles` is world-readable, so Search can
// find people who have never shared a link with you.
//
// Username rules (normalisation, length, reserved words) are NOT duplicated here: they
// live in lib/nest-profile-store.ts and are imported, so the local demo path and the
// server path can never disagree about what a legal handle is.
//
// Loud, like the Nest repo: every failure throws.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizeUsername, validateUsername, type ProfileLink } from "@/lib/nest-profile-store";
import { NestRepoError } from "@/lib/nest/supabase-nest-repo";
import { DEFAULT_HOUSE_STYLE_KEY, isHouseStyleKey } from "@/lib/nest-house";

function sb(): SupabaseClient {
  const client = createSupabaseBrowserClient();
  if (!client) throw new NestRepoError("Supabase is not configured in this build.");
  return client;
}

function fail(op: string, error: unknown): never {
  const detail =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "unknown error");
  console.error(`[profile-repo] ${op} failed:`, error);
  throw new NestRepoError(`${op} failed: ${detail}`, error);
}

export type CreatorProfile = {
  id: string;
  displayName: string;
  username?: string;
  bio?: string;
  avatarUrl?: string;
  /** The single house the creator chose. Absent ⇒ onboarding is incomplete. */
  houseStyle?: string;
  links?: ProfileLink[];
  /** True when M23B columns are absent, so `houseStyle`/`links` could not be read. */
  schemaIncomplete?: boolean;
};

type ProfileRow = {
  id: string;
  display_name: string;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  house_style?: string | null;
  links?: ProfileLink[] | null;
};

const COLS = "id, display_name, username, bio, avatar_url, house_style, links";

// ── Schema tolerance (HOTFIX M23B.1) ─────────────────────────────────────────
//
// `house_style` and `links` only exist once the founder has applied
// m23b_nest_platform_provision.sql. Until then PostgREST rejects the SELECT above with
// 42703 (undefined_column) — and a hard failure there meant a successfully-authenticated
// user could not load a profile, which cascaded into the frozen sign-in.
//
// A missing APPLICATION column must never break AUTHENTICATION. So we retry once with the
// columns that certainly exist, flag the profile as `schemaIncomplete`, and log a loud
// developer diagnostic naming the exact column. Production keeps working (the creator just
// has no house yet); development is told precisely what to run.
const BASE_COLS = "id, display_name, username, bio, avatar_url";

/** True when the error is Postgres/PostgREST telling us a column isn't there. */
function isMissingColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  const message = String((error as { message?: unknown }).message ?? "");
  return code === "42703" || code === "PGRST204" || /column .* does not exist/i.test(message);
}

let warnedAboutSchema = false;
function warnSchemaIncomplete(error: unknown): void {
  if (warnedAboutSchema) return;
  warnedAboutSchema = true;
  console.warn(
    "[profile-repo] The profiles table is missing M23B columns (house_style / links), so " +
      "house selection and creator links are unavailable. Sign-in and the rest of the app " +
      "still work. Fix: apply supabase/provision/m23b_nest_platform_provision.sql. " +
      `Underlying error: ${String((error as { message?: unknown })?.message ?? error)}`,
  );
}

function toProfile(r: ProfileRow, schemaIncomplete = false): CreatorProfile {
  return {
    ...(schemaIncomplete ? { schemaIncomplete: true } : {}),
    id: r.id,
    displayName: r.display_name,
    ...(r.username ? { username: r.username } : {}),
    ...(r.bio ? { bio: r.bio } : {}),
    ...(r.avatar_url ? { avatarUrl: r.avatar_url } : {}),
    ...(r.house_style ? { houseStyle: r.house_style } : {}),
    ...(Array.isArray(r.links) && r.links.length ? { links: r.links } : {}),
  };
}

/**
 * Onboarding is complete only when the creator has all three: a display name, a claimed
 * username and a selected house. An existing, fully configured user must never be sent
 * back through the flow; a partially configured one resumes at the missing step.
 */
export function onboardingComplete(p: CreatorProfile | null | undefined): boolean {
  return !!p && !!p.displayName.trim() && !!p.username && !!p.houseStyle;
}

/** The first onboarding step this profile still needs, or null when it needs none. */
export function nextOnboardingStep(p: CreatorProfile | null | undefined): "identity" | "house" | null {
  if (!p || !p.displayName.trim() || !p.username) return "identity";
  if (!p.houseStyle) return "house";
  return null;
}

// ── Reads ────────────────────────────────────────────────────────────────────
export async function getProfile(userId: string): Promise<CreatorProfile | null> {
  const { data, error } = await sb().from("profiles").select(COLS).eq("id", userId).maybeSingle();
  if (!error) return data ? toProfile(data as ProfileRow) : null;

  // The M23B columns are not there yet — degrade, don't fail. See BASE_COLS above.
  if (isMissingColumn(error)) {
    warnSchemaIncomplete(error);
    const retry = await sb().from("profiles").select(BASE_COLS).eq("id", userId).maybeSingle();
    if (retry.error) fail("Loading your profile", retry.error);
    return retry.data ? toProfile(retry.data as ProfileRow, true) : null;
  }
  fail("Loading your profile", error);
}

/** Resolve a creator from their /@handle. Case-insensitive, world-readable. */
export async function getProfileByUsername(username: string): Promise<CreatorProfile | null> {
  const u = normalizeUsername(username);
  if (!u) return null;
  const { data, error } = await sb().from("profiles").select(COLS).ilike("username", u).maybeSingle();
  if (!error) return data ? toProfile(data as ProfileRow) : null;
  if (isMissingColumn(error)) {
    warnSchemaIncomplete(error);
    const retry = await sb().from("profiles").select(BASE_COLS).ilike("username", u).maybeSingle();
    if (retry.error) fail("Looking up that creator", retry.error);
    return retry.data ? toProfile(retry.data as ProfileRow, true) : null;
  }
  fail("Looking up that creator", error);
}

/** Batch-resolve creators for a feed — one query, not one per card. */
export async function getProfiles(userIds: string[]): Promise<Map<string, CreatorProfile>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (!unique.length) return new Map();
  const first = await sb().from("profiles").select(COLS).in("id", unique);
  let data = first.data as ProfileRow[] | null;
  let incomplete = false;
  if (first.error) {
    if (!isMissingColumn(first.error)) fail("Loading creators", first.error);
    warnSchemaIncomplete(first.error);
    const retry = await sb().from("profiles").select(BASE_COLS).in("id", unique);
    if (retry.error) fail("Loading creators", retry.error);
    data = retry.data as ProfileRow[] | null;
    incomplete = true;
  }
  const map = new Map<string, CreatorProfile>();
  for (const r of data ?? []) map.set(r.id, toProfile(r, incomplete));
  return map;
}

/** Free-text creator search over username + display name. Real users, not fixtures. */
export async function searchCreators(query: string, limit = 20): Promise<CreatorProfile[]> {
  const q = query.trim();
  if (!q) return [];
  // Escape PostgREST's `or` delimiters so a query like "a,b" can't inject a filter.
  const safe = q.replace(/[,()*]/g, " ").trim();
  if (!safe) return [];
  const { data, error } = await sb()
    .from("profiles")
    .select(COLS)
    .or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`)
    .not("username", "is", null)
    .limit(limit);
  if (error) fail("Searching creators", error);
  return ((data ?? []) as ProfileRow[]).map((r) => toProfile(r));
}

/** Every creator who has completed onboarding — the Village population. */
export async function listCreators(limit = 60): Promise<CreatorProfile[]> {
  const { data, error } = await sb()
    .from("profiles")
    .select(COLS)
    .not("username", "is", null)
    .limit(limit);
  if (error) fail("Loading creators", error);
  return ((data ?? []) as ProfileRow[]).map((r) => toProfile(r));
}

/**
 * Is this username free? Checked against the SERVER, not the local browser — the whole
 * point of a unique handle is that it is unique across accounts.
 */
export async function isUsernameAvailable(input: string, forUserId?: string): Promise<boolean> {
  const u = normalizeUsername(input);
  if (!u) return false;
  const { data, error } = await sb().from("profiles").select("id").ilike("username", u).maybeSingle();
  if (error) fail("Checking that username", error);
  if (!data) return true;
  return (data as { id: string }).id === forUserId;
}

// ── Writes ───────────────────────────────────────────────────────────────────

/**
 * Step 1 of onboarding. Creates the profile row if it does not exist and claims the
 * username in the same statement, so the DB's unique index — not a client-side check —
 * is what actually decides who gets the handle.
 */
export async function saveIdentity(input: {
  userId: string;
  displayName: string;
  username: string;
}): Promise<CreatorProfile> {
  const displayName = input.displayName.trim();
  if (!displayName) throw new NestRepoError("Enter a display name.");
  const reason = validateUsername(input.username);
  if (reason) throw new NestRepoError(reason);
  const username = normalizeUsername(input.username);

  const { data, error } = await sb()
    .from("profiles")
    .upsert({ id: input.userId, display_name: displayName, username }, { onConflict: "id" })
    .select(COLS)
    .single();

  if (error) {
    // 23505 = unique_violation. Two people raced for the same handle; the loser is told
    // the truth rather than being handed a handle they do not own.
    if (typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505") {
      throw new NestRepoError("That username was just taken. Try another.");
    }
    fail("Saving your identity", error);
  }
  return toProfile(data as ProfileRow);
}

/** Step 2 of onboarding: persist the ONE house this creator lives in. */
export async function saveHouseStyle(userId: string, houseStyle: string): Promise<CreatorProfile> {
  const key = isHouseStyleKey(houseStyle) ? houseStyle : DEFAULT_HOUSE_STYLE_KEY;
  const { data, error } = await sb()
    .from("profiles")
    .update({ house_style: key })
    .eq("id", userId)
    .select(COLS)
    .single();
  if (error) {
    if (isMissingColumn(error)) {
      // Honest, specific, and actionable — never a generic "something went wrong".
      warnSchemaIncomplete(error);
      throw new NestRepoError(
        "House selection isn't available yet on this deployment — the database is still being set up. Everything else works.",
      );
    }
    fail("Saving your house", error);
  }
  return toProfile(data as ProfileRow);
}

/** Patch the mutable parts of a profile. The username is never changed here. */
export async function updateProfileFields(
  userId: string,
  patch: { displayName?: string; bio?: string; avatarUrl?: string; houseStyle?: string; links?: ProfileLink[] },
): Promise<CreatorProfile> {
  const row: Record<string, unknown> = {};
  if (patch.displayName !== undefined) row.display_name = patch.displayName.trim();
  if (patch.bio !== undefined) row.bio = patch.bio.trim() || null;
  if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl || null;
  if (patch.houseStyle !== undefined) row.house_style = patch.houseStyle;
  if (patch.links !== undefined) row.links = patch.links.filter((l) => l.url?.trim());
  if (!Object.keys(row).length) {
    const current = await getProfile(userId);
    if (!current) throw new NestRepoError("Your profile could not be loaded.");
    return current;
  }
  const { data, error } = await sb().from("profiles").update(row).eq("id", userId).select(COLS).single();
  if (error) fail("Saving your profile", error);
  return toProfile(data as ProfileRow);
}
