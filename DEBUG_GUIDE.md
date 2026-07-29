# DEBUG GUIDE

Practical checks. **§1 is mandatory before writing any persistence code or applying any SQL.**
Nothing here is destructive; do not run destructive SQL.

---

## 1. Does the live Supabase project actually have the Nest tables?

The repo *contains* these migrations. Whether they were **applied** is unknown from the repo.

```sql
select to_regclass('public.nests');          -- null ⇒ not applied
select to_regclass('public.nest_objects');
select to_regclass('public.nest_likes');
select to_regclass('public.nest_comments');
select to_regclass('public.creator_follows');
select to_regclass('public.notifications');
```

Then inspect shape:

```sql
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema='public' and table_name in ('nests','nest_objects')
 order by table_name, ordinal_position;

select conname, pg_get_constraintdef(oid)
  from pg_constraint where conrelid='public.nest_objects'::regclass;

select policyname, cmd, qual, with_check
  from pg_policies where schemaname='public' and tablename in ('nests','nest_objects');

select indexname, indexdef from pg_indexes
 where schemaname='public' and tablename in ('nests','nest_objects');

-- profile columns onboarding needs
select column_name from information_schema.columns
 where table_schema='public' and table_name='profiles';

-- what is actually stored
select count(*) from public.nests;
select count(*) from public.nest_objects;
```

**Expected columns** — `nests`: `id, owner_id, slug, title, background_id, visibility,
source_template_id, created_at, updated_at`. `nest_objects`: `nest_id, asset_id, x, y, scale,
rotation, z_index` (+ `overlay, w, h, flip_x` only if the corrective migration ran).

**Known gap:** `nest_objects.asset_id` has an FK to `nest_assets`, which makes an overlay
placement (`assetId = "overlay:text"`) a constraint violation. Confirm before writing overlays.

**Also confirm:** Preview and Production use the **same** Supabase project (compare
`NEXT_PUBLIC_SUPABASE_URL` in both Vercel environments), or results will be misleading.

## 2. Is the app silently falling back to localStorage?

`lib/nest-repo.ts` wraps Supabase calls in `catch { /* fall back */ }` (≈46, 57, 70, 81, 96).
Symptoms: everything "works" for you and nobody else sees it.

- Temporarily `console.error` inside those catches, or set a breakpoint, and publish.
- Or check the result: after publishing, does a `nests` row exist (§1 count query)?
- `select('nestudio-published')` in devtools — if the slug is only there, it never reached the server.

## 3. Is a link relying on the lossy `?c=` payload?

A share URL containing `?c=` carries the whole doc in the URL and **omits** `ownerId`,
`sourceTemplateId`, timestamps and placement extras.

- Strip `?c=` and reload. If it becomes "This Nest isn't open", the Nest exists only locally.
- Target state: `/nest/<slug>` alone resolves for a logged-out visitor.

## 4. Do the editor and previews render identically?

- Open **`/dev/nest-parity`** — one canonical fixture at Profile-card / Search-thumb / Home-feed /
  Full sizes. Composition must match; only the viewport differs.
- Both paths must go through `lib/nest-geometry.placementStyle`. If a surface looks different,
  something reintroduced its own maths — that's the M23A regression to hunt.
- `npx vitest run test/nest-geometry.test.ts` asserts the formula, anchoring, rotation, flipX,
  overlays and z-order.

## 5. Stale autosave vs persisted document

Two stores exist:
- `nestudio:nest-editor:v1:<docId>` — editor autosave (the editor mount **prefers** this)
- `nestudio-nest-documents` — the persisted `NestDocument` (Profile cards read this)

If the editor shows newer content than the Profile card, that's the divergence — not a render bug.
Inspect both in devtools → Application → Local Storage.

## 6. Useful localStorage keys

`nestudio-nest-documents` · `nestudio-published` · `nestudio:nest-editor:v1:<docId>` ·
`nestudio-profiles` · `nestudio-accounts` · `nestudio-account-session` · `nestudio-comments` ·
`nestudio-follows` · `nestudio-admin-mode` · `nestudio:founder-token:v1`

Reset demo state:
```js
["nestudio-profiles","nestudio-nest-documents","nestudio-published"].forEach(k=>localStorage.removeItem(k))
```

## 7. Auth / environment

- **`/api/auth/whoami`** is the single best check — returns `configured`, `projectRef`, `backend`,
  `authenticated`, `userId`, `isFounder`.
- `configured:false` or `backend:"local"` ⇒ `NEXT_PUBLIC_SUPABASE_*` were missing **at build time**;
  the app is in demo mode. Fix env then **redeploy** (a restart is not enough).
- Callback: `GET /auth/callback` with no code should 307 to `/auth/login?error=missing_code` on the
  **same origin**, with `Cache-Control: private, no-store`.
- OAuth/email redirects must be `${window.location.origin}/auth/callback`; Supabase Auth redirect
  URLs need the preview domain (wildcard covers per-commit URLs).

## 8. Cross-account discoverability

Use **two real accounts in two browser profiles** (not two tabs). Publish from A; from B check
Home, Explore, `/@a-handle`, A's House, and the bare share URL. Confirm B cannot see A's drafts and
cannot edit A's Nest (attempt an update and expect an RLS denial).

## 9. Does the Preview deployment match the latest commit?

The repo cannot tell you this. In the Vercel dashboard, compare the deployment's commit SHA with:

```bash
git rev-parse HEAD          # local
git rev-parse origin/m12-nest-platform
```

If they differ, you're testing stale code. A build can also succeed while env vars are wrong — §7.

---

## 10. M24 — quick checks

**Is the deployment even live?**
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<preview-url>/api/auth/whoami
```
`402 DEPLOYMENT_DISABLED` ⇒ the Vercel project is disabled (billing/spend limit), not a
build failure. No push can deploy until that is cleared in the Vercel dashboard.

**Why doesn't my published Nest match the editor?**
Check whether the row predates M24:
```sql
select id, asset_id, w, h from public.nest_objects where nest_id = '<id>';
```
`w`/`h` NULL ⇒ a legacy row on the derived-geometry path. Re-save the Nest in the editor to
convert it. Nothing is lost; nothing is backfilled (D-18).

**Why is the Asset Library empty / why did objects disappear?**
Open the console in development:
```
[asset-library] project=… · assets: N from Supabase + M bundled → T total · …
```
`T` should be `M` plus any Supabase-only ids. If `T` equals `N`, the merge has regressed to
a replacement (D-19).

**Are views recording?**
```sql
select count(*) from public.nest_views;
select nest_slug, viewer_key, view_day from public.nest_views order by created_at desc limit 5;
```
A repeat visit the same UTC day should NOT add a row — that is the unique index, not a bug.

**Is the notifications badge stale?** It refetches on tab focus and every 60s, not via
Realtime (D-23). Switch away and back before concluding it is broken.
