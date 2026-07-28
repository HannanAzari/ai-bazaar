# M23 — Canonical Nest Data Audit

> Step 1 of the required implementation order: *"Audit current data flow and document where
> Nest data diverges."* Everything else in M23 depends on the conclusion below.
> **No application code was changed in this pass.** One migration is proposed, not applied.

---

## Correction to an earlier draft of this document

An earlier pass of this audit claimed the `nests` / `nest_objects` tables "were never
provisioned". **That was wrong** — it was based only on `supabase/provision/`. Both tables are
created by `supabase/migrations/20260702_01_nest_platform.sql` (:78, :93) and appear in
`supabase/schema.sql` (:760, :775). **Whether that migration has been APPLIED to the live project
cannot be determined from the repo** — that must be checked with
`select to_regclass('public.nests');` before anything else. The corrective migration now ALTERs
these tables rather than creating them.

---

## The finding, in two parts

### Part 1 — nothing user-made reaches the server

**The canonical data layer exists in code but no listing surface ever queries it.**
`lib/nest/supabase-nest-repo.ts` fully implements `createNest`, `saveNest`, `publishNest`,
`resolveNestBySlug` and `listMyNests` against two tables — `nests` and `nest_objects` — storing
the complete composition (`asset_id, x, y, scale, rotation, z_index`) and returning **payload-free
`/nest/<slug>` URLs whose visibility is enforced by RLS**. That is exactly the architecture this
sprint asks for. But `lib/nest-repo.ts` wraps every Supabase call in `catch { /* fall back */ }`
(lines 46, 57, 70, 81, 96), so any failure — including a table that isn't there — is swallowed and
the doc is written to **localStorage** instead, with no signal to the caller or the user. A given
doc id may therefore exist in Postgres, in localStorage, or in **both with divergent contents**.

`NEXT_PUBLIC_NEST_BACKEND=supabase` is set, so writes are *attempted* against Postgres — but
`listMyNests()` in `supabase-nest-repo.ts:134` is **called from nowhere**, and
`use-discovery.ts` imports only `listPublished` (localStorage) plus curated fixtures. Worse,
`listPublished()` is called with **no ownerId**, so the "feed" is literally whatever the current
browser has published.

That gap causes every symptom observed in founder testing.

| Observed in testing | Actual cause |
|---|---|
| Account B can't see Account A's Nest | Different browsers = different localStorage. There is no shared store. |
| Public links need the long `?c=` payload | Local publishing embeds the whole doc in the URL because there's no server row to resolve. |
| Home/Search show only curated + own content | Discovery has no shared table to query. |
| Founder content behaves differently from normal accounts | It doesn't — *nobody's* content is shared. It only looks founder-specific because that's the account being tested. |

### Part 2 — the renderer re-derives the room (this is the "preview doesn't match" bug)

**`NestPreview` does not render what the editor rendered.** The editor canvas
(`editor-canvas.tsx:380`) positions objects from an explicit box (`x, y, width, height, rotate,
scaleX(-1)`). `NestPreview` (`nest-preview.tsx:53–66`) reconstructs geometry from a magic number:

```js
const widthPct = Math.max(8, Math.min(60, (p.scale ?? 0.4) * 55));
transform: `translate(-50%, -100%) rotate(${p.rotation ?? 0}deg)`
```

Four concrete divergences, all visible to a creator:

