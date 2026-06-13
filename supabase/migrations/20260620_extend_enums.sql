-- AI Room Designer (V1): analytics events for the deterministic, selection-only
-- room designer. These are enum *value* additions to the existing event_type, so
-- per ADR-009 they live alone in an enum-extension migration and must be
-- committed before anything references them. No table change is needed — the
-- designer composes existing Room/room_objects shapes and the events table
-- already stores event_type.

alter type public.event_type add value if not exists 'room_design_generated';
alter type public.event_type add value if not exists 'room_design_applied';
alter type public.event_type add value if not exists 'room_design_regenerated';
