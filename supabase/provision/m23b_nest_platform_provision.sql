-- ─────────────────────────────────────────────────────────────────────────────
-- Nestudio — M23B CANONICAL NEST PLATFORM (single provisioning file)
-- Project: srrmkdsvldlyllsxyhtq
--
-- ⚠ FOUNDER-APPLIED. Claude never runs this. Review, then run once in the Supabase
--   SQL editor. It supersedes `nests_canonical_provision.sql`, which could not run
--   (it ALTERed public.nest_objects, a table that does not exist in this project).
--
-- ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
-- Live inspection of the project on 2026-07-28 found:
--   • public.nests            → ABSENT
--   • public.nest_objects     → ABSENT
--   • public.nest_backgrounds → ABSENT
--   • public.nest_templates   → ABSENT
--   • public.nest_likes / nest_comments / creator_follows → ABSENT
--   • public.nest_assets      → PRESENT (1 row) — created by beta_nest_assets_provision.sql
--   • public.profiles         → PRESENT (5 rows), legacy shape, no house_style
--   • public.notifications    → PRESENT, the LEGACY pre-pivot table (user_id / shop_id)
-- i.e. supabase/migrations/20260702_01_nest_platform.sql was never applied; only the
-- standalone provision/ scripts were. This file brings the project to the state the
-- application code expects, and is safe whether or not that migration is applied later.
--
-- ── WHY NOT JUST RUN 20260702_01 + 20260703_01? ──────────────────────────────
--   1. 20260702_01 gives nests.background_id a NOT NULL FK → nest_backgrounds, and
--      nest_objects.asset_id a NOT NULL FK → nest_assets. Both target tables are empty
--      or near-empty, and the curated library actually ships as an in-repo fixture
--      (lib/nest-production-library.ts → NEST_PRODUCTION_LIBRARY_V1). Those FKs would
--      make EVERY insert fail, and make an overlay placement ("overlay:text") a
--      constraint violation by construction.
--   2. 20260703_01 does `create table if not exists public.notifications`, which SKIPS
--      the existing legacy table, and then creates policies referencing `recipient_id` —
--      a column that does not exist here. It aborts. This file reuses the legacy table.
--
-- ── SAFETY ───────────────────────────────────────────────────────────────────
-- Additive and idempotent. No DROP TABLE, no DELETE, no UPDATE of existing rows.
-- The only drops are of foreign-key constraints that block legitimate content, and
-- only if they are present.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 0) Enums ─────────────────────────────────────────────────────────────────
do $$ begin
  create type public.nest_visibility as enum ('draft', 'public', 'unlisted', 'followers', 'private');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.nest_library_status as enum ('draft', 'approved', 'hidden', 'archived', 'featured');
exception when duplicate_object then null; end $$;

-- The legacy enum is ('house_view','like','follow','guestbook_entry','item_click',
-- 'report_status') — it already carries 'like' and 'follow' but not 'comment'.
alter type public.notification_type add value if not exists 'comment';

-- ── 1) profiles — creator identity + the one selected house ──────────────────
-- `display_name` is already NOT NULL here; `username` already has a UNIQUE constraint.
-- We add case-insensitive uniqueness and the house selection.
alter table public.profiles add column if not exists house_style text;
-- Unlimited creator links (M20). Previously localStorage-only, so a visitor never saw
-- them; shape is [{ "label": "…", "url": "…" }].
alter table public.profiles add column if not exists links jsonb;
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username)) where username is not null;

