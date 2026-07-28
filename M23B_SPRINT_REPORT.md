# M23B — Founder-tested core product fixes

> Implementation report. Read `CTO_HANDOFF.md` for orientation and `DEBUG_GUIDE.md` §1 for
> the live checks that produced the schema decision below.

## The one manual action required

**Apply `supabase/provision/m23b_nest_platform_provision.sql` in the Supabase SQL editor.**
Nothing else is blocked on you. Claude did not and will not run it (D-13).

Live inspection of project `srrmkdsvldlyllsxyhtq` on 2026-07-28 found that
`supabase/migrations/20260702_01_nest_platform.sql` was **never applied** — only the
standalone `provision/` scripts were:

| Table | Live before the migration |
|---|---|
| `nests`, `nest_objects` | ❌ absent (`to_regclass` → NULL) |
| `nest_backgrounds`, `nest_templates` | ❌ absent |
| `nest_likes`, `nest_comments`, `creator_follows` | ❌ absent |
| `nest_assets` | ✅ present, 1 row |
| `profiles` | ✅ present, 5 rows, legacy shape, no `house_style` |
| `notifications` | ✅ present — the **legacy** pre-pivot table |

`supabase/provision/nests_canonical_provision.sql` is therefore **superseded**: it `ALTER`ed
`public.nest_objects`, a table that does not exist, so it aborts on its first statement.
Do not run it.

Two traps the new file exists to avoid:

1. **`20260702_01` alone would break every insert.** It gives `nests.background_id` a NOT NULL
   FK to `nest_backgrounds` (empty) and `nest_objects.asset_id` an FK to `nest_assets`
   (1 row) — and the latter makes an overlay placement (`assetId = "overlay:text"`) a
   constraint violation by construction. The catalogue actually ships as an in-repo fixture,
   so the new file creates those columns as plain text with no FK.
2. **`20260703_01_nest_social.sql` would abort.** Its `create table if not exists
   public.notifications` silently skips the existing legacy table, then its policies
   reference `recipient_id` — the live column is `user_id`. **Do not apply it.** M23B reuses
   the existing notifications table instead, adding one nullable `entity_id` column.

The file is additive and idempotent: no `DROP TABLE`, no `DELETE`, no rewrite of existing
rows. The only drops are of foreign keys that block legitimate content, and only if present.

After applying, verify with the block at the bottom of the SQL file.

---

## What changed, by sprint section

### §1 Onboarding — implemented
`/onboarding` used to `redirect("/create")`. It is now the real two-step flow:
**identity → house → own Profile**, and sign-up routes there instead of `/create`.

- Step 1 collects display name + username only. Availability is checked against the
  **server** (`profiles`), debounced, with the normalisation shown live (`Ada Lovelace` →
  `@ada_lovelace`). Continue stays disabled until valid. If the check itself fails we say so
  and let you continue — the DB's unique index gets the final say on submit (23505 → "that
  username was just taken").
- Step 2 is a horizontally-scrollable carousel of the existing CSS houses (no new assets),
  with a large preview, name, blurb, a visible selected state, tap **and** swipe, and
  position dots. Selection persists to `profiles.house_style`.
- Values entered in step 1 survive going Back from step 2.
- A fully configured creator is redirected out; a partially configured one resumes at the
  step they are missing (`nextOnboardingStep`).
- `/onboarding` was added to the header's full-screen route list — the marketing header was
  pushing Continue below the fold on a 375px screen.

### §2 Settings + sign out — implemented (deletion is real, and honest)
A gear appears in the creator's **own** Profile header. It is not CSS-hidden on a public
Profile; `TopControls` takes an `action` slot the public Profile simply does not pass.

- **Sign out works.** It ends the Supabase session, then clears cached per-user state via
  `lib/nest-session-reset.ts` (profiles, documents, publish registry, social, every editor
  autosave) and `router.replace`s to `/home` so Back cannot walk into a signed-in screen.
  Published content is untouched — it belongs to the account, not the device.
- **Delete account** has a real destructive confirmation (type DELETE) and calls
  `POST /api/account/delete`, which performs the real cascade server-side with the
  service-role key: private storage → the creator's social rows → notifications they caused
  → `auth.users` (Postgres cascades profiles → nests → nest_objects → avatars). Per D-09 it
  **never returns 200 for a partial deletion**: if the service-role key is absent or any step
  fails, it refuses with the reason and nothing is changed.

### §3 Cross-account visibility — implemented (blocked only on the SQL)
- `lib/nest/supabase-nest-repo.ts` rewritten: lossless and loud. Added `listPublicNests`,
  `listPublishedNestsByOwner`, `deleteNest`; compositions batch-load in one query (no N+1).
- **The silent fallback is gone.** `lib/nest-repo.ts` no longer wraps Supabase calls in
  `catch { /* fall back */ }`. Publish either returns a real payload-free `/nest/<slug>` or
  throws. `resolvePublished` returns a distinct `{ kind: "error" }` so a backend outage is
  never rendered as "this Nest doesn't exist".
- `use-discovery.ts` queries Supabase for every world-readable Nest and resolves creators
  from `profiles`. Curated examples are appended *after* real content and badged EXAMPLE.
- Explore searches real creators via `profiles`; Home, Explore and Profile all surface
  loading and error states.

