# NEXT SPRINT — M25: Prove it, on a real deployment, with two real accounts

> Read `CTO_HANDOFF.md` first. The previous sprint document (shared persistence) is fully
> implemented; its acceptance script is preserved below in §4 because it is still the right
> test.

## Objective

Stop writing features. **Verify the ones that exist**, end to end, on a live Preview, with
two real non-founder accounts — then fix only what that walkthrough breaks.

Everything in M23B → M24D is implemented and locally green (900 tests). Almost none of it
has been exercised by a human against a deployment, because nothing has deployed since
`235d2ab`. That gap is the project's biggest risk, and closing it is worth more than any
new work.

---

## 0. Prerequisites — the sprint cannot start without both

Neither is code. Both are founder actions. **Do not write code around them; ask.**

1. **Vercel** returns `402 DEPLOYMENT_DISABLED`. Clear the billing/usage block, redeploy
   `m12-nest-platform`, and confirm at `<preview-url>/api/auth/whoami`:
   `resolvedBackend: "supabase"` · `projectRef: "srrmkdsvldlyllsxyhtq"` ·
   `vercelEnv: "preview"` · the expected commit hash.
2. **Apply `supabase/provision/m24b_provision.sql`** in the Supabase SQL editor
   (`nest_views`, `nests.draft_doc`, `nests.draft_updated_at`, `nests.scene_extras`).
   Additive and idempotent. **Never apply SQL yourself.**

Then re-run `DEBUG_GUIDE.md` §1 to confirm the columns landed, and check the dev console for
`[nest-repo] scene_extras available` rather than the degraded path.

## 1. Order of work

1. **Confirm the deployment is the current commit.** (`DEBUG_GUIDE.md` §9.) If it is not,
   nothing below means anything.
2. **Run the two-account walkthrough** in §4, writing down every divergence *before* fixing
   anything. Resist fixing the first thing you see — the pattern across M24/M24B/M24C is
   that symptoms shared one upstream cause.
3. **Fix by root cause**, in the order the walkthrough surfaced them.
4. **Capture parity evidence**: Preview and Visitor screenshots at the *same* viewport, plus
   the measured Editor↔Preview delta from `/dev/nest-parity`.
5. **Only then** consider new work — see §5.

## 2. What to watch most closely

These are implemented but have never once been run by a person:

| Area | The specific thing to prove |
|---|---|
| **Focus** | Place an object inside a focus region → save → publish → open signed-out → tap the region → **the object is there**. The "missing plant" is the fixture. |
| **Surface** | Assign image/text content to a surface → a visitor sees it, at the right object-local geometry. |
| **Views** | A second account dwelling ~2.5s increments once; a reload same-day does not; the owner never counts. |
| **Drafts** | Saving a published Nest does **not** change what a visitor sees; publishing promotes it. |
| **Social** | Like / comment / follow from B; A sees the notification; counts agree across Home, Profile and the Nest. |
| **Legacy Nests** | A pre-M24 Nest still renders, is badged "Re-save to update layout", and re-saving fixes it. |

## 3. Acceptance criteria

- [ ] The Preview URL serves the current commit and reports `resolvedBackend: "supabase"`.
- [ ] `m24b_provision.sql` is applied; no repository is running its degraded path.
- [ ] A Nest published by Account A exists as a `nests` row + `nest_objects` rows and is
      visible to Account B in Home/Explore, on A's Profile, and through A's House.
- [ ] The share URL is `/nest/<slug>` with **no** `?c=` payload and opens logged-out.
- [ ] B **cannot** see A's drafts and **cannot** edit A's Nest.
- [ ] Rotation, flipX, overlays, z-order, **focus regions and surface content** all survive
      publish → reload → other account.
- [ ] Preview and Visitor screenshots at matching viewports are visually identical.
- [ ] Like / comment / follow / notification all work between two real accounts.
- [ ] A view is counted once per viewer per day; never for the owner.
- [ ] A Supabase failure produces a **visible** error, never a silent local write.
- [ ] typecheck · lint · tests · build all green; the sprint is deployed and the deployment
      verified.

## 4. The walkthrough (two normal, non-founder accounts)

**Account A** — sign up · complete onboarding · create a Nest · place a large object, a
small object, a rotated object, a flipped object, two overlapping objects, a text overlay,
an image overlay (mirror `lib/fixtures/canonical-nest.ts`) · **create a focus region and
place an object inside it** · **assign content to a surface** · save as draft · confirm the
Profile card matches the editor · reopen and confirm nothing changed · publish.

**Account B** — sign up in a different browser profile · find A via search · open A's
Profile · see the published Nest · enter it · **confirm the composition matches A's editor
exactly** · tap the focus region and confirm the child object is there · like · comment ·
follow · share · open the shared link logged-out.

**Back to A** — verify counts and notifications · confirm B never saw the draft · save a
change and confirm B still sees the published version until A publishes again.

## 5. Explicit non-goals

No new AI, asset, avatar, marketplace or discovery-algorithm work. No visual redesign of
approved Profile or Nest UI. No deletion of the legacy island. No 9:16 immersive background
— it is a documented seam (D-33) and stays one until the room art exists.

If the walkthrough passes cleanly, the *next* sprint after this one is the founder's call:
the strongest candidates are the Asset-Factory → `nest_assets` publishing seam (the library
holds one row) and deleting the legacy pre-pivot island.
