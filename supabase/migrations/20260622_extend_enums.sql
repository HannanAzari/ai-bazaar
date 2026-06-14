-- AI Room Designer V3 (Creator Auto Build): analytics events for analysing a
-- creator's social profiles and generating a room from them. Enum *value*
-- additions to the existing event_type only — per ADR-009 they stand alone in an
-- enum-extension migration. No table change: a creator room is an ordinary Room,
-- and drafts reuse the room_design_drafts table from 20260621_02.

alter type public.event_type add value if not exists 'creator_profile_analyzed';
alter type public.event_type add value if not exists 'creator_room_generated';
alter type public.event_type add value if not exists 'creator_room_applied';
alter type public.event_type add value if not exists 'creator_social_object_created';
