# Nestudio — CTO Handoff

> **START HERE.** This is the entry point for a new session. It is grounded in the repository
> as of the commit below, not in prior chat context.
> Read this, then **`M23B_SPRINT_REPORT.md`** (the current state and the one manual SQL action).
> Everything else is reference.

| | |
|---|---|
| **Branch** | `m12-nest-platform` (auto-deploys to a Vercel **Preview**; never merge to `main`) |
| **Latest verified commit** | `e1fd940` — *fix(nest): one canonical geometry so a Nest renders identically everywhere* (2026-07-28). Verified via `git log`; local `HEAD` == `origin/m12-nest-platform`. |
| **Gates at that commit** | typecheck ✅ · eslint 0 errors ✅ · **688 tests / 77 files** ✅ · `next build` ✅ (133 pages) |
| **Deployment** | The push **triggered** a Vercel Preview build. **Deployment success and the Preview URL were NOT verified** — they cannot be read from the repository. Treat as unconfirmed. |

---

## 1. Product vision

Nestudio is a **digital home**, not a social network. People don't visit profiles — they arrive
outside someone's **House** (the exterior/arrival) and step inside a **Nest** (the interior
experience they composed). Every transition should feel like moving through a place.

Vocabulary is fixed: **House = exterior/arrival**, **Nest = interior**. "Room" is not used on
profile/arrival surfaces.

## 2. Current product stage

**Beta stabilisation.** The product is not feature-poor — it is *untruthful*: what a creator makes
is not reliably what other people see. The current programme is to make it truthful, in this order:
canonical rendering (done) → shared persistence (next) → onboarding/settings/social → polish.

## 3. What is working

- **Canonical Nest rendering (M23A).** One geometry function drives the editor and every preview.
  See §7 and `docs/CANONICAL_NEST_DATA_AUDIT.md`.
- **Auth.** One server read (`getServerUser`) + one client hook (`useNestIdentity`); role-gated
  founder access via `FOUNDER_EMAILS`/`FOUNDER_USER_IDS`; Preview-safe PKCE callback at
  `/auth/callback` → neutral `/auth/complete`; `private, no-store` on authenticated routes.
- **Profile (creator + visitor)** share one structure: top controls → compact identity box →
  grounded House → one action. Expandable bio, quiet Nests/Views/Followers row, links as an
  anchored overlay, unlimited creator links.
- **Founder generation studios** — Asset Factory, Nest Factory, Avatar Studio on one shared
  `GenerationStudio`; libraries persist to Supabase (`nest_assets`, `nest_backgrounds`).
- **`/moderation` is founder-gated** (was wide open).

## 4. What is partially working

- **Nest viewer** — renders canonically, but still carries feed-style overlay clutter, has
  horizontal Nest swiping that product direction says to remove, and unaudited z-index layering.
- **Social (Like/Comment/Share)** — UI exists and persists to **localStorage**. Supabase tables
  `nest_likes`, `creator_follows`, `nest_comments`, `notifications` exist in migrations but **no
  code reads or writes them**.
- **Village** — already groups houses **one per creator** (correct model), but is fed from local
  + curated discovery data.

## 5. What is broken / unresolved (read before planning)

**M23B implemented items 3–9 below. The ONE thing standing between the product and a
truthful beta is a single SQL file the founder must apply:**
`supabase/provision/m23b_nest_platform_provision.sql`. See `M23B_SPRINT_REPORT.md`.

1. **Shared persistence unconfirmed *live*.** Live inspection on 2026-07-28 proved
   `nests`, `nest_objects`, `nest_backgrounds`, `nest_templates` and every social table are
   ABSENT from project `srrmkdsvldlyllsxyhtq` — `20260702_01_nest_platform.sql` was never
   applied. The application code is now written against them and fails loudly without them.
2. **Cross-account discovery** — implemented, untested end-to-end (needs the tables).
3. ~~Silent fallback~~ — **fixed (M23B).** The five `catch { /* fall back */ }` blocks are gone.
4. ~~Dual-state persistence~~ — **fixed (M23B).** One rule in `lib/nest-draft-reconcile.ts`.
5. ~~Lossy `?c=` links~~ — **fixed (M23B).** Publishing returns `/nest/<slug>`, payload-free.
6. ~~Onboarding~~ — **implemented (M23B).**
7. ~~Settings~~ — **implemented (M23B).** Sign out is real; deletion cascades or refuses honestly.
8. ~~Full-Nest UI + z-index~~ — **implemented (M23B).** `lib/nest-layers.ts` is the hierarchy.
9. ~~Horizontal swipe~~ — **removed (M23B).**

**Superseded:** `supabase/provision/nests_canonical_provision.sql` cannot run (it ALTERs a
table that does not exist), and `supabase/migrations/20260703_01_nest_social.sql` would abort
on the legacy `notifications` table. Do not apply either.

