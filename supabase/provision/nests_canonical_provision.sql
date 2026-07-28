-- ─────────────────────────────────────────────────────────────────────────────
-- Nestudio — M23 CANONICAL NEST STORAGE (corrective migration).
-- Project: srrmkdsvldlyllsxyhtq
--
-- ⚠ DO NOT RUN until the founder approves. Shown for review, per the standing rule that
--   every migration is founder-provisioned.
--
-- CORRECTION vs an earlier draft of this file: `public.nests` and `public.nest_objects`
-- ALREADY EXIST — they are created by supabase/migrations/20260702_01_nest_platform.sql
-- (:78, :93) and appear in supabase/schema.sql (:760, :775). This file therefore ALTERs
-- them; it does not recreate them. Whether that base migration has been APPLIED to the live
-- project cannot be determined from the repo — verify before running (query 1 below).
--
-- WHY THIS IS NEEDED — the existing table cannot store a Nest faithfully:
--   1. `nest_objects` has no column for overlays (text/image stickers), nor for the
--      explicit box `w`/`h` the editor uses.
--   2. `asset_id text not null references public.nest_assets(id)` REJECTS overlay
--      placements, whose assetId is the literal "overlay:text" / "overlay:image".
--   3. lib/nest/supabase-nest-repo.ts writes `rotation: 0` hard-coded (:78) and never reads
--      rotation back in toDoc (:50) — so rotation is destroyed on the Supabase path.
--      (That is an application fix, not SQL, but it is why the column looks unused.)
--
-- Without 1–3, publishing to Supabase is LOSSIER than the current localStorage path.
--
-- SAFETY: additive. Adds columns, relaxes one FK, adds policies. No DROP TABLE, no DELETE,
-- no data rewrite. Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 0) VERIFY FIRST (run these two SELECTs before anything else) ──────────────
--    Does the base schema exist at all?
--      select to_regclass('public.nests'), to_regclass('public.nest_objects');
--    What is actually stored right now?
--      select count(*) from public.nests;  select count(*) from public.nest_objects;
--    If to_regclass returns NULL, apply supabase/migrations/20260702_01_nest_platform.sql first.

-- ── 1) Let a placement carry everything the editor can express ────────────────
alter table public.nest_objects add column if not exists overlay jsonb;   -- text/image sticker payload
alter table public.nest_objects add column if not exists w double precision; -- explicit box width  (0–1)
alter table public.nest_objects add column if not exists h double precision; -- explicit box height (0–1)
alter table public.nest_objects add column if not exists flip_x boolean not null default false;

-- ── 2) Allow overlay placements. `asset_id` currently points at the official library, which
--       makes "overlay:text" a foreign-key violation. Overlays are creator content, not
--       library assets, so the constraint has to go; integrity for real assets is enforced in
--       the application (resolveAsset) and by the library being read-only to users.
do $$
declare c text;
begin
  select conname into c
    from pg_constraint
   where conrelid = 'public.nest_objects'::regclass
     and contype = 'f'
     and pg_get_constraintdef(oid) like '%nest_assets%';
  if c is not null then execute format('alter table public.nest_objects drop constraint %I', c); end if;
end $$;

-- ── 3) Discovery index — the feed reads world-readable Nests, newest first.
create index if not exists nests_public_idx on public.nests (updated_at desc)
  where visibility in ('public','unlisted');

-- ── 4) RLS — the access rules M23 §3 specifies. Guarded so re-running is safe.
alter table public.nests enable row level security;
alter table public.nest_objects enable row level security;

do $$
begin
  -- anyone, logged out included, may read world-readable Nests; owners also read their drafts
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nests' and policyname='nests_read_public_or_own') then
    create policy nests_read_public_or_own on public.nests for select
      to anon, authenticated
      using (visibility in ('public','unlisted') or owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nests' and policyname='nests_owner_insert') then
    create policy nests_owner_insert on public.nests for insert
      to authenticated with check (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nests' and policyname='nests_owner_update') then
    create policy nests_owner_update on public.nests for update
      to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nests' and policyname='nests_owner_delete') then
    create policy nests_owner_delete on public.nests for delete
      to authenticated using (owner_id = auth.uid());
  end if;

  -- objects inherit their parent Nest's readability, so a public Nest renders COMPLETELY
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nest_objects' and policyname='nest_objects_read_with_nest') then
    create policy nest_objects_read_with_nest on public.nest_objects for select
      to anon, authenticated
      using (exists (
        select 1 from public.nests n
        where n.id = nest_objects.nest_id
          and (n.visibility in ('public','unlisted') or n.owner_id = auth.uid())
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nest_objects' and policyname='nest_objects_owner_write') then
    create policy nest_objects_owner_write on public.nest_objects for all
      to authenticated
      using (exists (select 1 from public.nests n where n.id = nest_objects.nest_id and n.owner_id = auth.uid()))
      with check (exists (select 1 from public.nests n where n.id = nest_objects.nest_id and n.owner_id = auth.uid()));
  end if;
end $$;

-- ── 5) Creator identity + house selection (M23 §1 onboarding, §9 one house per creator).
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists house_style text;
create unique index if not exists profiles_username_key on public.profiles (lower(username)) where username is not null;

notify pgrst, 'reload schema';
