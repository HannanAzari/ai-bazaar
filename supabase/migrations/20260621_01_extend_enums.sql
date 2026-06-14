-- AI Room Designer V2: analytics events for drafts, constraints, and presets.
-- Enum *value* additions to the existing event_type, so per ADR-009 they are
-- committed alone in this _01 file before the _02 migration (which uses the
-- new room_design_drafts table) runs. event_type itself is unchanged elsewhere.

alter type public.event_type add value if not exists 'room_design_draft_saved';
alter type public.event_type add value if not exists 'room_design_draft_applied';
alter type public.event_type add value if not exists 'room_design_constraint_detected';
alter type public.event_type add value if not exists 'room_design_preset_used';
