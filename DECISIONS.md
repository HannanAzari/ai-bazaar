# DECISIONS

Product and engineering decisions that constrain future work. Each states the decision, the
reason, and its status. Supersedes contradicting statements in `docs/handoff/07_DECISIONS.md`
(retained as history).

---

**D-01 · One canonical Nest composition.** A Nest is saved once, completely, and every surface
renders that same saved data. No surface reconstructs or approximates a room.
*Why:* the founder observed Profile previews that did not match what they built. **Status: policy
in force; storage side still unresolved (see D-02).**

**D-02 · Public Nests must be globally discoverable; drafts owner-only.** A published Nest is
visible to any account subject to its visibility; drafts are visible only to their creator.
*Why:* content isolated per-browser is not a product. **Status: application code IMPLEMENTED
(M23B) — discovery, Profile, House and Village all read the shared tables. Blocked on the
founder applying `supabase/provision/m23b_nest_platform_provision.sql`; unverified until then.**

**D-03 · One shared geometry renderer.** `lib/nest-geometry.ts` (`placementBox` / `placementStyle`
/ `boxTransform` / `inPaintOrder`) is the only place that converts a placement into a box. The
editor (via `nest-editor-bridge`) and `NestPreview` both call it.
*Why:* two independent formulas produced a ~10% size error, dropped overlays and lost mirroring.
**Status: implemented (M23A, `e1fd940`).**

**D-04 · The editor's model is the canon.** `width = clamp(scale * 0.5, 0.06, 0.7)`; height from
the asset's `visualBounds.aspect` on the 3:4 scene; assets anchor by base centre, overlays by box
top-left with their own `w`/`h`. **Status: in force.**

**D-05 · Creator → one House → many published Nests.** The Village shows one house per creator, not
one per Nest. *Why:* a house is an identity, not a container per artefact. **Status: the Village
already groups per creator; the data wiring follows persistence.**

**D-06 · No horizontal swipe between Nests.** A visitor explores one Nest at a time; other Nests
are reached through the creator's Profile card/drawer or House. *Why:* swiping made Nests feel like
a feed, not places, and conflicted with room pan / back gestures. **Status: IMPLEMENTED (M23B).** Handlers,
arrows, dots and the slide state are gone; `test/nest-no-swipe.test.ts` keeps them gone.

**D-07 · Onboarding collects display name, unique username and house — nothing else.** Bio, links
and avatar stay editable later from Profile. *Why:* a new user should arrive at "this is me and
this is my house", not an empty Create screen. **Status: IMPLEMENTED (M23B)** — `/onboarding`,
two steps, resumable, with server-side username uniqueness.

**D-08 · Creator Profile gains Settings** (gear, creator-only) containing Sign out and Delete
account. *Why:* there is no account surface anywhere today. **Status: IMPLEMENTED (M23B).**
Sign out is real. Delete account calls a real server-side cascade and refuses honestly rather
than faking success (see D-09).

**D-09 · No fake account deletion.** If the cascade (profile, house, nests, objects, avatars,
private storage) cannot be completed safely, the destructive action stays **disabled** and the gap
is documented. *Why:* silently pretending to delete user data is unacceptable. **Status: in force.**

**D-10 · No hidden fallback that masks backend failures.** A Supabase failure must be visible.
The current `catch { /* fall back */ }` in `lib/nest-repo.ts` violates this and must be removed or
surfaced once the live schema is verified. *Why:* it made a broken data layer look healthy for
months. **Status: violation known and scheduled.**

**D-11 · Preserve real creator layouts; never reconstruct approximations.** If data is missing or
unrecoverable, say so — do not regenerate a plausible-looking room. **Status: in force.**

**D-12 · No new AI systems during beta stabilisation.** No AI generation, asset systems, avatar
work, marketplace or new discovery algorithms until the product is truthful. **Status: in force.**

**D-13 · Migrations are shown, never self-applied.** Every schema change is written to
`supabase/provision/*.sql`, reviewed, and applied by the founder. **Status: in force.**

**D-14 · Branch discipline.** Work lands on `m12-nest-platform` (Vercel Preview). `main` is
Production; no merges or promotions. **Status: in force.**

