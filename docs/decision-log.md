# Decision Log

Architectural decisions and their reasoning (ADR-style). **Append-only** — add new
decisions at the end; supersede rather than delete. Status values: Accepted ·
Superseded. See [architecture.md](../architecture.md) and [handoff.md](handoff.md).

---

## ADR-001 — Room-first UX

**Status:** Accepted · 2026-06-14

### Context
The house page originally read like a profile: a small room embedded in a card-
heavy layout with bio, stats, and links dominating. The product goal is that a
visitor feels "I entered this person's room," not "I'm reading their profile."

### Decision
Make the **room the page**. Owner identity, stats, links, and the guestbook are
secondary and live in slide-over drawers/panels; the room canvas is the dominant
surface.

### Alternatives Considered
- Keep the room as one widget on a profile page (status quo) — fails the goal.
- A two-pane split (room + persistent sidebar) — still profile-flavoured on mobile.

### Consequences
- (+) Strong, differentiated identity; the room becomes the thing people share.
- (+) Mobile reads as an immersive space, not a scroll.
- (−) Owner/profile info is one tap away, not always visible.
- (−) More layout complexity (drawers, overlays, z-index management).

---

## ADR-002 — Village as the navigation layer

**Status:** Accepted · 2026-06-11

### Context
Discovery needs a model. The anti-goal is an infinite, algorithmic feed.

### Decision
Navigation is **spatial**: a hex **world map** → village **street** → **house** →
room. You discover creators by exploring places.

### Alternatives Considered
- Feed/grid of houses as the home screen — rejected (feed-first contradicts the vision).
- Search-only discovery — too utilitarian; loses the "village" feeling.

### Consequences
- (+) Reinforces the village metaphor; memorable, screenshot-friendly.
- (+) Natural place for villages/themes to scale.
- (−) More steps to reach a specific room (mitigated by `/discover`, tags, direct addresses).
- (−) Spatial layouts are more work than a list.

---

## ADR-003 — LocalStorage demo architecture

**Status:** Accepted · 2026-06-10

### Context
The app must run and be demoable with zero backend setup, while real auth/DB are
not yet wired.

### Decision
Run as a **client-side demo**: seed content in `lib/data.ts`, mutable state in
`localStorage` via small per-feature libs (SSR-guarded `read`/`write`, `try/catch`,
a `*-changed` event for reactivity) plus a React `DemoProvider`. Supabase helpers
return `null` when env vars are blank.

### Alternatives Considered
- Require a Supabase project to run anything — too much friction for iteration/QA.
- In-memory only (no persistence) — loses state on reload; poor demo.

### Consequences
- (+) Instant local dev/QA; every feature is verifiable without a backend.
- (+) Clear seam to swap in real persistence later.
- (−) Two implementations to keep aligned (see ADR-004).
- (−) Single-user limitations (seeded notifications/activity; demo-derived counts).

---

## ADR-004 — Supabase parity model

**Status:** Accepted · 2026-06-11

### Context
The demo layer (ADR-003) is not production. Production needs a real, secure schema,
but maintaining it shouldn't block feature iteration.

### Decision
Keep `supabase/schema.sql` + dated migrations as a **production-parity mirror** of
the demo shapes, updated every sprint but **not executed at runtime here**. Each
feature ships **both** layers with aligned shapes; RLS is written alongside tables.

### Alternatives Considered
- Build the backend first, then the UI — slow; couples iteration to infra.
- Skip SQL until a backend sprint — risks large drift and a painful catch-up.

### Consequences
- (+) Production model stays current and reviewable; small cutover later.
- (+) Forces clean, normalized data shapes early.
- (−) Double bookkeeping; shapes can drift if discipline slips.
- (−) **SQL is unverified against live Postgres** — must dry-run migrations + RLS on staging.

---

## ADR-005 — Feature flag system

**Status:** Accepted · 2026-06-12

### Context
Foundations ship incrementally and must be toggleable on/off without code surgery,
resolving identically on server and client.

### Decision
`NEXT_PUBLIC_ENABLE_*` flags read in `lib/flags.ts` (inlined at build time), exposed
as a `flags` object. Convention: implemented features default **on**; gate the
route (`notFound()`), the UI entry points, and any data recording.

### Alternatives Considered
- A runtime/remote flag service — overkill for a static demo; adds a dependency.
- Branch-per-feature — no runtime toggle; can't A/B or disable in prod.

### Consequences
- (+) Safe rollout/rollback; clean "off" behavior; easy QA of both states.
- (+) Server and client agree (no fl/hydration mismatch).
- (−) Build-time only — changing a flag needs a rebuild.
- (−) Must remember to gate every entry point, not just the route.

---

## ADR-006 — Asset-library-first AI strategy

**Status:** Accepted · 2026-06-14

### Context
AI room design is a core pillar, but a hard product constraint is that **AI must
never generate visuals/graphics**, and no real AI is wired yet.

### Decision
The **curated asset catalog is the source of truth** for everything placeable. Any
future "AI room designer/editor" may only **select and arrange** existing catalog
assets (and is mocked/heuristic until a provider is added) — never synthesize art.

### Alternatives Considered
- Generative image/asset AI — rejected by product constraint (cost, consistency, IP, brand).
- Freeform user uploads as the asset source — deferred; no uploads/marketplace yet.

### Consequences
- (+) Consistent, on-brand visuals; predictable, testable AI behavior.
- (+) Decouples "AI" from any image provider; works as a deterministic recommender now.
- (−) Room richness is bounded by catalog breadth (needs ongoing asset work).
- (−) "AI designer" is a selector, which may feel less magical than generation.

---

## ADR-007 — Full-screen room experience (with legacy fallback)

**Status:** Accepted · 2026-06-14

### Context
ADR-001 (room-first) needs a concrete public implementation, without discarding the
previous room rendering or risking a hard regression.

### Decision
`components/room/room-experience.tsx` renders the room at full viewport with corner
actions and drawers. `components/shop-page-client.tsx` switches: `RoomExperience`
when `ENABLE_ROOM_ENGINE` is on and the house isn't hidden, else `LegacyHouseView`.
The legacy decoration room (`shop-room.tsx`) is retained as the flag-off fallback.

### Alternatives Considered
- Replace the legacy room outright — riskier; no escape hatch if the engine misbehaves.
- Embed the engine inside the old layout — undermines the full-screen goal.

### Consequences
- (+) Bold new surface with a one-flag rollback; moderator "resting" path preserved.
- (+) Room Engine and legacy decorations coexist (two data models) during transition.
- (−) Two room renderers to maintain until the legacy path is retired.
- (−) Full-screen layout adds drawer/overlay/keyboard-focus complexity.

---

## ADR-008 — Deterministic, render-pure visuals

**Status:** Accepted · 2026-06-10

### Context
SSR + hydration must match exactly, and the village/house art needs per-house
variety. An early bug came from serializing floating-point coordinates differently
on server vs client.

### Decision
All visual variation derives from **stable seeds** (e.g. `deriveHouseSpec(seed)`,
hex coords, room anchors) computed purely. **No `Math.random()` or `Date.now()` in
render.** Demo state loads in `useEffect`; components initialise to empty/zero so
server and first client render agree.

### Alternatives Considered
- Random variation at render — causes hydration mismatches and unstable visuals.
- Disable SSR for these components — loses static generation and first-paint quality.

### Consequences
- (+) Stable, reproducible visuals; no hydration warnings; houses look identical across map/street/cards.
- (−) Variation is constrained to what a seed function can express.

---

## ADR-009 — Enum-split migration discipline

**Status:** Accepted · 2026-06-11

### Context
PostgreSQL will not let a single transaction add a value to an existing `enum` and
then use that value. Several sprints extend existing enums (e.g. report targets).

### Decision
Split such changes into two ordered files: `_01_extend_enums.sql` (only the
`ALTER TYPE ... ADD VALUE`s) and `_02_*.sql` (everything that uses them). Brand-new
`CREATE TYPE` enums can be created and used in the same migration. Migrations are
**append-only and never reordered/renamed**.

### Alternatives Considered
- One migration per sprint — fails for enum-value additions used in the same tx.
- Convert enums to text/check constraints — loses type safety and clarity.

### Consequences
- (+) Migrations apply cleanly; ordering is explicit and stable.
- (−) More files per sprint; contributors must know the rule (documented here + in README).

---

## ADR-010 — Free drag/resize over anchor-only placement (Room Engine V2)

**Status:** Accepted · 2026-06-15

### Context
V1 placement was zone + anchor-point selection via dropdowns — predictable and
SSR-safe, but it did not feel like a creator tool. The V2 "Creator Studio"
sprint had to add free drag, resize, multi-select, undo/redo, autosave, and
templates **without redesigning the visual language** or breaking the existing
saved-room shape.

