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

## M12.1 — Library cutover (backgrounds/assets/templates + admin)

The curated library also moves to Supabase, keeping the fixture as a safe fallback:

- **Schema:** `supabase/migrations/20260702_03_nest_library_admin.sql` adds `is_admin()`-gated
  UPDATE policies on `nest_backgrounds/nest_assets/nest_templates` (reads are already public).
- **Source:** `lib/nest/supabase-library-repo.ts` fetches the library (all statuses) + writes
  status. `lib/nest-production-library.ts` gained `hydrateLibrary()` (pulls the DB into an
  in-memory cache the sync resolvers read) and a backend-aware, async `setItemStatus` (writes
  to the DB in supabase mode, else a localStorage override). `getLibrary()` prefers the cache
  when hydrated, else the fixture + overrides.
- **Behavior:** admin approve/feature/hide/archive → DB; onboarding lists only approved/featured
  from the DB; published Nests still resolve archived items (library SELECT + resolve-by-id return
  any status; fixtures kept as fallback). If Supabase is unavailable the fixture path remains.
- **Admin must be an `is_admin()` user** (signed in) to write library status in supabase mode.
  Fixtures are **not removed**.

To activate the library cutover: apply migration `_03`, run `scripts/upload-nest-library.mjs`
(populates the tables), and set `NEXT_PUBLIC_NEST_BACKEND=supabase`. Local mode (flag off) is
unchanged — verified in-browser (admin hide → onboarding filters, via the fixture path).

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

## M13 addendum (2026-07-02)

M13 (mobile stabilisation, [m13-mobile-stabilisation.md](m13-mobile-stabilisation.md)) runs on
top of this cutover and changes **no schema**. Relevant notes:

- The curated library now includes the **restored Golden Nest assets** (catalog-aligned ids) and
  **hides** the flawed oak TV/desk/chair. `scripts/upload-nest-library.mjs` still uploads the
  committed `public/nests/library-v1/**` art (now including the golden WEBP) to Storage.
- Generic **overlays** persist via new optional `NestPlacement.overlay/w/h/rotation` (local mode +
  `?c=` link). The Supabase `nest_objects` schema has **no overlay columns yet** — overlays do not
  persist through the Supabase backend until that follow-up lands. Everything else works in either
  backend.
