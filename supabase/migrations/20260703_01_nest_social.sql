-- ── M18 — Nest social foundation ─────────────────────────────────────────────
-- Real likes, follows, comments, and notifications for the Nest platform. Authored
-- to the M18 local social layer (lib/nest-social.ts, lib/nest-notifications-store.ts);
-- runtime-verified once applied to the live project (see docs/m12-supabase-cutover.md).
-- The local backend stays the default until NEXT_PUBLIC_NEST_BACKEND=supabase.
--
-- Idempotent so it can be applied to the existing project.

-- Likes — one per user per Nest -----------------------------------------------
create table if not exists public.nest_likes (
  id uuid primary key default gen_random_uuid(),
  nest_id uuid not null references public.nests (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (nest_id, user_id)
);
create index if not exists nest_likes_nest_idx on public.nest_likes (nest_id);

-- Follows — one per (follower, creator) --------------------------------------
create table if not exists public.creator_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users (id) on delete cascade,
  creator_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, creator_id),
  check (follower_id <> creator_id)
);
create index if not exists creator_follows_creator_idx on public.creator_follows (creator_id);
create index if not exists creator_follows_follower_idx on public.creator_follows (follower_id);

-- Comments V1 — flat, no threads --------------------------------------------
create table if not exists public.nest_comments (
  id uuid primary key default gen_random_uuid(),
  nest_id uuid not null references public.nests (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists nest_comments_nest_idx on public.nest_comments (nest_id, created_at desc);

-- Notifications --------------------------------------------------------------
do $$ begin
  create type public.notification_type as enum ('like', 'follow', 'comment');
exception when duplicate_object then null; end $$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid not null references auth.users (id) on delete cascade,
  type public.notification_type not null,
  entity_id text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_recipient_idx on public.notifications (recipient_id, created_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.nest_likes enable row level security;
alter table public.creator_follows enable row level security;
alter table public.nest_comments enable row level security;
alter table public.notifications enable row level security;

-- Likes: world-readable (counts on public Nests); a user writes only their own.
drop policy if exists nest_likes_read on public.nest_likes;
create policy nest_likes_read on public.nest_likes for select using (true);
drop policy if exists nest_likes_insert on public.nest_likes;
create policy nest_likes_insert on public.nest_likes for insert with check (user_id = auth.uid());
drop policy if exists nest_likes_delete on public.nest_likes;
create policy nest_likes_delete on public.nest_likes for delete using (user_id = auth.uid());

-- Follows: world-readable (counts); a user writes only their own follow rows.
drop policy if exists creator_follows_read on public.creator_follows;
create policy creator_follows_read on public.creator_follows for select using (true);
drop policy if exists creator_follows_insert on public.creator_follows;
create policy creator_follows_insert on public.creator_follows for insert with check (follower_id = auth.uid());
drop policy if exists creator_follows_delete on public.creator_follows;
create policy creator_follows_delete on public.creator_follows for delete using (follower_id = auth.uid());

-- Comments: world-readable; author inserts + deletes their own.
drop policy if exists nest_comments_read on public.nest_comments;
create policy nest_comments_read on public.nest_comments for select using (true);
drop policy if exists nest_comments_insert on public.nest_comments;
create policy nest_comments_insert on public.nest_comments for insert with check (user_id = auth.uid());
drop policy if exists nest_comments_delete on public.nest_comments;
create policy nest_comments_delete on public.nest_comments for delete using (user_id = auth.uid());

-- Notifications: only the recipient can read + mark them read.
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications for select using (recipient_id = auth.uid());
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
-- Inserts are performed by a SECURITY DEFINER trigger/function (a user can't write to
-- another user's inbox), added with the server cutover; no anon insert policy here.
