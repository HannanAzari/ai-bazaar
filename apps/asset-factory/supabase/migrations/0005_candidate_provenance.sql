-- V3.7.5 — provenance columns so saved Style Lab assets carry their lifestyle
-- personality + origin. Safe to run on an existing DB (idempotent).
alter table public.asset_candidates add column if not exists personality      text;
alter table public.asset_candidates add column if not exists source           text;
alter table public.asset_candidates add column if not exists source_sample_id text;

-- Helps the Review/library filter "saved from Style Lab" quickly.
create index if not exists asset_candidates_source_idx on public.asset_candidates (source);
