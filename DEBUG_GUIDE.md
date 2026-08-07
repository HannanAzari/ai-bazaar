# DEBUG GUIDE

Practical checks. **§1 is mandatory before writing any persistence code or applying any SQL.**
Nothing here is destructive; do not run destructive SQL.

---

## 1. Does the live Supabase project actually have the Nest tables?

> **Status as of 2026-08-05: ALL migrations are applied** (`m23b`, `m24b`, `m24e`), verified
> by column. Nothing is outstanding. Keep this section anyway — it is the procedure, and the
> M24E lesson stands: a provision file's *current contents* are not what was applied, so
> probe **by column**, never by file name.

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

**Resolved:** `m23b_nest_platform_provision.sql` deliberately creates `nest_objects` with
**no FK** on `asset_id`, so overlay placements (`assetId = "overlay:text"`) are legal.

**Also confirm:** Preview and Production use the **same** Supabase project (compare
`NEXT_PUBLIC_SUPABASE_URL` in both Vercel environments), or results will be misleading.

## 2. Is the app silently falling back to localStorage?

> **Fixed in M23B (D-10).** The five `catch { /* fall back */ }` blocks are gone and
> `nestBackend()` derives from `hasSupabaseEnv()`. This section is kept because the SYMPTOM
> recurs whenever `NEXT_PUBLIC_*` is missing at build time — see §7.

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

---

## 11. M24C/M24D — the scene runtime

**FIRST: is the fix even deployed?** Nothing has shipped since `235d2ab`. Before
investigating any "still broken" report, run §9 and §10's liveness check. Several
already-fixed issues were re-reported three sprints running because the founder was testing
stale code.

**The room background renders as a plain beige field.**
That was data loss, not rendering: `nestDocumentToEditable()` used to set
`backgroundImageUrl` but not `backgroundId`, so a reopened editor carried the fixture's id
and *saving wrote the wrong id back*. Verify the document, not the pixels:
```js
// in the editor, dev console
JSON.stringify(window.__nestDoc?.backgroundId)   // must be the creator's id
```
or check the row: `select background_id from public.nests where slug = '<slug>';`
Fixed at `52bd654`, asserted by `test/nest-scene-roundtrip.test.ts`.

**An object placed inside a focus region disappears.**
Focus regions live in `nests.scene_extras`. Two causes, in this order:
```sql
select to_regclass('public.nests');
select scene_extras from public.nests where slug = '<slug>';
```
1. The column does not exist ⇒ `m24b_provision.sql` is unapplied. The repository degrades
   deliberately (D-30) and the creator is told; this is expected, not a bug.
2. The column exists but is NULL ⇒ the document was saved before `52bd654`. Re-save.

Focus children are **never** promoted into `nest_objects` (D-32) — an empty
`placements` list plus a populated `scene_extras.detailScenes` is correct.

**A focus region opens but nothing moves / the wrong area fills the stage.**
The camera is one transform over the whole stage (D-31), `scale = min(1/w, 1/h)` with the
origin pinned to the crop's centre. If background and objects move by *different* amounts,
something has reintroduced a second coordinate space — that is the bug class M24B §ee2eeee
fixed. Check `focusCameraTransform()` is applied to the stage, not to a child.

**A surface shows nothing for a visitor.**
Surfaces resolve from the placement alone (D-29): `interaction.surfaces` on the placement
plus geometry from `predefinedSurfacesForAsset(assetId)`. Content keyed to a surface the
asset no longer declares is ignored by design. Check both halves:
```js
resolvePlacementSurfaces(placement)   // [] means one of the two is missing
```

**The surround shows colour bands.**
It should be one deterministic `hsl(<hue> 14% 11%)` matte with a gradient, glow and
vignette (D-33). Visible green/beige bands mean the blurred-background version has been
reintroduced — `test/nest-runtime-focus-surface.test.ts` asserts `blur-2xl` and `scale-125`
are absent.

