-- Analytics + Discovery V1 (ADR-020) — durable analytics + anonymous visitor
-- sessions. Uses the event_type values added in 20260625_01.
--
-- Three changes:
--   1. Let creators read analytics for shops they own (the insights dashboard).
--      Until now only admins could read `events`; a creator could not see their
--      own numbers in production. record_event() inserts stay open to everyone.
--   2. A `visitor_sessions` table — durable anonymous sessions (no auth), the
--      production mirror of lib/visitor-session.ts. Visitor/session ids also ride
--      on each event's `metadata` jsonb so the funnel can be derived from events
--      alone; this table is the normalized source of truth for session duration
--      and first-vs-returning.
--   3. Indexes for per-shop + per-visitor analytics queries.

-- 1. Owner-readable events (dashboard). Additive: the admin-read policy stays.
create policy "owners read own shop events" on public.events
  for select using (public.owns_shop(shop_id));

-- 2. Anonymous visitor sessions. visitor_id / session_id are app-generated
-- opaque strings (no PII, no auth). A session belongs to at most one shop (the
-- room being visited). Anyone may create/close their own session row.
create table public.visitor_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  visitor_id text not null,
  shop_id uuid references public.shops(id) on delete cascade,
  is_returning boolean not null default false,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_ms bigint check (duration_ms is null or duration_ms >= 0)
);

create index visitor_sessions_visitor_idx on public.visitor_sessions (visitor_id);
create index visitor_sessions_shop_idx on public.visitor_sessions (shop_id, started_at desc) where shop_id is not null;

alter table public.visitor_sessions enable row level security;

-- Anonymous visitors create and update their own session rows; shop owners and
-- admins may read sessions for analytics. (Anon writes are how the funnel is fed
-- without authentication; reads are restricted to owners/admins.)
create policy "anyone starts a session" on public.visitor_sessions for insert with check (true);
create policy "anyone ends their session" on public.visitor_sessions for update using (true) with check (true);
create policy "owners read shop sessions" on public.visitor_sessions for select
  using (public.owns_shop(shop_id) or public.is_admin());

-- 3. Analytics read paths: visitor id lives in events.metadata jsonb (unique
-- visitors), and shop_id is already indexed (events_shop_idx).
create index events_visitor_idx on public.events ((metadata->>'visitorId')) where metadata ? 'visitorId';
