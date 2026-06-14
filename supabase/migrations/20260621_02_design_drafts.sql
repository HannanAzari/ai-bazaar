-- AI Room Designer V2: owner-private design drafts. A draft is a saved, un-applied
-- design — the generated room (jsonb) plus the brief/style/intent/constraints that
-- produced it — so an owner can compare options and apply one later. Brand-new
-- table (no enum dependency on the _01 values), owner-scoped via owns_shop().

create table if not exists public.room_design_drafts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null default 'Draft' check (char_length(name) between 1 and 80),
  brief text not null default '',
  style text not null default 'cozy',
  intent_id text not null default 'personal',
  -- Structured brief: { creatorType?, mood?, purpose?, constraints }.
  parsed jsonb not null default '{}'::jsonb,
  -- The full generated room, ready to apply.
  room jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists room_design_drafts_shop_idx on public.room_design_drafts (shop_id);

alter table public.room_design_drafts enable row level security;

-- Drafts are private working state: only the house owner (or an admin) sees or
-- manages them.
create policy "owners read design drafts" on public.room_design_drafts for select
  using (public.owns_shop(shop_id) or public.is_admin());
create policy "owners manage design drafts" on public.room_design_drafts for all
  using (public.owns_shop(shop_id) or public.is_admin())
  with check (public.owns_shop(shop_id) or public.is_admin());