**The scene is stretched or cropped.**
The stage is always 3:4 (`SCENE_ASPECT`), sized with container-query units
(`min(100cqw, 75cqh)`). Note the trap: an explicit `height` is a *definite* size, so
`aspect-ratio` then only derives width and `max-width` silently breaks the ratio. Measure
rather than read the CSS:
```js
// the stage is the overflow-hidden box inside the flex-centred container
const el = document.querySelector('.absolute.inset-0.flex > div');
const r = el.getBoundingClientRect();
r.width / r.height   // must be 0.750
```

---

## 12. M25–M26A — the camera, gestures and the editor

**FIRST, as always: which build is this?**
```bash
curl -s https://<preview-url>/api/build-info
```
Reports `commit`, `branch`, `vercelProject`, `vercelEnv`, `deploymentUrl`,
`supabaseProjectRef` and `supabaseConfiguredAtBuild`. No secrets. If `commit` is not what you
expect, stop — you are debugging a different build.

**Vercel: do NOT guess hostnames.** Settled in M26A: one project (`ai-bazaar`, team
`hannanazaris-projects`), disabled. `402` on the production alias, `410 GONE` on the branch
preview. A 404 on a guessed host proves nothing — a wrong team slug hid the truth for
several sprints.

**A drag moves the room instead of the object (or both).**
Gesture ownership is decided ONCE at pointer-down by `lib/nest-gesture.ts` and held in
`ownerRef`. Check in this order:
1. Does the target carry `data-editor-object`? Handles carry `data-resize-handle` /
   `data-rotate-handle` and are deliberately OUTSIDE the object element.
2. Is the move gated? The canvas must read `const owner = ownerRef.current` and bail with
   `if (!gestureAllows(owner, wanted)) return`.
3. Is the camera's `canPanFrom` routing through `resolveGestureOwner`? An ad-hoc predicate
   here is exactly the bug M26A removed.

**Two fingers resized or rotated my object.** That gesture is deleted (D-56). If it comes
back, look for a `kind: "pinch"` in the editor canvas — object pinch must not exist.

**Handles or the toolbar are the wrong size when zoomed.**
```js
// at 1×, then again at 5× — both must be identical
document.querySelector('[data-resize-handle]').getBoundingClientRect()   // 40×40
document.querySelector('[data-object-toolbar]').getBoundingClientRect()  // 198×46
```
If they scale, chrome has drifted back inside the transform:
```js
!document.querySelector('[data-screen-selection]').closest('.will-change-transform') // true
```
If they *shrink*, something is counter-scaling chrome that is already in screen space —
that double negative measured 40×9px once (D-57).

**An object lands in the wrong place after a zoomed drag.** There is exactly one conversion
(`lib/nest-camera.ts`): `screenToScene`, `sceneToScreen`, `screenDeltaToScene`. A second
positioning formula anywhere is the bug.

**A new asset appears off-screen when added while zoomed.** It must be centred on
`visibleSceneCentre(cam, viewportRect, base)`, not the room centre (D-54).

**The stage shows colour bands again.** `components/nest/nest-stage.tsx` must have exactly
two themes and no per-room hash — deriving a hue from the background id is what produced
green behind one Nest and beige behind another (D-51).
```js
document.querySelector('[data-nest-stage-root]').dataset.stageTheme          // "dark"
getComputedStyle(document.querySelector('[data-nest-stage-root]')).backgroundColor
// identical across every background
```

**The editor renders blank in dev.** Restart the dev server. After several HMR cycles the
editor can mount empty, and the React hook-order warnings that accompany it are HMR
artefacts (the hook sequence in the warning matches a pre-edit module), not real bugs.

**Synthetic pointer events navigate away from the editor.** Known: `dispatchEvent`-driven
gestures do not faithfully reproduce the editor's selection-then-move sequence and can
trigger navigation. Use real `computer` clicks/drags for manipulation checks.
