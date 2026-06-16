-- Pilot Hardening V1: first-run funnel analytics events. Enum *value* additions to
-- the existing event_type (ADR-009 — stand-alone, no table change). Internal
-- analytics only (no external service); in production these are still recorded
-- client-side via trackEvent(). public_room_viewed reuses the existing room_view.

alter type public.event_type add value if not exists 'signup_completed';
alter type public.event_type add value if not exists 'onboarding_completed';
alter type public.event_type add value if not exists 'first_nest_created';
alter type public.event_type add value if not exists 'room_saved';
