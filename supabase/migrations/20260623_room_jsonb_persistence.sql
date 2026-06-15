-- Production Cutover V1 — faithful Room Engine V5 persistence.
--
-- The app's Room model uses string ids (`room-<addr>…`) and catalog asset keys
-- (`ast-bookshelf`), which don't fit `rooms.id uuid` / `room_objects.asset_id uuid`.
-- Rather than redesign the room engine, V1 stores each room's app id and its full
-- object list (with action_data, rotation, backgrounds, room links) as jsonb on
-- the existing, RLS-protected `rooms` table. The normalized `room_objects` table
-- is retained for future analytics; V1 reads/writes the jsonb snapshot.

alter table public.rooms add column if not exists client_id text;
alter table public.rooms add column if not exists objects jsonb not null default '[]'::jsonb;

-- One row per (shop, app-room-id) so upserts are idempotent.
create unique index if not exists rooms_shop_client_idx on public.rooms (shop_id, client_id);