alter table public.profiles enable row level security;
do $$ begin
  -- Creators must be publicly discoverable by username (Explore/Search, /@handle).
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_read_public') then
    create policy profiles_read_public on public.profiles for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_owner_insert') then
    create policy profiles_owner_insert on public.profiles for insert to authenticated with check (id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_owner_update') then
    create policy profiles_owner_update on public.profiles for update to authenticated
      using (id = auth.uid()) with check (id = auth.uid());
  end if;
end $$;

-- ── 2) nests — one row per Nest a creator composes ───────────────────────────
-- NOTE the deliberate omissions vs 20260702_01: `background_id` and `source_template_id`
-- are plain text with NO foreign key. The background/template catalogue is an in-repo
-- fixture today; an FK to an empty table would block every insert.
create table if not exists public.nests (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'My Nest',
  background_id text not null,
  visibility public.nest_visibility not null default 'draft',
  source_template_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If 20260702_01 was applied at some point, relax the FKs it added so real content fits.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.nests'::regclass and contype = 'f'
       and (pg_get_constraintdef(oid) like '%nest_backgrounds%' or pg_get_constraintdef(oid) like '%nest_templates%')
  loop
    execute format('alter table public.nests drop constraint %I', c);
  end loop;
end $$;

create index if not exists nests_owner_idx on public.nests (owner_id);
create index if not exists nests_slug_idx on public.nests (slug);
-- Discovery reads world-readable Nests, newest first.
create index if not exists nests_public_idx on public.nests (updated_at desc)
  where visibility in ('public', 'unlisted');

-- ── 3) nest_objects — the composition, losslessly ────────────────────────────
-- Every field the editor can express has a column. `asset_id` has NO foreign key:
-- overlays are creator content whose assetId is the literal "overlay:text"/"overlay:image".
create table if not exists public.nest_objects (
  id uuid primary key default gen_random_uuid(),
  nest_id uuid not null references public.nests (id) on delete cascade,
  asset_id text not null,
  x double precision not null default 0.5,
  y double precision not null default 0.8,
  scale double precision,
  rotation double precision not null default 0,
  z_index integer not null default 1,
  -- M23B additions: the placement extras that previously had nowhere to live.
  w double precision,             -- explicit normalized box width  (overlays)
  h double precision,             -- explicit normalized box height (overlays)
  flip_x boolean not null default false,
  overlay jsonb,                  -- text/image sticker payload (NestOverlay)
  interaction jsonb,              -- object interaction configuration (hotspots/surfaces)
  label text,                     -- creator-authored label
  link_url text                   -- creator-authored link target
);

-- Idempotent column adds, for a project where the table already exists in an older shape.
alter table public.nest_objects add column if not exists w double precision;
alter table public.nest_objects add column if not exists h double precision;
alter table public.nest_objects add column if not exists flip_x boolean not null default false;
alter table public.nest_objects add column if not exists overlay jsonb;
alter table public.nest_objects add column if not exists interaction jsonb;
alter table public.nest_objects add column if not exists label text;
alter table public.nest_objects add column if not exists link_url text;
alter table public.nest_objects alter column scale drop not null;

-- Drop the asset_id → nest_assets FK if an earlier migration created it: it makes an
-- overlay placement a constraint violation. Asset integrity is enforced in the
-- application (resolveAsset) and by the library being read-only to users.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.nest_objects'::regclass and contype = 'f'
       and pg_get_constraintdef(oid) like '%nest_assets%'
  loop
    execute format('alter table public.nest_objects drop constraint %I', c);
  end loop;
end $$;

create index if not exists nest_objects_nest_idx on public.nest_objects (nest_id);

-- updated_at trigger ----------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists nests_touch_updated_at on public.nests;
create trigger nests_touch_updated_at before update on public.nests
  for each row execute function public.touch_updated_at();

-- ── 4) RLS for nests + nest_objects ──────────────────────────────────────────
alter table public.nests enable row level security;
alter table public.nest_objects enable row level security;

