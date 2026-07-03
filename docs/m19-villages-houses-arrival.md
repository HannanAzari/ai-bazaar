# M19 — Villages, Houses & the Arrival Experience (branch `m12-nest-platform`)

> **Preview only.** Shipped on `m12-nest-platform`. **No merge to `main`, no production deploy.**
> The first **spatial** layer — `Village → House → Nest` made real so the reaction to opening
> `hannan.nestud.io` is *"Oh, I get it"* not *"another profile page."* Built **on top** of M15–M18;
> identity, editor, publishing, discovery, and social are untouched. No house editor / no stored
> houses / no world coordinates / no marketplace / no AI. Canonical record; see
> [changelog.md](changelog.md) and ADR-039.

## Mission

> Nestudio is not a room editor. Not a social network. It is **a world made of creators and their
> tiny universes.** *"I don't visit a profile. I visit a place."*

## Phase 0 — the journeys before M19

- **Creator journey:** sign up → claim immutable `@username` + profile → Create → single editor
  (`/nest-editor`) → publish → Profile dashboard.
- **Visitor journey:** Home = immersive `DiscoveryFeed` of composed Nest thumbnails → `/nest/[slug]`
  visitor page; Explore = search/grid; `/@handle` = a flat profile hero + published Nests.
- **Where the village fit:** the top of the hierarchy was a *feed* and a creator was a *profile
  card*. `useDiscovery` already resolved creator identity + persona + a composed `doc` per Nest —
  enough to compose a **House** per creator and lay Houses into a **Village** with **zero** changes
  to identity/editor/discovery/social.

## Architecture

A **pure presentation layer** derived from existing data — no tables, no migrations, no flags,
nothing stored. Everything is deterministic (seed-driven) so it's hydration-safe + unit-testable.

```
lib/nest-house.ts     Creator → House. HOUSE_STYLES (6 cozy palettes) · personaToStyleKey ·
                      deriveHouse / houseFromItems · FNV-1a hashSeed (stable exterior variation)
lib/nest-village.ts   Houses → Village. hexSpiral (real creators centered) · axialToPixel (seeded
                      jitter) · neighborHouse (deterministic generated neighbors) · buildVillage ·
                      neighborOf (next/prev, wraps)
        │
        ▼
components/nest/village/
  house-exterior.tsx  storybook SVG cottage (glowing windows, chimney smoke when "home", trees,
                      name plate) — every variation from the House seed
  scene-backdrop.tsx  warm dawn sky + sun + drifting clouds + rolling hills (CSS/SVG, no assets)
  village-scene.tsx   pannable hex board that "descends" in on load (nest-arrive); tap → select
  house-front.tsx     the ARRIVAL panel (exterior · door plate · bio · latest peek · Enter · nav)
  enter-transition.tsx  DoorTransition — door opens + light floods → route into the Nest
  use-village.ts      discovery items → Houses (creator = one house; curated = show-homes) → Village
```

**Model:** `Creator → House → Nests` (a creator owns **one** house; their published Nests are the
**rooms** inside it). Curated example templates become enterable **show-homes**; the rest of the
neighborhood is deterministic generated neighbors (empty lots) so a fresh village still feels alive.

## What shipped (by phase)

- **1 · House model** — `deriveHouse` maps persona + handle → a `HouseStyle` + seed. Six styles
  (Cottage/Creator/Gamer/Writer/Minimalist/Garden); all warm + cozy (even "gamer" is a moody
  cottage, never RGB/voxel). No editor, nothing stored, future custom houses possible.
- **2 · Village prototype** — `/village`: a hex neighborhood (~20 houses) with real creators near the
  heart and generated neighbors filling out. Static-but-pannable; deterministic positions.
- **3 · Arrival** — the world "descends" into the village (`nest-arrive` zoom-in); tapping a house is
  a gentle "walk up" (`nest-approach`). `world → zoom → village → house → door → nest`.
- **4 · House front** — avatar · name · house exterior · bio · **Enter** button; presence ("Home"/
  "Out") + latest-nest peek. *Animal Crossing meets Linktree.*
- **5 · Enter Nest transition** — `DoorTransition`: the door opens, warm light floods, then we fade
  into the composed Nest (no instant jump). Reduced-motion safe.