## 6. Intentionally deferred

- No new AI systems, asset systems, avatar work, marketplace or discovery algorithms during beta
  stabilisation.
- Legacy pre-pivot "AI Bazaar" island (`/bazaar`, `/discover`, `/tags`, `/collections`, `/activity`,
  `/u/[handle]`, `/assets`, `/village-lab`) — unreachable from primary nav, still compiles; deletion
  is its own sprint.
- Avatar public release — gated behind `AVATAR_PUBLIC_ENABLED=1` pending a founder-run style approval.

## 7. Architecture (summary — full detail in `docs/ARCHITECTURE.md`)

### Data model (as the code expects it)
```
auth.users
 └── profiles          (+ display_name, username, house_style ← migration adds these)
      └── nests        (id, owner_id, slug, title, background_id, visibility, source_template_id)
           └── nest_objects (nest_id, asset_id, x, y, scale, rotation, z_index)   ← composition
```
`nests` and `nest_objects` **do exist in repository migrations**
(`supabase/migrations/20260702_01_nest_platform.sql`), and social tables exist in
`20260703_01_nest_social.sql`. **Whether any of these are applied to the live Supabase project is
NOT confirmed** — verify first (`DEBUG_GUIDE.md` §1).

### Rendering model (M23A — the one thing recently fixed)
`lib/nest-geometry.ts` owns geometry. `placementBox()` → `{x, y, w, h, rotation, zIndex, flipX}`;
`placementStyle()` produces the inline style; `boxTransform()` the transform; `inPaintOrder()` the
z-sort. **Both** the editor (via `lib/nest-editor-bridge.ts`) and `NestPreview` (Profile, Home,
Search, full view) call it, so they agree by construction.

### Auth model
`getServerUser()` (server) · `useNestIdentity` (client) · `requireUser` / `requireFounder` /
`requireAvatarAccess`. Founder = signed-in Supabase user on the server-only allowlist.
`/api/auth/whoami` is the diagnostic.

### Storage reality today
User Nests, profiles, and all social state live in **localStorage**. Only the founder-generated
libraries and avatars are server-backed.

## 8. Deployment assumptions

- `m12-nest-platform` → Vercel **Preview**. `main` is Production; **do not merge or promote**.
- Required Preview env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `FOUNDER_EMAILS`/`FOUNDER_USER_IDS`,
  `NEXT_PUBLIC_NEST_BACKEND=supabase`. Missing `NEXT_PUBLIC_*` **at build time** silently drops the
  app into demo mode.
- Supabase Auth redirect URLs must include the preview domain (a wildcard covers per-commit URLs).

## 9. Exact recommended next task

**Verify the live Supabase schema, then make persistence real.** Do not write persistence code
before running the checks in `DEBUG_GUIDE.md` §1. Full plan: **`NEXT_SPRINT.md`**.

## 10. Stop rules

- **Never apply SQL yourself.** Migrations are shown and **founder-provisioned**.
- Do not merge to `main` or promote to Production.
- Do not add AI/asset/avatar/marketplace systems during beta stabilisation.
- Do not fake account deletion; disable the action until the cascade genuinely works.
- Do not add fallbacks that silently mask backend failures.
- Never reconstruct or approximate a creator's layout — preserve the real composition.
- Do not sweep unrelated pre-existing working-tree files into commits (see §11).

## 11. Working-tree note

The tree contains **pre-existing uncommitted work that predates this programme** (e.g.
`app/design/*` benches, `apps/asset-factory/*`, `components/room/*`, several docs). It is not mine
and must not be swept into commits. Always stage explicitly.

## 12. Document map

| Document | Purpose |
|---|---|
| **`CTO_HANDOFF.md`** | this file — orientation |
| **`M23B_SPRINT_REPORT.md`** | what M23B changed + the one manual SQL action |
| **`NEXT_SPRINT.md`** | the shared-persistence sprint (implemented by M23B; its test scenario is still the acceptance script) |
| **`ROADMAP.md`** | done / unverified / blocked / deferred / future |
| **`DECISIONS.md`** | product + engineering decisions and why |
| **`DEBUG_GUIDE.md`** | practical diagnostics (start with §1) |
| **`docs/ARCHITECTURE.md`** | the real architecture in detail |
| `docs/CANONICAL_NEST_DATA_AUDIT.md` | the data/rendering forensic audit + M23A record |
| `docs/BETA_NAVIGATION_AUDIT.md` | journey/navigation findings |
| `docs/BETA_INTERACTION_AUDIT.md` | lived interaction findings |
| `docs/handoff/01–10` | **historical** onboarding package — superseded by this file where they disagree |

> ⚠️ `docs/ARCHITECTURE.md` (not root) — the repo already has a pre-pivot `architecture.md`, and
> this filesystem is case-insensitive, so a root `ARCHITECTURE.md` would silently overwrite it.
