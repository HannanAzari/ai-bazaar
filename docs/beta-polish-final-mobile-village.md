# Beta Polish Final — Mobile Layout & Village Globe (branch `m12-nest-platform`)

> **Preview only.** Shipped on `m12-nest-platform`. **No merge to `main`, no production deploy.**
> **Visual / mobile polish only — no features; no backend, auth, publishing, social, or editor
> logic changed.** Canonical record; see [changelog.md](changelog.md).

## What changed

### 1. Village — a curved little world
`components/nest/village/village-scene.tsx` was reworked so the beautiful sky is no longer buried
under the ground. The **living sky** (sun/moon, stars, birds, weather) now fills the **upper half**;
the **ground is a soft globe limb** across the **lower half** (~56% of the viewport), with a **convex
clipped horizon** + **curved lanes** + **limb shading** that read as a small planet — **2.5D CSS/SVG,
no 3D, no Three.js, no new libraries.**
- Houses ride **three curved lanes** (front row closer + larger + fully lit; back rows smaller +
  hazier), laid on a wide **strip you orbit left↔right** — houses drift off one edge as others emerge.
- Real creators take the leading columns; the orbit **settles on the first real house**.
- The ground reuses **`VillageTerrain`** (grass valley, road, greenery) via a synthetic strip-sized
  village, so Beta Polish 2 realism + the time-of-day/weather relighting are preserved.
- **Zoom-into-arrival** (tap a house → camera pushes toward it, neighborhood softens) is unchanged;
  the viewport is measured with a `ResizeObserver` so the dome tracks orientation/resize.

### 2. Bottom gaps removed
The empty cream strip between content and the BottomNav is gone on the three surfaces that showed it:
- **Home feed** (`app/home/home-client.tsx`) — the feed now runs **full-bleed to the viewport edge**
  under the translucent nav (no bottom reserve); each card lifts its own controls clear of the nav.
- **Village** (`app/village/village-client.tsx`) — the curved ground runs to the viewport edge; the
  translucent nav floats over it.
- **House arrival** — the arrival overlay lost its bottom reserve, so the sky fills to the bottom.

### 3. Home feed card cleanup (Reels-style, room-first)
`components/nest/app-shell/discovery.tsx` `FeedCard`:
- The **heavy dark block** over the room is gone — replaced by a **soft, shallow** bottom gradient +
  a whisper top scrim (just enough for legibility). The room breathes.
- **Engagement moved to a vertical right rail** (like · comment · share) — TikTok/Reels shape, kept
  in the cozy Nestudio style; `ShareButton` gained an `iconOnly` variant for the rail.
- **One CTA only: Visit House** (shown when the creator has a house/handle). **Visit Nest / Peek in /
  Create** duplicates were removed — the Nest is already visible, so **tapping the room visits it**.
- Title + tags **minimised** (smaller display title, ≤2 tags); creator identity + Follow kept.

### 4. Editor top bar — Done always visible
`components/nest/editor/nest-editor.tsx`: the width-shifting **"Saved / Saving… / Unsaved" label was
removed** from the mobile top bar (autosave stays internal; its state now only hints the Done button's
tooltip, and manual saves still flash a toast). The bar was tightened (no middle slot, snugger Publish
/ Done) so the **Done button is fully visible** — verified at 375px: header `scrollWidth` 375, Done
right edge 367 (was 401, clipped).

### 5. House arrival
Kept the improved Beta Polish 3 arrival; confirmed **one** atmosphere label (no duplicate time/weather),
no bottom gap, fits one screen, **Enter Nest** obvious.

## Verification (browser, mobile 375×812)
`/village` (sky visible, curved ground, orbit) · tap house → zoom → arrival · `/home` swipe feed ·
`/explore` · `/nest-editor` (Done visible). **No console errors**, no layout regressions.
`typecheck · lint · test (402) · build` all green (Node 20).

## Not changed (as required)
- **No features; no backend / auth / publishing / social / editor logic.** Only layout, CSS, and the
  village presentation mapping. No tables, migrations, flags, or dependencies.

## Do not accidentally change
- **Sky must stay visible** in the village (ground ≈ lower half); the world is **2.5D CSS** — no real
  3D / Three.js / animation libraries.
- The feed stays **room-first**: no heavy dark overlay, one CTA (Visit House), engagement on the rail.
- The editor top bar carries **no width-shifting save label** — Done must always fit.
