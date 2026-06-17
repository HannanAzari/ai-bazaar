-- Nestudio Asset Factory V3.2 — store the chosen style family on generation jobs.

alter table public.asset_generation_jobs
  add column if not exists style_id text not null default 'royal_match';
