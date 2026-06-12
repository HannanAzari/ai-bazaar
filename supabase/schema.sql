create extension if not exists "pgcrypto";

create type public.decoration_type as enum ('text', 'image', 'ai_image', 'link', 'furniture');
create type public.generation_status as enum ('queued', 'building', 'complete', 'failed');
create type public.report_target_type as enum ('shop', 'decoration', 'user', 'guestbook');
create type public.report_status as enum ('pending', 'reviewed', 'hidden', 'dismissed');
create type public.event_type as enum ('house_view', 'room_view', 'decoration_click', 'link_click', 'share_click', 'follow', 'like');
create type public.notification_type as enum ('house_view', 'like', 'follow', 'guestbook_entry', 'item_click', 'report_status');
create type public.room_zone_type as enum ('back_wall', 'left_wall', 'right_wall', 'floor_left', 'floor_center', 'floor_right', 'shelf', 'window', 'door');
create type public.room_action_type as enum ('link', 'video', 'product', 'booking', 'contact', 'gallery', 'guestbook', 'collection', 'none');
create type public.room_kind as enum ('studio', 'shop', 'gallery', 'lounge', 'standard');
create type public.saved_kind as enum ('house', 'item');
create type public.activity_type as enum ('claimed_house', 'updated_house', 'added_decoration', 'liked_house', 'followed_creator', 'guestbook_entry', 'saved_to_collection');
create type public.asset_category as enum ('furniture', 'wall', 'floor', 'plant', 'lighting', 'decor', 'structure');
create type public.asset_placement as enum ('floor', 'wall', 'ceiling', 'exterior', 'any');
create type public.asset_rarity as enum ('common', 'uncommon', 'rare', 'legendary');
create type public.asset_status as enum ('draft', 'published', 'retired');
create type public.asset_owner_type as enum ('system', 'creator');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  username text unique,
  avatar_url text,
  bio text check (char_length(bio) <= 500),
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bazaars (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  subtitle text,
  position smallint not null unique check (position between 1 and 10),
  accent_color text not null default '#b9583c',
  created_at timestamptz not null default now()
);

create table public.shop_slots (
  id uuid primary key default gen_random_uuid(),
  bazaar_id uuid not null references public.bazaars(id) on delete cascade,
  slot_number smallint not null check (slot_number between 1 and 24),
  created_at timestamptz not null default now(),
  unique (bazaar_id, slot_number)
);

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete restrict,
  slot_id uuid not null unique references public.shop_slots(id) on delete restrict,
  address text not null unique check (address ~ '^[a-z]+[.][a-z]+[.][a-z]+$'),
  display_name text not null check (char_length(display_name) between 1 and 80),
  tagline text check (char_length(tagline) <= 140),
  bio text check (char_length(bio) <= 800),
  logo_url text,
  palette text,
  exterior jsonb not null default '{"color":"terracotta","roofStyle":"gable","gardenStyle":"wildflowers","signText":"Welcome in"}'::jsonb,
  visitor_count bigint not null default 0 check (visitor_count >= 0),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Rooms are explicit even though every MVP shop starts with exactly one.
create table public.shop_rooms (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null default 'Main room',
  position smallint not null default 1,
  template_key text not null default 'standard-empty-room',
  created_at timestamptz not null default now(),
  unique (shop_id, position)
);

create table public.shop_decorations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  room_id uuid references public.shop_rooms(id) on delete cascade,
  type public.decoration_type not null,
  title text,
  content text,
  asset_url text,
  link_url text,
  zone text not null default 'floor' check (zone in ('left-wall', 'back-wall', 'floor', 'right-wall')),
  position jsonb not null default '{"x":0,"y":0,"z":0}'::jsonb,
  sort_order integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shop_links (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  url text not null,
  kind text not null default 'external' check (kind in ('external', 'social')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, shop_id)
);

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  prompt text not null check (char_length(prompt) between 1 and 1000),
  provider text not null default 'mock',
  status public.generation_status not null default 'queued',
  output_url text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ── Guestbook ───────────────────────────────────────────────────────────────
