-- Room Engine V4 (Multi-Room Houses): new enum values. Per ADR-009 these are
-- value additions to existing enums, so they live alone in an enum-extension
-- migration and must be committed before the _02 migration / app references them.

-- Door & stairs are first-class asset categories (navigation objects).
alter type public.asset_category add value if not exists 'door';
alter type public.asset_category add value if not exists 'stairs';

-- New room types for the room manager.
alter type public.room_kind add value if not exists 'living_room';
alter type public.room_kind add value if not exists 'office';
alter type public.room_kind add value if not exists 'bedroom';
alter type public.room_kind add value if not exists 'garden';
alter type public.room_kind add value if not exists 'custom';

-- Door/stairs objects navigate between rooms.
alter type public.room_action_type add value if not exists 'room_link';

-- Multi-room navigation analytics.
alter type public.event_type add value if not exists 'room_entered';
alter type public.event_type add value if not exists 'room_created';
alter type public.event_type add value if not exists 'room_deleted';
alter type public.event_type add value if not exists 'room_link_clicked';
