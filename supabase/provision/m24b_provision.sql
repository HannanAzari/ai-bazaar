-- ─────────────────────────────────────────────────────────────────────────────
-- Nestudio — M24B (additive provisioning). Project: srrmkdsvldlyllsxyhtq
--
-- ⚠ FOUNDER-APPLIED. Review, then run once in the SQL editor.
--
-- SUPERSEDES `m24_views_provision.sql` — do NOT run that one. It created a
-- `profile_views` table, and M24B's decision is that profile/house views do not exist:
-- a creator's totals are the SUM over their published Nests (rooms.xyz model).
--
-- Two things only:
--   1. nest_views  — per-Nest view counter, deduped by the database.
--   2. nests.draft_doc / draft_updated_at — the YouTube-style draft workflow.
--
-- SAFETY: additive and idempotent. No DROP, no DELETE, no rewrite of existing rows.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1) Nest views ────────────────────────────────────────────────────────────
--
-- One view per viewer per Nest per UTC day. `view_day` is a stored column so the unique
-- index can be a plain b-tree (date_trunc on a timestamptz is STABLE, not IMMUTABLE, so
-- it cannot be indexed). That makes recording an atomic `insert … on conflict do nothing`
-- with no read-then-write race: two tabs opening at once cannot both count.
--
-- `viewer_key` is auth.uid() for a signed-in viewer, or an opaque random id kept in the
-- browser. Never an IP, never a fingerprint.
create table if not exists public.nest_views (
  id uuid primary key default gen_random_uuid(),
  nest_slug text not null,
  viewer_key text not null,
  view_day date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now()
);

create unique index if not exists nest_views_once_per_day
  on public.nest_views (nest_slug, viewer_key, view_day);
create index if not exists nest_views_slug_idx on public.nest_views (nest_slug);

alter table public.nest_views enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nest_views' and policyname='nest_views_read') then
    create policy nest_views_read on public.nest_views for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nest_views' and policyname='nest_views_insert') then
    create policy nest_views_insert on public.nest_views for insert to anon, authenticated with check (true);
  end if;
end $$;

-- ── 2) Draft workflow ────────────────────────────────────────────────────────
--
-- A published Nest stays live, untouched, while the creator edits over several sessions —
-- exactly like a YouTube draft. The unpublished scene lives in ONE jsonb column rather
-- than a duplicate set of nest_objects rows, because:
--   • visitors read `nest_objects`, so a draft that lives elsewhere can never leak;
--   • publishing is then a single transactional swap rather than a diff;
--   • and there is no way for a draft row to be mistaken for a live one.
--
-- `draft_doc` holds { title, backgroundId, placements[] } — the same canonical scene
-- document the editor and every renderer already use. NULL means "no unpublished work".
alter table public.nests add column if not exists draft_doc jsonb;
alter table public.nests add column if not exists draft_updated_at timestamptz;

-- ── M24C — focus regions and their child scenes ──────────────────────────────
--
-- `nest_objects` holds the MAIN scene's placements. Focus regions, and the objects a
-- creator places INSIDE them, are not root placements — they lived only in the editor's
-- React state and were destroyed when it unmounted. (A plant placed inside a Focus region
-- vanished on save; that is the regression fixture.)
--
-- One jsonb column rather than more tables: this is a nested authoring structure the
-- editor owns wholesale, it is always read and written together with the Nest, and
-- widening it must not need another migration.
alter table public.nests add column if not exists scene_extras jsonb;

create index if not exists nests_with_draft_idx on public.nests (owner_id)
  where draft_doc is not null;

notify pgrst, 'reload schema';

-- ── VERIFY AFTER RUNNING ─────────────────────────────────────────────────────
--   select to_regclass('public.nest_views');
--   select column_name from information_schema.columns
--    where table_schema='public' and table_name='nests' and column_name like 'draft%';
