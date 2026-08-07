# Nestudio — CTO Handoff

> **START HERE.** Entry point for a new session. Grounded in the repository, not in prior
> chat context. Read this, then `NEXT_SPRINT.md`. Everything else is reference.

| | |
|---|---|
| **Branch** | `m12-nest-platform` (never merge to `main`) |
| **Latest commit** | `56aa6f3` — M26A final: one gesture dispatcher, Edit\|Preview, toolbar in screen space. See `M26A_SPRINT_REPORT.md`. |
| **Gates at that commit** | typecheck ✅ · eslint 0 errors ✅ · **1156 tests / 101 files** ✅ · `next build` ✅ (133 pages) |
| **Deployment** | ⛔ **BLOCKED — see §0.** One Vercel project, disabled. |
| **Live DB** | Supabase `srrmkdsvldlyllsxyhtq`. `m23b`, `m24b` and `m24e` all applied. **No migration is outstanding.** |

---

## 0. THE BLOCKER — one, and only the founder can clear it

### 0.1 The Vercel project is disabled

Settled with evidence in M26A. **There is ONE project — `ai-bazaar`, team
`hannanazaris-projects` — and it is disabled.**

```
hannanazaris-projects.vercel.app                             404  DEPLOYMENT_NOT_FOUND
ai-bazaar-git-m12-nest-platform-hannanazaris-projects…app    410  GONE ("removed")
ai-bazaar-git-main-hannanazaris-projects.vercel.app          404
ai-bazaar.vercel.app                                         402  DEPLOYMENT_DISABLED
```

- The bare team host is a **scope suffix**, not an app URL — nothing is ever served there.
- The **410** is decisive: that hostname pattern is right, a deployment for this branch *did*
  exist, and Vercel has **removed** it. That is what happens to preview deployments when a
  project is disabled.

So both things are true: the founder really was testing a real deployment, and it really has
not been reachable since. **Do not re-litigate this and do not guess hostnames** — a 404 on a
guessed Vercel hostname proves nothing (an earlier wrong team slug, `hannans-projects`, hid
the 410 for several sprints).

`402 DEPLOYMENT_DISABLED` is a billing/usage state, **not a build failure**: `next build`
passes locally at 133 pages and every commit pushed cleanly.

**Fix (founder only):**
1. Vercel dashboard → project `ai-bazaar` → **Settings → Billing / Usage** → clear the block.
2. Redeploy `m12-nest-platform`.
3. Verify at `<preview-url>/api/build-info` — it reports `commit`, `branch`, `vercelProject`,
   `vercelEnv`, `deploymentUrl` and `supabaseProjectRef`, with no secrets. That endpoint
   exists precisely so "which build am I looking at?" is answerable from the phone.

There is no `.vercel/project.json`, no linked CLI and no token in this repo, so an agent can
neither deploy nor read build logs.

### 0.2 ~~Migrations~~ — CLEARED

`m24e_provision.sql` was applied. Verified live 2026-08-05:

```
nests.scene_extras      EXISTS      nests.draft_doc   EXISTS
nest_views              EXISTS      draft_updated_at  EXISTS
```

M25 and M26A need **no migration at all** — object interaction config rides in the existing
`nest_objects.interaction` jsonb bag.

Still **do not run** `nests_canonical_provision.sql` (superseded) or
`supabase/migrations/20260703_01_nest_social.sql` (aborts on the legacy `notifications`).

> Lesson kept: a provision file's *current contents* are not what was applied. Probe the live
> schema **by column**, never by file name.

---

## 1. Product vision

Nestudio is a **digital home**, not a social network. People arrive outside someone's
**House** and step inside a **Nest**. Vocabulary is fixed: House = exterior/arrival,
Nest = interior. "Room" is not used on profile/arrival surfaces.

## 2. Current stage

**Rooms-style editor foundation.** The programme has run: canonical rendering → shared
persistence → truthful publishing → one scene runtime → free zoom + object interaction →
**one gesture dispatcher and a real screen-space chrome layer**. The through-line is
unchanged: what a creator builds must be exactly what everyone else sees.

## 3. What is working (verified locally)

- **Auth.** Real Supabase auth; one server read, one client hook. Sign-in cannot freeze
  (D-11…D-13); sign-up cannot report success without creating a user (D-14).
- **Shared persistence.** Nests, profiles, houses, likes, comments, follows, notifications —
  all Supabase. No silent localStorage fallback (D-10).
- **Publishing parity.** The creator's box is replayed verbatim; one renderer; one
  coordinate space (D-18, D-24, D-25).
- **Onboarding**, **Settings** (real sign-out + delete cascade), **drafts**, **delete Nest**,
  per-Nest **views**, **notifications**.
- **Free exploration + object interaction (M25).** Pinch/pan to 5×; objects are the tap
  targets; a typed capability model drives TV / lamp / laptop / books. Legacy Focus data
  still plays but can no longer be authored.
- **Nest Stage (M26A).** One deep neutral stage, two variants, around every room. Not stored
  in the document.
