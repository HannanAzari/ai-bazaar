-- Room Engine V4 (Multi-Room Houses): a house already maps to many `rooms` rows
-- (one per room) and `room_objects.room_id` already scopes objects to a room, so
-- multi-room needs only two columns: a per-room description and an entry flag.
-- A door/stairs object's target room is stored in `room_objects.action_data`
-- (jsonb: { "targetRoomId": "<room id>" }) — no new column needed.

alter table public.rooms
  add column if not exists description text not null default '',
  add column if not exists is_entry boolean not null default false;

-- Exactly one entry room per shop (partial unique index over the truthy flag).
create unique index if not exists rooms_one_entry_per_shop on public.rooms (shop_id) where is_entry;
