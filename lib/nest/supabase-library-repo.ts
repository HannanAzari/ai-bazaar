// ── M12.1 — Supabase curated-library repository ──────────────────────────────
//
// Reads the curated library from nest_backgrounds / nest_assets / nest_templates
// (ALL statuses, so published Nests resolve archived items) and writes admin status
// changes back. Authored to supabase/migrations/20260702_*; runtime-verified once
// applied. Admin writes require an is_admin() session (RLS); reads are public.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { NEST_PRODUCTION_LIBRARY_V1 } from "@/lib/fixtures/nest-production-library-v1";
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

/**
 * Fetch the whole curated library (all statuses) from Supabase.
 *
 * Per-category resilience: only `nest_assets` is provisioned in the Beta. If a sibling
 * table (nest_backgrounds / nest_templates) is absent, fall back to the bundled fixture
 * for THAT category rather than failing the whole load — so the DB asset catalog still
 * powers the editor while backgrounds/templates keep working from the fixture.
 */
/**
 * Supabase rows MERGED over the bundled fixture, keyed by id.
 *
 * ── M24 §7 — this is the fix for "Asset Factory assets don't appear", and for the
 *    objects that vanished from published Nests ──
 *
 * This used to be a REPLACEMENT: `error ? fixture : rows`. While `nest_assets` did not
 * exist the query errored, the fixture was used, and everything worked. The moment the
 * M23B SQL was applied the query started SUCCEEDING with the one row the table happens to
 * contain — so the entire fixture catalogue was discarded and the library became a single
 * laptop.
 *
 * Live proof at the time of writing: published Nests reference 8 asset ids
 * (ast-avatar, ast-bookshelf, ast-floor-lamp, ast-framed-photo, ast-lr-sofa-boucle,
 * ast-lr-table-oak-round, ast-so-shelf-tall, ast-tv) and `nest_assets` holds exactly one
 * (ast-laptop-v1-certified). Every one of those 8 became unresolvable at once — which is
 * both the empty Asset Library and the "objects disappear" report, from one line of code.
 *
 * Supabase is canonical where it has an opinion: a row with the same id WINS, so an
 * Asset-Factory asset overrides its bundled ancestor. The fixture only fills the gaps.
 */
function mergeById<T extends { id: string }>(fixture: T[], rows: T[]): T[] {
  const byId = new Map(fixture.map((item) => [item.id, item]));
  for (const row of rows) byId.set(row.id, row); // Supabase wins on collision
  return Array.from(byId.values());
}

export async function fetchLibrary(): Promise<ProductionLibrary> {
  const client = sb();
  const [bg, as, tp] = await Promise.all([
    client.from("nest_backgrounds").select("*"),
    client.from("nest_assets").select("*"),
    client.from("nest_templates").select("*"),
  ]);

  const library: ProductionLibrary = {
    backgrounds: bg.error
      ? NEST_PRODUCTION_LIBRARY_V1.backgrounds
      : mergeById(NEST_PRODUCTION_LIBRARY_V1.backgrounds, (bg.data as BgRow[]).map(toBackground)),
    assets: as.error
      ? NEST_PRODUCTION_LIBRARY_V1.assets
      : mergeById(NEST_PRODUCTION_LIBRARY_V1.assets, (as.data as AssetRow[]).map(toAsset)),
    templates: tp.error
      ? NEST_PRODUCTION_LIBRARY_V1.templates
      : mergeById(NEST_PRODUCTION_LIBRARY_V1.templates, (tp.data as TplRow[]).map(toTemplate)),
  };

  // §7 — the development-only diagnostic. Says which project answered, how many rows came
  // back, and how many assets the editor ended up with, so "my asset isn't in the library"
  // is a one-glance question rather than an investigation.
  if (process.env.NODE_ENV !== "production") {
    const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/^https?:\/\//, "").split(".")[0] || "unknown";
    console.info(
      `[asset-library] project=${ref} · assets: ${as.error ? `FAILED (${as.error.message})` : `${(as.data ?? []).length} from Supabase`} ` +
        `+ ${NEST_PRODUCTION_LIBRARY_V1.assets.length} bundled → ${library.assets.length} total · ` +
        `backgrounds ${library.backgrounds.length} · templates ${library.templates.length}`,
    );
  }

  return library;
}

/** Admin curation write (approve/feature/hide/archive). Never deletes. */
export async function setStatus(itemType: ProductionItemType, itemId: string, status: ProductionLibraryStatus): Promise<void> {
  const { error } = await sb().from(TABLE[itemType]).update({ status }).eq("id", itemId);
  if (error) throw error;
}
