# M12 Preview — Mobile Test Checklist (branch `m12-nest-platform`)

> **Preview only.** Do **not** deploy production, do **not** merge to `main`. This branch
> carries the M12 foundation (`63c55e5`) + M12.1 library cutover & single-editor correction
> (`8f21e6a`). Follow these steps to stand up a Vercel **Preview** wired to Supabase and test
> the full loop on a phone. Reference: [`docs/m12-supabase-cutover.md`](m12-supabase-cutover.md).

The app is **local-mode by default** (localStorage + `?c=` links). Supabase turns on only when
`NEXT_PUBLIC_NEST_BACKEND=supabase` **in the Preview environment**. Never set it in Production here.

> **Image fix (preview blank-images):** the curated library now ships **deployable, web-optimized
> art** under `public/nests/library-v1/` (committed; the raw candidate art is gitignored). Onboarding
> renders these on Vercel in **either** backend. In Supabase mode, if a DB row is missing an image URL,
> the app falls back to this bundled art by id — so onboarding never shows broken images. Step B below
> uploads this same committed art to Storage.

---

## A. Apply Supabase migrations (once, to the preview project)

Use the Supabase SQL editor (Dashboard → SQL) or the CLI. Apply in order:

1. `supabase/migrations/20260702_01_nest_platform.sql` — tables (`nest_backgrounds`, `nest_assets`,
   `nest_templates`, `nests`, `nest_objects`) + `profiles` columns + RLS.
2. `supabase/migrations/20260702_02_nest_storage.sql` — buckets + storage policies.
3. `supabase/migrations/20260702_03_nest_library_admin.sql` — `is_admin()`-gated library writes.

CLI alternative (project linked): `supabase db push`.
**Verify:** the 5 `nest_*` tables exist, 6 buckets exist (`backgrounds/ assets/ templates/ avatars/
user-uploads/ nest-thumbnails/`), and RLS is enabled on the `nest_*` tables.

## B. Upload the curated library

Uploads the committed `public/nests/library-v1/**` art (14 images) to Storage + upserts rows
(templates now include placements + preview_image). Works from a fresh clone (no gitignored deps).

```bash
export NEXT_PUBLIC_SUPABASE_URL=…            # preview project URL
export SUPABASE_SERVICE_ROLE_KEY=…           # preview service key (never commit)
node scripts/upload-nest-library.mjs
```
**Verify:** `backgrounds/` + `assets/` buckets fill; rows appear in `nest_backgrounds` /
`nest_assets` / `nest_templates` with **`image_url` = a public Storage URL**
(`https://<project>.supabase.co/storage/v1/object/public/backgrounds/library-v1__…webp`).
Open one `image_url` in a browser — it must return the image (public bucket).

## C. Configure Supabase Auth (preview project)

- Enable **Anonymous sign-ins** (guests can draft).
- Enable the **Google** provider (client id/secret). Apple is later.
- Add the Vercel preview origin(s) to **Redirect URLs** and **Site URL**, e.g.
  `https://<preview>.vercel.app` and the branch-preview domain.
- Mark at least one profile as admin so `is_admin()` is true for library curation
  (per your existing `public.is_admin()` definition).

## D. Configure Vercel Preview env vars (Preview scope only)

In Vercel → Project → Settings → Environment Variables, add for the **Preview** environment
(not Production):

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | preview project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | preview anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | preview service key (server only) |
| `NEXT_PUBLIC_NEST_BACKEND` | `supabase`  ← **Preview only** |
| `NEXT_PUBLIC_APP_URL` | the preview URL |

Leave `NEXT_PUBLIC_NEST_BACKEND` **unset in Production**.

## E. Deploy the branch to Vercel Preview

- If the repo is connected to Vercel with Git integration, pushing `m12-nest-platform`
  auto-creates a **Preview deployment** for the branch (no production deploy, no merge).
- Otherwise: `vercel` (preview) or Vercel Dashboard → Deployments → deploy the branch.
- **Confirm the deployment is Preview**, built from commit `8f21e6a`, and **not** promoted to
  Production.

## F. Mobile smoke test (open the preview on your phone)

Run each; all must pass. (In Supabase preview mode, published links are real
`/nest/<slug>` URLs; visibility is enforced by RLS.)

1. **Quick Start → choose a template → opens `/nest-editor?document=<id>`** (single editor).
2. **Move an asset** — drag it; position updates.
3. **Save** — edits persist (reload the editor; the move is still there).
4. **Publish public** — sign up (email or Google) when prompted; receive a `/nest/<slug>` URL.
5. **Open the public link on mobile / a private browser** — the Nest renders (moved asset included).
6. **Build My Own → choose a background → `/nest-editor?document=<id>`** opens an empty room.
7. **Admin hide/archive a background** (`/design/nest-admin`, admin user) → **onboarding hides it**
   (`/design/nest-onboarding` → Build My Own no longer lists it).
8. **Archived background still renders in an already-published Nest** — open a Nest published on
   that background before archiving; it still shows (resolve-by-id returns any status).
9. **Private denial** — publish a Nest Private; open its URL in a different browser/account →
   access denied (RLS returns no row).

## G. Route checks (open each on the preview)

- `/design/nest-onboarding` — Create-your-Nest entry (Quick Start / Build My Own).
- `/nest-editor` — with no `?document=` shows the "no Nest" prompt; with a real id, the editor.
- `/design/nest-admin` — admin gate → curation tabs.
- `/design/nest-templates` — template gallery.

## H. Rollback

Unset `NEXT_PUBLIC_NEST_BACKEND` (or set to blank/`local`) in Preview → the app returns to the
localStorage + `?c=` behavior with no data migration. The `nest_*` tables/buckets can stay.

---

*Preview testing only. No production deploy, no merge to `main`.*