### Decision
- **Drag adjusts the existing normalised offset from an anchor**, clamped inside
  the room bounds (`moveObjectTo`), rather than replacing the zone/anchor model.
  Zones still own category validation and capacity; the anchor remains the
  object's logical base. This keeps every prior room valid and the validation
  rules untouched.
- **Resize stores `scale` + `width`/`height`** side by side: the slider drives the
  uniform `scale`; corner handles set the box `width`/`height` (px). `width`/`height`
  are **optional** so pre-V2 rooms (scale-only) render unchanged via a base size.
- **Pointer interaction lives in `RoomCanvas` (editor mode)**; the editor passes a
  small callback bundle (`onInteractionStart`/`onLiveChange`/`onCommit`/selection).
  Live drags update state without a history entry; a single entry is pushed on
  release. Undo/redo is a **pure, tested history stack** (`lib/room-history.ts`).
- **Templates select existing catalog assets only** (ADR-006) and run through the
  same placement rules — no generated graphics, no rule bypass.

### Alternatives Considered
- **Absolute coordinates, retire anchors** — cleaner "free editor" feel, but a
  larger model change, a migration risk, and it weakens zone-based validation.
- **Replace `scale` with `width`/`height` only** — breaks pre-V2 rooms and the
  slider UX; rejected in favour of keeping both.
- **Per-keystroke / per-frame history** — floods undo; chose discrete commits and
  one entry per drag/resize gesture.

### Consequences
- (+) Real creator-tool editing (drag, resize, multi-select, undo, autosave,
  templates) with **zero change to the visual language** and full back-compat.
- (+) Validation and the public renderer are unchanged; the canvas is the only
  component that grew interaction logic.
- (−) `RoomCanvas` editor mode is now stateful (pointer tracking) — more complex
  than the V1 render-only canvas.
- (−) Two size controls (slider + handles) must stay coherent (effective size =
  `width × scale`).

---

## ADR-011 — Real interactive objects: rich action data + a `profile` type

**Status:** Accepted · 2026-06-16

### Context
Through V2 the object `actionType`s `gallery/video/product/booking/contact` were
**placeholder panels**, and `link` just opened a URL. The V3 goal was to make
objects real destinations a visitor can use **inside the room**, plus add
profile objects — without redesigning visuals or adding AI/marketplace/payments.

### Decision
- **Grow `RoomActionData` as an open, optional, flat shape** (`title`,
  `description`, `images[]`, `price`, `image`, `email`, `website`, `phone`,
  `socials[]`). It is stored in the existing `room_objects.action_data` **jsonb**
  column, so richer content needs **no table migration** and old objects stay
  valid (missing data → an inert click, never an error).
- **Add one new action type, `profile`** (TS enum + `room_action_type` enum
  value), rather than overloading `link`. Profile objects open a real in-room
  creator card (reusing profiles + activity) and deep-link to `/u/[handle]`. New
  action types are a spec change, recorded here and in room-engine-spec.md §5.
- **Keep panels client-only and provider-light**: video parses YouTube/Vimeo to
  an embed URL (`lib/embeds.ts`); booking embeds Calendly or links out; product
  and link redirect externally. No payments, no messaging — AI Bazaar never
  brokers the transaction or the message.
- **Pure, tested helpers** (`lib/room-actions.ts`) normalise/validate action data
  for both the visitor panels and the owner inspector, so a half-filled object
  degrades gracefully.
- **Insights reuse the events log** (`object_click`) joined with the room — no new
  store, no dashboards (`lib/room-insights.ts`).

### Alternatives Considered
- **Typed per-action columns / tables** — rejected; jsonb already exists and the
  shapes are small and evolving.
- **Reuse `link` for profiles** (deep-link only) — rejected; it wouldn't be a real
  in-room experience and fails the "interact without leaving the room" goal.
- **Embed a real payment/booking backend** — out of scope by product constraint;
  redirect/iframe only.

### Consequences
- (+) Objects are genuinely useful; a room reads as "an interactive world."
- (+) Back-compatible: jsonb absorbs the shape; pre-V3 objects still work.
- (+) The action set stays a closed, enumerated contract (now 10 types).
- (−) Visitor panels load third-party embeds/images (YouTube, Vimeo, Calendly,
  favicons, sample images) — external requests outside AI Bazaar's control.
- (−) `RoomActionData` is a permissive union; helpers (not types) enforce which
  fields matter per action.

---

## ADR-012 — Multi-room houses: a HouseRooms wrapper with a single entry pointer

**Status:** Accepted · 2026-06-17

### Context
Through V3 a house was exactly one `Room`, stored per address. V4 makes a house a
set of connected rooms a visitor explores via doors/stairs — without a visual
redesign, without losing any layout saved in V1–V3, and keeping the room object
model unchanged (spec §10 reserved this).

### Decision
- **Wrap rooms in a `HouseRooms { shopAddress, entryRoomId, rooms[] }`.** The
  per-room model is unchanged (each `Room` keeps its own zones/objects); the house
  just owns the set + which room is the entry.
- **Entry is a single `entryRoomId` pointer**, not a per-room `isEntryRoom` flag —
  one source of truth, so a house can never have zero or two entry rooms. (The SQL
  mirror uses a `rooms.is_entry` flag with a partial unique index per shop.)
- **Migrate legacy saves on read, same `ai-bazaar-rooms` key.** A stored value
  that is a single `Room` is wrapped into a one-room house (that room becomes the
  entry) by `getStoredHouse`. No key rename (which would silently wipe state), no
  data loss. Back-compat single-room store helpers operate on the entry room.
- **Doors/stairs are real asset categories** (`door`, `stairs`) with a new
  `room_link` action whose `actionData.targetRoomId` names the destination.
  Navigation is **client-side, instant, no URL change** — room state lives in the
  public component (a breadcrumb trail), so deep-linking/SSR is unaffected.
- **House-level validation as no-ops** (`lib/house.ts`): keep ≥1 room, empty a
  room before deleting, reassign entry + clear dangling door links on delete,
  regenerate colliding ids, treat unknown link targets as inert.

### Alternatives Considered
- **Per-room `isEntryRoom` boolean** (as first drafted) — needs invariant policing
  to keep exactly one true; rejected for the single pointer.
- **A new `ai-bazaar-houses` storage key** — clean, but silently discards V1–V3
  layouts; rejected in favour of migrate-on-read.
- **Reuse `structure` for doors/stairs** (action only) — smaller change, but
  doesn't model navigation objects as their own categories; rejected per the
  sprint's intent.

### Consequences
- (+) Real "explore a house" UX; the room object model and renderer are untouched.
- (+) Zero data loss; the SQL `rooms`/`room_objects` tables already supported many
  rooms, so the mirror needed only `description` + `is_entry`.
- (+) Whole-house undo/redo and autosave fall out of moving editor history to
  `HouseRooms`.
- (−) The editor is now house-aware (active-room concept, room manager) — more
  state than the single-room editor.
- (−) Room navigation state is client-only; a deep link can't target a specific
  inner room yet (visitors always start at the entry room).

---

## ADR-013 — Richer objects as CSS treatments around existing icons; backgrounds as shell recolours

**Status:** Accepted · 2026-06-18

### Context
Through V4 every object rendered as the same parchment **icon tile**, and the room
shell was a single fixed look. V5 had to make objects visually richer / more
place-like and add room background variety **without** redesigning the village,
houses, palette, typography, or art direction — and without regressing the drag/
resize/rotate/select behaviour built in V2–V4.

### Decision
- **Objects are CSS treatments wrapping the existing lucide glyph**, not new art
  files or bitmap sprites. A pure `objectVisual(assetId, category)` maps an asset
  to a visual *kind* (frame / screen / shelf / desk / card / portrait / certificate
  / board / door / stairs / plant / rug / seat / tile); the renderer draws that kind
  in the existing warm palette. Frames show the object's first gallery/product
  image when it has one. The fallback is the original tile, so anything unmapped
  still renders.
- **Behaviour is preserved by layering**: the sprite fills the object box
  (`size-full`) inside the same interactive shell that still carries the selection
  ring, hidden state, interactive cue, tooltip, resize handles, rotation transform,
  and `data-object-id`/`data-resize-handle` hooks. Hit area and handles are
  unchanged.
- **Backgrounds recolour the existing shell**, they are not new scenes:
  `ROOM_BACKGROUNDS` is a small map of palettes (wall colour + a soft mood tint)
  applied via the `--room-wall` CSS variable and one overlay div. Stored in the
  existing `room.background` text field — **app-defined keys, no enum, no
  migration**. Owners pick one; new/preset rooms default by room type.
- **Labels become engraved nameplates** at the object base (museum-placard
  style) rather than floating pills — "natural", per the brief.
