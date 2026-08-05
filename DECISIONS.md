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

**D-24 · ONE SceneRenderer.** Preview, the feed, Profile cards and visitors all
instantiate `NestPreview` with the same canonical document, built by the same function
publish uses. Modes may vary only `interactive`. *Why:* three renderers existed and Preview
showed a scene no visitor could get. **Status: in force (M24B), `test/nest-scene-renderer.test.ts`.**

**D-25 · The scene is a fixed-aspect box everywhere.** Objects and background share one
coordinate space; the stage letterboxes inside its container. *Why:* the renderer stretched
to the container's aspect and cropped the background, so the two drifted apart by a
different amount on every screen. **Status: in force (M24B).**

**D-26 · Drafts never touch the live Nest.** Saving a published Nest writes
`nests.draft_doc`; visitors read `nest_objects`, so a draft cannot leak. Publish promotes it
and clears the draft only after the live version is written. **Status: in force (M24B).**

**D-27 · No profile or house views.** A Nest has Views/Likes/Comments; a creator's totals
are the SUM over their published Nests (rooms.xyz model). `profile_views` was removed before
shipping. **Status: in force (M24B), supersedes part of D-22.**

**D-28 · Overlay animations carry no fill-mode.** `fill: both` holds the from-state
(`opacity: 0`) whenever an animation is throttled, making a sheet invisible and untappable.
**Status: in force (M24B).**

**D-29 · Scene resolution is a pure module, not component state.** `lib/nest-scene.ts`
turns a `NestDocument` into what a renderer needs — focus regions, the camera transform,
surfaces — with no React and no Supabase in the path. *Why:* the editor and the visitor had
two different renderers *because* scene resolution lived inside components; a visitor
literally could not resolve a surface, because resolving one needed editor state. With it
extracted, both modes call the same functions over the same document and cannot disagree.
**Status: in force (M24D), `test/nest-runtime-focus-surface.test.ts`.**

**D-30 · A missing column degrades a feature; it never breaks the product.** Repositories
probe once for a newly-added column, fall back to the base column set, omit it on write,
and tell the creator plainly when the one feature that needs it is unavailable. *Why:*
selecting `nests.scene_extras` unconditionally produced `column ... does not exist` on
every feed read and took the whole app down against the live database — the same shape of
failure M23B had already fixed once for `profiles.house_style`. Migrations are
founder-applied and therefore always lag the code. **Status: in force (M24C).**

**D-31 · A focused view is the main scene under ONE camera transform.** `focusCameraTransform()`
returns a scale + origin applied to the whole stage, so the background and every object
move together; the smaller axis wins so nothing outside the crop leaks in. *Why:* a
re-laid-out focused scene is a second coordinate space, and every displacement bug this
programme has fixed came from having two. A zoom-only region with no child scene still
resolves — dropping it would silently discard creator intent.
**Status: in force (M24D).**

**D-32 · Objects inside a focus region stay inside it.** They are serialised into the
versioned `NestSceneExtras`, never promoted into the main placements. *Why:* the "missing
plant" could have been compensated for by duplicating it into the root scene. That would
render something the creator never composed. **Status: in force (M24C),
`test/nest-scene-roundtrip.test.ts`.**

**D-33 · The surround is a derived matte, not the room's own image.** One deep desaturated
colour computed from the background id — `hsl(<hue> 14% 11%)`, deterministic so it never
flickers and needs no pixel sampling — plus a vertical gradient, a warm radial glow and an
edge vignette. *Why:* flat bands read as unfinished, and the enlarged blurred background
that replaced them produced visible green/beige/dark bands on real rooms and read as an
accident. Geometry is untouched: this paints behind the fixed 3:4 stage. The future 9:16
`immersiveBackgroundUrl` swaps what is drawn there and needs no geometry change (typed seam
`ImmersiveBackground`). **Status: in force (M24D), supersedes M24C §7.**

