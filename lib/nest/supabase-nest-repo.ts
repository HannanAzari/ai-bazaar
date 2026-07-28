// ── M23B — Supabase Nest repository (the source of truth) ────────────────────
//
// Real persistence for Nest documents (`nests` + `nest_objects`). Visibility is
// enforced SERVER-SIDE by RLS: public/unlisted Nests are world-readable; drafts and
// private/followers resolve only for their owner.
//
// Two rules govern this file, both learned the hard way (see docs/CANONICAL_NEST_DATA_AUDIT.md):
//
//   1. LOSSLESS. Every field the editor can put on a placement has a column and is
//      carried in BOTH directions. The previous version wrote `rotation: 0` hard-coded
//      and never read rotation back, and had nowhere to put overlays, w/h or flipX —
//      which made the Supabase path lossier than localStorage.
//   2. LOUD. Nothing here swallows an error. Every function throws a NestRepoError with
//      the underlying Postgres message. The facade (lib/nest-repo.ts) decides what the
//      user sees; it must never turn a failure into a silent local write.
//
// Schema: supabase/provision/m23b_nest_platform_provision.sql

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  NestDocument,
  NestPlacement,
  NestPlacementInteraction,
  NestVisibility,
} from "@/lib/nest-document-types";
import type { NestOverlay } from "@/lib/nest-editor-types";

/** A backend failure that reached the UI. Carries the Postgres detail for the console. */
export class NestRepoError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "NestRepoError";
    this.cause = cause;
  }
}

function fail(op: string, error: unknown): never {
  const detail =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "unknown error");
  // Always visible in the browser console — the whole point of M23B is that a backend
  // failure stops being invisible.
  console.error(`[nest-repo] ${op} failed:`, error);
  throw new NestRepoError(`${op} failed: ${detail}`, error);
}

function sb(): SupabaseClient {
  const client = createSupabaseBrowserClient();
  if (!client) {
    throw new NestRepoError(
      "Supabase is not configured in this build (NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY missing at build time).",
    );
  }
  return client;
}

const now = () => new Date().toISOString();

