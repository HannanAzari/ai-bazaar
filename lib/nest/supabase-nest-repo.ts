// ── M12 — Supabase Nest repository ───────────────────────────────────────────
//
// Real persistence for Nest documents (nests + nest_objects), authored to
// supabase/migrations/20260702_01_nest_platform.sql. Visibility is enforced
// SERVER-SIDE by RLS: public/unlisted nests are world-readable; drafts/private/
// followers resolve only for their owner. Guests get an anonymous auth session so
// they can own drafts; publishing requires a real (email/OAuth) upgrade.
//
// NOTE: authored against the schema; runtime-verified once the migrations are
// applied to the live project (see docs/m12-supabase-cutover.md). The M11 local
// path remains the default backend until NEXT_PUBLIC_NEST_BACKEND=supabase.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { NestDocument, NestPlacement, NestVisibility } from "@/lib/nest-document-types";
import { getAllLocalDocs } from "@/lib/nest-document-store";

function sb(): SupabaseClient {
  const client = createSupabaseBrowserClient();
  if (!client) throw new Error("Supabase client unavailable (missing env).");
  return client;
}

const now = () => new Date().toISOString();
function slugify(title: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "nest";
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Row mappers ──────────────────────────────────────────────────────────────
type NestRow = {
  id: string; slug: string | null; owner_id: string | null; title: string;
  background_id: string; visibility: NestVisibility; source_template_id: string | null;
  created_at: string; updated_at: string;
};
type ObjectRow = { id: string; asset_id: string; x: number; y: number; scale: number; rotation: number; z_index: number };

function toDoc(nest: NestRow, objects: ObjectRow[]): NestDocument {
  return {
    id: nest.id,
    ownerId: nest.owner_id ?? undefined,
    backgroundId: nest.background_id,
    title: nest.title,
    visibility: nest.visibility,
    sourceTemplateId: nest.source_template_id ?? undefined,
    createdAt: nest.created_at,
    updatedAt: nest.updated_at,
    placements: objects
      .sort((a, b) => a.z_index - b.z_index)
      .map<NestPlacement>((o) => ({ id: o.id, assetId: o.asset_id, x: o.x, y: o.y, scale: o.scale, zIndex: o.z_index })),
  };
}

// ── Auth (guest / signed-in) ─────────────────────────────────────────────────
export async function currentUserId(): Promise<string | undefined> {
  const { data } = await sb().auth.getUser();
  return data.user?.id;
}

/** Ensure there's at least an anonymous session so a guest can own drafts. */
export async function ensureGuestSession(): Promise<string> {
  const client = sb();
  const { data } = await client.auth.getUser();
  if (data.user) return data.user.id;
  const { data: anon, error } = await client.auth.signInAnonymously();
  if (error || !anon.user) throw error ?? new Error("Anonymous sign-in failed.");
  return anon.user.id;
}

// ── CRUD ─────────────────────────────────────────────────────────────────────
async function replaceObjects(nestId: string, placements: NestPlacement[]) {
  const client = sb();
  await client.from("nest_objects").delete().eq("nest_id", nestId);
  if (placements.length) {
    await client.from("nest_objects").insert(
      placements.map((p) => ({
        nest_id: nestId, asset_id: p.assetId, x: p.x, y: p.y,
        scale: p.scale ?? 0.45, rotation: 0, z_index: p.zIndex ?? 1,
      })),
    );
  }
}

export async function createNest(input: {
  backgroundId: string; title: string; placements: NestPlacement[]; sourceTemplateId?: string;
}): Promise<NestDocument> {
  const ownerId = await ensureGuestSession();
  const client = sb();
  const { data, error } = await client
    .from("nests")
    .insert({ owner_id: ownerId, background_id: input.backgroundId, title: input.title, visibility: "draft", source_template_id: input.sourceTemplateId ?? null })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("createNest failed.");
  await replaceObjects(data.id, input.placements);
  return toDoc(data as NestRow, input.placements.map((p, i) => ({ id: p.id, asset_id: p.assetId, x: p.x, y: p.y, scale: p.scale ?? 0.45, rotation: 0, z_index: p.zIndex ?? i })));
}

export async function getNest(id: string): Promise<NestDocument | undefined> {
  const client = sb();
  const { data: nest } = await client.from("nests").select("*").eq("id", id).maybeSingle();
  if (!nest) return undefined;
  const { data: objects } = await client.from("nest_objects").select("*").eq("nest_id", id);
  return toDoc(nest as NestRow, (objects ?? []) as ObjectRow[]);
}

export async function saveNest(doc: NestDocument): Promise<NestDocument> {
  const client = sb();
  await client.from("nests").update({ title: doc.title, background_id: doc.backgroundId, updated_at: now() }).eq("id", doc.id);
  await replaceObjects(doc.id, doc.placements);
  return { ...doc, updatedAt: now() };
}

export async function publishNest(id: string, visibility: NestVisibility): Promise<{ slug: string; url: string; visibility: NestVisibility } | undefined> {
  const client = sb();
  const { data: existing } = await client.from("nests").select("slug, title").eq("id", id).single();
  if (!existing) return undefined;
  const slug = existing.slug ?? slugify(existing.title);
  const { error } = await client.from("nests").update({ visibility, slug }).eq("id", id);
  if (error) throw error;
  // Real, payload-free URL — visibility is enforced server-side by RLS.
  return { slug, url: `/nest/${slug}`, visibility };
}

/** Resolve a published nest by slug. RLS returns it only if world-readable or owned. */
export async function resolveNestBySlug(slug: string): Promise<NestDocument | undefined> {
  const client = sb();
  const { data: nest } = await client.from("nests").select("*").eq("slug", slug).maybeSingle();
  if (!nest) return undefined;
  const { data: objects } = await client.from("nest_objects").select("*").eq("nest_id", (nest as NestRow).id);
  return toDoc(nest as NestRow, (objects ?? []) as ObjectRow[]);
}

export async function listMyNests(): Promise<NestDocument[]> {
  const client = sb();
  const uid = await currentUserId();
  if (!uid) return [];
  const { data: nests } = await client.from("nests").select("*").eq("owner_id", uid).order("updated_at", { ascending: false });
  const out: NestDocument[] = [];
  for (const n of (nests ?? []) as NestRow[]) {
    const { data: objects } = await client.from("nest_objects").select("*").eq("nest_id", n.id);
    out.push(toDoc(n, (objects ?? []) as ObjectRow[]));
  }
  return out;
}

// ── One-time migration: localStorage nests → Supabase rows ───────────────────
export async function migrateLocalNestsToSupabase(): Promise<{ migrated: number }> {
  const local = getAllLocalDocs();
  let migrated = 0;
  for (const doc of local) {
    try {
      const created = await createNest({ backgroundId: doc.backgroundId, title: doc.title, placements: doc.placements, sourceTemplateId: doc.sourceTemplateId });
      if (doc.visibility !== "draft") await publishNest(created.id, doc.visibility);
      migrated++;
    } catch {
      /* skip a doc that references a missing background; never lose the others */
    }
  }
  return { migrated };
}
