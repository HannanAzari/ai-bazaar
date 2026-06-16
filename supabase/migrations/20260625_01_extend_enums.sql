-- Analytics + Discovery V1: enum *value* additions to the existing event_type
-- (ADR-009 — committed before use in 20260625_02). Anonymous visitor sessions
-- (session_started/session_ended) and per-object impressions (object_view) power
-- the creator insights dashboard, the visitor funnel, and discovery ranking.

alter type public.event_type add value if not exists 'session_started';
alter type public.event_type add value if not exists 'session_ended';
alter type public.event_type add value if not exists 'object_view';
