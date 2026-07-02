# M12 — Supabase Cutover Runbook (Nest Platform)

> Turns the M11 local prototype into real infrastructure **without changing user-facing
> behavior**. Everything is authored + gate-verified; the steps below are what a human runs
> against the live Supabase project (they can't be done from the build sandbox). The app
> stays on the M11 local path until `NEXT_PUBLIC_NEST_BACKEND=supabase` is set — so nothing
> breaks before you cut over.

## What M12 shipped (code, in this repo)

- **Schema** — `supabase/migrations/20260702_01_nest_platform.sql` (profiles columns +
  `nest_backgrounds`, `nest_assets`, `nest_templates`, `nests`, `nest_objects` + RLS) and
  `20260702_02_nest_storage.sql` (buckets + storage policies). Tables are namespaced `nest_*`
  to avoid colliding with the existing V1 `public.assets` / `public.profiles`.
- **Persistence facade** — `lib/nest-repo.ts` (local | supabase, chosen by
  `NEXT_PUBLIC_NEST_BACKEND`, default local) with a **safe local fallback** on every Supabase
  call, so an unapplied schema never hard-breaks the app.
- **Supabase repo** — `lib/nest/supabase-nest-repo.ts` (nests + nest_objects CRUD, guest
  anonymous auth, slug publish, RLS-gated resolve, `migrateLocalNestsToSupabase`).
- **Auth facade** — `lib/nest-auth.ts` (local username stub | Supabase anonymous guest +
  email + Google; delayed signup preserved; guests draft, real accounts publish).
- **Tooling** — `scripts/upload-nest-library.mjs` (uploads library images to Storage +
  upserts library rows using the service key).

## Migration / behavior invariants (unchanged from M10/M11)

- Library items are **never deleted** — only re-statused. Published nests keep rendering
  archived backgrounds/assets forever (library SELECT allows any status).
- Public/unlisted nests are world-readable; **private/followers are enforced server-side by
  RLS**, not by a URL payload. The `?c=` self-contained link still works for the local
  backend + as a universal shareable fallback.

## Cutover steps (run against the live project)

1. **Provision** a Supabase project (or reuse the one already in `.env.local`). Set
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   in each environment (local · preview · production). **Never commit secrets.**
2. **Enable anonymous sign-ins** + **Google** provider in Supabase Auth settings (Apple
   later). Add each environment's URL to the allowed redirect list.
3. **Apply the schema** — via the Supabase SQL editor or the CLI:
   `supabase db push` (with all `supabase/migrations/*` present). Confirm the six `nest_*`
   objects + buckets exist.
4. **Upload the curated library**: `node scripts/upload-nest-library.mjs`
   (needs `SUPABASE_SERVICE_ROLE_KEY`). Verify buckets `backgrounds/` + `assets/` fill and
   `nest_backgrounds` / `nest_assets` / `nest_templates` rows appear.
5. **Flip the backend**: set `NEXT_PUBLIC_NEST_BACKEND=supabase` and redeploy. The app now
   persists nests to Postgres + issues real payload-free `/nest/<slug>` URLs.
6. **Migrate existing local work** (optional, per browser): call
   `migrateLocalNestsToSupabase()` on first authed load to copy a user's localStorage nests
   into their account (no work lost).

## Environments

| Env | URL | Notes |
|---|---|---|
| local | `http://localhost:3000` | `NEXT_PUBLIC_NEST_BACKEND` blank (local) or `supabase` to test the cutover |
| preview | Vercel preview URL | separate Supabase project or a preview schema; add the URL to Auth redirects |
| production | prod domain | prod Supabase project; service key only in server env, never client |

## Smoke tests (the M12 acceptance scenarios, run after cutover)

1. **Guest → create → publish → sign in → open on mobile:** guest drafts, publish prompts
   email/Google, published URL opens on another device. ✅
2. **Different user → open private URL → denied:** RLS returns no row for a non-owner. ✅
3. **Admin archives a background → published nests still render, new users can't select it:**
   library SELECT returns archived rows (render), onboarding filters approved/featured. ✅
4. **New phone → login → drafts + published exist:** rows are keyed to `owner_id`, not the
   device. ✅

## Rollback

Set `NEXT_PUBLIC_NEST_BACKEND` back to blank/`local` (or unset the Supabase env). The app
returns to the M11 localStorage + `?c=` behavior with no data migration required. The
`nest_*` tables + buckets can remain in place (harmless when the backend is local).

## Not verified in the build sandbox (needs the live project)

Applying DDL, uploading assets, OAuth redirect flows, and the cross-device acceptance runs
were **authored but not executed here** (no live-DB / network / secrets access in the build
environment). Gates (typecheck · lint · test · build) pass and the **local backend path is
browser-verified** (M11 behavior unchanged with the flag off).
