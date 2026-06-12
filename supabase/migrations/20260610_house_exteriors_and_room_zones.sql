-- Detached house styling and room-zone placement for the village UI.
alter type public.decoration_type add value if not exists 'furniture';

alter table public.shops
  add column if not exists exterior jsonb not null
  default '{"color":"terracotta","roofStyle":"gable","gardenStyle":"wildflowers","signText":"Welcome in"}'::jsonb;

alter table public.shop_decorations
  add column if not exists zone text not null default 'floor';

alter table public.shop_decorations
  drop constraint if exists shop_decorations_zone_check;

alter table public.shop_decorations
  add constraint shop_decorations_zone_check
  check (zone in ('left-wall', 'back-wall', 'floor', 'right-wall'));

comment on column public.shops.exterior is
  'Owner-controlled house facade and plot styling. The sign may later support community or sponsored board modes.';

comment on column public.shop_decorations.zone is
  'Placement zone within a room. Detailed coordinates remain available in position JSONB.';
