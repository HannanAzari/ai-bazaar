-- ─────────────────────────────────────────────────────────────────────────────
-- Nestudio — ADDITIVE provisioning for the Avatar Identity Engine (two-stage).
-- A per-user `avatar_identities` table: durable storage for an APPROVED (frozen)
-- identity so every future avatar reuses the SAME face instead of re-inventing it.
-- Project: srrmkdsvldlyllsxyhtq.
--
-- ⚠ DO NOT RUN until the founder approves. Shown for review per the sprint spec.
--   The A/B bench (/nest-studio/avatar-ab) proves the workflow WITHOUT this table —
--   it holds the candidate/frozen identity in session and never writes until the
--   founder provisions durable storage here. This is the same show-then-provision
--   flow used for user_avatars and nest_backgrounds.
--
-- SAFETY: additive only. No DROP, no DELETE, no destructive ALTER, no overwrite of
-- existing tables/rows/buckets/policies. Reuses the existing PRIVATE bucket
-- (avatar-private) — creates no new bucket. Idempotent.
--
-- PRIVACY: source photo + approved identity portrait are PRIVATE user data. Only
-- private-bucket PATHS are stored here (never public URLs). skin_tone is a neutral
-- visual descriptor for resemblance only — NEVER an ethnicity/demographic label.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) per-user identity catalog. A frozen row is the reusable identity package:
--    the original photo (WHO) + the approved Nestudio portrait (HOW) both as PRIVATE paths.
create table if not exists public.avatar_identities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  version text not null,                       -- AVATAR_IDENTITY_VERSION
  source_private_url text,                      -- original photo (private bucket path) — PRIMARY likeness ref
  approved_identity_private_url text,           -- approved Stage-1 portrait (private bucket path)
  metadata jsonb not null default '{}'::jsonb,  -- neutral face descriptors (no demographics)
  frozen boolean not null default false,
  approved_by text,                             -- 'founder' | 'user'
  approved_by_user_id uuid,                     -- owner scope on approval
  prompt_version text,                          -- Stage-1 prompt version
  model_version text,                           -- generation model/version
  approved_at timestamptz,                      -- freeze timestamp
  created_at timestamptz not null default now(),
  deleted_at timestamptz                        -- soft delete (deletion contract)
);

create index if not exists avatar_identities_owner_idx on public.avatar_identities (owner_id) where deleted_at is null;
-- At most ONE frozen, non-deleted identity per owner — a frozen identity cannot be
-- silently overwritten (a new identity is a new row; the app must supersede explicitly).
create unique index if not exists avatar_identities_one_frozen on public.avatar_identities (owner_id) where frozen and deleted_at is null;

-- 1a) optional link from an avatar to the identity it was assembled from (additive, nullable).
alter table public.user_avatars add column if not exists identity_id uuid references public.avatar_identities (id) on delete set null;

-- 2) RLS — OWNER-ONLY. No public read; identity images live only in the private bucket.
alter table public.avatar_identities enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='avatar_identities' and policyname='avatar_identities_owner_select') then
    create policy avatar_identities_owner_select on public.avatar_identities for select
      to authenticated using (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='avatar_identities' and policyname='avatar_identities_owner_insert') then
    create policy avatar_identities_owner_insert on public.avatar_identities for insert
      to authenticated with check (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='avatar_identities' and policyname='avatar_identities_owner_update') then
    create policy avatar_identities_owner_update on public.avatar_identities for update
      to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='avatar_identities' and policyname='avatar_identities_owner_delete') then
    create policy avatar_identities_owner_delete on public.avatar_identities for delete
      to authenticated using (owner_id = auth.uid());
  end if;
end $$;

notify pgrst, 'reload schema';
