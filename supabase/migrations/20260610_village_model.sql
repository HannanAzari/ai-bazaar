-- Run this migration before the updated seed on an existing MVP database.
-- Resolve or remove any claimed slots above 24 before applying.

do $$
begin
  if exists (
    select 1
    from public.shops sh
    join public.shop_slots ss on ss.id = sh.slot_id
    where ss.slot_number > 24
  ) then
    raise exception 'Move claimed houses from slots 25-50 before applying this migration';
  end if;
end $$;

delete from public.shop_slots where slot_number > 24;

alter table public.bazaars drop constraint if exists bazaars_position_check;
alter table public.bazaars add constraint bazaars_position_check check (position between 1 and 10);

alter table public.shop_slots drop constraint if exists shop_slots_slot_number_check;
alter table public.shop_slots add constraint shop_slots_slot_number_check check (slot_number between 1 and 24);

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

drop trigger if exists validate_shop_village_address on public.shops;
create trigger validate_shop_village_address
  before insert or update of address, slot_id on public.shops
  for each row execute procedure public.validate_village_address();
