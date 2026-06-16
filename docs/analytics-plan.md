# Analytics Plan — Nestudio (pilot)

Internal, privacy-light analytics only. **No third-party services.** Events are
recorded via `trackEvent()` (`lib/events.ts`), which is **mode-aware** (Analytics +
Discovery V1, 2026-06-25): in **demo** it appends to localStorage; in **production**
it writes durably to Supabase via the `record_event` RPC (`SupabaseEventsRepository`),
falling back to the local mirror (logged once) if the write fails. Counts surface on
`/moderation`; per-creator insights surface in **Studio → Insights & visitors**.

Every event auto-carries an **anonymous visitor id + session id** (no auth, no PII;
`lib/visitor-id.ts` / `lib/visitor-session.ts`), stored in the `events.metadata`
jsonb. This powers unique-visitor, session-duration, object-engagement, and funnel
metrics — all computed by one pure module (`lib/creator-insights.ts`) shared by demo
and production.

## Events that exist (by area)

- **Engagement:** `house_view`, `room_view`, `decoration_click`, `object_click`,
  `link_click`, `share_click`, `follow`, `like`.
- **Room studio:** `room_object_added/deleted/moved/resized`, `room_template_applied`.
- **Interactive objects:** `gallery_opened`, `video_opened`, `product_opened`,
  `booking_opened`, `contact_opened`, `profile_opened`.
- **Multi-room:** `room_entered`, `room_created`, `room_deleted`, `room_link_clicked`.
- **AI designer V1–V3:** `room_design_generated/applied/regenerated`,
  `room_design_draft_saved/draft_applied/constraint_detected/preset_used`,
  `creator_profile_analyzed/room_generated/room_applied/social_object_created`.
- **Pilot funnel:** `signup_completed`, `onboarding_completed`,
  `first_nest_created`, `room_saved`.
- **Visitor analytics (Analytics + Discovery V1):** `session_started`,
  `session_ended` (metadata `durationMs`/`returning`), `object_view` (per-object
  impressions for engagement %).

## Creator insights (Studio → Insights & visitors)

`lib/creator-insights.ts` aggregates one shop's events into: total visits, unique
visitors, room entries, average session duration, top clicked objects (+ views /
clicks / opens / engagement %), top room, top day of week, and the visitor funnel
(visits → room entries → interactions → exits) with conversion %. Production reads
are gated by the `owns_shop` RLS policy so a creator sees only their own numbers.

## Discovery ranking (Featured Nests)

`lib/discovery.ts` powers `/discover` Featured Nests: Trending (most recorded
visits), New creators (newest), Recently active (latest real activity) — each falling
back to seeded `shops` data so rails are always populated. Discovery does not read
the `events` table client-side (RLS forbids anon reads); a public per-shop aggregate
view for global production trending is deferred.

## Pilot events that matter (the funnel)

| Step | Event | Fired where |
|---|---|---|
| Account created | `signup_completed` | `app/auth/sign-up` on success |
| Reached first room | `onboarding_completed` | `app/onboarding` on success |
| First Nest claimed | `first_nest_created` | `app/onboarding` on success |
| Room persisted | `room_saved` | editor autosave + Save; onboarding |
| Public room viewed | `room_view` (reused) | `RoomExperience` mount |

Pilot questions these answer: do people finish onboarding? do they get a room saved?
do their rooms get visited?

## What is missing / deferred (post-pilot)

- **Live Supabase verification:** the durable path (`SupabaseEventsRepository` +
  `record_event`) is implemented and unit-tested with a mock client, and verified in
  demo via localStorage — but the schema has **not been applied to live Postgres**
  here (ADR-018 limitation), so end-to-end durability is unverified. Until then,
  production writes that fail fall back to the local mirror (so the dashboard still
  works per-browser). Apply the schema + run the RLS smoke tests to close this.
- **Global production discovery trending:** ranking uses recorded visits in the local
  mirror + seeded `shops` data. A public per-shop aggregate view/RPC is needed for a
  truly global production trending feed (discovery can't read raw `events` under RLS).
- **Funnel drop-off detail:** no per-step timing, no "started but abandoned
  onboarding," no error-rate events.
- **Retention:** return-visit is now captured (`session_started` `returning` flag);
  no DAU/cohort rollups yet.
- **External analytics** (PostHog/GA/etc.): intentionally **not** added.

## Recommended next steps (when past pilot)

1. Apply `schema.sql` + the `20260625_*` migrations to the live project and run the
   RLS smoke tests (owner-read events, anon session insert) to verify durable,
   cross-device analytics end-to-end.
2. Add a public per-shop visit-count aggregate view for global discovery trending.
3. Add lightweight drop-off + error events (`onboarding_started`, `*_failed`).
4. Only then consider a privacy-respecting external product-analytics tool.
