-- Sprint 2: saving, activity, and asset-metadata foundations.
-- All-new types and tables, so no enum-split is needed (CREATE TYPE may be used
-- in the same transaction; only ALTER TYPE ... ADD VALUE cannot).

-- ── Collections ─────────────────────────────────────────────────────────────
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create type public.saved_kind as enum ('house', 'item');

create table if not exists public.collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  kind public.saved_kind not null,
  shop_id uuid not null references public.shops(id) on delete cascade,
  decoration_id uuid references public.shop_decorations(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- A house (or item) can only sit in a collection once.
  unique (collection_id, kind, shop_id, decoration_id),
  check ((kind = 'house' and decoration_id is null) or (kind = 'item' and decoration_id is not null))
);

create index if not exists collections_owner_idx on public.collections (owner_id);
create index if not exists collection_items_collection_idx on public.collection_items (collection_id);

alter table public.collections enable row level security;
alter table public.collection_items enable row level security;

-- Collections and their contents are private to the owner.
create policy "owners read collections" on public.collections for select using (owner_id = auth.uid());
create policy "owners manage collections" on public.collections for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owners read collection items" on public.collection_items for select
  using (exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = auth.uid()));
create policy "owners manage collection items" on public.collection_items for all
  using (exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = auth.uid()));

-- ── Activity feed ───────────────────────────────────────────────────────────
create type public.activity_type as enum (
  'claimed_house', 'updated_house', 'added_decoration', 'liked_house',
  'followed_creator', 'guestbook_entry', 'saved_to_collection'
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  type public.activity_type not null,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text not null,
  actor_handle text not null,
  summary text not null check (char_length(summary) <= 200),
  href text,
  -- Optional context for richer rendering later.
  shop_id uuid references public.shops(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists activity_created_idx on public.activity_events (created_at desc);
create index if not exists activity_actor_idx on public.activity_events (actor_handle, created_at desc);

alter table public.activity_events enable row level security;
-- Activity is public (it powers the global and profile feeds).
create policy "activity is public" on public.activity_events for select using (true);
create policy "users record own activity" on public.activity_events for insert to authenticated
  with check (actor_id = auth.uid());

-- ── Asset catalog ───────────────────────────────────────────────────────────
create type public.asset_category as enum ('furniture', 'wall', 'floor', 'plant', 'lighting', 'decor', 'structure');
create type public.asset_placement as enum ('floor', 'wall', 'ceiling', 'exterior', 'any');
create type public.asset_rarity as enum ('common', 'uncommon', 'rare', 'legendary');
create type public.asset_status as enum ('draft', 'published', 'retired');
create type public.asset_owner_type as enum ('system', 'creator');

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  category public.asset_category not null,
  -- Village id this asset themes to, or 'any'.
  village_theme text not null default 'any',
  placement public.asset_placement not null default 'any',
  owner_type public.asset_owner_type not null default 'system',
  owner_id uuid references public.profiles(id) on delete set null,
  rarity public.asset_rarity not null default 'common',
  tags text[] not null default '{}',
  image_url text,
  status public.asset_status not null default 'draft',
  created_at timestamptz not null default now()
);

create index if not exists assets_category_idx on public.assets (category) where status = 'published';
create index if not exists assets_status_idx on public.assets (status);

alter table public.assets enable row level security;
-- Published assets are public; admins manage the whole catalog. No uploads/marketplace yet.
create policy "published assets are public" on public.assets for select
  using (status = 'published' or public.is_admin());
create policy "admins manage assets" on public.assets for all
  using (public.is_admin()) with check (public.is_admin());
