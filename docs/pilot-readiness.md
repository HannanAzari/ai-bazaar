# Pilot Readiness — Nestudio

A first-time-user audit of the app for a **friends & family pilot** (not a public
launch). Status as of Pilot Hardening V1. Pairs with
[staging-checklist.md](staging-checklist.md) and [pilot-ops.md](pilot-ops.md).

## Flow-by-flow

| Flow | Status | Notes |
|---|---|---|
| Landing page (`/`) | ✅ Ready | Hex village map + onboarding overlay; static, fast. |
| Signup (`/auth/sign-up`) | ✅ Ready | Real Supabase email+password; friendly errors; double-submit guarded; `signup_completed` tracked. |
| Login (`/auth/login`) | ✅ Ready | Friendly errors (bad creds → calm copy); busy state; redirects to `/studio`. |
| Onboarding (`/onboarding`) | ✅ Ready | One screen → profile + Auto Build + first Nest; loading button; friendly errors; input capped. |
| First Nest creation | ✅ Ready | Production `shops` insert (RLS); idempotent; verified live. |
| Room editing (`/studio`) | ✅ Ready | Autosave + manual save fire `room_saved`; save errors are calm; session-loading guard. |
| Public room (`/shop/[address]`) | ✅ Ready | Resolves demo + production shops; loads from Supabase; "door closed" empty state. Records anonymous visitor session + object impressions. |
| Creator insights (`/studio` → Insights) | ✅ Ready | Visits, unique visitors, avg session, top objects/room/day, funnel. Durable in production (owner-read RLS); local in demo. |
| Discovery (`/discover`) | ✅ Ready | Featured Nests (Trending / New / Recently active) reuse house cards; populated from real + seeded data. |
| Logout / login persistence | ✅ Ready | Verified live: room persists across reload + re-login. |
| Mobile (~375px) | 🟡 Acceptable | Core flows usable; see "Risky / watch". |
| Error states | ✅ Improved | Shared `friendlyError`; no raw Supabase strings shown. |

## What is ready
- Auth (signup/login/logout/session) on Supabase; demo mode unchanged.
- Onboarding → first room in well under a minute.
- Room persistence (multi-room, objects, backgrounds, links) round-trips via Supabase.
- Friendly error mapping + loading/double-submit guards on production paths.
- Input limits (`lib/validation.ts`) + existing field caps (guestbook 240, labels, room name).
- Legal/trust placeholders (`/privacy`, `/terms`, `/safety`, `/contact`) linked in footer.
- Pilot funnel analytics (internal, localStorage).

## What is risky (watch during pilot)
- **Email deliverability:** pilot uses email-confirm OFF on staging; enabling it in
  production needs a custom SMTP (default sender rate-limits at ~3/hr).
- **Shop claiming concurrency:** open-slot selection is read-then-insert; two users
  claiming the same slot at once would hit the unique constraint and surface a calm
  retry message, but isn't transactional. Fine at pilot scale.
- **`getByHandle` aggregate** returns null in production V1 → `/u/[handle]` is thin
  in production (demo is full). Acceptable for pilot.
- **Mobile**: dense studio controls are usable but cramped at 375px (no redesign in scope).
- **Durable analytics unverified live:** the `SupabaseEventsRepository` is now
  implemented (Analytics + Discovery V1) and `trackEvent` writes to Supabase in
  production, but the schema isn't applied to the live project here, so writes fall
  back to the local mirror until it is. Apply `schema.sql` + `20260625_*` and run the
  RLS smoke tests to verify cross-device analytics. The `reports` Supabase repo is
  still a stub → moderation reads localStorage in production.
- **Discovery trending** ranks from recorded visits + seeded data; a public aggregate
  view is needed for a global production trending feed (fine at pilot scale).

## Must fix before pilot — none blocking
All P0 user-facing issues found in the audit were addressed this sprint (raw errors,
double-submit, missing loading/empty states, no legal pages). Remaining items are
"watch" not "block".

## Can wait (post-pilot)
- Custom SMTP + production email confirmation.
- `events`/`reports` Supabase repos; moderation dashboard.
- `/u/[handle]` production aggregate; richer mobile layout pass; avatar uploads.
- Transactional slot claiming; admin UI.

## Verdict
**Safe for a friends & family pilot.** Not public-launch ready (see "risky" + "can
wait"). Run the [staging-checklist.md](staging-checklist.md) §0z flow after each deploy.
