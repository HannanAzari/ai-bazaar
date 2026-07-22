-- ─────────────────────────────────────────────────────────────────────────────
-- Nestudio — ADDITIVE provisioning of the dedicated Nest Library (`nest_backgrounds`).
-- Project: srrmkdsvldlyllsxyhtq  ·  matches supabase/migrations/20260702_01_nest_platform.sql
-- (+ one additive `metadata` column for Nest Factory DNA).
--
-- SAFETY (verified): additive only. No DROP, no DELETE, no destructive ALTER, no overwrite
-- of existing tables/rows/buckets/policies. Never touches public.assets (V1), nest_assets,
-- or any other object. Idempotent — safe to run more than once.
-- Storage: the `nestudio-assets` bucket already EXISTS (public) — nothing to create.
-- Run in the Supabase SQL editor (recommended, human-in-loop).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) status enum (shared with nest_assets; guarded — CREATE TYPE has no IF NOT EXISTS)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'nest_library_status') then
    create type public.nest_library_status as enum ('draft','approved','hidden','archived','featured');
  end if;
end $$;

-- 2) the Nest Library table (additive; matches the authored nest_platform schema)
create table if not exists public.nest_backgrounds (
  id text primary key,
  slug text unique,
  title text not null,
  image_url text not null,
  variants jsonb not null default '{}'::jsonb,
  style text,
  status public.nest_library_status not null default 'draft',
  camera_dna_version text,
  tags text[] not null default '{}',
  source_candidate_id text,
  created_at timestamptz not null default now()
);

-- 2b) Nest Factory DNA metadata (mood, lighting, palette, walls, dnaScore…) — additive column
alter table public.nest_backgrounds add column if not exists metadata jsonb not null default '{}'::jsonb;

-- 3) RLS (idempotent)
alter table public.nest_backgrounds enable row level security;

-- 4) world-readable SELECT policy (guarded, NO DROP) — lets the editor (anon key) read.
--    Writes are service-role only (bypass RLS), so no write policy is created here.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'nest_backgrounds' and policyname = 'nest_backgrounds_read'
  ) then
    create policy nest_backgrounds_read on public.nest_backgrounds for select using (true);
  end if;
end $$;

-- 5) refresh the PostgREST schema cache so the REST API exposes the new table
notify pgrst, 'reload schema';
