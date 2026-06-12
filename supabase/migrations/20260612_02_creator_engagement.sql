-- Step 2: notifications, guestbooks, and guestbook reports.
-- Run after 20260612_01_extend_enums.sql has committed.
--
-- Creator profiles need no new tables — they read the existing profiles, shops,
-- shop_links, and follows tables.

-- ── Guestbook ───────────────────────────────────────────────────────────────
create table if not exists public.guestbook_entries (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  author_name text not null check (char_length(author_name) between 1 and 40),
  message text not null check (char_length(message) between 1 and 240),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists guestbook_shop_idx on public.guestbook_entries (shop_id, created_at desc);

alter table public.guestbook_entries enable row level security;

-- Visitors see visible notes; owners and admins see hidden ones too.
create policy "visible guestbook notes are public" on public.guestbook_entries for select
  using (not hidden or public.owns_shop(shop_id) or public.is_admin());
create policy "authenticated leave notes" on public.guestbook_entries for insert to authenticated
  with check (author_id = auth.uid());
-- Owners (and admins) hide; owners and authors delete.
create policy "owners moderate notes" on public.guestbook_entries for update
  using (public.owns_shop(shop_id) or public.is_admin())
  with check (public.owns_shop(shop_id) or public.is_admin());
create policy "owners or authors delete notes" on public.guestbook_entries for delete
  using (public.owns_shop(shop_id) or author_id = auth.uid() or public.is_admin());

-- ── Reports: allow targeting a guestbook entry ──────────────────────────────
alter table public.reports
  add column if not exists guestbook_entry_id uuid references public.guestbook_entries(id) on delete cascade;

alter table public.reports drop constraint if exists reports_target_check;
alter table public.reports add constraint reports_target_check check (
  (target_type = 'shop' and shop_id is not null and decoration_id is null and reported_user_id is null and guestbook_entry_id is null)
  or (target_type = 'decoration' and decoration_id is not null and reported_user_id is null and guestbook_entry_id is null)
  or (target_type = 'user' and reported_user_id is not null and shop_id is null and decoration_id is null and guestbook_entry_id is null)
  or (target_type = 'guestbook' and guestbook_entry_id is not null and reported_user_id is null and decoration_id is null)
);

-- ── Notifications ───────────────────────────────────────────────────────────
create type public.notification_type as enum (
  'house_view', 'like', 'follow', 'guestbook_entry', 'item_click', 'report_status'
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  -- The recipient (whose bell this lands in).
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.notification_type not null,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) <= 280),
  href text,
  -- Optional context, e.g. who triggered it or which house it concerns.
  actor_id uuid references public.profiles(id) on delete set null,
  shop_id uuid references public.shops(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read = false;

alter table public.notifications enable row level security;

-- Recipients read and update (mark read) only their own notifications.
create policy "recipients read notifications" on public.notifications for select using (user_id = auth.uid());
create policy "recipients update notifications" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Notifications are created by triggers / security-definer helpers, not directly
-- by clients. This helper inserts one for a recipient.
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