**D-34 · A tap does what the CREATOR bound to it — never what the asset is called.**
`lib/nest-interaction.ts` is a closed union (`open-url` | `open-youtube` | `enter-focus` |
`none`), resolved only from `hotspot.binding`, `placement.linkUrl` or a Focus id. *Why:*
inferring behaviour from an id like `ast-tv` makes a room do things its creator never
asked for, and makes their actual configuration unreachable. URLs are re-validated at
render time, not only at authoring time, because a document can reach the runtime from a
legacy row or an import that our editor never checked. **Status: in force (M24E),
`test/nest-interaction-runtime.test.ts`.**

**D-35 · Surface CONTENT and surface ACTION are separate.** What is drawn comes from
`interaction.surfaces`; what happens on tap comes from `interaction.hotspots[].binding`.
Content renders `pointer-events-none`; the hotspot is the tap target. *Why:* the founder's
report was literally "the image appears, the tap does nothing" — the two had been conflated
into one feature, so shipping the visual read as shipping the behaviour. A hotspot always
beats a whole-object `linkUrl`, so the room never becomes accidentally clickable underneath
the region the creator actually drew. **Status: in force (M24E).**

**D-36 · An unconfigured hotspot is not a tap target; a MALFORMED one is loud.** A
catalogue hotspot with no binding is skipped entirely — rendering it would place an
invisible button over the object that swallows taps and does nothing. A hotspot the creator
did configure but that cannot run (no URL, unsafe scheme) is still rendered, outlined in
development and logged by name. *Why:* a dead tap is indistinguishable from a runtime that
forgot to render the region, and that ambiguity is why the Focus bug survived three
sprints. **Status: in force (M24E).**

**D-37 · Degrade a feature, but never discard creator work.** Refines D-30. A missing
column still degrades silently when the document does not use it; when the document
actually carries Focus regions, the write is REFUSED before anything is sent, with a
message naming the migration. *Why:* D-30 was being applied too broadly — a save
containing Focus regions reported "Saved ✓" and dropped every one of them. Degrading an
unused feature is correct; silently destroying work the creator can see on screen is not.
**Status: in force (M24E), supersedes the blanket reading of D-30.**

**D-38 · The runtime is `NestRuntime`, and `mode` decides input only.** One component
renders and runs a Nest in the editor Preview, the full public Nest and every card;
`mode` (`editor-preview` | `visitor` | `card`) selects nothing but whether input is live.
`NestPreview` is a passthrough adapter kept for existing call sites and contains no
rendering. The Home feed card stays `card` deliberately: the room itself is the "visit this
Nest" tap target there, so a hotspot inside it would steal that tap. **Status: in force
(M24E), `test/nest-scene-renderer.test.ts`.**

**D-39 · Free zoom replaces Focus for ordinary close inspection.** The whole room pinch-zooms
and pans to ~5× (`lib/nest-camera.ts` + `use-scene-camera.ts`). A creator places a 10px book
on a shelf and a visitor zooms in on it; neither authors a region. *Why:* Focus made "look
closer" an authoring task, so every small detail cost a child scene, and the child scene was
a second coordinate space — the source of three sprints of displacement and data-loss bugs.
The camera is a viewport transform and never touches object geometry. **Legacy Focus data is
kept and still plays** (`resolveFocusRegions` is still called); it simply cannot be authored
any more. Nothing is dropped, no column is removed. **Status: in force (M25).**

**D-40 · Session state is not authored state.** A lamp the visitor switched on is a fact
about this visit and lives in component state; the lamp's *initial* state is a fact about the
Nest and lives in the document. A visitor tap never produces a database write. *Why:* the
alternative is either writing on every tap (a room that mutates for everyone who looks at
it) or refusing state changes entirely. **Status: in force (M25),
`test/nest-zoom-interaction.test.ts`.**

**D-41 · The OBJECT is the hit target; there is no permanent affordance chrome.** No hotspot
badge, no pinch icon, no rectangle to author. Discovery is a one-time "Tap objects and pinch
to explore" plus an on-demand Hint that pulses interactive objects for ~1.8s. *Why:* a badge
on every interactive object turns a room into a control panel, and the room is the product.
Tiny objects get an invisible ~14px touch pad that must be **hittable** — a
`pointer-events-none` pad extends nothing, which is how this shipped broken the first time.
**Status: in force (M25).**

