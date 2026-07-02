-- ── M12 — Nest Platform: real persistence ────────────────────────────────────
-- Production tables for the M10/M11 Nest flow (production library + Nest documents).
-- Namespaced `nest_*` to avoid colliding with the existing V1 `public.assets` /
-- `public.profiles`. Idempotent so it can be applied to the existing project.
--
-- Invariants preserved from M10/M11:
--   • library items are NEVER deleted — only re-statused (published Nests keep
--     resolving archived backgrounds/assets forever → library SELECT allows any row)
--   • public/unlisted Nests are world-readable; draft/private/followers are owner-only
--     (enforced server-side by RLS, not by a URL payload)

-- Enums -----------------------------------------------------------------------
do $$ begin
  create type public.nest_visibility as enum ('draft', 'public', 'unlisted', 'followers', 'private');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.nest_library_status as enum ('draft', 'approved', 'hidden', 'archived', 'featured');
exception when duplicate_object then null; end $$;

-- profiles (extend the existing table) ----------------------------------------
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio text;
create unique index if not exists profiles_username_key on public.profiles (lower(username)) where username is not null;

-- Curated library: backgrounds ------------------------------------------------
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

-- Curated library: assets (namespaced — NOT the V1 public.assets) -------------
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

-- Curated library: templates (pre-populated Nests) ----------------------------
create table if not exists public.nest_templates (
  id text primary key,
  slug text unique,
  title text not null,
  persona text,
  background_id text references public.nest_backgrounds (id),
  placements jsonb not null default '[]'::jsonb,
  preview_image text,
  status public.nest_library_status not null default 'draft',
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Nests (one per creation) ----------------------------------------------------
create table if not exists public.nests (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  owner_id uuid references auth.users (id) on delete cascade,
  title text not null default 'My Nest',
  background_id text not null references public.nest_backgrounds (id),
  visibility public.nest_visibility not null default 'draft',
  source_template_id text references public.nest_templates (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists nests_owner_idx on public.nests (owner_id);
create index if not exists nests_slug_idx on public.nests (slug);

-- Nest objects (placements) ---------------------------------------------------
create table if not exists public.nest_objects (
  id uuid primary key default gen_random_uuid(),
  nest_id uuid not null references public.nests (id) on delete cascade,
  asset_id text not null references public.nest_assets (id),
  x double precision not null default 0.5,
  y double precision not null default 0.8,
  scale double precision not null default 0.45,
  rotation double precision not null default 0,
  z_index integer not null default 1
);
create index if not exists nest_objects_nest_idx on public.nest_objects (nest_id);

-- updated_at trigger for nests ------------------------------------------------
create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists nests_touch_updated_at on public.nests;
create trigger nests_touch_updated_at before update on public.nests
  for each row execute function public.touch_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.nest_backgrounds enable row level security;
alter table public.nest_assets enable row level security;
alter table public.nest_templates enable row level security;
alter table public.nests enable row level security;
alter table public.nest_objects enable row level security;

-- Library: world-readable (ANY status, so published Nests resolve archived items).
-- Writes are service-role only (admin) — the service key bypasses RLS, so no policy.
drop policy if exists nest_backgrounds_read on public.nest_backgrounds;
create policy nest_backgrounds_read on public.nest_backgrounds for select using (true);
drop policy if exists nest_assets_read on public.nest_assets;
create policy nest_assets_read on public.nest_assets for select using (true);
drop policy if exists nest_templates_read on public.nest_templates;
create policy nest_templates_read on public.nest_templates for select using (true);

-- Nests: public/unlisted are world-readable; everything else owner-only.
drop policy if exists nests_read on public.nests;
create policy nests_read on public.nests for select
  using (visibility in ('public', 'unlisted') or owner_id = auth.uid());
drop policy if exists nests_insert on public.nests;
create policy nests_insert on public.nests for insert with check (owner_id = auth.uid());
drop policy if exists nests_update on public.nests;
create policy nests_update on public.nests for update using (owner_id = auth.uid());
drop policy if exists nests_delete on public.nests;
create policy nests_delete on public.nests for delete using (owner_id = auth.uid());

-- Nest objects: readable iff the parent nest is readable; writable iff owned.
drop policy if exists nest_objects_read on public.nest_objects;
create policy nest_objects_read on public.nest_objects for select using (
  exists (select 1 from public.nests n where n.id = nest_id
          and (n.visibility in ('public', 'unlisted') or n.owner_id = auth.uid())));
drop policy if exists nest_objects_write on public.nest_objects;
create policy nest_objects_write on public.nest_objects for all
  using (exists (select 1 from public.nests n where n.id = nest_id and n.owner_id = auth.uid()))
  with check (exists (select 1 from public.nests n where n.id = nest_id and n.owner_id = auth.uid()));
