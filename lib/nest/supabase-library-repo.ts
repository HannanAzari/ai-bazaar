// ── M12.1 — Supabase curated-library repository ──────────────────────────────
//
// Reads the curated library from nest_backgrounds / nest_assets / nest_templates
// (ALL statuses, so published Nests resolve archived items) and writes admin status
// changes back. Authored to supabase/migrations/20260702_*; runtime-verified once
// applied. Admin writes require an is_admin() session (RLS); reads are public.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  ProductionAsset,
  ProductionBackground,
  ProductionItemType,
  ProductionLibrary,
  ProductionLibraryStatus,
  ProductionTemplate,
} from "@/lib/nest-production-types";

function sb(): SupabaseClient {
  const client = createSupabaseBrowserClient();
  if (!client) throw new Error("Supabase client unavailable (missing env).");
  return client;
}

const TABLE: Record<ProductionItemType, string> = {
  background: "nest_backgrounds",
  asset: "nest_assets",
  template: "nest_templates",
};

// ── Row → Production type mappers ─────────────────────────────────────────────
type BgRow = { id: string; title: string; image_url: string; variants: Record<string, string> | null; style: string | null; status: ProductionLibraryStatus; camera_dna_version: string | null; tags: string[] | null; source_candidate_id: string | null };
type AssetRow = { id: string; title: string; image_url: string; cutout_url: string | null; variants: Record<string, string> | null; category: string; compatible_slot_types: string[] | null; editable_surfaces: unknown; hotspots: unknown; visual_bounds: unknown; camera_dna_version: string | null; status: ProductionLibraryStatus; tags: string[] | null; source_candidate_id: string | null };
type TplRow = { id: string; title: string; persona: string | null; background_id: string | null; placements: unknown; preview_image: string | null; status: ProductionLibraryStatus; tags: string[] | null };

const toBackground = (r: BgRow): ProductionBackground => ({
  id: r.id, name: r.title, style: r.style ?? undefined, imageUrl: r.image_url,
  variants: r.variants ?? {}, cameraDnaVersion: r.camera_dna_version ?? "camera-dna-lock-v1",
  status: r.status, tags: r.tags ?? [], sourceCandidateId: r.source_candidate_id ?? undefined,
});
const toAsset = (r: AssetRow): ProductionAsset => ({
  id: r.id, name: r.title, category: r.category as ProductionAsset["category"], imageUrl: r.image_url,
  cutoutUrl: r.cutout_url ?? undefined, variants: r.variants ?? {},
  visualBounds: (r.visual_bounds as ProductionAsset["visualBounds"]) ?? undefined,
  compatibleSlotTypes: (r.compatible_slot_types as ProductionAsset["compatibleSlotTypes"]) ?? [],
  editableSurfaces: (r.editable_surfaces as ProductionAsset["editableSurfaces"]) ?? undefined,
  hotspots: (r.hotspots as ProductionAsset["hotspots"]) ?? undefined,
  cameraDnaVersion: r.camera_dna_version ?? "front-facing-v1",
  status: r.status, tags: r.tags ?? [], sourceCandidateId: r.source_candidate_id ?? undefined,
});
const toTemplate = (r: TplRow): ProductionTemplate => ({
  id: r.id, name: r.title, persona: r.persona ?? "", backgroundId: r.background_id ?? "",
  objectPlacements: (r.placements as ProductionTemplate["objectPlacements"]) ?? [],
  previewImage: r.preview_image ?? undefined, status: r.status, tags: r.tags ?? [],
});

/** Fetch the whole curated library (all statuses) from Supabase. */
export async function fetchLibrary(): Promise<ProductionLibrary> {
  const client = sb();
  const [bg, as, tp] = await Promise.all([
    client.from("nest_backgrounds").select("*"),
    client.from("nest_assets").select("*"),
    client.from("nest_templates").select("*"),
  ]);
  if (bg.error) throw bg.error;
  if (as.error) throw as.error;
  if (tp.error) throw tp.error;
  return {
    backgrounds: (bg.data as BgRow[]).map(toBackground),
    assets: (as.data as AssetRow[]).map(toAsset),
    templates: (tp.data as TplRow[]).map(toTemplate),
  };
}

/** Admin curation write (approve/feature/hide/archive). Never deletes. */
export async function setStatus(itemType: ProductionItemType, itemId: string, status: ProductionLibraryStatus): Promise<void> {
  const { error } = await sb().from(TABLE[itemType]).update({ status }).eq("id", itemId);
  if (error) throw error;
}