- **One gesture dispatcher (M26A).** Owner assigned at pointer-down and locked until
  pointer-up. Two fingers never touch object geometry.
- **Real screen-space chrome (M26A).** Selection frame, handles and toolbar are siblings of
  the viewport, positioned per frame from `sceneToScreen()`. Handles measured 40×40 at both
  1× and 5×; toolbar 198×46 at both.
- **Edit | Preview (M26A).** One switch, both modes, no duplicate.

## 4. Sprint history (most recent first)

| Commit | What it did |
|---|---|
| `56aa6f3` | M26A final — one gesture dispatcher; object-pinch deleted; Edit\|Preview; toolbar into screen space |
| `373e738` | M26A — real screen-space selection chrome; `/api/build-info`; the Vercel 410 finding |
| `0ade25a` | M26A — `NestStage`; gesture arbiter; screen-sized chrome (first pass) |
| `08f9871` | M25B — creator zoom, sheet layering, Safari form zoom, Save interaction |
| `4b4056c` | M25 — free zoom + object interaction replace the Focus-first model |
| `fbdf460` | M24E — the Nest is actually interactive (Focus opens, Surfaces run) |
| `e719e2d` | docs reconciliation |
| `c9bb259` | M24D — visitors replay Focus/Surface; adaptive matte |
| `52bd654` | M24C — background + focus-scene data loss; `scene_extras` |
| `3b515b9` · `b3f116c` · `ee2eeee` | M24B — parity, drafts, delete, views, one coordinate space |
| `876581f` · `235d2ab` | M24 — views, notifications; parity, layering, library merge |
| `f263fdc` · `1e1c432` | auth hotfixes (signup unreachable; sign-in freeze) |
| `88821f8` | M23B — truthful persistence, onboarding, settings |

Detail: **`M26A_SPRINT_REPORT.md`** (current), `M25_SPRINT_REPORT.md`,
`M24E_SPRINT_REPORT.md`, `M24CD_SPRINT_REPORT.md`, `M24B_SPRINT_REPORT.md`,
`M24_SPRINT_REPORT.md`, `M23B_SPRINT_REPORT.md`.

## 5. What is NOT verified — do not claim these

Most are blocked on §0.1; the last three are simply not done.

- **Two-account live social testing** — unit-tested only.
- **Publish → visitor round-trip** — never compared by a human.
- **Notifications end-to-end** — wired, never driven by a second account.
- **Views** — `nest_views` exists; nothing counted by a second account.
- **Zoom smoothness on a physical iPhone** — structurally optimised (D-43), never
  frame-rate measured on a device.
- **Mobile acceptance at 390×844 and 430×932** — only 375×667 and 714×863 were run.
- **The 17-step creator flow** — selection, zoom, chrome sizing and the mode switch were
  driven; drag, resize, rotate, add-from-library at 5×, Save Draft and reopen were not.
- **Adding an asset while zoomed through the real asset-library UI** — unit-tested through
  `addObject` and the wired `visibleCentre` call, not driven through the sheet.

## 6. Known limitations

- **Legacy Nests** (`nest_objects.w`/`h` NULL, pre-M24) keep derived geometry until re-saved;
  badged in the owner's Profile. **Never backfilled** (D-18).
- **`nest_assets` holds one row.** The library merges Supabase over the bundled fixture
  (D-19). Fix the Asset-Factory publishing seam; do not duplicate rows.
- **Speaker, console, curtain and a standalone laptop have capability definitions but no
  art** (`AWAITING_ART` in `lib/nest-asset-interaction.ts`). They cannot appear in a room.
- **Notifications use focus-refetch**, not Realtime (D-23).
- **The 9:16 immersive background** is a documented typed seam only.

## 7. Architecture (detail in `docs/ARCHITECTURE.md`)

### The stage / world / screen split — M26A's core

```
<NestStage>                        app environment; NEVER in the Nest document
  <NestViewport>                   clipping box; the camera attaches here
    <camera stage>                 WORLD SPACE — transformed
       background · objects · hit areas
  <ScreenSpaceChrome>              SCREEN SPACE — sibling, never a descendant
       selection frame · handles · object toolbar · Reset view
```

Chrome is positioned per camera frame from `sceneToScreen()`, written straight to the DOM
inside the camera's own rAF — so it tracks the object without a React render and never
scales (D-53, D-57).

### The scene contract

```
Editor ──editableObjectsToPlacements + editableSceneExtras──► NestDocument
                                  ┌────────────────┴───────────────┐
                            nest_objects                    nests.scene_extras
                          (main placements)            (legacy focus regions)
                                  └──────────► NestRuntime ◄───────┘
                                (Preview · visitor · feed · cards)
```

### Key modules
- `lib/nest-camera.ts` — camera maths **and** `screenToScene` / `sceneToScreen` /
  `screenDeltaToScene` / `visibleSceneCentre` / `resolveTapTarget`. One positioning system.
