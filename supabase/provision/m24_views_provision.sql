-- ─────────────────────────────────────────────────────────────────────────────
-- Nestudio — M24 VIEWS (additive provisioning)
-- Project: srrmkdsvldlyllsxyhtq
--
-- ⚠ FOUNDER-APPLIED. Claude never runs this. Review, then run once in the SQL editor.
--
-- WHY: view counts were localStorage-only, so they were per-browser and always read 0 for
-- anyone else. This adds the two tables that make them real and shared.
--
-- ── THE DEDUPLICATION RULE, ENFORCED BY THE DATABASE ─────────────────────────
--
-- One view per viewer per Nest per UTC day. It is a plain `view_day date` column with a
-- unique index rather than a "within the last 24 hours" query, because that makes dedup
-- an atomic `insert … on conflict do nothing`:
--
--   • no read-then-write race (two tabs opening at once cannot both count),
--   • no expression index (date_trunc on a timestamptz is STABLE, not IMMUTABLE, so it
--     cannot be indexed directly — a stored column can),
--   • and the rule is legible in the schema instead of buried in application code.
--
-- A UTC-day bucket is a documented beta simplification of "per 24 hours": a viewer who
-- returns either side of midnight UTC counts twice. That is acceptable for beta and is
-- recorded in DECISIONS.md rather than left as a surprise.
--
-- `viewer_key` is `auth.uid()` for a signed-in viewer, or an opaque random id kept in the
-- browser for an anonymous one. It is deliberately NOT an IP address or a fingerprint —
-- nothing here identifies a person.
--
-- SAFETY: additive and idempotent. No DROP, no DELETE, no change to existing tables.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1) Nest views ────────────────────────────────────────────────────────────
create table if not exists public.nest_views (
  id uuid primary key default gen_random_uuid(),
  nest_slug text not null,
  viewer_key text not null,
  -- Stamped at insert so the unique index below can be a plain b-tree.
  view_day date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now()
);

create unique index if not exists nest_views_once_per_day
  on public.nest_views (nest_slug, viewer_key, view_day);
create index if not exists nest_views_slug_idx on public.nest_views (nest_slug);

-- ── 2) Profile / House views ─────────────────────────────────────────────────
create table if not exists public.profile_views (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references auth.users (id) on delete cascade,
  viewer_key text not null,
  view_day date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now()
);

create unique index if not exists profile_views_once_per_day
  on public.profile_views (profile_id, viewer_key, view_day);
create index if not exists profile_views_profile_idx on public.profile_views (profile_id);

-- ── 3) RLS ───────────────────────────────────────────────────────────────────
-- Counts are public (they are shown on every Profile and Nest). Anyone may record a
-- view, including logged-out visitors — that is the point of a view counter. The unique
-- index is what stops one visitor counting twice in a day.
--
-- Note for the record: an adversary could still inflate a count by rotating their
-- anonymous key. Beta accepts that; it is a vanity metric, not billing.
alter table public.nest_views enable row level security;
alter table public.profile_views enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nest_views' and policyname='nest_views_read') then
    create policy nest_views_read on public.nest_views for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nest_views' and policyname='nest_views_insert') then
    create policy nest_views_insert on public.nest_views for insert to anon, authenticated with check (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profile_views' and policyname='profile_views_read') then
    create policy profile_views_read on public.profile_views for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profile_views' and policyname='profile_views_insert') then
    create policy profile_views_insert on public.profile_views for insert to anon, authenticated with check (true);
  end if;
end $$;

notify pgrst, 'reload schema';

-- ── VERIFY AFTER RUNNING ─────────────────────────────────────────────────────
--   select to_regclass('public.nest_views'), to_regclass('public.profile_views');
--   select indexname from pg_indexes where tablename in ('nest_views','profile_views');
