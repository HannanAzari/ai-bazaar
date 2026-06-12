insert into public.bazaars (slug, name, subtitle, position, accent_color)
values
  ('moon-court', 'Moon Court', 'Dreamers, night owls & soft things', 1, '#315d7a'),
  ('saffron-yard', 'Saffron Yard', 'Food, craft & bright ideas', 2, '#d47b28'),
  ('rose-arcade', 'Rose Arcade', 'Art, fashion & tiny obsessions', 3, '#a94f5c'),
  ('cedar-ring', 'Cedar Ring', 'Nature, ritual & slow living', 4, '#4d7358'),
  ('cobalt-lane', 'Cobalt Lane', 'Tech, music & curious experiments', 5, '#5554a4'),
  ('honey-grove', 'Honey Grove', 'Mending, making & generous tables', 6, '#a66f28'),
  ('lantern-hill', 'Lantern Hill', 'Stories, light & evening rituals', 7, '#b45c38'),
  ('velvet-square', 'Velvet Square', 'Sound, cinema & after-dark rooms', 8, '#74547d'),
  ('paper-meadow', 'Paper Meadow', 'Print, illustration & folded worlds', 9, '#62806e'),
  ('blue-orchard', 'Blue Orchard', 'Ideas growing in unusual directions', 10, '#3e7193')
on conflict (slug) do update
set name = excluded.name,
    subtitle = excluded.subtitle,
    position = excluded.position,
    accent_color = excluded.accent_color;

insert into public.shop_slots (bazaar_id, slot_number)
select bazaars.id, slot_number
from public.bazaars
cross join generate_series(1, 24) as slot_number
on conflict (bazaar_id, slot_number) do nothing;

-- Starter tag vocabulary. Residents add their own as they decorate; these give
-- the tag and discovery pages something to show on a fresh install.
insert into public.tags (name)
values
  ('art'), ('painting'), ('portrait'), ('illustration'), ('print'), ('zine'),
  ('origami'), ('paper'), ('craft'), ('textile'), ('mending'), ('workshop'),
  ('music'), ('radio'), ('film'), ('cinema'), ('video'), ('writing'),
  ('stories'), ('reading'), ('tea'), ('ritual'), ('slow-living'), ('nature'),
  ('field-notes'), ('code'), ('prototype'), ('experiments')
on conflict (name) do nothing;
