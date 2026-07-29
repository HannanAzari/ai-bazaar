# ROADMAP

Status honestly separates *code exists* from *verified working in a deployment*.
Nothing is marked complete merely because the code is written.

State as of `c9bb259` (M24D). Gates: typecheck · lint 0 errors · **900 tests / 96 files** ·
build 132 pages.

Legend — ✅ complete & verified locally · 🟨 implemented, **unverified in deployment** ·
⛔ blocked · ⏸ deferred by decision · 🔭 future

> The honest summary: **the code is ahead of what anyone has been able to run.** Two founder
> actions (Vercel billing, one SQL file) gate almost everything in the 🟨 section.

---

## ✅ Complete & verified locally

- **Canonical rendering** — one geometry function; the creator's box is replayed verbatim
  (D-18). Measured Editor↔Preview delta **0.0027** (~1px). Parity bench `/dev/nest-parity`.
- **One SceneRenderer** — Preview, feed, Profile cards and visitors all instantiate
  `NestPreview` from the same document (D-24).
- **One coordinate space** — fixed-aspect stage, letterboxed by container-query units (D-25).
- **Scene resolution extracted** to pure `lib/nest-scene.ts` (D-29); a focused view is the
  main scene under one camera transform (D-31).
- **Focus + Surface replay** — regions, child objects, and image/text/sticker surface
  content all render for a visitor.
- **Focus/background data loss fixed** — `backgroundId` and `NestSceneExtras` survive
  save → draft → publish → reopen (D-32).
- **Adaptive matte** replaces the blurred surround (D-33).
- **Auth spine** — one server session + one client hook; role-gated founder access;
  Preview-safe PKCE callback. No sign-in freeze (D-11…D-13), no false signup success (D-14).
- **Shared persistence** — Nests, profiles, houses, likes, comments, follows and
  notifications all in Supabase. No silent localStorage fallback (D-10).
- **Onboarding**, **Settings** (real sign-out, real delete cascade), **draft workflow**
  (D-26), **delete Nest**, **per-Nest views** (D-22/D-27), **notifications** (D-23).
- **Schema tolerance** — a missing column degrades one feature, never the product (D-30).
- **Overlays in the root stacking context** (D-21), **no animation fill-mode** (D-28),
  **named layers** (D-16), **house parity** (D-20), **library merge** (D-19).
- **Profile (creator + visitor)** — one shared structure, compact identity box, grounded
  House, expandable bio, links overlay. **`/moderation` founder-gated.**
- **Audits** — product, UX, navigation, interaction, canonical-data.

## 🟨 Implemented but UNVERIFIED — blocked on the founder actions below

- **Everything above, as deployed.** Nothing has shipped since `235d2ab`.
- Publish → visitor round-trip compared side by side.
- Focus/Surface driven end-to-end (save → publish → visitor tap).
- Two-account social: like, comment, follow, notification.
- View counting (needs `nest_views`).
- Draft save/publish against the live DB (needs `nests.draft_doc`).
- Preview/Visitor screenshots at matching viewports.

## ⛔ Blocked — founder actions, in priority order

1. **Vercel `402 DEPLOYMENT_DISABLED`.** Account/billing state, not a build failure —
   `next build` passes at 132 pages. Nothing has deployed since `235d2ab`, so the founder
   has been testing code five commits stale, which is why several already-fixed issues kept
   being re-reported. **This is the single highest-value unblock in the project.**
2. **Apply `supabase/provision/m24b_provision.sql`** — `nest_views`, `nests.draft_doc`,
   `nests.draft_updated_at`, `nests.scene_extras`. Additive and idempotent.

`m23b_nest_platform_provision.sql` **is applied** — nests, nest_objects, likes, comments,
follows and the profile columns exist and hold real rows.

Do **not** apply `nests_canonical_provision.sql` (ALTERs a non-existent table) or
`supabase/migrations/20260703_01_nest_social.sql` (aborts on the legacy `notifications`).

## ⚠️ Known limitations (accepted and recorded, not bugs)

- Legacy pre-M24 Nests keep derived geometry until re-saved; badged in the owner's Profile,
  never backfilled (D-18).
- `nest_assets` holds one row; the library merges Supabase over the bundled fixture (D-19).
- Notifications refetch on focus rather than via Realtime, which is not configured (D-23).
- Views bucket by UTC day and trust an anonymous browser key — a vanity metric, not billing
  (D-22).
- Creator links now persist to `profiles.links`; existing localStorage-only links are not
  migrated and need re-entering once.

## ⏸ Deferred by decision

- No new AI, asset, avatar, marketplace or discovery-algorithm systems during beta
  stabilisation.
- Deleting the legacy pre-pivot island (`/bazaar`, `/discover`, `/tags`, `/collections`,
  `/activity`, `/u/[handle]`, `/assets`, `/village-lab`) — unreachable from primary nav,
  still compiles. Its own sprint.
- Avatar public release (`AVATAR_PUBLIC_ENABLED=1`) pending founder style approval.
- Empty-state copy for: no links, no avatar, no comments, no likes.
- Merging Home and Explore — information architecture, the founder's call.

## 🔭 Future

- **9:16 immersive background.** Typed seam exists (`ImmersiveBackground` in
  `lib/nest-scene.ts`); needs an Asset-Factory path that generates art coordinated with the
  3:4 room. No geometry change required (D-33).
- Realtime notifications, once Realtime is configured.
- Asset-library growth — fix the Asset-Factory → `nest_assets` publishing seam.
- Creator Generator (compose a starter Nest) → Interaction Engine → Memory Engine.
- Thumbnail/screenshot strategy generated from canonical composition, with versioning.
- Village as a real spatial layer.

## Risks resolved

- ~~Silent localStorage fallback~~ — removed; failures are visible (D-10).
- ~~Autosave vs document divergence~~ — one stated rule, announced when it happens (D-17).
- ~~`?c=` as the canonical share method~~ — publishing returns `/nest/<slug>`, payload-free.
- ~~Supabase write path lossier than localStorage~~ — every field has a column and a
  round-trip test (`test/nest-placement-fidelity.test.ts`).
- ~~Backfill would regenerate slugs~~ — the unfixed helper was deleted rather than left as a
  trap.
- ~~Editor/publish displacement~~ — two distinct causes, both fixed (D-18, D-25).
- ~~Focus objects lost on save~~ — serialised into the versioned scene (D-32).

## Risks still open

1. **Deployment.** Until the Vercel block clears, every "verified" claim in this repo means
   "verified locally". That gap has already caused repeated re-reporting of fixed bugs.
2. **Migration lag.** Code ships before SQL is applied, every time. D-30 makes that safe,
   but it must be applied to every new repository read that touches a new column.
3. **Nothing has been tested by two real accounts.** Social, notifications and visitor
   parity are the least-proven areas of the product.