- **Rotation** reuses the model's existing `rotation` field and the V2 live/commit
  interaction pattern; no schema change.

### Alternatives Considered
- **Hand-built inline SVG sprites per category** — more distinctly illustrated, but
  far more visual-design surface and higher regression risk against the drag/
  resize/rotate hit areas; rejected for the lower-risk CSS-framing approach.
- **Background as a new enum / theme system** — unnecessary; `room.background`
  already exists as free text, so variants are app-defined with zero DB work.
- **Deriving background purely from room type** — less owner control; chose an
  explicit picker that *defaults* by type.

### Consequences
- (+) Rooms read as composed places (framed art, screens, shelves, doors) while the
  art direction, palette, and village are untouched; no new assets to maintain.
- (+) No schema/migration; backgrounds and rotation ride existing columns.
- (+) Pure `objectVisual` / `roomBackground` are unit-tested and deterministic.
- (−) Visual richness is bounded by what CSS-around-an-icon can express (not true
  per-asset illustration).
- (−) Resize-handle math remains axis-aligned, so resizing a heavily rotated object
  is approximate (pre-existing; rotation UI makes it more reachable).

---

## ADR-014 — Repository layer + env-derived runtime mode for the Supabase cutover

**Status:** Accepted · 2026-06-19

### Context
AI Bazaar has always run as a localStorage demo (ADR-003) with a production-parity
SQL mirror (ADR-004) that is never executed at runtime. Moving to a real Supabase
backend must be possible **without breaking demo mode** and without a risky
big-bang rewrite of every component that reads/writes state.

### Decision
- **Backend mode is derived from env, not a feature flag.** `lib/runtime-mode.ts`
  returns `"production"` only when both `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` are present, else `"demo"` — matching how the
  Supabase clients already null out. A dev-only badge surfaces the current mode.
- **A repository layer is the cutover seam** (`lib/repos/*`), mirroring the existing
  `getImageStorage()` factory. Async interfaces (houses/rooms/room objects/profiles/
  events/reports) are implemented twice: `local.ts` delegates to the existing demo
  libs (no behaviour change); `supabase.ts` are typed stubs that throw
  `NotImplementedError`. `getRepositories(mode?)` picks by runtime mode.
- **Interfaces are async** so the same contract fits both the synchronous demo
  (wrapped in `Promise.resolve`) and real network I/O later.
- **Prep does not rewire the app.** Components keep calling the demo libs directly;
  the repo layer is introduced unused, so demo mode is provably unchanged and the
  cutover becomes an incremental, per-repo swap.
- **Migrations stay append-only** (ADR-009). The audit found the migration chain
  can't build from an empty DB (baseline tables/types live only in `schema.sql`);
  the resolution is to **apply `schema.sql` for a fresh DB** and treat migrations as
  incremental patches — documented in `docs/supabase-cutover.md` rather than
  rewriting history.

### Alternatives Considered
- **A feature flag for the backend** — rejected; presence of credentials is the
  natural, fail-safe signal (no flag can make a keyless app talk to Supabase).
- **Rewrite components onto Supabase directly** — rejected; high risk, no demo
  fallback, and couples the cutover to a single deploy.
- **Author a from-zero baseline migration now** — deferred; out of prep scope and
  would duplicate `schema.sql`. Tracked as future work.

### Consequences
- (+) Cutover (and rollback) is a config action: set/unset env vars. A single repo
  can switch to Supabase while others stay local (staged rollout).
- (+) Demo mode is untouched and the seam is unit-tested (mode detection, selection,
  file presence).
- (−) Two implementations per repo to maintain once Supabase is wired; the stubs are
  currently dead code that must be filled in before production.
- (−) The repo layer is not yet consumed by components, so adopting it later is a
  follow-up refactor.

---

## ADR-015 — AI Room Designer: a deterministic, selection-only recommender

**Status:** Accepted · 2026-06-20

### Context
ADR-006 committed to an asset-library-first AI strategy and room-engine-spec §11
reserved an "AI room designer" that **selects and arranges existing catalog assets
— never generates visuals**. The AI Room Designer V1 sprint had to deliver that:
turn a natural-language brief ("create a cozy reading room") into a furnished room,
with a hard constraint of **no image generation and no external/LLM APIs** of any
kind, and the requirement that it be deterministic and testable.

### Decision
- **A pure, rules-based engine** (`lib/ai-room-designer.ts`), no provider calls.
  Three composable, individually-tested stages: (1) `matchIntent(brief)` scores the
  brief's tokens against an ordered table of design **intents** (keyword lists →
  room kind, background, preferred assets/tags/actions), with a trailing
  always-matching `personal` fallback; (2) `scoreAssets(intent, style, variant)`
  ranks the **room-ready catalog assets** by core-asset rank + tag overlap +
  category/action fit + style affinity; (3) `generateRoomDesign` composes the top
  picks into a room.
- **Composition reuses the existing placement pipeline** (`createRoom` +
  `addObjectFromAsset`), so every generated room is valid **by construction** —
  zone/category/capacity/bounds rules are never re-implemented or bypassed, and an
  asset that can't be placed is simply skipped. Navigation assets (door/stairs) are
  excluded — a single generated room has no link targets.
- **Determinism with controlled variety via a `variant` integer.** Identical input
  (brief, style, roomType, variant) always yields the identical room and the
  identical explanations. "Regenerate" bumps `variant`, which feeds a deterministic
  per-asset hash jitter that reshuffles **near-ties only** (it never overrides a
  strong intent match) — fresh-but-reproducible layouts, fully unit-testable. (As
  everywhere in the engine, object **ids** still carry a timestamp; equality is
  asserted on assetIds/zones/labels, not ids.)
- **Preview-before-apply, replacing the active room.** The studio **Design** mode
  (`components/room/room-designer.tsx`, flag `ENABLE_AI_DESIGNER`) shows the
  proposal next to the current room; **Apply** replaces the selected room's
  contents (objects/type/background/name) via `saveHouse`, keeping the room's id
  and house identity intact, so multi-room houses and door links are undisturbed.
  Nothing persists until Apply.
- **Explanations are generated from the same scoring data** (matched keywords,
  chosen background, style, per-pick reason) — no second source of truth.
- **Analytics as enum-value additions** (`room_design_generated/applied/
  regenerated`), committed alone in `20260620_extend_enums.sql` (ADR-009); no table
  change since the designer only composes existing `Room`/`room_objects` shapes.

### Alternatives Considered
- **Call an LLM / image model to design or render the room** — rejected outright by
  the product constraint (ADR-006) and the sprint brief; also non-deterministic and
  untestable. The catalog is the source of truth.
- **A new free-form placement path for generated rooms** — rejected; routing
  through `addObjectFromAsset` guarantees validity and keeps one placement code path.
- **Non-deterministic randomness for "regenerate"** (e.g. `Math.random`) — rejected
  for hydration-safety/testability (ADR-008); the `variant`+hash approach gives
  variety while staying pure and reproducible.
- **A standalone `/design` route** — rejected in favour of a studio **Design** mode,
  keeping it in the owner-editing context next to the manual editor.

### Consequences
- (+) A genuinely useful "describe it and see it" designer that is on-brand,
  deterministic, and fully unit-tested; it can later sit behind a real model
  without changing the contract (the model would only propose intents/picks).
- (+) Zero risk to saved rooms or the renderer — output is an ordinary `Room`;
  Apply is the only mutation and it preserves room identity.
- (+) No schema change beyond three analytics enum values; demo mode is otherwise
  untouched.
- (−) Design quality is bounded by **catalog breadth** and the hand-authored intent
  table; new themes/assets mean editing the intent/scoring tables (tracked as the
  P1 "asset ecosystem expansion").
- (−) The `variant` jitter only reorders near-ties, so on a brief with one dominant
  intent, regenerate produces modest variety rather than dramatically different rooms.

---

## ADR-016 — AI Room Designer V2: layered brief parsing, a constraints engine, and SQL-backed drafts

**Status:** Accepted · 2026-06-21

### Context
ADR-015 shipped a deterministic, selection-only designer that maps a brief to a
single *intent* and composes a room. V2 had to make it feel more intelligent —
understand creator type, mood, purpose, and explicit constraints ("no plants",
"only 4 objects", "show booking"), let owners keep multiple **drafts**, and offer
one-click **creator presets** — all while keeping the hard constraints (no real
AI, no image generation, no external APIs) and **not breaking the V1 contract**.

### Decision
- **Parsing is a new pure layer on top of the V1 intent, not a replacement.**
  `parseBrief()` returns a structured `{ creatorType?, mood?, purpose?, constraints }`
  via ordered keyword tables (first match wins — deterministic). `generateRoomDesign`
  now: picks the intent from the detected creator type when present (else the V1
  `matchIntent`), derives style from mood when none is supplied, then applies
  constraints. V1's `matchIntent`/`scoreAssets`/`variant` determinism is untouched,
  so all V1 tests keep passing.
