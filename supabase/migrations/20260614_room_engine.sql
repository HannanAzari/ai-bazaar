-- Room Engine V1: a proper room data model layered over the existing house.
-- All-new types and tables (no enum-split needed). Zones are a fixed template
-- defined in app code (lib/room-schema.ts), so the zone lives as an enum column
-- on each object rather than its own table.

create type public.room_zone_type as enum (
  'back_wall', 'left_wall', 'right_wall',
  'floor_left', 'floor_center', 'floor_right',
  'shelf', 'window', 'door'
);

create type public.room_action_type as enum (
  'link', 'video', 'product', 'booking', 'contact', 'gallery', 'guestbook', 'collection', 'none'
);

create type public.room_kind as enum ('studio', 'shop', 'gallery', 'lounge', 'standard');

-- One editable room per house in V1 (the model allows more later).
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null default 'Main room' check (char_length(name) between 1 and 80),
  type public.room_kind not null default 'standard',
  theme text not null default 'warm',
  background text not null default 'standard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rooms_shop_idx on public.rooms (shop_id);

create table if not exists public.room_objects (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  asset_id uuid references public.assets(id) on delete set null,
  zone public.room_zone_type not null,
  anchor_id text not null,
  x real not null default 0,
  y real not null default 0,
  scale real not null default 1 check (scale > 0 and scale <= 4),
  rotation real not null default 0,
  z_index integer not null default 0,
  label text not null default '' check (char_length(label) <= 80),
  action_type public.room_action_type not null default 'none',
  action_data jsonb not null default '{}'::jsonb,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists room_objects_room_idx on public.room_objects (room_id, z_index);

create table if not exists public.room_object_tags (
  object_id uuid not null references public.room_objects(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (object_id, tag_id)
);

alter table public.rooms enable row level security;
alter table public.room_objects enable row level security;
alter table public.room_object_tags enable row level security;

-- Rooms of visible houses are public; owners (and admins) manage their own.
create policy "rooms are public" on public.rooms for select
  using (exists (select 1 from public.shops s where s.id = shop_id and (not s.hidden or public.owns_shop(s.id) or public.is_admin())));
create policy "owners manage their room" on public.rooms for all
  using (public.owns_shop(shop_id) or public.is_admin())
  with check (public.owns_shop(shop_id) or public.is_admin());

create policy "room objects are public" on public.room_objects for select
  using (exists (select 1 from public.rooms r join public.shops s on s.id = r.shop_id where r.id = room_id and (not s.hidden or public.owns_shop(s.id) or public.is_admin())));
create policy "owners manage room objects" on public.room_objects for all
  using (exists (select 1 from public.rooms r where r.id = room_id and (public.owns_shop(r.shop_id) or public.is_admin())))
  with check (exists (select 1 from public.rooms r where r.id = room_id and (public.owns_shop(r.shop_id) or public.is_admin())));

create policy "room object tags are public" on public.room_object_tags for select using (true);
create policy "owners manage room object tags" on public.room_object_tags for all
  using (exists (select 1 from public.room_objects o join public.rooms r on r.id = o.room_id where o.id = object_id and (public.owns_shop(r.shop_id) or public.is_admin())))
  with check (exists (select 1 from public.room_objects o join public.rooms r on r.id = o.room_id where o.id = object_id and (public.owns_shop(r.shop_id) or public.is_admin())));
