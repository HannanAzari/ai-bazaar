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

## Future decisions

Append new ADRs below as `ADR-0NN`. When a decision changes, add a new ADR that
**supersedes** the old one (and mark the old one `Status: Superseded by ADR-0NN`)
rather than editing history.