- `lib/nest-gesture.ts` — the gesture arbiter (pure). One owner per session (D-52, D-55).
- `lib/nest-scene.ts` — pure scene resolution. React-free, Supabase-free.
- `lib/nest-interaction.ts` — the typed interaction contract (D-34).
- `lib/nest-asset-interaction.ts` — asset capability model (D-35, D-40).
- `components/nest/nest-stage.tsx` — `NestStage` / `NestViewport` / `ScreenSpaceChrome`.
- `components/nest/app-shell/nest-runtime.tsx` — **the one runtime**; `mode` decides input
  only. `nest-preview.tsx` is a passthrough adapter.
- `components/nest/app-shell/use-scene-camera.ts` — gestures via refs; `subscribe()` publishes
  every frame.
- `components/nest/editor/screen-space-selection.tsx` — the screen-space chrome layer.
- `/dev/nest-runtime` — Preview and visitor side by side on one document, with resolver
  output printed. The fastest way to tell "not interactive" from "data never arrived".

### Other spines
- **Auth** — `lib/auth/*`; diagnostics at `/api/auth/whoami` and `/api/build-info`.
- **Persistence** — `lib/nest-repo.ts` over `lib/nest/supabase-*-repo.ts`.
- **Social state** — `lib/nest-social-store.ts`, one optimistic cache.
- **Layering** — `lib/nest-layers.ts` (D-16).

## 8. Stop rules

- **Never apply SQL.** Migrations are written, shown, and founder-provisioned.
- Never merge to `main` or promote to Production.
- **Never let a missing column break the product** (D-30) — but **never silently discard
  creator work** (D-37): refuse the write and name the migration.
- **Never infer an interaction from an asset id or name** (D-34).
- **Two fingers never touch object geometry** (D-56).
- **The camera is never persisted** (D-45).
- No silent fallbacks that mask backend failure (D-10).
- Never reconstruct or approximate a creator's layout.
- No new AI / asset / avatar / marketplace systems during beta stabilisation.
- Do not sweep the pre-existing dirty files into commits (§9).

## 9. Working-tree note

These tracked files are **pre-existing work that predates this programme**. Never stage them:

```
app/creator-studio/review/review-client.tsx      docs/BETA_INTERACTION_AUDIT.md
apps/asset-factory/lib/golden-room.ts            docs/BETA_NAVIGATION_AUDIT.md
components/room/room-object.tsx                  docs/nestudio-cto-handoff.md
                                                 docs/room-engine-spec.md
```

Same for the many untracked `app/design/*`, `apps/asset-factory/*`, `lib/wall-*`,
`public/benchmark/*` and `docs/*` files. Always `git add` explicit paths. **Never `git add -A`.**

## 10. Environment

- Node 20 required: `export PATH=/Users/hannan/.nvm/versions/node/v20.20.2/bin:$PATH`
  (the shell defaults to Node 16).
- Gates: `npx tsc --noEmit` · `npx next lint` · `npx vitest run` · `npx next build`.
- `.env.local` points at the live Supabase project — local dev writes production data.
- Preview env must include `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `FOUNDER_EMAILS`/`FOUNDER_USER_IDS`,
  `NEXT_PUBLIC_NEST_BACKEND=supabase`. `NEXT_PUBLIC_*` is **inlined at build time** —
  missing values silently drop the app into demo mode. This has bitten us twice.
- **Dev-server note:** the editor sometimes renders blank after several HMR cycles. Restart
  the dev server rather than debugging it; the accompanying React hook-order warnings are
  HMR artefacts, not real ordering bugs.

## 11. Document map

| Document | Purpose |
|---|---|
| **`CTO_HANDOFF.md`** | this file — orientation + the blocker |
| **`NEXT_SPRINT.md`** | what to do next, in order |
| **`SESSION_PROMPT.md`** | paste this into a new Claude session |
| **`M26A_SPRINT_REPORT.md`** | CURRENT: Nest Stage, gesture dispatcher, screen-space chrome, the Vercel finding |
| `M25_SPRINT_REPORT.md` | free zoom + object interaction |
| `M24E_SPRINT_REPORT.md` | the interactive runtime + the full data trace |
| `M24CD_SPRINT_REPORT.md` · `M24B_SPRINT_REPORT.md` · `M24_SPRINT_REPORT.md` · `M23B_SPRINT_REPORT.md` | earlier records |
| `ROADMAP.md` | done / unverified / blocked / deferred |
| `DECISIONS.md` | **D-01…D-58** — decisions and *why* |
| `DEBUG_GUIDE.md` | practical diagnostics (start with §1) |
| `docs/ARCHITECTURE.md` | the architecture in detail |
| `docs/CANONICAL_NEST_DATA_AUDIT.md` | the data/rendering forensic audit |
| `docs/handoff/01–10` | **historical**; superseded by this file where they disagree |

> ⚠️ `docs/ARCHITECTURE.md` (not root) — a pre-pivot `architecture.md` exists at the root
> and this filesystem is case-insensitive, so a root `ARCHITECTURE.md` would overwrite it.