- **Constraints are applied as score boosts + an exclusion filter + a count cap,
  never as a new placement path.** Excluded categories/actions are filtered out of
  the ranked candidates; purpose / show-X flags add deterministic score boosts
  (e.g. desk → booking, product shelf for selling); "minimal" and "max N" tighten
  the target count. Placement still routes through `addObjectFromAsset`, so the
  room remains valid by construction (spec §6/§9) and the engine can never emit an
  invalid room from a hostile brief.
- **Drafts get full SQL parity** (ADR-004), not a demo-only exception. A new
  owner-private `room_design_drafts` table stores the generated room + brief/style/
  intent/constraints as jsonb, with `owns_shop` RLS; the demo mirror is
  `lib/room-design-drafts.ts` on `ai-bazaar-design-drafts`. The generated room is
  stored whole (jsonb) so a draft is a self-contained snapshot, independent of
  later catalog/intent changes.
- **History is session-only (in-memory), drafts are the persistence mechanism.**
  The "recent designs" list lives in component state; anything worth keeping is
  saved as a draft. This avoids a second persisted store/ànalytics surface for
  what is largely ephemeral working state.
- **Presets are pure data** (`CREATOR_PRESETS`: brief + style) that drive the
  existing generate path — no special-case generation.
- **Analytics as enum-value additions** (`room_design_draft_saved/draft_applied/
  constraint_detected/preset_used`), committed in `20260621_01` before the
  `20260621_02` table migration (ADR-009). The V2 UI reuses the `ENABLE_AI_DESIGNER`
  flag rather than adding one.

### Alternatives Considered
- **Replace the V1 intent model with the parser** — rejected; layering keeps V1
  deterministic and back-compatible and avoids re-tuning the whole asset scorer.
- **Demo-only drafts (no table)** — considered (the sprint said "if appropriate"),
  rejected to honour the strict two-layer rule; drafts are owner data worth
  modelling in Postgres with RLS.
- **A separate persisted history log (with its own table/events)** — rejected as
  over-engineered; drafts already cover durable persistence and history is a
  convenience list.
