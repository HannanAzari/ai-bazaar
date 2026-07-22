-- ─────────────────────────────────────────────────────────────────────────────
-- Nestudio Beta — ADDITIVE provisioning of the canonical `nest_assets` catalog ONLY.
-- Project: srrmkdsvldlyllsxyhtq  ·  matches supabase/schema.sql (audited source).
--
-- SAFETY (verified): additive only. No DROP, no DELETE, no destructive ALTER, no
-- overwrite of existing tables/rows/buckets/policies. Never references public.assets
-- (V1) or any other object. Idempotent — safe to run more than once.
-- Storage: the `nestudio-assets` bucket already EXISTS (public) — nothing to create.
-- Run in the Supabase SQL editor (recommended, human-in-loop) or via psql.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) status enum (CREATE TYPE has no IF NOT EXISTS → guarded)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'nest_library_status') then
    create type public.nest_library_status as enum ('draft','approved','hidden','archived','featured');
  end if;
end $$;

-- 2) the catalog table (additive)
create table if not exists public.nest_assets (
  id text primary key,
  slug text unique,
  title text not null,
  image_url text not null,
  cutout_url text,
  variants jsonb not null default '{}'::jsonb,
  category text not null,
  compatible_slot_types text[] not null default '{}',
  editable_surfaces jsonb,
  hotspots jsonb,
  visual_bounds jsonb,
  camera_dna_version text,
  status public.nest_library_status not null default 'draft',
  tags text[] not null default '{}',
  source_candidate_id text,
  created_at timestamptz not null default now()
);

-- 3) RLS (idempotent)
alter table public.nest_assets enable row level security;

-- 4) world-readable SELECT policy (guarded, NO DROP) — lets the editor (anon key) read.
--    Writes are service-role only (bypass RLS), so no write policy is created here.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'nest_assets' and policyname = 'nest_assets_read'
  ) then
    create policy nest_assets_read on public.nest_assets for select using (true);
  end if;
end $$;

-- 5) refresh the PostgREST schema cache so the REST API exposes the new table
notify pgrst, 'reload schema';