### §4 Draft/published truthfulness — implemented
- `NestPlacement` gained `label`, `linkUrl` and an `interaction` bag (hotspots, content
  binding, surfaces, plane, locked/hidden, contactShadow, variant). The editor bridge now
  carries these **both** directions; previously they were editor-only.
- The old write path hard-coded `rotation: 0` and never read rotation back, and had nowhere
  to store overlays, `w`/`h` or `flipX` — it was lossier than localStorage. Every field now
  has a column and a round-trip test.
- **The two-store divergence is resolved by a stated rule** (`lib/nest-draft-reconcile.ts`):
  autosave protects in-progress work; explicit **Save** writes the canonical draft *and
  clears the autosave*; **Publish** writes the canonical published version and clears it too.
  On reopen, canonical wins unless the autosave is strictly newer — and when it is, a banner
  says so. The editor's Save previously wrote only localStorage, which is exactly why the
  Profile card lagged the editor.
- Slugs are generated once and reused forever, so re-publishing never breaks a shared URL.

### §5 Creator → one house → many Nests — implemented
One reader (`useCreatorNests`) serves both Profiles: the owner sees drafts + published, a
visitor sees published only (enforced by the query *and* by RLS). The Village builds from
real `profiles` plus their published Nests, grouped one house per creator, using the house
they **chose** — persona derivation is now only the fallback. A creator with no published
Nest yet still appears.

### §6 Full Nest simplified — implemented
Permanent canvas is now only: `[avatar] Nest name` (top-left, the **Nest** title),
Exit (top-right), and Like · Comments · Share (right rail). Removed from the canvas: the
repeated creator name, the bottom title block, tags, Visit House, and the permanent
Edit/Stats/View House row. Those moved into the creator drawer and a discreet owner "…"
menu. The drawer carries name, @handle, bio, stats, Follow, links and the creator's other
Nests.

### §7 Like / Comments / Share — implemented
Against `nest_likes` / `nest_comments` / `creator_follows`. One like per user per Nest is
enforced by the table's primary key, not client bookkeeping. Likes and follows are optimistic
**and roll back on failure** — a filled heart over a like that did not persist is the exact
class of lie this sprint removes. Comments have real loading / empty / error / list states.
Share uses Web Share where available, clipboard otherwise, with a confirmation toast, on the
stable slug URL. Notifications reuse the existing table (one added `entity_id` column), so
there is no second notification system.

### §8 Layering — implemented
`lib/nest-layers.ts` is now the single hierarchy (room → objects → hotspots → scrim → chrome
→ nav → drawer → modal → toast) plus shared `safeTop`/`safeBottom`/`BOTTOM_NAV_CLEARANCE`.
Bottom nav, sheets, modals, the door transition, the Village header and the feed card were
all moved onto it. No `z-[9999]`; a test asserts nothing exceeds the toast layer.

**The root cause of the founder's "furniture covering metadata" screenshot was found and
fixed:** `NestPreview`'s root was `relative` with `z-index: auto`, so it never formed a
stacking context and each placement's inline `zIndex` leaked into the *feed card's* context —
a sofa with `zIndex: 3` genuinely painted over the creator row. Adding `isolate` to that one
root fixes every surface at once. Verified before/after in the browser.

### §9 Swipe removed — implemented
Pointer handlers, arrows, pagination dots, the reel module and the directional slide state
are all gone from the full Nest view, along with the `touch-action: pan-y` override that was
only there to fight them — so browser back-swipe and panning work again. `test/nest-no-swipe.test.ts`
asserts they stay gone. Other Nests are reached from the drawer, Profile or House.

---

## Gates

| Gate | Result |
|---|---|
| `tsc --noEmit` | ✅ clean |
| `next lint` | ✅ 0 errors (pre-existing warnings only) |
| `vitest run` | ✅ **731 tests / 83 files** (was 688 / 77) |
| `next build` | ✅ 133 pages |

New tests: `nest-draft-reconcile`, `nest-placement-fidelity`, `nest-session-reset`,
`nest-onboarding-gate`, `nest-layers`, `nest-no-swipe`.

## What was verified in a browser, and what was not

**Verified (screenshots taken):**
- Home against the live Supabase project shows **"We couldn't load Nests. …Could not find
  the table 'public.nests'"** instead of an empty feed. This is the D-10 fix working against
  the real outage.
- Onboarding step 1 renders full-screen with live username validation
  (`@ada_lovelace is available`) and Continue correctly disabled until valid.
- Onboarding step 2 renders the house carousel, and **resumes there** when identity is
  already saved.
- The z-index fix, before and after, on the Home feed.

**NOT verified — and cannot be until the SQL is applied:**
- The two-account scenario (A publishes → B discovers, likes, comments, opens the shared
  link logged out; B cannot see A's drafts or edit A's Nest). Every table it needs is absent.
- Any Supabase write path end-to-end: publish, save, onboarding persistence, delete account.
- The Vercel Preview deployment (cannot be read from the repo; no Vercel CLI or token here).

I have not claimed any of these passed. They are the first thing to run after provisioning —
the scenario is written out in `NEXT_SPRINT.md`.

## Note on the dev harness

`.claude/launch.json` gained a `nestudio-local-backend` entry (port 3002, demo backend) used
for the UI walkthrough above. It is a local convenience only and affects no deployment.
Be aware `NEXT_PUBLIC_*` overrides are inlined at compile time and did not always survive a
hot recompile, so that server occasionally reported the Supabase backend on the client.
