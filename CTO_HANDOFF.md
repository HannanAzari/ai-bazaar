# Nestudio — CTO Handoff

> **START HERE.** Entry point for a new session. Grounded in the repository, not in prior
> chat context. Read this, then `NEXT_SPRINT.md`. Everything else is reference.

| | |
|---|---|
| **Branch** | `m12-nest-platform` (never merge to `main`) |
| **Latest commit** | M24E — *the Nest is actually interactive*. See `M24E_SPRINT_REPORT.md`. |
| **Gates at that commit** | typecheck ✅ · eslint 0 errors ✅ · **948 tests / 97 files** ✅ · `next build` ✅ (133 pages) |
| **Deployment** | ⛔ **BLOCKED — see §0.** Nothing has deployed since `235d2ab`. |
| **Live DB** | Supabase `srrmkdsvldlyllsxyhtq`. `m23b` and `m24b` are applied. **`m24e_provision.sql` is NOT** — see §0.2. |

---

## 0. THE TWO BLOCKERS — both need the founder, neither is code

Everything else in this document is secondary to these.

### 0.1 Vercel is disabled

```
https://ai-bazaar.vercel.app/api/auth/whoami        → 402  DEPLOYMENT_DISABLED
https://ai-bazaar-git-m12-nest-platform-….app/…     → 404  DEPLOYMENT_NOT_FOUND
```

`402 / DEPLOYMENT_DISABLED` is Vercel refusing to serve a suspended project — in practice a
billing state (spend limit reached, or a failed payment method). **It is not a build
failure:** `next build` passes locally at 133 pages and every commit pushed cleanly.

**This changes how you should read bug reports.** The founder has been testing a build from
before `235d2ab`. Several issues re-reported across M24 / M24B / M24C were already fixed in
code they had never run. Before investigating any "still broken" report, check whether the
fix has simply not shipped.

**Fix (founder only):**
1. Vercel dashboard → project `ai-bazaar` → **Settings → Billing / Usage** → clear the block.
2. Redeploy `m12-nest-platform`.
3. Verify at `<preview-url>/api/auth/whoami`: `resolvedBackend: "supabase"`,
   `projectRef: "srrmkdsvldlyllsxyhtq"`, `vercelEnv: "preview"`, and the expected commit.

There is no Vercel CLI, token or `.vercel` linkage in this repo, so an agent can neither do
this nor read the build logs.

### 0.2 `supabase/provision/m24e_provision.sql` is unapplied

Live inspection on 2026-08-05 found the migration state **split**:

```
nests.draft_doc          EXISTS      nest_views          EXISTS
nests.draft_updated_at   EXISTS      nests.scene_extras  MISSING  ←
```

`m24b_provision.sql` was applied **before M24C appended `scene_extras` to it**. So the
migration genuinely was applied — just the earlier version. This one column is why every
Focus region, and every object placed inside one, was discarded at the database boundary
no matter how correct the editor and runtime were.

`m24e_provision.sql` adds exactly that column. Additive and idempotent; run it in the
Supabase SQL editor. (Re-running `m24b_provision.sql` would also work — a separate file
just makes the outstanding action unambiguous.)

**Until it is applied**, saving or publishing a Nest that contains Focus regions is
**refused with a clear message** rather than silently dropping them (D-37). Nests without
Focus regions are completely unaffected.

**Do not run** `nests_canonical_provision.sql` (superseded; ALTERs a table that does not
exist) or `supabase/migrations/20260703_01_nest_social.sql` (aborts on the legacy
`notifications` table).

---

## 1. Product vision

Nestudio is a **digital home**, not a social network. People arrive outside someone's
**House** and step inside a **Nest**. Vocabulary is fixed: House = exterior/arrival,
Nest = interior. "Room" is not used on profile/arrival surfaces.

## 2. Current stage

**Beta stabilisation, runtime-correctness phase.** The programme has run: canonical
rendering → shared persistence → truthful publishing → *one scene runtime*. The through-line
is that what a creator builds must be exactly what everyone else sees.

## 3. What is working (and verified locally)

- **Auth.** Real Supabase auth. One server read (`getServerUser`), one client hook
  (`useNestIdentity`), founder role-gating via `FOUNDER_EMAILS` / `FOUNDER_USER_IDS`.
  Sign-in cannot freeze (D-11…D-13); sign-up cannot report success without creating a user
  (D-14).
- **Shared persistence.** Nests, profiles, houses, likes, comments, follows and
  notifications all live in Supabase. No silent localStorage fallback (D-10).
