# ROADMAP

Status honestly separates *code exists* from *verified working in a deployment*.
Nothing is marked complete merely because the code is written.

Legend — ✅ complete & verified · 🟨 implemented, **unverified in deployment** · ⛔ blocked ·
⏸ deferred by decision · 🔭 future

---

## ✅ Complete & verified (locally: typecheck · lint · 688 tests · build)

- **Canonical geometry (M23A)** — one `placementBox` shared by editor and every preview; overlays
  render outside the editor; `flipX` preserved; stable z-order. Parity bench `/dev/nest-parity`,
  13 focused tests. *(commit `e1fd940`)*
- **Auth spine** — single server session + client hook; role-gated founder access; Preview-safe
  PKCE callback; `private, no-store` on authenticated routes; 18 tests.
- **`/moderation` founder-gated** — was fully open to any visitor; 6 tests.
- **Profile (creator + visitor)** — one shared structure, compact identity box, grounded House,
  expandable bio, links overlay, unlimited links, avatar modals, centred auth modal.
- **Journey fixes** — sign-up no longer dead-ends in the pre-pivot shop funnel; founder-only AI
  path hidden from users it would 403; password rule aligned; duplicated page titles removed.
- **Audits** — product, UX, navigation, interaction, canonical-data.

## 🟨 Implemented but UNVERIFIED in deployment

- **Everything above, as deployed.** The push to `m12-nest-platform` triggered a Vercel Preview
  build, but **deployment success and the Preview URL were never verified** — they can't be read
  from the repo. Verify before trusting any of it in the browser.
- **Creator-side signed-in flows** — Profile edit sheet, avatar modal, Settings-adjacent paths were
  validated by types/tests/routes, **not** by a signed-in walkthrough.

## ⛔ Blocked — deployment

**The Vercel project is disabled** (`402 DEPLOYMENT_DISABLED`). No branch push can produce a
Preview until billing/usage is cleared in the Vercel dashboard. This is not a code or build
problem — `next build` passes (132 pages). Exact action in `M24_SPRINT_REPORT.md`.

**`supabase/provision/m24_views_provision.sql` is unapplied** — view counts read 0 until the
founder runs it. Nothing else depends on it.

## ✅ Unblocked since M23B — the SQL was applied

`m23b_nest_platform_provision.sql` is live: nests, nest_objects, likes, comments, follows and
the profile columns all exist and hold real rows.

## ⛔ Previously blocked — on ONE founder action

Everything below is **implemented in code** and gated only on the founder applying
`supabase/provision/m23b_nest_platform_provision.sql`. Live inspection (2026-07-28) confirmed
`nests`, `nest_objects`, `nest_backgrounds`, `nest_templates` and every social table are absent
from project `srrmkdsvldlyllsxyhtq`: the base migration was never applied.

- **Shared persistence / cross-account discovery** — code done (M23B), unverified live.
- **Social persistence** — `nest_likes` / `nest_comments` / `creator_follows` are now read and
  written by real code; notifications reuse the existing table.
- **Account deletion** — a real server-side cascade exists at `POST /api/account/delete`. It
  refuses honestly rather than faking success, so it is safe to ship before verification.
- **The two-account test scenario** — cannot run until the tables exist.

## ⏸ Deferred by decision

- Deleting the legacy pre-pivot island (~40% of routes, unreachable but compiling).
- Avatar public release (`AVATAR_PUBLIC_ENABLED=1`) pending founder style approval.
- Empty-state copy for: no links, no avatar, no comments, no likes.
- Merging Home and Explore (information-architecture decision, founder's call).

## 🔭 Future

- Creator Generator (compose a starter Nest) → Interaction Engine → Memory Engine.
- Thumbnail/screenshot strategy generated from canonical composition, with versioning.
- Village as a real spatial layer.

## Risks: resolved in M23B

3. ~~Silent localStorage fallback~~ — removed; failures are visible (D-10).
4. ~~Autosave vs document divergence~~ — one stated rule, announced when it happens (D-17).
5. ~~`?c=` as the canonical share method~~ — publishing returns `/nest/<slug>` with no payload;
   `?c=` decodes for old links only and never outranks the server.
6. ~~Supabase write path lossier than localStorage~~ — every field has a column and a
   round-trip test (`test/nest-placement-fidelity.test.ts`).
7. ~~Backfill would regenerate slugs~~ — the unfixed helper was deleted rather than left as a
   trap; slugs are generated once and reused forever.

## Risks still open

1. Published Nests still not *confirmed* stored/resolved live — pending the SQL.
2. Account B seeing Account A's Nest is implemented but untested end-to-end — pending the SQL.
8. **Creator links** now persist to `profiles.links`; existing localStorage-only links are not
   migrated and will need re-entering once.