**D-42 · Overlapping taps resolve by visual containment, then nearest centre.**
`resolveTapTarget` in `lib/nest-camera.ts`. *Why:* two 10px books 12px apart have touch pads
that overlap entirely, so `elementFromPoint` alone always returned whichever painted last —
every tap aimed at the first book opened the second. No second-tap chooser: with these two
rules the ambiguous case does not arise, and a disambiguation popup is worse than a good
guess. **Status: in force (M25).**

**D-43 · The gesture layer never re-renders the scene.** The camera is written straight to
the stage's `style.transform` inside a rAF; React sees it only when the gesture ends, and
only so the Reset control can appear. The listener effect depends on nothing that changes
per render — the tap handler and the panning flag are read through refs. *Why:* a pinch
fires ~60 events/second and `useState` would re-lay-out every object on each one. It is also
a correctness rule: an earlier version re-ran the listener effect on every `setZoomed`, and
its cleanup cancelled the pending frame while leaving the frame slot latched, so the camera
silently froze after the first gesture. **Status: in force (M25).**

**D-44 · One creator panel, in the creator's language.** Connect, Surface and Focus are
retired from the editor toolbar in favour of a single object-level Interaction panel that
shows only what the selected asset supports — a lamp offers no URL field. The words
"hotspot", "surface projection", "child scene" and "target scene" appear nowhere a creator
can see, asserted by test. *Why:* those are our names for our problems. **Status: in force
(M25), supersedes the authoring half of D-35.**

**D-45 · The editor's viewport is workspace state, never the visitor's opening shot.** A
creator zooming in to place a book does not author a camera; every visitor opens at 1×,
fitted. *Why:* an accidentally-saved viewport would be indistinguishable from a deliberate
one, and there is no UI to correct it. An authored opening camera is a future feature that
must be explicit. **Status: in force (M25).**

**D-46 · The editor and the visitor share ONE camera.** Arrange mode mounts the same
`useSceneCamera` with the same 1–5× limits, focal-point pinch and pan clamping. *Why:* a
second zoom system is a second coordinate space, and every displacement bug this project
has had came from having two of something. The camera needed almost no coordinate work
because the canvas converts screen→scene with `sceneRef.getBoundingClientRect()`, and a
transformed element's bounding rect is its POST-transform box — so `(clientX - r.left) /
r.width` is already canonical at any scale, with no scale term anywhere. **Status: in force
(M25B), `test/nest-editor-camera.test.ts`.**

**D-47 · A one-finger drag belongs to whatever it started on.** `canPanFrom` is evaluated at
`pointerdown` and never re-evaluated: a finger that starts on an asset moves that asset for
the whole gesture; anywhere else it pans (once zoomed). Two fingers always pinch, whatever
they started on. *Why:* deciding per-move would let an asset start moving and the camera
finish the job. **Status: in force (M25B).**

**D-48 · Editor chrome is removed while a sheet is open, not merely restacked.** The
floating object toolbar renders OUTSIDE `.editor-scene`'s stacking context, so its `z-[600]`
competed directly with the sheet's `z-[60]` and painted over it. It now uses `z.chrome` and
is unmounted entirely when an object sheet is open. *Why:* "put it behind" leaves handles
that still steal taps; the brief asked for gone. **Status: in force (M25B).**

**D-49 · Form controls are ≥16px on coarse pointers, globally.** One rule in `globals.css`.
*Why:* iOS Safari zooms the page whenever a focused control is under 16px and does not
reliably zoom back out. Explicitly NOT fixed with `maximum-scale=1` / `user-scalable=no`,
which would disable pinch accessibility zoom for everyone, nor with a transform trick, which
lies about the layout. **Status: in force (M25B).**

**D-50 · A sheet re-seeds from the document only when the SELECTION changes.** The
Interaction panel's effect keys on `object.instanceId` alone, and save reads its values from
refs. *Why:* the old effect also depended on the committed connection, so the instant a save
landed it reset the fields from the freshly-written document — which read to the creator as
"Save did nothing" — and a controlled input's final `onChange` can arrive after the button's
pointer sequence on iOS, so state alone could be one keystroke stale. **Status: in force
(M25B).**