- **Publishing parity.** The creator's approved box is replayed verbatim; one renderer; one
  coordinate space (D-18, D-24, D-25). Measured Editor↔Preview delta: **0.0027** (~1px).
- **Onboarding** (identity → house → Profile), **Settings** with real sign-out and a real
  delete-account cascade, **draft workflow**, **delete Nest**, per-Nest views,
  notifications.
- **A genuinely interactive Nest (M24E).** One runtime (`NestRuntime`) for the editor
  Preview, the public Nest and every card. Focus regions open and return; hotspots run a
  typed interaction (`open-url` / `open-youtube` / `enter-focus`) resolved only from
  creator data. Verified in a real browser in both modes — see `M24E_SPRINT_REPORT.md` §6.

## 4. Sprint history (most recent first)

| Commit | What it did |
|---|---|
| M24E | one `NestRuntime`; typed interaction contract; Focus/hotspot execution; the split-migration discovery |
| `c9bb259` | M24D — visitors replay Focus/Surface; scene resolution extracted to `lib/nest-scene.ts`; blurred surround → adaptive matte |
| `52bd654` | M24C — **background** and **focus-scene** data loss fixed; `scene_extras`; schema tolerance |
| `3b515b9` | M24B — overlay `fill-mode` hazard; legacy-layout notice; docs |
| `b3f116c` | M24B — one SceneRenderer; draft workflow; delete; per-Nest views; carousel |
| `ee2eeee` | M24B — scene locked to one coordinate space (the last displacement source) |
| `876581f` | M24 — views, notifications, comment-sheet keyboard; **deployment blocker found** |
| `235d2ab` | M24 — editor/publish parity; layering; house identity; asset-library merge |
| `f263fdc` | Hotfix — signup could not reach Supabase (backend resolved to `local`) |
| `1e1c432` | Hotfix — sign-in froze on "Signing in…" (auth Web Lock deadlock) |
| `88821f8` | M23B — truthful persistence, onboarding, settings, simplified Nest |

Detail: `M24E_SPRINT_REPORT.md` (current), `M24CD_SPRINT_REPORT.md`,
`M24B_SPRINT_REPORT.md`, `M24_SPRINT_REPORT.md`, `M23B_SPRINT_REPORT.md`.

## 5. What is NOT verified — do not claim these

Every item is blocked on §0.1, §0.2, or both.

- **Two-account live social testing.** The shared social store is unit-tested (17 cases) but
  never proven with two real accounts.
- **Publish → visitor round-trip.** Parity is measured Editor↔Preview and by unit test;
  nobody has published a Nest and compared it as a visitor.
- **Focus/Surface through a real publish.** M24E proves the whole interaction loop in a
  browser against real components and real art (`/dev/nest-runtime`), but no Focus region
  has yet gone through save → publish → *another account*, because that needs both §0
  blockers cleared.
- **Notifications end-to-end** — wired, never driven by a second account.
- **Views** — `nest_views` exists, but nothing has been counted by a second account.

## 6. Known limitations

- **Legacy Nests** (`nest_objects.w`/`h` NULL, pre-M24) keep derived geometry. They render
  as they always have but are not pixel-identical to the editor until the creator saves
  once; the owner's Profile badges them "Re-save to update layout". **We never backfill** —
  inferring the original boxes would be guessing at creator intent (D-18).
- **`nest_assets` holds one row.** The library merges Supabase over the bundled fixture
  (D-19). If Asset-Factory output is landing elsewhere, fix the publishing seam — do not
  duplicate rows.
- **Notifications use focus-refetch**, not Realtime, which is not configured here (D-23).
- **The 9:16 immersive background** is a documented typed seam only (`ImmersiveBackground`
  in `lib/nest-scene.ts`). Nothing generates it.

## 7. Architecture (detail in `docs/ARCHITECTURE.md`)

### The scene contract — the most important thing in the codebase

```
Editor ──editableObjectsToPlacements + editableSceneExtras──► NestDocument
                                                                   │
                                  ┌────────────────────────────────┤
                                  ▼                                ▼
                            nest_objects                    nests.scene_extras
                          (main placements)            (focus regions + child scenes)
                                  │                                │
                                  └──────────► NestPreview ◄───────┘
                                    (Preview · visitor · feed · cards)
```

- `lib/nest-geometry.ts` — `placementBox()` **replays** the stored box; it only derives
  geometry for pre-M24 rows with NULL `w`/`h`.
