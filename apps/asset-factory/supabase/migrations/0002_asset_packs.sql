-- Nestudio Asset Factory V2.5 — asset packs (catalog pipeline validation).
-- Server-side access only (service role); RLS denies anon, same as V2 tables.

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

alter table public.asset_packs enable row level security;
