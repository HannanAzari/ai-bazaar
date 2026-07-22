-- ─────────────────────────────────────────────────────────────────────────────
-- Nestudio — ADDITIVE provisioning for Avatar Factory: a PRIVATE bucket + the
-- per-user `user_avatars` table with owner-only RLS. Project: srrmkdsvldlyllsxyhtq.
--
-- ⚠ DO NOT RUN until the founder approves. Shown for review per the sprint spec.
--
-- SAFETY: additive only. No DROP, no DELETE, no destructive ALTER, no overwrite of
-- existing tables/rows/buckets/policies. Never touches profiles, nest_assets,
-- nest_backgrounds, or any existing bucket. Idempotent.
--
-- WHY a new bucket: every existing bucket (avatars, user-uploads, …) is public=true.
-- Source photos of real people MUST NOT live in a public bucket. This creates the
-- FIRST private bucket, owner-scoped by RLS.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) PRIVATE bucket for source photos + unpublished avatar outputs (public=false).
insert into storage.buckets (id, name, public)
values ('avatar-private', 'avatar-private', false)
on conflict (id) do nothing;

-- 1a) Owner-only storage RLS: a user may only touch objects under their own uid folder
--     (path convention: `<auth.uid()>/…`). No public read — signed URLs only, server-side.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='avatar_private_owner_rw') then
    create policy avatar_private_owner_rw on storage.objects for all
      to authenticated
      using (bucket_id = 'avatar-private' and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = 'avatar-private' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;

-- 2) status enum (shared; guarded)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'nest_library_status') then
    create type public.nest_library_status as enum ('draft','approved','hidden','archived','featured');
  end if;
end $$;

-- 3) per-user avatar catalog (owner-scoped; supports history, poses, status, cost, deletion)
create table if not exists public.user_avatars (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text,
  source_private_url text,   -- private bucket path (source photo) — NEVER public
  output_private_url text,   -- private bucket path (unpublished/review output)
  public_profile_url text,   -- public URL, set ONLY when this avatar is the active profile avatar
  editor_asset_url text,     -- owner-scoped placeable output
  active boolean not null default false,
  pose text not null default 'idle-standing',
  style_version text,
  metadata jsonb not null default '{}'::jsonb,
  generation_history jsonb not null default '[]'::jsonb,
  cost jsonb not null default '{}'::jsonb,      -- { reference, generation, total }
  status public.nest_library_status not null default 'draft',
  created_at timestamptz not null default now(),
  deleted_at timestamptz                        -- soft delete
);

create index if not exists user_avatars_owner_idx on public.user_avatars (owner_id) where deleted_at is null;
-- At most one ACTIVE, non-deleted avatar per owner.
create unique index if not exists user_avatars_one_active on public.user_avatars (owner_id) where active and deleted_at is null;

-- 4) RLS — OWNER-ONLY. No public row read; the public profile shows only profiles.avatar_url
--    (set to the public output on activation), never a user_avatars row.
alter table public.user_avatars enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_avatars' and policyname='user_avatars_owner_select') then
    create policy user_avatars_owner_select on public.user_avatars for select
      to authenticated using (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_avatars' and policyname='user_avatars_owner_insert') then
    create policy user_avatars_owner_insert on public.user_avatars for insert
      to authenticated with check (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_avatars' and policyname='user_avatars_owner_update') then
    create policy user_avatars_owner_update on public.user_avatars for update
      to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_avatars' and policyname='user_avatars_owner_delete') then
    create policy user_avatars_owner_delete on public.user_avatars for delete
      to authenticated using (owner_id = auth.uid());
  end if;
end $$;

notify pgrst, 'reload schema';
