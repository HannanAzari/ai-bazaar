-- Room Engine V2 (Creator Studio): new analytics event types for the editing
-- lifecycle. New enum *values* must be committed before any later migration
-- uses them (see decision-log ADR-009), so they live in this _01 file alone.
--
-- Also adds `object_click`, which shipped in the V1 TypeScript EventType but
-- was never mirrored into this enum — corrected here to restore SQL parity.

alter type public.event_type add value if not exists 'object_click';
alter type public.event_type add value if not exists 'room_object_added';
alter type public.event_type add value if not exists 'room_object_deleted';
alter type public.event_type add value if not exists 'room_object_moved';
alter type public.event_type add value if not exists 'room_object_resized';
alter type public.event_type add value if not exists 'room_template_applied';
