# Beta Polish 2 — Village Realism (branch `m12-nest-platform`)

> **Preview only.** Shipped on `m12-nest-platform`. **No merge to `main`, no production deploy.**
> **Pure visual polish — no new features, no navigation changes.** Goal: the village should feel
> believable. Houses were floating stickers on a flat green field; now they sit in a rolling grass
> valley with a winding road, greenery, elevation, depth, and shadows. Canonical record; see
> [changelog.md](changelog.md).

## What changed (visual only)

### 1. `VillageTerrain` — the ground the village sits on
New `components/nest/village/village-terrain.tsx`, rendered inside the (scrolling) board, behind the
houses:
- **Rolling grass valley** — a vertical grass gradient (far/light at the horizon → near/dark in the
  foreground) with gentle **elevation contours** across it, so the ground rolls instead of being flat.
- **Horizon** — the top ~16% stays sky (the fixed backdrop shows through), with soft far hills at the
  horizon line so ground and sky blend.
- **Winding dirt road** — a meandering S-curve main road down the valley + one branch + short dashed
  **walking paths** from the road toward a few houses (drawn edge-then-lighter-centre for depth).
- **Neighbourhood greens** — soft radial lighter-grass patches under the house clusters, so houses
  read as grouped little neighbourhoods (not a uniform field).
- **Scattered greenery** — trees, bushes, flowers, and rocks placed on a **jittered grid** that skips
  any cell too near a house (so nothing overlaps a home) — organic, **not a perfect grid**, and
  **deterministic** (seeded, no `Math.random`). Each prop carries a contact shadow + perspective scale.
- **Re-lit by the sky** — the terrain shares the time-of-day + weather **wash/overcast**, so it reads
  morning → night and clear / rain / snow (night uses the deep blue-green ground palette).

### 2. Perspective + grounding (`village-scene.tsx`)
- **Depth perspective** — houses scale by their `y`: lower houses are **closer** (bigger, fully lit),
  upper houses **further** (smaller + a touch hazier via opacity), each scaling **from its base**.
- **Contact shadows** — `HouseExterior` gained a soft blurred shadow ellipse under the garden so every
  house **sits ON the ground** instead of floating. (The old flat "clearing" blob is gone.)

### 3. More house variety (still procedural, functionality unchanged)
`houseFeatures` (`lib/nest-house.ts`) gained two seed-derived, **visual-only** features:
- **`fence`** — `none` / `picket` / `hedge` / `stone`, drawn across the front yard (centre left open
  for the door/path).
- **`porch`** — a small awning over the door with two posts.
These join the existing seed variety (roof gable/hip · chimney · window shape · door type · garden ·
mailbox · tree side), so two same-persona houses still look like different homes.

## Verification (browser, mobile 375×812)

Screenshotted the village across all five requested conditions (clock + deterministic weather forced
for capture only):

- **Morning · Clear**, **Afternoon · Clear**, **Night · Clear**, **Afternoon · Rain**, **Afternoon ·
  Snow** — each shows the winding road through rolling grass, grounded houses with depth/perspective,
  scattered greenery, and per-house variety (porches, picket/stone fences, roofs, chimneys); the
  terrain re-lights correctly per time/weather.
- **Navigation intact:** tapping a house still opens the arrival panel (camera zoom → Enter Nest). No
  navigation, editor, publishing, auth, or discovery logic was touched.
- **No console errors.** `typecheck · lint · test (402) · build` all green (Node 20).

## Not changed (as required)

- **Only visuals.** Navigation (tap → arrival → Enter/Exit) is exactly as M19/M19.1. No new features,
  no data model changes, no tables/migrations/flags/dependencies. The hex layout + positions from
  `lib/nest-village.ts` are unchanged — the terrain draws *around* the existing house positions.

## Known limitations / notes

- Decorative greenery is drawn **behind** all houses (a background layer); it doesn't interleave by
  depth with individual houses. It avoids house footprints, so overlap is minimal.
- The winding road is decorative (deterministic curves), not a graph that literally connects every
  door — walking paths only stub toward a few real-creator houses.
- Terrain prop count is capped (~64) for performance; everything is static (no per-frame animation on
  the ground), so it composites cheaply.

## Do not accidentally change

- **Terrain + decor stay deterministic** (seeded hash, no `Math.random`/`Date.now`) — or the village
  reshuffles across renders/SSR and hydration breaks.
- **`houseFeatures` unsigned shifts** (`>>>`) still apply to the new `fence`/`porch` bits.
- **The terrain draws around existing house positions** — don't move it into `lib/nest-village.ts`
  layout or change positions; this sprint is visuals only.
