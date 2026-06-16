-- Nestudio Asset Factory V3 — generation jobs (AI generation queue).
-- Server-side access only (service role); RLS denies anon, same as the V2/V2.5 tables.

create table if not exists public.asset_generation_jobs (
  id                       text primary key,
  status                   text not null default 'draft',
  category                 text not null,
  pack                     text not null default '',
  count                    integer not null default 1,
  subject                  text not null default '',
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

alter table public.asset_generation_jobs enable row level security;
