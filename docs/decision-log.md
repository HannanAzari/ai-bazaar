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

## Future decisions

Append new ADRs below as `ADR-0NN`. When a decision changes, add a new ADR that
**supersedes** the old one (and mark the old one `Status: Superseded by ADR-0NN`)
rather than editing history.