- **Hard-failing on impossible constraints** (e.g. "no plants" in a garden) —
  rejected; constraints degrade gracefully (filter what's possible) rather than
  refusing to produce a room.

### Consequences
- (+) Briefs feel understood (creator/mood/purpose/constraints surfaced and
  respected); presets and drafts make the tool faster to use and iterate with.
- (+) Fully deterministic and unit-tested; the V1 contract and tests are intact.
- (+) Drafts are production-ready (table + RLS), consistent with every other
  feature.
- (−) The keyword tables are hand-authored — new vocabulary/creator types mean
  editing `parseBrief`/intent maps (shares the V1 "catalog/vocab breadth" ceiling).
- (−) One more owner-scoped table + RLS policy to test live during the Supabase
  cutover; `room_design_drafts.room` is denormalised jsonb (a snapshot), so a draft
  won't reflect later edits to the live room — intended, but worth noting.

---

## ADR-017 — Creator Auto Build: a deterministic, no-scraping profile analyzer that feeds the existing designer

**Status:** Accepted · 2026-06-22

### Context
V3 had to let a creator generate a room from their **online identity** (Instagram,
TikTok, YouTube, website, bio) while keeping every prior constraint: no real AI, no
image generation, no external APIs — and, critically, **no scraping** of those
profiles. The challenge is extracting useful signal from URLs the app must not fetch.

### Decision
- **Analyze the strings, never the network.** `lib/creator-analyzer.ts`
  `analyzeCreator()` derives signals purely from what the user typed: usernames
  (first URL path segment), domain words (hostname minus www/TLD, split on
  separators), and bio text. No `fetch`, no headless browser, no API. Fully
  deterministic and unit-testable.
- **Reuse the V2 vocabulary and designer.** The analyzer runs the existing
  `parseBrief` over a corpus (bio + handles + domain words) to get creator type /
  mood / purpose, with **platform fallbacks** (YouTube→podcaster, Instagram→
  photographer, TikTok→personal) and a `personal` last resort. Room building goes
  through the existing `generateRoomDesign()` — V3 adds no second generator.
- **Augment, don't fork, the room.** `generateCreatorRoom()` trims the base design
  to a small budget, then adds an **about-me profile object** and **one `link`
  object per supplied platform** via the standard `addObjectFromAsset` (so the room
  stays valid and overflow is skipped, not forced). One object per platform matches
  the sprint's intent and the existing action system — **no new room mechanics**.
- **Extend `CreatorType` with `consultant` and `personal`** to cover the sprint's 12
  types as first-class values (keyword tables ordered so the V2 "coach and
  consultant"→coach test still holds; `personal` uses specific signals only).
- **Confidence is a transparent function of signal count** (links + bio + whether a
  keyword type/purpose was found), surfaced as a percentage — explainable, not a
  black box.
- **Welcome message is a deterministic template** stored in the existing
  `room.description` field (no schema change). Apply was fixed to persist
  `description` so the message survives.
- **Analytics as enum-value additions** (`creator_profile_analyzed`,
  `creator_room_generated`, `creator_room_applied`, `creator_social_object_created`)
  in `20260622_extend_enums.sql` (ADR-009). **No new table** — creator rooms are
  ordinary Rooms and drafts reuse `room_design_drafts`. Reuses `ENABLE_AI_DESIGNER`.

### Alternatives Considered
- **Scrape/fetch the profiles for real signal** — rejected outright (sprint
  constraint, privacy, non-determinism, network in a demo). String analysis is
  enough for a useful, testable heuristic.
- **A combined contact object holding all socials** — rejected in favour of one
  object per platform (the sprint's literal ask, and more discoverable in-room).
- **Analyzer-only creator types mapped to the existing 10** — rejected in favour of
  extending the union, so all 12 are first-class and consistent across the designer.
- **A dedicated creator-room generator** — rejected; reusing `generateRoomDesign`
  keeps one composition/validation path.

### Consequences
- (+) "Paste your links → get a room" with auto socials, an about-me, and a welcome
  line; deterministic, explainable (confidence + rationale), and fully unit-tested.
- (+) No scraping/API/schema-table surface; reuses the designer, drafts, and flag.
- (+) The 12 creator types are now first-class across V2 + V3.
- (−) Signal quality is bounded by what URLs/bios literally contain — a cryptic
  handle yields low confidence and a platform-based guess (by design).
- (−) The base design is trimmed to make room for auto objects, so a creator room is
  intentionally leaner than a pure brief design; heavy multi-platform inputs can hit
  zone capacity and silently skip the lowest-priority objects (graceful, but worth
  noting).

---

## ADR-018 — Production Cutover V1: unified session, mode-selected repos/storage, jsonb room persistence

**Status:** Accepted · 2026-06-23

### Context
The seam from ADR-014 (runtime mode + repository layer + Supabase stubs) needed to
become real for a pilot: actual Supabase auth, profiles, and room persistence —
**without breaking demo mode** (ADR-003) and using only the **anon key under RLS**
(no service role). The live project exists but its schema was not yet applied, and
the room model (string ids, `ast-*` asset keys) doesn't fit the normalized
`rooms.id uuid` / `room_objects.asset_id uuid` shape.

### Decision
- **One unified, mode-aware session** (`lib/auth/*` + `AuthProvider`/`useSession`).
  `DemoAuthClient` keeps the existing `ai-bazaar-user` localStorage session
  (passwordless, as before); `SupabaseAuthClient` wraps Supabase email+password.
  `DemoProvider` now *derives* its `user` from the session and delegates
  login/logout, so the dozens of `useDemo().user` consumers are untouched. This
  beats a parallel provider (two sources of truth for "who's signed in").
- **Mode selects the implementation everywhere** via small factories that mirror
  each other: `getAuthClient()`, `getRepositories()`, `getImageStorage()`. Runtime
  mode (env presence) stays the single source of truth; rollback is unsetting env.
- **Supabase repos resolve their client lazily.** Constructing a repo never
  requires env (so selection is testable and the factory never throws); the client
  is needed only when a method runs. Only `profiles`/`houses`/`rooms`/`roomObjects`
  are implemented; `events`/`reports` stay `NotImplementedError` (scope).
- **Rooms persist as a jsonb snapshot on the `rooms` table** (`client_id` = app
  room id, `objects` = jsonb), not normalized `room_objects` rows. This preserves
  the full Room Engine V5 model (objects, action_data, rotation, backgrounds, room
  links, multi-room, descriptions) with pure, tested mappers and **no room-engine
  redesign**, sidestepping the uuid/asset-key impedance. Normalized `room_objects`
  rows are retained for future analytics.
- **An async house-store seam** (`lib/house-store.ts`) is what components call; in
  demo it routes through the local repo → the same `lib/room.ts` → identical
  behavior. This is the first real adoption of the repo layer by the UI.
- **Onboarding reuses V3** (`creator-analyzer`) rather than a second system, and
  works in demo so it's verifiable without a backend.
- **Subdomain is a pure host parser + a middleware rewrite** to the existing
  `/u/<handle>` route — no new pages, no DNS this sprint.

### Alternatives Considered
- **Parallel Supabase auth provider** beside DemoProvider — rejected (duplicate
  session state); unified abstraction chosen.
- **Normalized `room_objects` rows + an `asset_key`/uuid bridge** — more faithful
  to the schema but a larger migration and a redesign risk against `asset_id uuid`;
  deferred. jsonb snapshot is the pragmatic V1.
- **Eager repo client construction** — made selection throw without env and broke
  testability; rejected for lazy resolution.
- **Applying the schema from the app** — impossible/again-scoped-out with anon-only
  access; made a staging-checklist step instead.

### Consequences
- (+) Real auth + profiles + room persistence in production behind one env flag;
  demo is unchanged and remains the verified path; rollback is config-only.
- (+) Pure mappers + lazy repos are unit-tested (168 tests); factories are uniform.
- (−) **Production DB persistence is unverified** until the schema is applied to the
  project (anon key can't run DDL) — documented, not claimed.
- (−) jsonb room storage diverges from the normalized `room_objects` table (two
  shapes coexist); revisit if per-object querying is needed.
- (−) `events`/`reports` Supabase repos remain follow-ups; `/u/[handle]` aggregate
  (`getByHandle`) returns null in production V1.
- **Update 2026-06-23:** production **shop claiming** is now implemented
  (`lib/shop-claim.ts`: `claimShopInSupabase` + `getShopByAddress`) and the **full
  authenticated flow is verified live** on staging (account → onboarding → claim →
  save → reload → persist → logout → login → persist; RLS holds).

---

## ADR-019 — Pilot hardening: shared validation, centralized friendly errors, internal funnel, draft legal pages

**Status:** Accepted · 2026-06-24

### Context
Before letting real (friends & family) users in, the app needed reliability/safety
polish — not features. Risks: raw Supabase errors leaking to users, double-submits,
missing input limits, no legal/trust pages, and no first-run funnel measurement.

### Decision
- **One shared validation module** (`lib/validation.ts`) holding the limits + checks,
  aligned with the DB CHECK constraints, so UI/demo/repos agree. Enforced at the
  highest-leverage inputs; pure + tested.
- **Centralized error mapping** (`lib/errors.ts` `friendlyError(err, context)`):
  users see short calm copy; developers keep the raw error via `console.error`. This
  satisfies "no raw Supabase errors to users" while preserving debuggability, and
  keeps copy consistent instead of ad-hoc per call-site.
- **Internal-only funnel analytics** reusing the existing `trackEvent`/`event_type`
  enum (4 additions; `public_room_viewed` reuses `room_view` to avoid duplication).
  **No external analytics** during pilot. Events remain client-side (the Supabase
  events repo is still a stub) — accepted limitation, documented in
  `docs/analytics-plan.md`.
- **Draft legal/trust pages** as plain static placeholders behind a shared
  `LegalPage`, clearly marked draft, linked in the footer — explicitly not real
  legal documents.

### Alternatives Considered
- Per-call-site error strings — rejected (inconsistent, leak-prone).
- A third-party analytics SDK — rejected for pilot (privacy + scope).
- Building the Supabase events repo now — deferred; out of "no new infra" scope.

### Consequences
- (+) Calm, consistent UX on failure; safer inputs; measurable funnel; trust pages.
- (+) Demo + production unchanged in behavior; all additive.
- (−) Funnel data is per-browser until the events repo is wired (post-pilot).
- (−) Validation is enforced at key inputs, not exhaustively every field yet.

---

## ADR-020 — Analytics + Discovery V1: mode-aware durable analytics, event-derived visitor sessions, and seed-backed discovery ranking

**Status:** Accepted · 2026-06-25

### Context
Analytics were `trackEvent` → localStorage only (per-browser, lost on device
change); the `SupabaseEventsRepository` was a stub. There were no visitor sessions,
no unique-visitor / session-duration metrics, and discovery was search + tags only.
This sprint had to make analytics **durable**, add **anonymous visitor sessions**, a
**creator insights dashboard**, **per-object + funnel** analytics, and a first
**creator-discovery** layer — without redesigning villages/rooms/onboarding and
keeping demo mode byte-for-byte unchanged (ADR-003/ADR-004/ADR-014).

### Decision
- **`trackEvent` becomes mode-aware, not a new API.** Demo still writes localStorage;
  production routes through `getRepositories().events.record()` (the now-implemented
  `SupabaseEventsRepository` → `record_event` RPC). A remote failure **mirrors locally
  and logs once**, so durability never costs data or floods logs. The local writer
  (`trackEventLocal`) is split out so the local repo and the production fallback share
  it without an import cycle (the repo is reached via a dynamic import).
- **Visitor identity is opaque and event-derived.** `lib/visitor-id.ts` holds the
  ids + storage (no deps, so `events.ts` can enrich every event and
  `visitor-session.ts` can own the lifecycle without a cycle). The **event stream is
  the source of truth** for the funnel — each event carries `visitorId`/`sessionId`
  in the `events.metadata` jsonb — so demo and production share **one aggregation
  path** (`lib/creator-insights.ts`). A `visitor_sessions` table is the normalized
  SQL mirror (parity), not a second runtime store.
- **One pure insights module** computes the dashboard, object analytics, and funnel,
  keeping the UI thin and fully unit-tested. The dashboard reads events through the
  repo (durable in production, local in demo) + the saved house for labels.
- **Creators can read their own analytics** via a new `owns_shop(shop_id)` SELECT
  policy on `events` (previously admin-only). Discovery stays public and does **not**
  read the events table client-side (RLS forbids anon reads); Featured Nests rank from
  **real stored data** — recorded `house_view`s / last activity in the local mirror,
  **falling back to the seeded `shops` data** (visitors/likes/createdAt) so rails are
  always populated. A global production trending feed (a public aggregate view) is
  deferred.
- **Enum additions follow ADR-009** (`_01_extend_enums` before `_02_analytics`); the
  room object/`Room` model is untouched (no spec change).

### Alternatives Considered
- **A second `recordEvent` API + migrating call sites** — rejected; making
  `trackEvent` mode-aware preserves the existing API and avoids churn.
- **A dedicated `visitor_sessions` runtime store as the source of truth** — rejected
  for V1; deriving the funnel from the event stream avoids a parallel store and keeps
  one aggregation path. The table remains the normalized parity mirror.
- **Public per-shop analytics for a global trending feed** — rejected for now; would
  need a public aggregate view/RPC. Seed-backed ranking + the local mirror keep
  discovery populated and honest without exposing raw events to anon.
- **External product analytics (PostHog/GA)** — still intentionally excluded.

### Consequences
- (+) Analytics are durable in production (survive refresh/logout/device) with a
  safe local fallback; demo is unchanged; the API and 200 prior tests are intact.
- (+) Anonymous sessions + unique visitors + durations + object engagement + a funnel,
  all from one tested pure module; discovery gains a creator layer reusing existing art.
- (−) **Live Supabase persistence is still unverified** (schema not applied in this
  env; ADR-018 limitation) — durability is implemented + unit-tested with a mock
  client, and verified in demo via localStorage; not claimed against live Postgres.
- (−) Production discovery trending is seed/local-backed until a public aggregate view
  exists; `events`/`reports` aggregate reads are owner/admin-scoped by RLS.

---

## ADR-021 — Real Style Lab art via a static catalog bridge + image-first rendering

**Status:** Accepted · 2026-06-25

### Context
The Asset Factory (`apps/asset-factory/`, an isolated deployable) generates,
reviews, and approves real interior assets and persists them to **its Supabase**
(Storage `asset-candidates/interior-v1/*.png` + the RLS-locked `asset_candidates`
table; `roomEngineCatalog()` exports approved + OpenAI rows with public image URLs).
The main app's room engine, however, was at V5: it renders every object as a **CSS
sprite around a lucide icon** and **never displays an asset's own image**; its
catalog (`lib/assets.ts`) is a hardcoded array of placeholder-SVG assets. We needed
the **smallest slice** to render one room from the approved Style Lab PNGs —
without building runtime Supabase asset loading, generating assets, or touching the
Factory.

### Decision
- **Bridge via a static catalog artifact, not a runtime read (yet).** The Factory's
  room-engine catalog is committed to the main app as
  `lib/asset-catalogs/nestudio-interior-v1.json` (the Factory's `RoomEngineAsset`
  shape) and merged into `catalogAssets` through a typed loader
  (`lib/asset-catalogs/index.ts`), so `getAsset()` / `roomReadyAssets()` see the new
  assets with **zero** change to consumers. The app isolation (root tsconfig excludes
  `apps/`) is respected — we copy the exported artifact, never import across apps.
- **Image-first rendering with graceful fallback.** `room-object.tsx` renders an
  asset's real image as the object when `renderableAssetImage(asset.imageUrl)` returns
  a URL — i.e. it's present and **not** a placeholder (`/assets/placeholder/*`) or
  dry-run sample (`/samples/*`); on image **load error** it falls back to the existing
  CSS sprite. The decision is a **pure, tested helper** in `lib/room-visuals.ts`. All
  existing behavior (click, hover, selection, transforms, labels, actions, a11y, and
  the frame/gallery `actionData` image path) is preserved.
- **Generate the artifact with a secure service-role export, not a runtime read.**
  The anon key is RLS-blocked from `asset_candidates`, so a one-time Node script
  (`scripts/export-style-lab-catalog.mjs`) uses `SUPABASE_SERVICE_ROLE_KEY` to read the
  approved `style_lab` rows and write the static JSON with their **public Supabase
  image URLs**. It refuses to write rows without a public http(s) URL — **no
  fabrication / no placeholders**. Runtime Supabase asset loading (a catalog repo +
  anon-read RLS policy) is the later durability step, deliberately out of this slice.
- **A dedicated premium stage for the slice, not a production-shell redesign.** The
  Nestudio target look (mobile-first three-wall dollhouse cutaway, warm-wood floor,
  deep-green/warm wall, soft lighting + contact shadows, large readable furniture) is
  a standalone debug surface (`components/room/interior-stage.tsx` at
  `/design/interior-v1`). It does **not** modify `RoomCanvas`/`RoomExperience`, so the
  production room shell and existing rooms are untouched (no regression). Promoting
  this look into the live shell is a separate, explicit visual sprint.

### Alternatives Considered
- **Runtime Supabase read now** — rejected for this slice (RLS/policy/repo work, and
  the data wasn't reachable); it's the planned next step.
- **Fabricate Supabase URLs in the artifact** — rejected; they would 404 and the
  slice couldn't be verified. Honest local stand-ins render and prove the pipeline.
- **Import from `apps/asset-factory`** — rejected; the apps are isolated by tsconfig/
  eslint. The contract is the exported artifact.
- **Replace the CSS sprites outright** — rejected; image-first **with sprite fallback**
  keeps the 19 placeholder-only assets and any failed image working, no regression.

### Consequences
- (+) A room renders from the **28 real approved Style Lab PNGs** today, in a stage
  that matches the Nestudio premium direction; `getAsset`/`roomReadyAssets`/placement/
  validation are unchanged and existing icon-sprite rooms don't regress.
- (+) Deterministic and tested (catalog merge + public-URL assertion, helper decision,
  fixed test room, stage layout); internal debug surface at `/design/interior-v1`.
- (−) The catalog is a **committed static snapshot** of the approved assets — re-run
  the export script after the Factory approves/changes assets to refresh it. The image
  URLs depend on the Supabase public bucket staying public.
- (−) Real art loads as network images (the sprite path remains for placeholder/offline
  assets); a runtime Supabase catalog read (+ anon-read RLS) is still owed.
- (−) The current approved set is furniture-only (sofas/tables/chairs/desk) — no wall
  art / plants yet, so the slice room is furniture on a floor; broaden the pack later.

---

## ADR-022 — Template-based Nestudio visual kit for pilot (curated images, not CSS-drawn scenes)

**Status:** Accepted · 2026-06-25

### Context
The Interior V1 work (ADR-021) proved real Style Lab furniture renders well, but
repeated attempts to build a believable **room shell with CSS geometry** (clip-path
walls/floors, gradients) looked like a tunnel/box and were a dead end for pilot
quality. Product direction for the pilot: stop drawing houses/rooms with CSS;
**use curated, generated image templates** for exteriors, rooms, and (later) the
village map, with interactive assets placed on top.

### Decision
- **Introduce a visual-kit template architecture.** A shared `VisualTemplate` base
  (`id, name, imageUrl, width, height, styleFamily, personalityTags,
  compatibleUseCases, safeArea, placementZones, version`) with `RoomShellTemplate`,
  `ExteriorShellTemplate`, and a reserved `VillageTileTemplate` extending it
  (`lib/types.ts`).
- **Layered rendering.** A template is a **non-interactive background image**;
  interactive assets (real furniture PNGs) are layered on top at the template's
  calibrated `placementZones`. Furniture stays **image-first with fallback**
  (ADR-021). The existing room engine (zones/validation, `RoomCanvas`,
  `RoomExperience`) is **untouched** — classic/icon rooms don't regress.
- **Static registries, no runtime Supabase yet.** Templates register in
  `lib/templates/room-shells.ts` and `lib/templates/exterior-shells.ts` (village
  tiles later). The pipeline is Asset Factory → review → export image + calibration
  → register. The committed shell SVGs are **temporary placeholders**; swapping in a
  generated final image is a one-line `imageUrl` change + recalibration + `version`
  bump.
- **Redefine the AI design engine's role** as *choose a template + place assets*
  (by `styleFamily`/`personalityTags`/`compatibleUseCases`), not synthesize a scene.
  This keeps it deterministic, on-brand, and curated (consistent with ADR-006).
- **Scope:** architecture + one room shell + one exterior shell + two debug pages
  (`/design/interior-v1`, `/design/exterior-v1`). No procedural generation, no full
  designer, no extra shells this sprint.

### Alternatives Considered
- **Keep iterating on CSS-drawn shells** — rejected; quality ceiling too low and
  per-scene CSS is unmaintainable. Images are the right medium for curated quality.
- **Runtime Supabase template loading now** — deferred; a static registry unblocks
  the pipeline without RLS/repo work. Same staged approach as the asset catalog.
- **One monolithic template type** — rejected; room vs exterior carry different
  calibration (floor/wall/lighting vs door/sign), so they extend a shared base.

### Consequences
- (+) A clean, typed pipeline ready for the Asset Factory to fill with generated
  templates; the app composes images + assets instead of drawing scenes.
- (+) Existing app flow (village, my place, studio, room/design/exterior/classic
  interior) and icon rooms are unaffected; the kit is additive.
- (−) Template quality now depends on Asset Factory output; the committed SVGs are
  placeholders until real generations land.
- (−) Calibration (`placementZones`) is hand-tuned per template — generating many
  shells means producing calibration alongside each image.

---

## ADR-023 — Wall-first architecture: walls are the primary creator object; rooms are composed

**Status:** Accepted · 2026-06-22 · refines (does not supersede) ADR-021/022; holds ADR-006.

### Context
The product had been optimizing for **asset-first room design** (creators arrange furniture;
we generate + hand-calibrate a growing library of room shells). Review of product direction
and mobile UX concluded Nestudio is a **creator identity platform**, not interior-design
software — and our own [scene-calibration §9](nestudio-scene-calibration.md) scale finding
showed per-shell manual calibration breaks at 100k+. The most valuable object is a **Wall**
(the creator's story surface), not a sofa or a shell.

### Decision
- **Model:** `Creator → Walls → Room → House → Village`. **Walls** are the primary, *container-
  independent* creator object; **rooms/houses are generated containers**; **village is discovery**.
- **Separate CONTENT (walls) from CONTAINER (room).** A Wall = a typed content surface
  (Portfolio/Video/Bio/Links/Product/Music/Book/Achievement/Life) reusing the existing **11
  action types** + **`RoomActionData`** schema. Rooms are **composed** around walls.
- **The room becomes a composition engine.** Re-point the existing deterministic, selection-only
  **AI Room Designer** to compose a room around the creator's walls on **one canonical container**
  (Golden Interior Shell #1) + AI-selected furniture/decor/lighting — instead of generating and
  calibrating many shells. O(1) container calibration vs an O(shells) treadmill.
- **Zoom is a first-class concept:** room view ↔ wall view (immersive camera move, upgrading the
  shipped `object-action-modal`), game-like and mobile-native.
- **Furniture is demoted to supporting cast** (AI-selected dressing), de-risking the furniture-only
  asset gap. The free-drag room editor is **demoted to optional "customize."**
- **Additive, flag-gated, demo-by-default, reversible.** The composer outputs ordinary
  `Room`/`HouseRooms`, so persistence, the layered renderer, public experience, and village are
  unchanged; flags off = today's app. Existing content-objects migrate to walls on read.

### Alternatives Considered
- **Asset-first (status quo)** — rejected: optimizes a niche, low-shareability craft and an
  unscalable calibration treadmill.
- **Rewrite the engine for walls** — rejected/unnecessary: walls are an *elevation* of shipped
  primitives (action types + `RoomActionData` + the three wall zones + the AI designer).

### Consequences
- (+) Faster creation (define walls → AI composes), stronger identity, scalable (few containers +
  many walls), mobile-native zoom, furniture gap off the critical path.
- (+) Heavy reuse: Visual DNA, Scene Calibration, Golden Shell #1, the AI designer, action/data
  model, house/village all kept and *more* leveraged.
- (−) New UX work (the zoom experience). (−) Shell-library/exterior/tile generation and the 5-mood
  golden set are **postponed**; must resist re-opening the shell treadmill out of habit.
- Docs: [wall-first-architecture.md](wall-first-architecture.md),
  [wall-module-system.md](wall-module-system.md),
  [wall-zoom-experience.md](wall-zoom-experience.md), [creator-home-v2.md](creator-home-v2.md).

---

## ADR-024 — Object-portal model: the room is a spatial site of portals; AI builds it from connected content

**Status:** Accepted · 2026-06-22 · refines ADR-023; holds ADR-006.

### Context
ADR-023 made walls the primary creator object but framed a "wall" as a content surface. Deeper
review: a wall is a **visual interface**, not content/page/section — the content lives **behind
interactive objects**. Nestudio should behave like Linktree + personal site + portfolio +
digital home as one navigable space.

### Decision
- **The Portal is the atom:** `Portal = a visual interface (object OR wall surface) + a binding
  to a destination`. "Walls" (gallery/achievement) are **wall-surface portals**; objects
  (TV→YouTube, computer→GitHub, speaker→Spotify) are **object portals**. The room is a
  **spatial website**.
- **Three portal behaviors**, all reusing shipped action types: **jump** (external link —
  `link`/`video`/`product`/`booking`/`contact`), **zoom** (in-app content view —
  `gallery`/`profile` + the zoom UX), **room** (`room_link`). Binding reuses `RoomActionData`.
- **Creator job = connect content + upload media + choose style.** AI owns furniture, decor,
  layout, composition, atmosphere (the re-pointed deterministic designer). **A home in < 5
  min**: pick type → AI suggests a portal kit → paste links (smart URL→object detection) → AI
  composes → accept/customize.
- **Mandatory quick-links list:** every spatial home also renders a flat, accessible,
  crawlable, fast list from the same portal bindings — fixing SEO, accessibility, utility
  users, and the "I just want the link" friction.
- **Anti-treadmill restraint:** keep a small, flexible portal-object catalog (one object serves
  many destinations via binding + label); do **not** start an object-per-service treadmill.
- Recommendation: **B — connect content, AI builds rooms** (over A — build rooms), conditioned
  on the quick-links floor + low taps-to-content.

### Alternatives Considered
- **A: creators build rooms** — rejected: interior-design burden, niche, slow, abandoned.
- **A bespoke object per destination** — rejected: a smaller re-run of the shell treadmill.
- **Spatial-only (no list)** — rejected: loses to Linktree on utility, fails SEO/accessibility.

### Consequences
- (+) Fast setup, strong identity, mobile-native spatial exploration, per-portal CTR analytics
  (Linktree's value metric, spatial), heavy reuse (assets = surfaces, action types = bindings,
  designer = composer, zoom = nav).
- (−) Real risks: zoom perf on low-end mobile, in-app embeds (CSP/autoplay), URL→object
  detection long tail, accessibility/SEO of a canvas, novelty decay, link-maximalists.
  Mitigations are conditions of success (quick-links list, caps + multi-room, embed-or-preview,
  small portal catalog, reduced-motion).
- Docs: [wall-object-system.md](wall-object-system.md),
  [creator-onboarding-v2.md](creator-onboarding-v2.md),
  [spatial-link-system.md](spatial-link-system.md),
  [visitor-experience-v2.md](visitor-experience-v2.md).

---

## ADR-025 — Room → Wall → Object: the wall is a front-facing scene, not a content page

**Status:** Accepted · 2026-06-22 · refines ADR-023/024.

### Context
The V1 magical-room slice (`/design/magic-room`) validated the Portal concept but **flattened the
wall into a content page** — tapping the TV opened a list of video cards. That reads like a
profile page in a frame and loses the spatial magic.

### Decision
- **Three-level spatial model:** **Room (experience) → Wall (interface) → Object (action).** The
  **room is the experience**, the **wall is a front-facing scene** (still part of the room, with
  real objects in it — a TV is still a TV), and the **object is the action** (tap the TV → video
  plays). The wall **never becomes a generic list/grid.**
- **Navigation:** continuous zoom with a strict back-stack Object → Wall → Room; breadcrumb grows
  with depth; reduced-motion + the quick-links floor (ADR-024) preserved.
- **Object actions (Level 3)** are overlays over the wall scene: inline player, lightbox, preview-
  card→Open (external), or detail panel — reusing the shipped action types + `RoomActionData`.
- **Layout (room-layout-study):** **Room overview = dollhouse cutaway (C)** — keep the locked
  Visual DNA V1.0 / Golden Interior Shell #1 / Scene Calibration; **Wall view = a dedicated
  front-facing flat scene per wall.** Decouple the two levels so the wall can be face-on for
  readability/tap on mobile without re-opening the locked shell. Two-wall corner (A) is the
  strongest pure per-wall immersion but caps portals (~2–3) and conflicts with the locked shell —
  not adopted now.
- **No new runtime contract:** walls = wall planes, objects = placed objects with actions; the new
  thing is the wall-scene level between room and action.

### Consequences
- (+) The corrected feeling: explore a home → approach a wall → use an object; content reads
  clearly *and* stays spatial; strong mobile readability.
- (+) Reuses the locked dollhouse + the shipped action/data model; the per-wall front-facing scene
  is the only genuinely new rendering surface.
- (−) Each wall needs a composed front-facing scene (more art direction than a list); the
  room↔wall "turn to face" transition needs care to stay continuous.
- Prototype: `/design/room-wall-object-v1` (internal, mock-only). Docs:
  [room-wall-object-architecture.md](room-wall-object-architecture.md),
  [wall-experience-v2.md](wall-experience-v2.md),
  [object-portal-system-v2.md](object-portal-system-v2.md),
  [spatial-navigation-v2.md](spatial-navigation-v2.md), [room-layout-study.md](room-layout-study.md).

---

## ADR-026 — Scene Pack System: image-backed room shells + wall packs + hotspot maps

**Status:** Accepted · 2026-06-22 · **supersedes the layered-furniture path of ADR-021/022**;
preserves ADR-024/025; holds ADR-006.

### Context
Building premium rooms by placing individual furniture PNGs on a bare shell (ADR-021/022) is too
hard to make premium at scale (per-piece placement, lighting/shadow/scale all manual). The
Room → Wall → Object prototype (ADR-025) is conceptually right but its SVG/CSS-drawn graphics
aren't premium.

### Decision
Nestudio assembles premium homes from **image-backed packs**, not from many separately placed
furniture assets:
- **RoomShellPack** — a complete premium **isometric room image** (sofa, table, rug, lighting,
  shadows, atmosphere baked in) with 2–4 **neutral wall slots**. Feels like a home before any
  wall content.
- **WallPack** — a **front-facing wall-scene image** with its objects baked in; the zoom target
  for a wall slot.
- **HotspotMap** — invisible, normalized clickable rects over a baked image; map baked objects →
  **ObjectAction** (reusing the shipped action types + `RoomActionData`).
- **Combine by navigation, not compositing:** room view (iso image) → **zoom + cross-fade** →
  wall view (front image) → object action. **Do not** warp front-facing walls onto iso planes;
  keep room and wall as **separate images** authored in their natural perspective, unified by one
  light law + palette (Visual DNA) + aligned hotspots.

### Why
- **Why it replaces asset-first construction:** a generated full room image gives consistent
  lighting, correct shadows, believable scale, and the emotional "home" feeling **for free** — a
  far faster path to premium than placing dozens of furniture PNGs.
- **Why it preserves Room → Wall → Object:** the three levels are unchanged; only the *rendering*
  changes (baked images + hotspots instead of SVG shapes / layered PNGs).
- **Why it's better for premium quality:** the artist/generator composes a whole lit scene;
  the app never has to make individual assets sit together convincingly.
- **Why furniture assets become secondary:** the 28 furniture PNGs (and the layered/icon engine)
  remain for the classic/fallback path and as supporting assets, but they are **no longer the
  premium rendering primitive** — the room image is.

### Feasibility (CTO)
Feasible. Combine by navigation (not compositing); keep room/wall as separate images; generate
the **room shell first** and lock its prompt, then matching walls; prove the loop in the existing
prototype before scaling. Biggest risks: shell↔wall **consistency** (one light law/palette —
enforced by the Scene Style Lock) and **hotspot calibration drift** (needs a tool, gen-plan
Phase 5). Full analysis: [scene-pack-architecture.md](scene-pack-architecture.md) §5.

### Consequences
- (+) Fast path to premium, cohesive, mobile-friendly homes; simpler than per-asset placement.
- (+) Reuses Visual DNA, Scene Calibration (perspective/lock/negatives), the Room→Wall→Object
  model, and the action/data binding.
- (−) Hotspot calibration per pack (tool owed); heavier images (WebP/CDN/LOD); accessibility/SEO
  rely on hotspot aria-labels + the quick-links floor; a room×wall compatibility catalog.
- Docs: [scene-pack-architecture.md](scene-pack-architecture.md),
  [room-shell-pack-spec.md](room-shell-pack-spec.md), [wall-pack-spec.md](wall-pack-spec.md),
  [scene-pack-generation-plan.md](scene-pack-generation-plan.md).

---

## ADR-027 — V2 pivot: replace Room → Wall with House → Nest architecture

**Status:** Accepted · 2026-06-22 · **supersedes ADR-021, ADR-022, ADR-025, ADR-026** (and the
"Wall" framing of ADR-023/024). Master doc: [nestudio-production-pipeline.md](nestudio-production-pipeline.md).
*(The sprint prompt referred to this as "ADR-031" by example; the next sequential number in this log
is 027.)*

### Context
Multiple V1 iterations (isometric Golden Room shell + perspective-warped wall packs) validated key
assumptions and disproved others. We now know enough to pivot the product architecture.

### What we learned
- AI-generated **concept art** is excellent.
- **Front-facing cinematic scenes** create much stronger emotional engagement than isometric rooms.
- **Perspective-warping wall images** into room shells does **not** produce premium quality.
- AI-generated **room shells + wall packs cannot maintain perfect consistency**.
- **3D asset generation** is promising for future internal production, but must **not** define the MVP.
- The emotional goal is **"this place feels like me,"** not "this is a beautiful room."

### Decision
- Replace `Village → House → Room → Wall → Object → Content` with **`Village → House → Nest → Objects
  → Content`**. The user-facing **"Wall" concept is removed**.
- A **Nest** is a **front-facing cinematic scene** (full front wall + slivers of side walls + floor),
  **composed** from a curated **Nest Template** + **Scene Slots** + **Asset Library** assets + avatar +
  a few personal belongings — not generated per creator.
- **Composition becomes the primary system; AI generation becomes minimal** (concept art to seed the
  curated library; runtime generation only for avatars + truly personal belongings).
- **Scene Slots** replace perspective wall regions/hotspot bounds as the placement abstraction.
- Interactions become **Object → Animation → Content** (lightweight, reusable Interaction Library).
- The **Asset Library** is the heart of the product. The **Avatar** is just an asset in an Avatar Slot.

### Reasons
Better emotional experience · better mobile UX (front-facing, no isometric gymnastics) · simpler
interaction model · lower AI generation cost · better scalability (curate once, reuse) · stronger
creator identity ("feels like me").

### Trade-offs (honest)
- (−) Up-front investment in a **curated Asset Library + Nest Templates + Scene Slots + Interaction
  Library** (more curation, less "just generate it").
- (−) Less per-creator visual novelty than infinite generation promised — mitigated by combinatorial
  composition + personal belongings + avatar.
- (−) The V1 prototypes (isometric Golden Room, wall packs, perspective projection, scene-pack docs)
  are now reference history, not the build target — sunk effort, but it bought the validated learnings.
- (+) Consistency, premium quality, cost, and mobile UX all improve; the architecture is stable enough
  to guide years of development.

### Consequences
- Docs updated with "superseded" banners (history preserved): scene-calibration, scene-pack-architecture,
  room-shell-pack-spec, wall-pack-spec, scene-pack-generation-plan, golden-room-v1; golden-room-exploration
  reframed as validation history; visual-dna carried forward (terminology → Nest, front-facing).
- New master docs: [nestudio-production-pipeline.md](nestudio-production-pipeline.md),
  [nestudio-cto-handoff.md](nestudio-cto-handoff.md).
- No implementation in this sprint; the next sprint rebuilds the Asset Factory around the Nest architecture.

---

## ADR-028 — V2 camera lock: front-facing cinematic Nest (replaces the 30° parallel-iso Perspective Contract)

**Status:** Accepted · 2026-06-26 · refines **ADR-027**; **supersedes the ~30° parallel-isometric
Perspective Contract** of the Visual DNA (`nestudio-visual-dna.md` §11) for all V2 production.
Master doc: [nestudio-production-pipeline.md](nestudio-production-pipeline.md).

### Context
ADR-027 pivoted the architecture to **House → Nest → Objects → Content** and committed to
**front-facing cinematic Nest scenes** (pipeline §3, production-bible §4). However the locked
Visual DNA V1.0 still pinned a **parallel ~30° isometric "dollhouse" Perspective Contract** across
all layers (§11), calibrated to the 28 approved isometric furniture assets. A front-facing Nest and
a ~30°-iso asset library are **not mutually compatible** — an iso-authored asset cannot sit correctly
in a front-facing scene. The CTO architecture review flagged this as the single biggest unresolved
technical contradiction and a hard blocker for any Nest Template or asset authoring. This ADR
resolves it.

### Decision
**Nestudio V2 uses one locked front-facing cinematic Nest camera** for the entire product:
- the **full front wall** visible (fronto-parallel),
- **small slivers of the left and right walls** visible (gentle inward rake) — accent/decor only,
- the **floor** visible (slight up-tilt to meet the front wall),
- **slight room depth** — a shallow "stage box," depth without isometric rendering,
- **eye-level to slightly-elevated camera, gentle downward tilt (~5–10°)**,
- **mobile-first** composition (portrait primary; a landscape variant may share the same angles),
- **not isometric**, **not top-down**, **not ~30° parallel projection**, **no perspective-warping**
  of flat images (assets are authored *to* this camera, never warped into it).

This camera is **frozen** like any locked constant: changing it later invalidates the V2 Asset
Library, so treat it as immutable without a superseding ADR.

### Why
- **Better mobile readability** — a front wall fills a phone in portrait; no isometric gymnastics or
  corner-cropping.
- **Better emotional experience** — you feel *inside* the room facing the person's wall ("this place
  feels like me"), not looking down at a toy diorama.
- **Easier interactions** — tap targets sit on a fronto-parallel plane; object actions/overlays are
  simpler to position and read.
- **Easier animation** — lightweight transform/opacity animations on near-fronto-parallel objects,
  reduced-motion-safe.
- **Easier asset generation** — authoring to a single front-facing camera is more reliable to
  generate and approve than holding a strict ~30° parallel-iso with no vanishing point.
- **Avoids perspective warping** — the rejected ADR-027 failure mode (warping flat wall images onto
  iso planes) is structurally impossible here.
- **Aligns with House → Nest → Objects → Content** — the Nest *is* a front-facing scene by
  definition (ADR-027); the camera now matches the architecture.

### Trade-offs (honest)
- (−) The **28 approved ~30° isometric assets are no longer the production V2 standard** — they
  become **V1 reference/history** (they may inspire style, but are not authored to the V2 camera).
- (−) Some V1 work (the iso Golden Room, the Perspective Contract, iso calibration) becomes
  reference/history — sunk effort, but it bought the validated learning that front-facing wins.
- (−) The **Asset Library V2 must be authored (or re-authored) to the front-facing cinematic
  camera** before Nest Templates can be composed — this is the near-term asset cost.
- (+) One coherent camera across architecture + DNA + assets; no hidden iso/front-facing impedance
  to discover during the build.

### Consequences
- `nestudio-visual-dna.md` §11 Perspective Contract is **superseded** by this front-facing camera
  contract (the doc is updated with a banner; the iso text is kept as history). The object DNA's
  iso framing is reference-only for V2; if/when the object DNA is re-locked for V2 it must declare
  the front-facing camera version.
- The source-of-truth docs (architecture.md, roadmap.md, handoff.md) are corrected to
  **Village → House → Nest → Objects → Content** and no longer recommend wall-first (ADR-023/024)
  or Room → Wall → Object (ADR-025).
- No implementation, no Composer, no UI, no Supabase, no asset generation in this sprint (M0 is
  documentation/architecture lock only). Asset Library V2 authoring is a later sprint.

---

## Future decisions

Append new ADRs below as `ADR-0NN`. When a decision changes, add a new ADR that
**supersedes** the old one (and mark the old one `Status: Superseded by ADR-0NN`)
rather than editing history.