create table public.guestbook_entries (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  author_name text not null check (char_length(author_name) between 1 and 40),
  message text not null check (char_length(message) between 1 and 240),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type public.report_target_type not null,
  shop_id uuid references public.shops(id) on delete cascade,
  decoration_id uuid references public.shop_decorations(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete cascade,
  guestbook_entry_id uuid references public.guestbook_entries(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 500),
  status public.report_status not null default 'pending',
  created_at timestamptz not null default now(),
  constraint reports_target_check check (
    (target_type = 'shop' and shop_id is not null and decoration_id is null and reported_user_id is null and guestbook_entry_id is null)
    or (target_type = 'decoration' and decoration_id is not null and reported_user_id is null and guestbook_entry_id is null)
    or (target_type = 'user' and reported_user_id is not null and shop_id is null and decoration_id is null and guestbook_entry_id is null)
    or (target_type = 'guestbook' and guestbook_entry_id is not null and reported_user_id is null and decoration_id is null)
  )
);

-- ── Notifications ─────────────────────────────────────────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.notification_type not null,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) <= 280),
  href text,
  actor_id uuid references public.profiles(id) on delete set null,
  shop_id uuid references public.shops(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── Collections ───────────────────────────────────────────────────────────────
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  kind public.saved_kind not null,
  shop_id uuid not null references public.shops(id) on delete cascade,
  decoration_id uuid references public.shop_decorations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (collection_id, kind, shop_id, decoration_id),
  check ((kind = 'house' and decoration_id is null) or (kind = 'item' and decoration_id is not null))
);

