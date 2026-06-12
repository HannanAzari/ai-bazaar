-- Step 2: tags, analytics events, and the extended reports model.
-- Run after 20260611_01_extend_enums.sql has committed.

-- ── Reports: support user targets and the new status default ──────────────
alter table public.reports
  add column if not exists reported_user_id uuid references public.profiles(id) on delete cascade;

alter table public.reports alter column status set default 'pending';

alter table public.reports drop constraint if exists reports_check;
alter table public.reports drop constraint if exists reports_target_check;
alter table public.reports add constraint reports_target_check check (
  (target_type = 'shop' and shop_id is not null and decoration_id is null and reported_user_id is null)
  or (target_type = 'decoration' and decoration_id is not null and reported_user_id is null)
  or (target_type = 'user' and reported_user_id is not null and shop_id is null and decoration_id is null)
);

-- ── Tags ──────────────────────────────────────────────────────────────────
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
    check (name ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' and char_length(name) <= 32),
  created_at timestamptz not null default now()
);

-- Houses, decorations, and links can each carry tags.
create table if not exists public.shop_tags (
  shop_id uuid not null references public.shops(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (shop_id, tag_id)
);

create table if not exists public.decoration_tags (
  decoration_id uuid not null references public.shop_decorations(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (decoration_id, tag_id)
);

create table if not exists public.link_tags (
  link_id uuid not null references public.shop_links(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (link_id, tag_id)
);

create index if not exists shop_tags_tag_idx on public.shop_tags (tag_id);
create index if not exists decoration_tags_tag_idx on public.decoration_tags (tag_id);
create index if not exists link_tags_tag_idx on public.link_tags (tag_id);

alter table public.tags enable row level security;
alter table public.shop_tags enable row level security;
alter table public.decoration_tags enable row level security;
alter table public.link_tags enable row level security;

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

-- ── Analytics events ──────────────────────────────────────────────────────
create type public.event_type as enum (
  'house_view', 'room_view', 'decoration_click', 'link_click', 'share_click', 'follow', 'like'
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  type public.event_type not null,
  actor_id uuid references public.profiles(id) on delete set null,
  shop_id uuid references public.shops(id) on delete cascade,
  decoration_id uuid references public.shop_decorations(id) on delete cascade,
  link_id uuid references public.shop_links(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists events_type_idx on public.events (type, created_at desc);
create index if not exists events_shop_idx on public.events (shop_id) where shop_id is not null;

-- Append-only telemetry helper. Anyone can record; only admins can read.
create or replace function public.record_event(
  p_type public.event_type,
  p_shop_id uuid default null,
  p_decoration_id uuid default null,
  p_link_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
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

-- Lightweight rollup for the basic moderation counts (no heavy dashboards yet).
create or replace view public.event_counts
with (security_invoker = on) as
  select type, count(*)::bigint as total
  from public.events
  group by type;

alter table public.events enable row level security;
create policy "anyone records events" on public.events for insert with check (true);
create policy "admins read events" on public.events for select using (public.is_admin());
