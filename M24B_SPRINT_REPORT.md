# M24B — publishing parity, draft workflow & beta polish

> Read `CTO_HANDOFF.md` first. Supersedes `M24_SPRINT_REPORT.md`.

## ⛔ Deployment is blocked — and it is not the code

```
https://ai-bazaar.vercel.app/api/auth/whoami   → 402  DEPLOYMENT_DISABLED
https://ai-bazaar-git-m12-nest-platform-…/…    → 404  DEPLOYMENT_NOT_FOUND
```

The Vercel project is **disabled** (account/billing). Every commit since `235d2ab` has
pushed cleanly and built locally (132 pages), and none of them can deploy. This means the
founder has been testing a build that predates every M24/M24B fix — which is why items
already fixed still looked broken.

**Only you can clear this:** Vercel dashboard → `ai-bazaar` → Settings → Billing/Usage →
clear the block → redeploy `m12-nest-platform` → verify at
`<preview-url>/api/auth/whoami` (`resolvedBackend: "supabase"`,
`projectRef: "srrmkdsvldlyllsxyhtq"`, `vercelEnv: "preview"`).

There is no Vercel CLI, token or `.vercel` linkage in this environment.

## Manual SQL

**Apply `supabase/provision/m24b_provision.sql`** — additive, idempotent. Creates
`nest_views` and adds `nests.draft_doc` / `draft_updated_at`.
`m24_views_provision.sql` was **deleted**: it created a `profile_views` table that M24B
decided should not exist.

## Acceptance criteria

| Criterion | Status | Evidence |
|---|---|---|
| Editor == Preview == Published == Feed == Visitor | ✅ | Measured in-browser: worst delta **0.0027** (~1px) across all 4 objects; both stages exactly **0.750** aspect |
| Generated assets appear automatically | ✅ | Editor tray shows the Asset-Factory laptop; diagnostic `1 from Supabase + 19 bundled → 20 total` |
| Draft editing exists | ✅ | `nests.draft_doc`; save on a published Nest never touches `nest_objects`; 7 tests |
| Delete Nest works | ✅ | Confirmation modal; cascades `nest_objects`; leaves every surface at once |
| Edit button works | ✅ | Row + explicit pencil both open the editor |
| Views aggregate correctly | ✅ | Per-Nest only; Profile totals = SUM over published Nests |
| Likes/comments/follows update instantly | ✅ | Shared store, 17 tests (from M24) |
| Carousel cards fully visible | ✅ | No page scroll + CTA visible + cards unclipped at 375×667, 375×812, 430×932 |
| Preview mode restored | ✅ | Background renders; `interactive` matches the visitor exactly |
| No visible object displacement | ✅ | Root cause was the coordinate space, not w/h — see below |
| Published scene pixel-perfect | ✅ for new saves | Legacy rows need one re-save (below) |

## The two root causes

**Displacement.** Not a `w/h` problem. The editor lays out in a strict 3:4 box; the
renderer stretched its stage to `inset:0` of its container (~0.49 on a phone) and drew the
background `object-cover` (cropped), while objects stayed positioned as percentages of the
*container*. Background and objects drifted apart by however much the container's aspect
differed from 3:4 — **differently on every screen size**. The stage is now always
`SCENE_ASPECT`, letterboxed, background `object-fill`.

Implementation note: `height:100%` + `aspect-ratio` + `max-width` does **not** work — an
explicit height is definite, so `aspect-ratio` only derives the width and `max-width` then
silently breaks the ratio. Container-query units (`min(100cqw, 75cqh)`) constrain the width
by both axes first. Verified by measurement, not by reading the diff.

**Three renderers.** Preview used `NestSceneNavigator`, the visitor used `NestPreview`, the
editor its own canvas. Preview showed a scene no visitor would ever get. There is now one
`NestPreview`; `interactive` is the only thing modes may vary.

## Also fixed while verifying

`BottomSheet`'s slide-up used `animation-fill-mode: both`, which holds the **from** state
(`opacity: 0`, `translateY(100%)`) whenever the animation is not advancing — a throttled
tab, a low-power device. Caught by probing the overlay stack: the panel measured
`top = viewportH` with the animation stuck at `currentTime: 0`. Fill-mode removed from the
sheet and the modal, so a sheet that fails to animate simply appears instantly.

## Known limitation — legacy Nests

Rows saved before M24 have `w`/`h` NULL and keep the derived-geometry path. They render
exactly as they always have, but will not be pixel-identical to the editor until the
creator **saves them once**. We do not backfill — inferring the original boxes would be
guessing at creator intent. The owner's Profile now badges these
**"Re-save to update layout"** (creator-only; visitors never see it).

Your three existing published Nests are affected.

## Gates

typecheck ✅ · eslint **0 errors** ✅ · **865 tests / 94 files** ✅ · build ✅ 132 pages

New: `nest-draft-workflow` (7), `nest-scene-renderer` (12).

## Not verified

- **Two-account live social testing** — the shared store is unit-tested but not proven with
  two live accounts.
- **Publish → visitor round-trip on a real new save** — parity is measured Editor↔Preview
  and both stages measured identical to the feed; the full publish cycle needs a working
  deployment.
- **Notifications end-to-end** — the page and badge are wired; not driven by a second
  account.