-- ── Activity feed ─────────────────────────────────────────────────────────────
create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  type public.activity_type not null,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text not null,
  actor_handle text not null,
  summary text not null check (char_length(summary) <= 200),
  href text,
  shop_id uuid references public.shops(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ── Asset catalog ─────────────────────────────────────────────────────────────
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  category public.asset_category not null,
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

-- ── Tags ────────────────────────────────────────────────────────────────────
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
    check (name ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' and char_length(name) <= 32),
  created_at timestamptz not null default now()
);

create table public.shop_tags (
  shop_id uuid not null references public.shops(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (shop_id, tag_id)
);

create table public.decoration_tags (
  decoration_id uuid not null references public.shop_decorations(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (decoration_id, tag_id)
);

create table public.link_tags (
  link_id uuid not null references public.shop_links(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (link_id, tag_id)
);

-- ── Analytics events ────────────────────────────────────────────────────────
create table public.events (
  id uuid primary key default gen_random_uuid(),
  type public.event_type not null,
  actor_id uuid references public.profiles(id) on delete set null,
  shop_id uuid references public.shops(id) on delete cascade,
  decoration_id uuid references public.shop_decorations(id) on delete cascade,
  link_id uuid references public.shop_links(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ── Room engine ──────────────────────────────────────────────────────────────
-- Zones are a fixed app-defined template (lib/room-schema.ts); the zone lives as
-- an enum column on each object rather than its own table.
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null default 'Main room' check (char_length(name) between 1 and 80),
  type public.room_kind not null default 'standard',
  theme text not null default 'warm',
  background text not null default 'standard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_objects (
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

create table public.room_object_tags (
  object_id uuid not null references public.room_objects(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (object_id, tag_id)
);

create index shops_address_idx on public.shops using btree (address);
create index shops_created_at_idx on public.shops using btree (created_at desc) where hidden = false;
create index decorations_shop_idx on public.shop_decorations (shop_id, sort_order) where hidden = false;
create index likes_shop_idx on public.likes (shop_id);
create index generation_jobs_owner_idx on public.generation_jobs (owner_id, created_at desc);
create index shop_tags_tag_idx on public.shop_tags (tag_id);
create index decoration_tags_tag_idx on public.decoration_tags (tag_id);
create index link_tags_tag_idx on public.link_tags (tag_id);
create index events_type_idx on public.events (type, created_at desc);
create index events_shop_idx on public.events (shop_id) where shop_id is not null;
create index guestbook_shop_idx on public.guestbook_entries (shop_id, created_at desc);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read = false;
create index collections_owner_idx on public.collections (owner_id);
create index collection_items_collection_idx on public.collection_items (collection_id);
create index activity_created_idx on public.activity_events (created_at desc);
create index activity_actor_idx on public.activity_events (actor_handle, created_at desc);
create index assets_category_idx on public.assets (category) where status = 'published';
create index assets_status_idx on public.assets (status);
create index rooms_shop_idx on public.rooms (shop_id);
create index room_objects_room_idx on public.room_objects (room_id, z_index);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.owns_shop(target_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.shops where id = target_shop_id and owner_id = auth.uid());
$$;

-- Append-only analytics helper. Anyone may record; only admins may read events.
create or replace function public.record_event(
  p_type public.event_type,
  p_shop_id uuid default null,
  p_decoration_id uuid default null,
  p_link_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.events (type, actor_id, shop_id, decoration_id, link_id, metadata)
  values (p_type, auth.uid(), p_shop_id, p_decoration_id, p_link_id, p_metadata)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace view public.event_counts
with (security_invoker = on) as
  select type, count(*)::bigint as total
  from public.events
  group by type;

-- Notifications are written by security-definer helpers/triggers, not clients.
create or replace function public.push_notification(
  p_user_id uuid,
  p_type public.notification_type,
  p_title text,
  p_body text,
  p_href text default null,
  p_actor_id uuid default null,
  p_shop_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.notifications (user_id, type, title, body, href, actor_id, shop_id)
  values (p_user_id, p_type, p_title, p_body, p_href, p_actor_id, p_shop_id)
  returning id into new_id;
  return new_id;
end;
$$;

-- A new guestbook note notifies the house owner.
create or replace function public.notify_on_guestbook_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
  addr text;
begin
  select owner_id, address into owner, addr from public.shops where id = new.shop_id;
  if owner is not null and owner <> coalesce(new.author_id, '00000000-0000-0000-0000-000000000000') then
    perform public.push_notification(
      owner, 'guestbook_entry', 'Guestbook note',
      new.author_name || ' signed your guestbook.', '/shop/' || addr, new.author_id, new.shop_id
    );
  end if;
  return new;
end;
$$;

create trigger on_guestbook_entry_created
  after insert on public.guestbook_entries
  for each row execute procedure public.notify_on_guestbook_entry();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

create or replace function public.create_default_room()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.shop_rooms (shop_id) values (new.id);
  return new;
end;
$$;

create trigger on_shop_created
  after insert on public.shops
  for each row execute procedure public.create_default_room();

create or replace function public.validate_village_address()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  expected_prefix text;
begin
  select split_part(b.slug, '-', 1)
  into expected_prefix
  from public.shop_slots s
  join public.bazaars b on b.id = s.bazaar_id
  where s.id = new.slot_id;

  if split_part(new.address, '.', 1) <> expected_prefix then
    raise exception 'Address must begin with village prefix %', expected_prefix;
  end if;
  return new;
end;
$$;

create trigger validate_shop_village_address
  before insert or update of address, slot_id on public.shops
  for each row execute procedure public.validate_village_address();

alter table public.profiles enable row level security;
alter table public.bazaars enable row level security;
alter table public.shop_slots enable row level security;
alter table public.shops enable row level security;
alter table public.shop_rooms enable row level security;
alter table public.shop_decorations enable row level security;
alter table public.shop_links enable row level security;
alter table public.likes enable row level security;
alter table public.follows enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.reports enable row level security;
alter table public.guestbook_entries enable row level security;
alter table public.notifications enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.activity_events enable row level security;
alter table public.assets enable row level security;
alter table public.rooms enable row level security;
alter table public.room_objects enable row level security;
alter table public.room_object_tags enable row level security;
alter table public.tags enable row level security;
alter table public.shop_tags enable row level security;
alter table public.decoration_tags enable row level security;
alter table public.link_tags enable row level security;
alter table public.events enable row level security;

create policy "profiles are public" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "bazaars are public" on public.bazaars for select using (true);
create policy "slots are public" on public.shop_slots for select using (true);

create policy "visible shops are public" on public.shops for select using (not hidden or owner_id = auth.uid() or public.is_admin());
create policy "users claim one shop" on public.shops for insert to authenticated
  with check (owner_id = auth.uid() and not exists (select 1 from public.shops where owner_id = auth.uid()));
create policy "owners update shops" on public.shops for update
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
create policy "admins delete shops" on public.shops for delete using (public.is_admin());

create policy "visible rooms are public" on public.shop_rooms for select
  using (exists (select 1 from public.shops where shops.id = shop_id and (not shops.hidden or shops.owner_id = auth.uid() or public.is_admin())));
create policy "owners manage rooms" on public.shop_rooms for all
  using (public.owns_shop(shop_id) or public.is_admin())
  with check (public.owns_shop(shop_id) or public.is_admin());

create policy "visible decorations are public" on public.shop_decorations for select
  using (not hidden and exists (select 1 from public.shops where shops.id = shop_id and not shops.hidden) or public.owns_shop(shop_id) or public.is_admin());
create policy "owners manage decorations" on public.shop_decorations for all
  using (public.owns_shop(shop_id) or public.is_admin())
  with check (public.owns_shop(shop_id) or public.is_admin());

create policy "shop links are public" on public.shop_links for select
  using (exists (select 1 from public.shops where shops.id = shop_id and not shops.hidden));
create policy "owners manage links" on public.shop_links for all
  using (public.owns_shop(shop_id) or public.is_admin())
  with check (public.owns_shop(shop_id) or public.is_admin());

create policy "likes are public" on public.likes for select using (true);
create policy "users manage own likes" on public.likes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "follows are public" on public.follows for select using (true);
create policy "users manage own follows" on public.follows for all
  using (follower_id = auth.uid()) with check (follower_id = auth.uid());

create policy "owners view jobs" on public.generation_jobs for select using (owner_id = auth.uid() or public.is_admin());
create policy "owners create jobs" on public.generation_jobs for insert
  with check (owner_id = auth.uid() and public.owns_shop(shop_id));
create policy "admins update jobs" on public.generation_jobs for update using (public.is_admin());

create policy "users create reports" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "admins review reports" on public.reports for all using (public.is_admin()) with check (public.is_admin());

create policy "visible guestbook notes are public" on public.guestbook_entries for select
  using (not hidden or public.owns_shop(shop_id) or public.is_admin());
create policy "authenticated leave notes" on public.guestbook_entries for insert to authenticated
  with check (author_id = auth.uid());
create policy "owners moderate notes" on public.guestbook_entries for update
  using (public.owns_shop(shop_id) or public.is_admin())
  with check (public.owns_shop(shop_id) or public.is_admin());
create policy "owners or authors delete notes" on public.guestbook_entries for delete
  using (public.owns_shop(shop_id) or author_id = auth.uid() or public.is_admin());

create policy "recipients read notifications" on public.notifications for select using (user_id = auth.uid());
create policy "recipients update notifications" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "owners read collections" on public.collections for select using (owner_id = auth.uid());
create policy "owners manage collections" on public.collections for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners read collection items" on public.collection_items for select
  using (exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = auth.uid()));
create policy "owners manage collection items" on public.collection_items for all
  using (exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = auth.uid()));

create policy "activity is public" on public.activity_events for select using (true);
create policy "users record own activity" on public.activity_events for insert to authenticated
  with check (actor_id = auth.uid());

create policy "published assets are public" on public.assets for select
  using (status = 'published' or public.is_admin());
create policy "admins manage assets" on public.assets for all
  using (public.is_admin()) with check (public.is_admin());

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

create policy "tags are public" on public.tags for select using (true);
create policy "authenticated create tags" on public.tags for insert to authenticated with check (true);

create policy "shop tags are public" on public.shop_tags for select using (true);
create policy "owners manage shop tags" on public.shop_tags for all
  using (public.owns_shop(shop_id) or public.is_admin())
  with check (public.owns_shop(shop_id) or public.is_admin());

create policy "decoration tags are public" on public.decoration_tags for select using (true);
create policy "owners manage decoration tags" on public.decoration_tags for all
  using (exists (select 1 from public.shop_decorations d where d.id = decoration_id and (public.owns_shop(d.shop_id) or public.is_admin())))
  with check (exists (select 1 from public.shop_decorations d where d.id = decoration_id and (public.owns_shop(d.shop_id) or public.is_admin())));

create policy "link tags are public" on public.link_tags for select using (true);
create policy "owners manage link tags" on public.link_tags for all
  using (exists (select 1 from public.shop_links l where l.id = link_id and (public.owns_shop(l.shop_id) or public.is_admin())))
  with check (exists (select 1 from public.shop_links l where l.id = link_id and (public.owns_shop(l.shop_id) or public.is_admin())));

create policy "anyone records events" on public.events for insert with check (true);
create policy "admins read events" on public.events for select using (public.is_admin());