| Divergence | Effect |
|---|---|
| width `scale * 55` clamped [8,60] vs the editor's `scale * 0.5` clamped [0.06,0.7] | **~10 % systematic size error on every object, on every surface** |
| height never applied (falls back to the image's intrinsic ratio) | objects are the wrong height vs the editor's `visualBounds.aspect` |
| **overlays dropped entirely** — `resolveAsset("overlay:text")` returns undefined → `return null` | **every text and image sticker the creator placed is invisible** in Profile cards, Home, Explore and the full Nest view |
| `flipX` never survives `editableObjectsToPlacements` | mirrored objects un-mirror |

Because the full Nest view uses the same `NestPreview` as an 80 px thumbnail, **the "real" Nest a
visitor enters is itself an approximation.** Fixing storage alone will not fix this — the renderer
must be unified too.

**Nothing needs to be invented; three things need to be repaired:** apply/verify the schema, stop
the silent fallbacks, and make one renderer serve every surface.

---

## 1. Current sources of truth

| Data | Where it actually lives today | Shared across accounts? |
|---|---|---|
| Nest document (title, background, visibility) | `localStorage["nestudio-nest-documents"]` | ❌ |
| Nest composition (placements) | inside the same localStorage doc | ❌ |
| Published pointer (slug → doc) | `localStorage["nestudio-published"]` | ❌ |
| Public link contents | **the URL itself** (`?c=` base64 of a compact doc) | ⚠️ only if the payload rides along |
| Profile (name, username, bio, links) | `localStorage["nestudio-profiles"]` | ❌ |
| Likes / comments / follows / views | `localStorage` (`lib/nest-social`) | ❌ |
| Official asset library | Supabase `nest_assets` ✅ | ✅ |
| Empty-room library | Supabase `nest_backgrounds` ✅ | ✅ |
| Avatars | Supabase `user_avatars` + private bucket ✅ | ✅ (owner-only by design) |
| **User Nests** | **nowhere on the server** | ❌ |

So: the *libraries* the founder generates are properly server-backed; the *product* — everything a
normal user makes — is not.

## 2. Duplicated / reconstructed representations

- **`?c=` payload** (`encodeDoc`) is a **lossy second representation** of a Nest: it carries
  background, title, visibility and a compact placement tuple only. Anything added to
  `NestDocument` later (rotation, wall/floor placement, interactions, linked content, labels,
  tags) is **silently dropped** from any link-shared Nest. This is a live divergence risk even
  before the migration.
- **THREE stores, not two.** (1) `localStorage["nestudio-nest-documents"]` — read by every
  listing surface; (2) `localStorage["nestudio:nest-editor:v1:<docId>"]` — the editor's own
  autosave, read **only** by the editor mount, which prefers it over the persisted document;
  (3) Supabase `nests` + `nest_objects`. Nothing reconciles (1) and (2) outside publish, so a
  creator can edit for an hour and still see a stale card on their Profile.
- **Social tables exist and are unused.** `nest_likes`, `creator_follows`, `nest_comments`,
  `notifications` are defined in `supabase/migrations/20260703_01_nest_social.sql` but no code
  reads or writes them — all social state is localStorage (`lib/nest-social.ts`). §6 is therefore
  a wiring job, not a new system.
- `listMyNests()` and `migrateLocalNestsToSupabase()` both exist in `supabase-nest-repo.ts` and are
  **called from nowhere**.
- **Village houses** are *already* correctly derived one-per-creator
  (`use-village.ts housesFromDiscovery` groups by `creator.id`), so §9's model is structurally
  right — it is only fed from local/curated discovery data.

## 3. Final canonical schema (proposed)

```
auth.users
  └── profiles            (+ display_name, username unique, house_style)   ← §1 onboarding, §9 house
        └── nests         (id, owner_id, slug unique, title, background_id,
        │                  visibility, source_template_id, timestamps)
        └── nest_objects  (nest_id, asset_id, x, y, scale, rotation, z_index)   ← the composition
```

Column names deliberately match `NestRow` / `ObjectRow` in `supabase-nest-repo.ts` **exactly**, so
no application rewrite is needed to start using them.

SQL: **`supabase/provision/nests_canonical_provision.sql`** — ALTERs the existing tables (adds
`overlay jsonb`, `w`, `h`, `flip_x`; drops the `asset_id → nest_assets` FK that makes
`"overlay:text"` a constraint violation; adds RLS + discovery index; adds
`profiles.display_name / username / house_style`). Additive, idempotent, no DROP TABLE.
**Awaiting founder provisioning.**

### Storage gaps the current table cannot express
| Missing | Consequence today |
|---|---|
| no `overlay` / `w` / `h` columns | stickers and explicit boxes cannot be stored at all |
| `asset_id` FK → `nest_assets` | an `"overlay:text"` placement is a **foreign-key violation** |
| `rotation` written as hard-coded `0` (`supabase-nest-repo.ts:78`) and never read back in `toDoc` (:50) | **rotation is destroyed on save** via the Supabase path |

So today the Supabase path is *lossier than localStorage*. That must be fixed before any backfill.

## 4. Rendering contract (target)

One saved composition → many viewports:

```
nests + nest_objects  →  NestDocument  →  <NestPreview doc … />
                                            ├── editor canvas      (interactive, full)
                                            ├── Profile card       (cropped, static)
                                            ├── Home feed          (full-bleed, interactive)
                                            ├── Search thumbnail   (small, static)
                                            └── full Nest view     (full-bleed, interactive)
```

`NestPreview` is already the shared renderer used by the Profile card, Home feed and full view —
the contract is largely in place. **Confirming that the editor canvas and `NestPreview` derive
placements identically (rather than approximating) is the one open verification** before declaring
§4 done, and it must be done with the database live, not against localStorage.

## 5. Access rules (in the migration)

- anyone, logged out included, may read `visibility ∈ (public, unlisted)`
- owners additionally read their own drafts
- only owners insert/update/delete their own Nests
- `nest_objects` inherit their parent Nest's readability, so a public Nest renders **completely**
  for a stranger
- no service-role key is used anywhere on the client

## 6. Migrations

| File | Status |
|---|---|
| `supabase/provision/nests_canonical_provision.sql` | **written, NOT applied** — needs founder provisioning |

## 7. Migration / backfill plan (§10)

Existing test content lives in browser localStorage and **cannot be reached by a server migration**.
Options, in order of honesty:

1. **Accept the reset.** Existing local Nests were made against a store that was never shared.
   Simplest, loses test content.
2. **One-time client backfill.** After the schema is corrected, push a signed-in user's local
   docs into Supabase on first load, then mark them migrated. `migrateLocalNestsToSupabase()`
   already exists but is unused **and currently drops `ownerId`, `createdAt`, `overlay`, `w`, `h`
   and `rotation`** — it must be fixed before it is called, or it will bake the loss in.
   ⚠️ It also re-runs `createNest → publishNest`, which **regenerates slugs — every existing
   published URL would break.** Slug preservation has to be part of the backfill.

Users without `display_name` / `username` / `house_style` are exactly the users §1's onboarding is
meant to catch; the migration adds those columns so that flow has somewhere to write.

**I will not fabricate missing creator layouts.** Anything that cannot be recovered should be
surfaced to the user as "made before Nestudio saved to the cloud", not silently regenerated.

## 8. Known limitations / what is NOT done

This document is step 1 of 12. **Steps 2–12 are blocked on the migration being applied** — writing
onboarding, discovery queries, social persistence or the settings screen against tables that do not
exist would produce code that silently falls back to localStorage again, which is precisely the bug.

Specifically not done: onboarding flow (§1), Settings + sign-out/delete (§2), cross-account
discovery queries (§3), renderer consolidation verification (§4), full-Nest UI simplification (§5),
Like/Comment/Share persistence (§6), z-index tokens (§7), swipe removal (§8), house↔Nest wiring
(§9), backfill (§10), two-account testing (§12).

**Account deletion (§2) specifically:** per the sprint's own instruction — *"If full cascading
deletion cannot safely be completed, do not fake it"* — deleting an `auth.users` row requires a
service-role call from a server route, and the cascade must cover profiles, nests, nest_objects,
avatars and private storage objects. That must be designed against the real schema, and the button
must stay disabled until it genuinely works.

---

# M23A — Canonical rendering: IMPLEMENTED

The renderer half of this audit is now fixed. Storage is untouched (no migration applied).

## Architecture

**One function owns geometry: `lib/nest-geometry.ts`.**

```
NestPlacement ──► placementBox(p, i) ──► { x, y, w, h, rotation, zIndex, flipX }
                        │
                        ├─► placementStyle() ──► editor canvas   (via nest-editor-bridge)
                        └─► placementStyle() ──► NestPreview      (Profile · Home · Search · full)
```

- `widthFromScale(scale) = clamp(scale * 0.5, 0.06, 0.7)` — the editor's rule is now everyone's.
  `scaleFromWidth()` is its exact inverse, used when saving editor boxes back.
- **Anchoring is explicit and differs by kind** — assets anchor by base centre (feet on the
  floor); overlays anchor by box top-left with their own `w`/`h`. That knowledge now lives in
  one place instead of being re-guessed per surface.
- `boxTransform()` emits one transform string (`rotate(...) scaleX(-1)`), so rotation and
  mirroring are identical everywhere.
- `inPaintOrder()` sorts by z-index with a stable tiebreak.

`nest-editor-bridge.ts` now calls `placementBox()` instead of carrying its own copy of the
formula, so the editor and every preview are mathematically the same by construction.

## What was wrong, and what changed

| Property | Before | After |
|---|---|---|
| width | preview `scale * 55 %` vs editor `scale * 0.5` → **~10 % size error everywhere** | one formula |
| height | preview omitted it (intrinsic image ratio) | explicit, from `visualBounds.aspect` |
| overlays | `resolveAsset("overlay:text")` → undefined → `return null` → **invisible outside the editor** | rendered via the shared `OverlayContent` |
| flipX | not on `NestPlacement`; dropped at the bridge | added to the type, carried both directions |
| rotation | preview applied it, bridge dropped it on some paths | carried consistently |
| paint order | ad-hoc sort | `inPaintOrder()` with stable tiebreak |

## Evidence

- **`/dev/nest-parity`** renders `CANONICAL_TEST_NEST` at Profile-card (160px), Search-thumb
  (110px), Home-feed (300px) and Full (360px) sizes side by side. The composition is identical;
  only the viewport differs. The text and image overlays are visible in **all** panels — the
  clearest before/after signal, since they previously rendered nowhere but the editor.
- **`test/nest-geometry.test.ts`** — 13 tests: width formula (incl. explicitly asserting it is
  *not* the old `scale*55`), clamps, `scale↔width` round-trip, asset base-centre anchoring,
  overlay top-left anchoring, rotation, mirroring, explicit height, overlays not dropped,
  z-order, stable tiebreak, and a full placement → editor → placement round-trip.

## Known remaining mismatch

- **The editor's own canvas still owns extra state the document does not carry** —
  `contactShadow`, `locked`, `hidden`, hotspots and surface bindings live on
  `EditableNestObject`. They do not affect geometry, but they are editor-only today.
- **Draft vs saved is still two stores.** `nestudio:nest-editor:v1:<docId>` (editor autosave) is
  preferred by the editor mount, while Profile cards read the persisted `NestDocument`. Geometry
  is now identical, but a creator with unsaved edits can still see an older composition on their
  Profile. Fixing that is a persistence change, deliberately out of scope for M23A.
- Storage remains localStorage-backed; cross-account visibility is unchanged until the migration
  is provisioned.

---

# M23B — LIVE SCHEMA VERIFIED, and the storage half implemented

## The live check this document has been asking for, finally run

Against project `srrmkdsvldlyllsxyhtq` on 2026-07-28, via PostgREST with the service-role key
(no DB password or Supabase CLI is available on this machine, so `pg_policies` / `pg_indexes` /
`pg_constraint` could not be read directly — those inspections are moot for tables that do not
exist, and the SQL file ends with a verification block for the founder to run):

```
select to_regclass('public.nests');         →  NULL
select to_regclass('public.nest_objects');  →  NULL
```

| Table | Live | Rows |
|---|---|---|
| `nests`, `nest_objects` | ❌ absent | — |
| `nest_backgrounds`, `nest_templates` | ❌ absent | — |
| `nest_likes`, `nest_comments`, `creator_follows` | ❌ absent | — |
| `nest_assets` | ✅ present, shape matches the migration exactly | 1 |
| `profiles` | ✅ present, legacy shape, **no `house_style`** | 5 |
| `notifications` | ✅ present — the **legacy** pre-pivot table (`user_id`, `shop_id`→`shops`) | 0 |

**Conclusion: `supabase/migrations/20260702_01_nest_platform.sql` was never applied.** Only the
standalone `provision/` scripts were — which is why `nest_assets` exists alone while the other
four tables from the same file do not.

This also **corrects §3 and §6 of the audit above**: `supabase/provision/nests_canonical_provision.sql`
is not merely "awaiting provisioning", it **cannot run** — its first statement ALTERs
`public.nest_objects`. It is superseded by `supabase/provision/m23b_nest_platform_provision.sql`.

Two further findings the earlier audit could not have known:

- **The base migration alone would break every insert.** `nests.background_id` is `not null
  references nest_backgrounds(id)` and that table would be created empty, while the curated
  library actually ships as an in-repo fixture. The new file drops both FKs.
- **`20260703_01_nest_social.sql` would abort.** `create table if not exists public.notifications`
  skips the legacy table, then its policies reference `recipient_id`; the live column is `user_id`.

## §1 of this audit is now false, deliberately

> "nothing user-made reaches the server"

That was true when written. As of M23B the write and read paths both go to Supabase, the
silent `catch { /* fall back */ }` blocks are gone, `listMyNests` is called (alongside new
`listPublicNests` / `listPublishedNestsByOwner`), and `use-discovery.ts` queries the shared
tables instead of `listPublished()` on localStorage.

## §3's "storage gaps" are closed

| Was missing | Now |
|---|---|
| no `overlay` / `w` / `h` columns | present, plus `flip_x`, `interaction`, `label`, `link_url` |
| `asset_id` FK → `nest_assets` rejected `"overlay:text"` | no FK; integrity enforced in `resolveAsset` |
| `rotation` written as hard-coded `0`, never read back | carried both directions, asserted by `test/nest-placement-fidelity.test.ts` |

`migrateLocalNestsToSupabase()` was **deleted** rather than left unused: it dropped `ownerId`,
`createdAt`, `overlay`, `w`, `h` and `rotation`, and regenerated slugs — a loaded gun in the
codebase. The backfill decision is therefore explicit: **accept the reset.** Existing local
content was made against a store that was never shared.

## The M23A "known remaining mismatch" is resolved

- Editor-only state (`hotspots`, `surfaces`, `interactionId`, `contentBinding`, `locked`,
  `hidden`, `contactShadow`, `variantId`, `plane`) now round-trips through
  `NestPlacement.interaction`.
- Draft vs saved is one rule, not two stores — see `lib/nest-draft-reconcile.ts` and D-17.

## One more rendering bug, found in the browser during M23B

`NestPreview`'s root was `relative` with `z-index: auto`, so it never formed a stacking context
and each placement's inline `zIndex` escaped into the **feed card's** stacking context. A sofa
with `zIndex: 3` genuinely painted over the creator row and Nest title. This is the
"furniture covering metadata" item in the founder screenshots, and it was a stacking-context
bug, not a layout one. Fixed with `isolate` on that single root — which fixes the Profile card,
search thumbnail and full Nest view at the same time.