/** Slug from a title + a short random suffix. Generated ONCE, then never regenerated. */
export function slugifyTitle(title: string): string {
  const base =
    title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "nest";
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Row shapes ───────────────────────────────────────────────────────────────
type NestRow = {
  id: string;
  slug: string | null;
  owner_id: string;
  title: string;
  background_id: string;
  visibility: NestVisibility;
  source_template_id: string | null;
  created_at: string;
  updated_at: string;
};

type ObjectRow = {
  id: string;
  nest_id: string;
  asset_id: string;
  x: number;
  y: number;
  scale: number | null;
  rotation: number | null;
  z_index: number;
  w: number | null;
  h: number | null;
  flip_x: boolean | null;
  overlay: NestOverlay | null;
  interaction: NestPlacementInteraction | null;
  label: string | null;
  link_url: string | null;
};

const NEST_COLS = "id, slug, owner_id, title, background_id, visibility, source_template_id, created_at, updated_at";
const OBJECT_COLS = "id, nest_id, asset_id, x, y, scale, rotation, z_index, w, h, flip_x, overlay, interaction, label, link_url";

// ── Mapping (the lossless part) ──────────────────────────────────────────────

/** One `nest_objects` row → a NestPlacement, with every optional field restored. */
export function rowToPlacement(o: ObjectRow): NestPlacement {
  return {
    id: o.id,
    assetId: o.asset_id,
    x: o.x,
    y: o.y,
    ...(o.scale != null ? { scale: o.scale } : {}),
    zIndex: o.z_index,
    ...(o.rotation ? { rotation: o.rotation } : {}),
    ...(o.w != null ? { w: o.w } : {}),
    ...(o.h != null ? { h: o.h } : {}),
    ...(o.flip_x ? { flipX: true } : {}),
    ...(o.overlay ? { overlay: o.overlay } : {}),
    ...(o.interaction ? { interaction: o.interaction } : {}),
    ...(o.label ? { label: o.label } : {}),
    ...(o.link_url ? { linkUrl: o.link_url } : {}),
  };
}

/** A NestPlacement → an insertable `nest_objects` row. Nothing is dropped. */
function placementToRow(nestId: string, p: NestPlacement, index: number) {
  return {
    nest_id: nestId,
    asset_id: p.assetId,
    x: p.x,
    y: p.y,
    scale: p.scale ?? null,
    rotation: p.rotation ?? 0,
    z_index: p.zIndex ?? index + 1,
    w: p.w ?? null,
    h: p.h ?? null,
    flip_x: p.flipX ?? false,
    overlay: p.overlay ?? null,
    interaction: p.interaction ?? null,
    label: p.label ?? null,
    link_url: p.linkUrl ?? null,
  };
}

function toDoc(nest: NestRow, objects: ObjectRow[]): NestDocument {
  return {
    id: nest.id,
    ownerId: nest.owner_id,
    backgroundId: nest.background_id,
    title: nest.title,
    visibility: nest.visibility,
    ...(nest.source_template_id ? { sourceTemplateId: nest.source_template_id } : {}),
    createdAt: nest.created_at,
    updatedAt: nest.updated_at,
    placements: [...objects].sort((a, b) => a.z_index - b.z_index).map(rowToPlacement),
  };
}

// ── Session ──────────────────────────────────────────────────────────────────
export async function currentUserId(): Promise<string | undefined> {
  const { data, error } = await sb().auth.getUser();
  if (error) return undefined; // not signed in is not an error condition
  return data.user?.id;
}

/** The signed-in user id, or a hard failure. Publishing requires a real account. */
async function requireUserId(op: string): Promise<string> {
  const uid = await currentUserId();
  if (!uid) throw new NestRepoError(`${op} requires you to be signed in.`);
  return uid;
}

// ── Composition writes ───────────────────────────────────────────────────────
//
// Delete-then-insert. A placement's row id is not stable across saves (the editor's
// own `instanceId` is the stable identity, and it round-trips through the document),
// so replacing the set is both simpler and cheaper than diffing.
async function replaceObjects(nestId: string, placements: NestPlacement[]): Promise<void> {
  const client = sb();
  const { error: delErr } = await client.from("nest_objects").delete().eq("nest_id", nestId);
  if (delErr) fail("Replacing the Nest composition", delErr);
  if (!placements.length) return;
  const { error: insErr } = await client
    .from("nest_objects")
    .insert(placements.map((p, i) => placementToRow(nestId, p, i)));
  if (insErr) fail("Saving the Nest composition", insErr);
}

// ── CRUD ─────────────────────────────────────────────────────────────────────
export async function createNest(input: {
  backgroundId: string;
  title: string;
  placements: NestPlacement[];
  sourceTemplateId?: string;
}): Promise<NestDocument> {
  const ownerId = await requireUserId("Creating a Nest");
  const { data, error } = await sb()
    .from("nests")
    .insert({
      owner_id: ownerId,
      background_id: input.backgroundId,
      title: input.title,
      visibility: "draft",
      source_template_id: input.sourceTemplateId ?? null,
    })
    .select(NEST_COLS)
    .single();
  if (error || !data) fail("Creating a Nest", error);
  await replaceObjects((data as NestRow).id, input.placements);
  return await getNest((data as NestRow).id).then(
    (doc) => doc ?? toDoc(data as NestRow, []),
  );
}

export async function getNest(id: string): Promise<NestDocument | undefined> {
  const client = sb();
  const { data: nest, error } = await client.from("nests").select(NEST_COLS).eq("id", id).maybeSingle();
  if (error) fail("Loading a Nest", error);
  if (!nest) return undefined;
  const { data: objects, error: objErr } = await client
    .from("nest_objects")
    .select(OBJECT_COLS)
    .eq("nest_id", id);
  if (objErr) fail("Loading the Nest composition", objErr);
  return toDoc(nest as NestRow, (objects ?? []) as ObjectRow[]);
}

/**
 * Save the canonical version of a Nest: title, background, visibility AND the complete
 * composition. This is what "Save draft" and every autosave-promotion writes.
 */
export async function saveNest(doc: NestDocument): Promise<NestDocument> {
  const client = sb();
  const { error } = await client
    .from("nests")
    .update({
      title: doc.title,
      background_id: doc.backgroundId,
      ...(doc.sourceTemplateId ? { source_template_id: doc.sourceTemplateId } : {}),
      updated_at: now(),
    })
    .eq("id", doc.id);
  if (error) fail("Saving your Nest", error);
  await replaceObjects(doc.id, doc.placements);
  const fresh = await getNest(doc.id);
  if (!fresh) throw new NestRepoError("Saved, but the Nest could not be read back.");
  return fresh;
}

/**
 * Publish at a visibility. The slug is generated once and then REUSED forever, so a
 * shared URL never breaks when a Nest is re-published or renamed.
 */
export async function publishNest(
  id: string,
  visibility: NestVisibility,
): Promise<{ slug: string; url: string; visibility: NestVisibility }> {
  const client = sb();
  const { data: existing, error: readErr } = await client
    .from("nests")
    .select("slug, title")
    .eq("id", id)
    .maybeSingle();
  if (readErr) fail("Publishing your Nest", readErr);
  if (!existing) throw new NestRepoError("That Nest no longer exists on the server.");

  const row = existing as { slug: string | null; title: string };
  const slug = row.slug ?? slugifyTitle(row.title);
  const { error } = await client.from("nests").update({ visibility, slug, updated_at: now() }).eq("id", id);
  if (error) fail("Publishing your Nest", error);
  // Payload-free — visibility is enforced server-side by RLS, not by a URL secret.
  return { slug, url: `/nest/${slug}`, visibility };
}

/** Resolve a published Nest by slug. RLS returns it only if world-readable or owned. */
export async function resolveNestBySlug(slug: string): Promise<NestDocument | undefined> {
  const client = sb();
  const { data: nest, error } = await client.from("nests").select(NEST_COLS).eq("slug", slug).maybeSingle();
  if (error) fail("Opening this Nest", error);
  if (!nest) return undefined;
  const { data: objects, error: objErr } = await client
    .from("nest_objects")
    .select(OBJECT_COLS)
    .eq("nest_id", (nest as NestRow).id);
  if (objErr) fail("Opening this Nest", objErr);
  return toDoc(nest as NestRow, (objects ?? []) as ObjectRow[]);
}

export async function deleteNest(id: string): Promise<void> {
  const { error } = await sb().from("nests").delete().eq("id", id);
  if (error) fail("Deleting your Nest", error);
}

// ── Listings ─────────────────────────────────────────────────────────────────
//
// One shared shape so Home, Explore, Profile, House and Village all read the same rows.

export type NestListing = { doc: NestDocument; slug?: string; ownerId: string };

/** Batch-load compositions for many Nests in ONE query (no N+1 over the feed). */
async function attachObjects(nests: NestRow[]): Promise<NestListing[]> {
  if (!nests.length) return [];
  const { data: objects, error } = await sb()
    .from("nest_objects")
    .select(OBJECT_COLS)
    .in("nest_id", nests.map((n) => n.id));
  if (error) fail("Loading Nests", error);
  const byNest = new Map<string, ObjectRow[]>();
  for (const o of (objects ?? []) as ObjectRow[]) {
    const list = byNest.get(o.nest_id);
    if (list) list.push(o);
    else byNest.set(o.nest_id, [o]);
  }
  return nests.map((n) => ({
    doc: toDoc(n, byNest.get(n.id) ?? []),
    slug: n.slug ?? undefined,
    ownerId: n.owner_id,
  }));
}

/** Every world-readable Nest, newest first. The real feed behind Home + Explore. */
export async function listPublicNests(limit = 60): Promise<NestListing[]> {
  const { data, error } = await sb()
    .from("nests")
    .select(NEST_COLS)
    .in("visibility", ["public", "unlisted"])
    .not("slug", "is", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) fail("Loading the Nest feed", error);
  return attachObjects((data ?? []) as NestRow[]);
}

/** A creator's published Nests — what a visitor sees on their Profile and in their House. */
export async function listPublishedNestsByOwner(ownerId: string): Promise<NestListing[]> {
  const { data, error } = await sb()
    .from("nests")
    .select(NEST_COLS)
    .eq("owner_id", ownerId)
    .in("visibility", ["public", "unlisted"])
    .not("slug", "is", null)
    .order("updated_at", { ascending: false });
  if (error) fail("Loading this creator's Nests", error);
  return attachObjects((data ?? []) as NestRow[]);
}

/** Everything the signed-in creator owns, drafts included. Owner-only by RLS. */
export async function listMyNests(): Promise<NestListing[]> {
  const uid = await currentUserId();
  if (!uid) return [];
  const { data, error } = await sb()
    .from("nests")
    .select(NEST_COLS)
    .eq("owner_id", uid)
    .order("updated_at", { ascending: false });
  if (error) fail("Loading your Nests", error);
  return attachObjects((data ?? []) as NestRow[]);
}
