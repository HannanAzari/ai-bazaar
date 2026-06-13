-- Room Engine V3 (Real Interactive Objects): a new object action type and the
-- visitor interaction events. These are enum *value* additions to existing
-- types, so per ADR-009 they live alone in an enum-extension migration and must
-- be committed before anything references them. No table change is needed:
-- `room_objects.action_data` is already jsonb (it absorbs the richer V3 shape),
-- and the events table already stores `event_type`.

alter type public.room_action_type add value if not exists 'profile';

alter type public.event_type add value if not exists 'gallery_opened';
alter type public.event_type add value if not exists 'video_opened';
alter type public.event_type add value if not exists 'product_opened';
alter type public.event_type add value if not exists 'booking_opened';
alter type public.event_type add value if not exists 'contact_opened';
alter type public.event_type add value if not exists 'profile_opened';
