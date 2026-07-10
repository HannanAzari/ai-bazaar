# Village Projection Rebuild — Pseudo-3D Curved World (2026-07-10)

Branch `m12-nest-platform`, **preview only — no merge to `main`, no production deploy**. **No product
features; no changes to auth, publishing, social backend, editor data model, or marketplace/AI** — this
is the Village *presentation layer* only. Supersedes the orbital-village pass in
[beta-polish-fullscreen-orbit.md](beta-polish-fullscreen-orbit.md).

## Why

The previous village was a single-axis **orbit** (`phi` angle, horizontal drag only): houses lived on
fixed longitude/latitude bands and you could only spin the world sideways. It read more like a rotating
carousel than a place you move through. The goal here was a small **curved living world** you can roam
in **any** direction — left/right/up/down/diagonal — where the centre reads closest, the edges fall away
around the limb, and houses wrap round the world as you pan.

Rebuilt around a **virtual 2D world + a movable camera**, not by patching the scroll/orbit code. Still a
lightweight **DOM/CSS** solution: **no Three.js, no Canvas, no gesture/animation libraries** — native
Pointer Events + `requestAnimationFrame` only.

## Architecture

Three layers, smallest-blast-radius first:

1. **`lib/village-projection.ts`** — pure, framework-free projection math (no React, no DOM). World
   items have stable coordinates `{ worldX, worldY }`; a `Camera { x, y }` moves over them. `projectItem`
   curves a world point to the screen:
   - `relativeX = wrapDeltaX(worldX, cameraX, WORLD_WIDTH)` — shortest signed delta on a **horizontal
     cylinder**, so the world **wraps** (a house leaving the right re-enters from the left).
   - `relativeY = clamp(worldY − cameraY)` — finite **depth** (soft-clamped, never wraps). Positive =
     foreground (lower, larger, sharp, high z); negative = horizon (higher, small, hazy, low z). So
     **vertical camera movement slides houses between foreground and background.**
   - `screenY = horizonY + relativeY·verticalScale + horizontalCurve·relativeX² + depthCurve·relativeY²`
     — the `relativeX²` **dome term** (positive → screenY grows downward → sides fall away) is what makes
     the ground read as **convex**, "standing on a small planet."
   - `scale` responds primarily to depth; `opacity`/`blur`/`zIndex`/`visible` derive from depth + edge
     distance. Every constant is tunable and documented (`DEFAULT_PROJECTION_CONFIG`).
   - Pure physics helpers: `applyInertia`, `clampVelocity`, `stepCamera`, `dragToVelocity`.
   Fully unit-tested: [test/village-projection.test.ts](../test/village-projection.test.ts) (19 tests —
   wrapping shortest-delta, clamp, scale-by-depth, visibility radius, zIndex ordering, `projectAll`
   sorting, opacity/scale bounds, inertia math).

2. **`components/nest/village/use-curved-world.ts`** — the movable camera + gestures, driven with native
   Pointer Events + rAF. Owns `camera`/`velocity` in **refs** and writes each item's
   `transform`/`opacity`/`z-index` **straight to the DOM every frame** — **no React render per frame**
   (the mobile-perf rule). Details:
   - Drag maps `camera −= delta · sensitivity` (world follows the finger); works for **horizontal,
     vertical and diagonal** drags through one implementation.
   - Release **flings** with friction + velocity clamping; a **tap-vs-drag** threshold (6 px) keeps
     houses tappable (a real drag sets `suppressTap` so its trailing click is eaten).
   - `pointerdown/move/up/cancel` + `wheel`; pointer-move updates are **coalesced into one rAF**.
   - **Blur is applied only when the world comes to rest** — transform + opacity only while moving.
   - `will-change: transform, opacity` on moving items; `prefers-reduced-motion` → no inertia, immediate
     stable positioning. Vertical drag is soft-clamped to the world's depth so you can't wander into void.
   - Helpers: `centerOn` (glide a point centre-front), `jumpTo` (instant re-centre), `initialCamera`.

3. **`components/nest/village/village-scene.tsx`** — rewritten to use the two layers with the **real**
   houses. Same props contract (`village`, `onSelect`, `sky`, `wx`, `zoomingId`) so
   `app/village/village-client.tsx` is unchanged. `layout()` gives each `VillageHouse` stable world
   coordinates (even spread around `WORLD_WIDTH` with per-seed jitter; depth scattered by seed so houses
   never line up in rows); the first **real creator** anchors where the camera opens, and the camera
   **re-centres** on it when discovery loads it in (guarded on the home-house id — never mid-drag). The
   **curved ground** SVG samples the *same* `horizontalCurve·relativeX²` parabola as the projection, so
   ground and houses agree. `HouseExterior` art, name pills, online dots, real-creator badges, idle
   float, and the **zoom-into-arrival** (scale the world layer toward the tapped house, then
   `HouseFront` rises) are all preserved. Gestures freeze during the arrival zoom.

## Atmosphere / moon

`SceneBackdrop` (sky, sun, stars, clouds, birds, rain, snow, time-of-day themes) is reused unchanged —
sky stays fixed in screen space; ≥ 1/3 of the viewport remains sky (horizon pinned at
`horizonYFraction = 0.4`, independent of camera). The **moon** was softened
(`scene-backdrop.tsx`): the gradient now eases to the disc's own edge (no abrupt cool stop) and the glow
is **blur-only (0 spread)**, removing the bright rim that sat between the disc and its halo — a clean
**soft full moon**, no thick ring, no broken crescent.

## Prototype

Built and tuned as an isolated bench first:
[`/village-projection-lab`](../app/village-projection-lab) (`page.tsx` + `lab-client.tsx`) — 20
placeholder houses + light decor (trees/lamps/flowers on the same projection), a **debug** overlay
(world coords + horizon guide) and **live sliders** for every projection constant, with Copy-config /
Reset. `robots: noindex`; not part of the shipped surface — safe to delete once the feel is locked. The
tuned constants were baked back into `DEFAULT_PROJECTION_CONFIG`.

## Acceptance (verified on a 375-px iPhone viewport)

1. ✓ Dragging any direction moves the world naturally. 2. ✓ Houses follow a projected curve, not flat
horizontal scrolling. 3. ✓ Centre houses are larger. 4. ✓ Edge houses shrink and disappear. 5. ✓ New
houses emerge as the world wraps. 6. ✓ Ground and houses agree. 7. ✓ ≥ 1/3 of the screen stays sky.
8. ✓ Sun/moon/weather remain visible (soft moon confirmed at night). 9. ✓ Houses remain tappable →
existing arrival (`HouseFront`) opens; Back returns to the scene. 10. ✓ No console errors on `/village`.

Gates green: **typecheck ✓ · lint ✓ · test 421 ✓ (402 + 19 new) · build ✓** (`/village` and
`/village-projection-lab` both prerender).

## Files

- New: `lib/village-projection.ts`, `test/village-projection.test.ts`,
  `components/nest/village/use-curved-world.ts`, `app/village-projection-lab/{page,lab-client}.tsx`.
- Rewritten: `components/nest/village/village-scene.tsx`.
- Edited: `components/nest/village/scene-backdrop.tsx` (moon).
- Unchanged contract: `village-client.tsx`, `use-village.ts`, `use-atmosphere.ts`, `house-exterior.tsx`,
  `house-front.tsx`, `nest-village.ts`, `nest-house.ts`, `nest-atmosphere.ts`.

No tables, migrations, flags, or dependencies.