do $$ begin
  -- anyone, logged out included, may read world-readable Nests; owners also read drafts
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nests' and policyname='nests_read_public_or_own') then
    create policy nests_read_public_or_own on public.nests for select to anon, authenticated
      using (visibility in ('public','unlisted') or owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nests' and policyname='nests_owner_insert') then
    create policy nests_owner_insert on public.nests for insert to authenticated with check (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nests' and policyname='nests_owner_update') then
    create policy nests_owner_update on public.nests for update to authenticated
      using (owner_id = auth.uid()) with check (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nests' and policyname='nests_owner_delete') then
    create policy nests_owner_delete on public.nests for delete to authenticated using (owner_id = auth.uid());
  end if;

  -- objects inherit their parent Nest's readability, so a public Nest renders COMPLETELY
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nest_objects' and policyname='nest_objects_read_with_nest') then
    create policy nest_objects_read_with_nest on public.nest_objects for select to anon, authenticated
      using (exists (select 1 from public.nests n where n.id = nest_objects.nest_id
                       and (n.visibility in ('public','unlisted') or n.owner_id = auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nest_objects' and policyname='nest_objects_owner_write') then
    create policy nest_objects_owner_write on public.nest_objects for all to authenticated
      using (exists (select 1 from public.nests n where n.id = nest_objects.nest_id and n.owner_id = auth.uid()))
      with check (exists (select 1 from public.nests n where n.id = nest_objects.nest_id and n.owner_id = auth.uid()));
  end if;
end $$;

-- ── 5) Social — likes, comments, follows ─────────────────────────────────────
-- Keyed by the Nest's stable slug so a like survives any future id change and can be
-- resolved from a share URL without a second lookup.
create table if not exists public.nest_likes (
  nest_slug text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (nest_slug, user_id)          -- one like per user per Nest, enforced by the DB
);

create table if not exists public.nest_comments (
  id uuid primary key default gen_random_uuid(),
  nest_slug text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists nest_comments_slug_idx on public.nest_comments (nest_slug, created_at desc);

create table if not exists public.creator_follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  creator_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, creator_id),
  check (follower_id <> creator_id)
);

alter table public.nest_likes enable row level security;
alter table public.nest_comments enable row level security;
alter table public.creator_follows enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nest_likes' and policyname='nest_likes_read') then
    create policy nest_likes_read on public.nest_likes for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nest_likes' and policyname='nest_likes_own_write') then
    create policy nest_likes_own_write on public.nest_likes for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nest_comments' and policyname='nest_comments_read') then
    create policy nest_comments_read on public.nest_comments for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nest_comments' and policyname='nest_comments_own_write') then
    create policy nest_comments_own_write on public.nest_comments for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='creator_follows' and policyname='creator_follows_read') then
    create policy creator_follows_read on public.creator_follows for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='creator_follows' and policyname='creator_follows_own_write') then
    create policy creator_follows_own_write on public.creator_follows for all to authenticated
      using (follower_id = auth.uid()) with check (follower_id = auth.uid());
  end if;
end $$;

-- ── 6) Notifications — REUSE the existing table, do not fork it ──────────────
-- The live table is the legacy pre-pivot one: (user_id, type, title, body, href,
-- actor_id, shop_id, read, created_at). It is a perfectly good recipient inbox; all it
-- lacks is a way to point at the Nest that caused the notification, so a later unlike
-- can withdraw the right row. One nullable column, nothing else.
alter table public.notifications add column if not exists entity_id text;
create index if not exists notifications_entity_idx on public.notifications (user_id, type, entity_id);

alter table public.notifications enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='notifications_read_own') then
    create policy notifications_read_own on public.notifications for select to authenticated using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='notifications_update_own') then
    create policy notifications_update_own on public.notifications for update to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  -- An actor writes a notification INTO someone else's inbox (a like/comment on their
  -- Nest), so the insert check is on actor_id, not user_id.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='notifications_insert_as_actor') then
    create policy notifications_insert_as_actor on public.notifications for insert to authenticated
      with check (actor_id = auth.uid() and user_id <> auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='notifications_delete_as_actor') then
    create policy notifications_delete_as_actor on public.notifications for delete to authenticated
      using (actor_id = auth.uid());
  end if;
end $$;

-- ── 7) Reload PostgREST's schema cache so the new tables are reachable ───────
notify pgrst, 'reload schema';

-- ── VERIFY AFTER RUNNING ─────────────────────────────────────────────────────
--   select to_regclass('public.nests'), to_regclass('public.nest_objects'),
--          to_regclass('public.nest_likes'), to_regclass('public.nest_comments');
--   select column_name from information_schema.columns
--    where table_schema='public' and table_name='nest_objects' order by ordinal_position;
--   select policyname, cmd from pg_policies where schemaname='public'
--    and tablename in ('nests','nest_objects','profiles','nest_likes','nest_comments');