- **6 · Profile evolution** — `/@handle` leads with the **House hero** (Enter Nest) over the
  preserved identity details (M16) + social (M18); published Nests read as **"Rooms in this house."**
- **7 · Discovery integration** — feed cards lead with **Visit House** + **Peek inside** (house =
  entry point, Nest = a room); grid cards gain a "Visit house" link; Home + Explore get a **Village**
  entry pill.
- **8 · Village navigation** — next / previous house + back to village (in the arrival panel; wraps).
- **9 · Differentiation** — cozy neighborhoods, soft colors, miniature architecture, warm lighting,
  storybook feeling (Ghibli town / Animal Crossing) — **not** voxel/metaverse/Web3.
- **10 · Mobile** — verified on 375×812 (below).
- **11 · Gates** — `typecheck · lint · test (389) · build` all green (Node 20).

## Verification (browser, mobile 375×812)

- **Village** renders as a cozy hex neighborhood (V1 header correctly hidden); presence dots + name
  plates; real creators wear the terracotta `@handle` plate, neighbors a soft name plate.
- **Arrival:** tap *Creator Loft* → house front (Back to village · presence · house · door plate ·
  latest peek · prev/next · **Enter Nest**).
- **Enter Nest → door transition → inside the composed Nest** (`/nest/tpl-creator-loft?c=…`).
- **`/@hannan`** (seeded local creator): house hero with bio + **Enter Nest**, then details (Follow ·
  Website/GitHub · 0/0/1) + **"Rooms in this house"** (LIVE nest card).
- **Home feed** leads the real creator with **Visit House** / **Peek inside**; curated keep
  Visit Nest / Create.
- Unknown handle → friendly **"No house here yet"** (Build your house / Visit the village).
- **No console errors** on any surface.

## Tests

- `test/nest-house.test.ts` — persona→style mapping (+ loose keyword match + fallback), `hashSeed`
  determinism, `deriveHouse` (stable seed · id/name fallbacks · enter target), `houseFromItems`
  (newest = primary, empty → null), `houseInitial`, `styleFor`.
- `test/nest-village.test.ts` — `hexSpiral` (count · uniqueness · center · determinism),
  `axialToPixel` (bounded jitter · deterministic), `neighborHouse` (deterministic · not-real),
  `buildVillage` (real-first · never drops reals · positive bounds · determinism),
  `villageFromCreators`, navigation (`houseIndex` · `neighborOf` wrap · unknown-id fallback).
- **389 total** (365 + 24 new).

## Known limitations

- **Houses are derived, not editable** — no house editor yet; the exterior is composed from the
  creator's persona/handle. Custom houses are future work.
- **The village is local per browser** — built from local discovery (published + curated). A global,
  server-side village needs the Supabase cutover (published Nests + `profiles` server-side).
- **Generated neighbors are cosmetic** — they populate the neighborhood but are empty lots (not
  enterable); only real creators + curated show-homes have a Nest behind the door.
- **`/@handle` next/prev** isn't wired across real handles (only one real creator exists locally);
  the arrival panel there offers "The village" to wander instead. The in-village overlay does next/
  prev across all houses.
- **No deep-link to a specific room** yet (a house opens to its primary/latest Nest).

## Future recommendations

- **Custom-house editor** — let creators pick/tune their House (style, palette, door plate, a few
  yard belongings) — the natural next step now that the model + renderer exist.
- **Server-side global village** — after the Supabase cutover, build the village from the real
  published set so neighbors are real creators, and support villages-by-theme/persona.
- **Richer arrival** — a true `world → zoom → village → house` camera push (parallax layers), day/
  night + weather, and a walking avatar between houses.
- **Multi-room houses in the arrival** — surface all of a creator's Nests as labelled doors/windows
  on the house front (deep-linkable rooms).

## Do not accidentally change

- **Determinism** — `hashSeed` + seeded jitter must stay pure (no `Math.random`/`Date.now`) or the
  village reshuffles across renders/SSR and hydration breaks.
- **The House/Village are derived** — they store nothing and add no schema; keep them a pure
  presentation layer over discovery, so identity/editor/publishing/social stay the source of truth.
- **`/village` is in `NEST_APP_PREFIXES`** (`components/site-header.tsx`) so the legacy V1 header
  stays hidden on the immersive village.