- `lib/nest-scene.ts` — pure scene resolution (focus regions, camera transform, surfaces,
  hotspots). React-free and Supabase-free **on purpose**: that is what lets Preview and the
  visitor share one implementation.
- `lib/nest-interaction.ts` — the typed interaction contract (D-34).
- `components/nest/app-shell/nest-runtime.tsx` — **the one runtime**. `mode` decides input
  and nothing else. `nest-preview.tsx` is a passthrough adapter for older call sites.
- `/dev/nest-runtime` — Preview and visitor side by side on one document, with the
  resolver output printed. The fastest way to tell "not interactive" from "data never
  arrived".
- The stage is always `SCENE_ASPECT` (3:4), letterboxed via container-query units.

### Other spines
- **Auth** — `lib/auth/*`, `components/nest/app-shell/use-nest-identity.ts`,
  diagnostic at `/api/auth/whoami`.
- **Persistence** — `lib/nest-repo.ts` (facade) over `lib/nest/supabase-*-repo.ts`.
- **Social state** — `lib/nest-social-store.ts`, one optimistic cache for every surface.
- **Layering** — `lib/nest-layers.ts`. Everything that stacks names a layer (D-16).

## 8. Stop rules

- **Never apply SQL.** Migrations are written, shown, and founder-provisioned.
- Never merge to `main` or promote to Production.
- **Never let a missing column break the product** (D-30) — degrade the feature, say so.
  But **never silently discard creator work** (D-37): if the document actually uses the
  missing column, refuse the write and name the migration.
- **Never infer an interaction from an asset id or name** (D-34).
- No silent fallbacks that mask backend failure (D-10).
- Never reconstruct or approximate a creator's layout.
- Do not fake account deletion; disable the action until the cascade genuinely works.
- No new AI / asset / avatar / marketplace systems during beta stabilisation.
- Do not sweep the pre-existing dirty files into commits (§9).

## 9. Working-tree note

These tracked files are **pre-existing work that predates this programme**. They are not
ours and must never be staged:

```
app/creator-studio/review/review-client.tsx      docs/BETA_INTERACTION_AUDIT.md
apps/asset-factory/lib/golden-room.ts            docs/BETA_NAVIGATION_AUDIT.md
components/room/room-object.tsx                  docs/nestudio-cto-handoff.md
                                                 docs/room-engine-spec.md
```

The same applies to the many untracked `app/design/*`, `apps/asset-factory/*`,
`lib/wall-*`, `public/benchmark/*` and `docs/*` files. Always `git add` explicit paths.
**Never `git add -A`.**

## 10. Environment

- Node 20 required: `export PATH=/Users/hannan/.nvm/versions/node/v20.20.2/bin:$PATH`
  (the shell defaults to Node 16).
- Gates: `npx tsc --noEmit` · `npx next lint` · `npx vitest run` · `npx next build`.
- `.env.local` points at the live Supabase project — local dev writes production data.
- Preview env must include `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `FOUNDER_EMAILS`/`FOUNDER_USER_IDS`,
  `NEXT_PUBLIC_NEST_BACKEND=supabase`. `NEXT_PUBLIC_*` is **inlined at build time** —
  missing values silently drop the app into demo mode. This has bitten us twice.

## 11. Document map

| Document | Purpose |
|---|---|
| **`CTO_HANDOFF.md`** | this file — orientation + the blockers |
| **`NEXT_SPRINT.md`** | what to do next, in order |
| **`SESSION_PROMPT.md`** | paste this into a new Claude session |
| **`M24E_SPRINT_REPORT.md`** | CURRENT: the interactive runtime + the full data trace |
| `M24CD_SPRINT_REPORT.md` | the scene runtime, focus/surface replay, the matte |
| `M24B_SPRINT_REPORT.md` | parity, drafts, delete, views |
| `M24_SPRINT_REPORT.md` · `M23B_SPRINT_REPORT.md` | earlier records |
| `ROADMAP.md` | done / unverified / blocked / deferred |
| `DECISIONS.md` | D-01…D-33 — decisions and *why* |
| `DEBUG_GUIDE.md` | practical diagnostics (start with §1) |
| `docs/ARCHITECTURE.md` | the architecture in detail |
| `docs/CANONICAL_NEST_DATA_AUDIT.md` | the data/rendering forensic audit |
| `docs/handoff/01–10` | **historical**; superseded by this file where they disagree |

> ⚠️ `docs/ARCHITECTURE.md` (not root) — a pre-pivot `architecture.md` exists at the root
> and this filesystem is case-insensitive, so a root `ARCHITECTURE.md` would overwrite it.
