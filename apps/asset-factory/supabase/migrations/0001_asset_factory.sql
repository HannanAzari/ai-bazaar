-- Nestudio Asset Factory V2 — shared review backend.
-- Self-contained: these tables belong to the Asset Factory only and are unrelated
-- to the main Nestudio app's schema. Safe to run in the same Supabase project or a
-- dedicated one. All access is server-side via the service role; RLS denies anon.

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
  created_at          text not null,
  updated_at          timestamptz not null default now()
);

create index if not exists asset_candidates_status_idx on public.asset_candidates (status);
create index if not exists asset_candidates_created_idx on public.asset_candidates (created_at desc);

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

-- ── RLS: deny all to anon; the service role bypasses RLS ─────────────────────
-- The app reaches these tables only through password-gated server routes using the
-- service-role key, so no anon policies are created (default deny).
alter table public.asset_candidates enable row level security;
alter table public.asset_review_actions enable row level security;

-- ── Storage bucket for uploaded/imported images ─────────────────────────────
insert into storage.buckets (id, name, public)
values ('asset-candidates', 'asset-candidates', true)
on conflict (id) do nothing;
