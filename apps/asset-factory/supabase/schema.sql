-- Nestudio Asset Factory — canonical fresh-install schema (V2).
-- The superset to apply on a brand-new database (paste into the Supabase SQL
-- editor). For an existing DB, apply the ordered files in ./migrations instead.
-- Independent of the main Nestudio app's schema.

-- ── Asset candidates ─────────────────────────────────────────────────────────
create table if not exists public.asset_candidates (
  id                  text primary key,
  name                text not null,
  slug                text not null,
  category            text not null,
  pack                text not null default 'imported',
  status              text not null default 'needs_review',
  image_url           text not null default '',
  local_path          text,
  prompt              text not null default '',
  negative_prompt     text not null default '',
  model_provider      text not null default 'manual',
  model_name          text not null default 'import',
  seed                integer not null default 0,
  width               integer not null default 0,
  height              integer not null default 0,
  transparent         boolean not null default true,
  tags                jsonb not null default '[]'::jsonb,
  compatible_zones    jsonb not null default '[]'::jsonb,
  placement_type      text not null default 'floor',
  default_scale       numeric not null default 1,
  default_action_type text not null default 'none',
  style_score         numeric not null default 0,
  quality_notes       text not null default '',
  reviewer            text not null default '',
  reviewed_at         text not null default '',
  personality         text,
  source              text,
  source_sample_id    text,
  created_at          text not null,
  updated_at          timestamptz not null default now()
);

create index if not exists asset_candidates_status_idx on public.asset_candidates (status);
create index if not exists asset_candidates_created_idx on public.asset_candidates (created_at desc);
create index if not exists asset_candidates_source_idx on public.asset_candidates (source);

-- ── Review activity log ──────────────────────────────────────────────────────
create table if not exists public.asset_review_actions (
  id             text primary key,
  candidate_id   text not null,
  candidate_name text not null default '',
  action         text not null,
  reviewer       text not null default '',
  note           text,
  created_at     text not null
);

create index if not exists asset_review_actions_created_idx on public.asset_review_actions (created_at desc);
create index if not exists asset_review_actions_candidate_idx on public.asset_review_actions (candidate_id);

-- ── Asset packs (V2.5) ───────────────────────────────────────────────────────
create table if not exists public.asset_packs (
  id          text primary key,
  slug        text not null,
  name        text not null,
  description text not null default '',
  theme       text not null default '',
  status      text not null default 'draft',
  asset_ids   jsonb not null default '[]'::jsonb,
  created_at  text not null,
  updated_at  timestamptz not null default now()
);

create index if not exists asset_packs_created_idx on public.asset_packs (created_at);

-- ── Generation jobs (V3) ─────────────────────────────────────────────────────
create table if not exists public.asset_generation_jobs (
  id                       text primary key,
  status                   text not null default 'draft',
  category                 text not null,
  pack                     text not null default '',
  count                    integer not null default 1,
  subject                  text not null default '',
  style_id                 text not null default 'royal_match',
  prompt                   text not null default '',
  negative_prompt          text not null default '',
  model_provider           text not null default 'replicate',
  model_name               text not null default '',
  requested_by             text not null default '',
  estimated_cost           numeric not null default 0,
  actual_cost              numeric,
  dry_run                  boolean not null default true,
  generated_candidate_ids  jsonb not null default '[]'::jsonb,
  error                    text,
  created_at               text not null,
  started_at               text,
  completed_at             text,
  updated_at               timestamptz not null default now()
);

create index if not exists asset_generation_jobs_created_idx on public.asset_generation_jobs (created_at desc);
create index if not exists asset_generation_jobs_status_idx on public.asset_generation_jobs (status);

-- ── RLS: deny all to anon; the service role bypasses RLS ─────────────────────
alter table public.asset_candidates enable row level security;
alter table public.asset_review_actions enable row level security;
alter table public.asset_packs enable row level security;
alter table public.asset_generation_jobs enable row level security;

-- ── Storage bucket for uploaded/imported images ─────────────────────────────
insert into storage.buckets (id, name, public)
values ('asset-candidates', 'asset-candidates', true)
on conflict (id) do nothing;