**D-15 · Terminology.** House = exterior/arrival. Nest = interior. "Room" is not used on
profile/arrival surfaces. **Status: in force on those surfaces; `lib/nest-house.ts` and the editor
still use their own vocabulary internally.**

**D-16 · One layering hierarchy.** Everything that stacks names a layer from
`lib/nest-layers.ts` (room → objects → hotspots → scrim → chrome → nav → drawer → modal →
toast). No ad-hoc `z-[9999]`. *Why:* per-component stacking produced the collisions in the
founder screenshots — most consequentially `NestPreview` not forming a stacking context, so a
placed sofa's `z-index` leaked out and painted over the feed card's creator row.
**Status: in force (M23B), asserted by `test/nest-layers.test.ts`.**

**D-17 · Autosave is a recovery buffer, never a source of truth.** Explicit Save writes the
canonical draft and clears the autosave; Publish does the same for the published version. On
reopen the canonical document wins unless the autosave is strictly newer, and that case is
announced to the creator. *Why:* the editor used to prefer the autosave unconditionally, so a
creator's Profile could show an older room indefinitely and it looked like a render bug.
**Status: in force (M23B), `lib/nest-draft-reconcile.ts`.**

**D-18 · The published Nest REPLAYS the creator's approved box; it never rebuilds it.**
A placement stores `w`/`h` with `x`/`y` as the box top-left, and `placementBox()` returns it
verbatim. Editor Preview renders the canonical document through the visitor's own renderer,
built with the same function publish uses. *Why:* geometry used to be re-derived from
`scale` plus the asset catalogue's aspect ratio, so height changed, and because the top is
computed from the height the object also MOVED. **Status: in force (M24), asserted by
`test/nest-editor-publish-parity.test.ts`.**
**Known limitation:** rows written before M24 have NULL `w`/`h` and keep the legacy
derivation. They are correct-as-published but will not match their editor state until the
creator re-saves. We do not backfill — inferring the original boxes would be guessing at
creator intent.

**D-19 · The Supabase library is MERGED over the bundled fixture, never a replacement.**
Supabase rows win on id collision; the fixture fills the gaps. *Why:* `fetchLibrary()` used
to replace the fixture whenever the query succeeded. Applying the M23B SQL made it succeed
with the one row `nest_assets` contains, so the catalogue collapsed to a single laptop and
every published Nest lost its objects. **Status: in force (M24).**

**D-20 · One house per style, everywhere.** `houseStyleSeed(styleKey)` seeds the building,
so a chosen style renders identically in onboarding, both Profiles, the House arrival and
the Village. Creators who have not chosen one still vary per-creator, so the Village is not
a row of clones. *Why:* the two surfaces used different seeds and `houseFeatures()` decodes
the whole building from the seed — same colours, different architecture.
**Status: in force (M24), asserted by `test/nest-house-parity.test.ts`.**

**D-21 · Overlays render in the ROOT stacking context.** Sheets and modals portal to
`document.body`. *Why:* a `z-index` only means something inside its own stacking context;
the owner menu lives inside an `absolute z-40` header, so the sheet's `z-60` was scoped to
that header and the engagement rail painted over it. **Status: in force (M24).**

**D-22 · A view is a person who stayed, counted once a day.** Recorded after ~2.5s of
VISIBLE dwell, never for the owner, never from a thumbnail or Preview, and deduplicated by
a unique index on `(target, viewer_key, view_day)` so recording is an atomic
`insert … on conflict do nothing`.
*Beta simplifications, deliberately chosen and recorded rather than hidden:*
 • the bucket is a UTC **day**, not a rolling 24 hours — a viewer either side of midnight
   UTC counts twice;
 • an anonymous viewer is a random key in their own browser, so clearing site data or
   rotating it allows inflation. It is a vanity metric, not billing.
**Status: in force (M24), pending `supabase/provision/m24_views_provision.sql`.**

**D-23 · One notifications backend — the existing table.** The read side now uses
`public.notifications`, which has been receiving follow/like/comment rows since M23B. The
badge refetches on tab focus rather than via Realtime, because Realtime is not configured
for this project and the sprint forbids building on a maybe. **Status: in force (M24).**
