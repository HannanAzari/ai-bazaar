# NEXT SPRINT — Shared persistence & cross-account discoverability

> **STATUS (M23B): the implementation section below is DONE.** All of steps 1–7 are
> implemented; see `M23B_SPRINT_REPORT.md`. What remains of this document is its value as the
> **acceptance script** — the two-account testing scenario at the bottom is exactly what to run
> once `supabase/provision/m23b_nest_platform_provision.sql` has been applied.
>
> One correction to the prerequisites below: the live checks were run, and BOTH
> `to_regclass` calls returned NULL. The corrective migration named here
> (`nests_canonical_provision.sql`) could not run and has been superseded.

> Read `CTO_HANDOFF.md` first.
> This conclusion was verified against the code, not assumed: `lib/nest-repo.ts` still routes
> through `catch { /* fall back */ }` to localStorage, `use-discovery.ts` still imports only
> `listPublished` (localStorage) + curated fixtures, and `listMyNests()` in
> `lib/nest/supabase-nest-repo.ts` is **called from nowhere**.

## Objective

A Nest published by **any** account is stored in Supabase and resolvable by **any other** account,
at a stable payload-free URL, subject only to its visibility. Drafts stay owner-only.

## Prerequisite checks — DO THESE FIRST, WRITE NO CODE UNTIL THEY PASS

Run `DEBUG_GUIDE.md` §1. In short:

```sql
select to_regclass('public.nests');
select to_regclass('public.nest_objects');
```

- If either returns `NULL` → the base migration
  (`supabase/migrations/20260702_01_nest_platform.sql`) is **not applied**. Stop and ask the
  founder to provision. **Never apply SQL yourself.**
- If both exist → inspect columns, constraints, RLS policies and indexes, then decide whether
  `supabase/provision/nests_canonical_provision.sql` (the corrective ALTER migration) is still
  needed as written.
- Confirm **Preview and Production point at the same Supabase project** before drawing conclusions
  from either.

## Implementation order

1. **Verify the live schema** (above). Record findings in `docs/CANONICAL_NEST_DATA_AUDIT.md`.
2. **Have the founder provision** any missing migration. Do not proceed without it.
3. **Fix the repo layer's fidelity.** `lib/nest/supabase-nest-repo.ts` currently writes
   `rotation: 0` hard-coded and never reads rotation back in `toDoc()`, and has no columns for
   `overlay` / `w` / `h` / `flipX`. Until this is fixed, **the Supabase path is lossier than
   localStorage** — do not migrate data into it.
4. **Make failures loud.** Replace the silent `catch { /* fall back */ }` in `lib/nest-repo.ts`
   with a surfaced error (and, if a fallback is kept at all, a visible "saved locally only" state).
   This is the single highest-value change for trust.
5. **Repoint reads.** `use-discovery.ts` must query Supabase for published Nests (wire the existing
   `listMyNests` / add a `listPublicNests`), keeping curated fixtures only as a genuine fallback.
   Then Profile, Explore and Village inherit it.
6. **Stable share URLs.** Publishing must return `/nest/<slug>` with no `?c=` payload; the viewer
   resolves by slug through RLS. Keep `?c=` decoding for old links only.
7. **Backfill** (optional, decide explicitly). `migrateLocalNestsToSupabase()` exists, is unused,
   and currently drops `ownerId`, `createdAt`, `overlay`, `w`, `h`, `rotation` — **and regenerates
   slugs, which would break every existing published URL.** Fix or don't call it.

## Files likely involved

`lib/nest-repo.ts` · `lib/nest/supabase-nest-repo.ts` · `lib/nest-document-store.ts` ·
`components/nest/app-shell/use-discovery.ts` · `lib/nest-discovery.ts` ·
`app/nest/[slug]/visitor-client.tsx` · `app/profile/profile-dashboard-client.tsx` ·
`app/profile/[handle]/profile-client.tsx` · `supabase/provision/nests_canonical_provision.sql`

## Risks

- **Data loss.** Existing test Nests live only in browser localStorage; no server migration can
  reach them. Decide *explicitly* whether to reset or backfill.
- **URL breakage** from slug regeneration during any backfill.
- **Lossy write path** (step 3) — migrating before fixing it bakes the loss in.
- **RLS mistakes** could expose drafts. Test with two real accounts, not one.

## Acceptance criteria

- [ ] Live schema state recorded in the audit doc.
- [ ] A Nest published by Account A exists as a `nests` row + `nest_objects` rows.
- [ ] Account B (different browser/account) sees it in Home/Explore, on A's Profile, and via
      A's House.
- [ ] The share URL is `/nest/<slug>` with **no** `?c=` payload and opens logged-out.
- [ ] Account B **cannot** see A's drafts and **cannot** edit A's Nest.
- [ ] Rotation, flipX, overlays and z-order survive publish → reload → other account.
- [ ] A Supabase failure produces a **visible** error, not a silent local write.
- [ ] typecheck · lint · tests · build all green.

## Testing scenario (two normal, non-founder accounts)

**Account A** — sign up · create a Nest · place a large object, a small object, a rotated object, a
flipped object, two overlapping objects, a text overlay and an image overlay (mirror
`lib/fixtures/canonical-nest.ts`) · save as draft · confirm the Profile card matches the editor ·
reopen and confirm nothing changed · publish.

**Account B** — sign up in a different browser/profile · find A via search · open A's Profile ·
see the published Nest · enter it · confirm the composition matches A's editor exactly · like ·
comment · share · open the shared link logged-out.

**Back to A** — verify counts/notifications · confirm B never saw the draft.

## Explicit non-goals

Onboarding, Settings/delete-account, full-Nest UI simplification, z-index tokens, swipe removal,
social persistence, AI/asset/avatar work, visual redesign, legacy-island deletion. Those come after
persistence is truthful.
