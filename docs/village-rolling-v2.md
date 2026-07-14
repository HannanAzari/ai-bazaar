# Nestudio Village V2 — Infinite Rolling Village (2026-07-14)

Branch `m12-nest-platform`, **preview only — no merge to `main`, no production deploy**. **No product
features; no changes to auth, publishing, social backend, editor data model, arrival flow, or
marketplace/AI.** This is a **prototype** of the Village presentation, built at `/village-lab`. The globe
approach ([village-surface-globe.md](village-surface-globe.md)) is **abandoned** — it read as world
geometry, not a place. `/village` is unchanged and will only be replaced after this look is approved.

## The feeling we're after

A warm, endless, hand-painted countryside you glide through — **Animal Crossing / Stardew / Ghibli**, not
a map or a projection. When you look at it you should think *"I want to wander this neighbourhood and meet
these people,"* never *"clever scrolling system."* ~80% of the work here is atmosphere, composition and
art direction.

## How it's built (lightweight — no Three.js, no Canvas)

A side-on landscape of **parallax bands** (far → near) that streams forever. Everything is a pure function
of an integer cell index, so scrolling is perfectly stable and the world never ends or obviously repeats.

- **[lib/village-street.ts](../lib/village-street.ts)** — pure, tested (15 tests): a deterministic
  `hash01`; `hillY(worldX)` (two summed sines → a gentle, never-flat, never-obviously-repeating roll);
  `settlement()` density waves (dense hamlets ↔ open country); `cellContent()` (house / decor / empty);
  `groundPath` + `roadPath` samplers; `visibleCellRange` streaming window; camera physics.
- **[use-village-street.ts](../components/nest/village/use-village-street.ts)** — the gliding camera.
  Horizontal movement is dominant and **unbounded**; vertical is a small **clamped** look up/down so you
  can never get lost. Native Pointer Events + rAF inertia. Each band is one DOM layer translated by
  `-cameraX * parallax` (GPU transform) every frame — **scrolling never triggers a React render**. The
  only React state is the visible **cell window** per band, updated just when the integer range shifts (a
  generous buffer keeps it rare) — that's what streams the world endlessly without per-frame reconciliation.
- **[/village-lab](../app/village-lab/village-lab-client.tsx)** — three bands (far/mid/near) each with a
  rolling grass fill, a winding road ribbon that follows the terrain, creator **houses grounded on the
  hill line** (shadow pads, front-path stubs to the road), and **decor scattered down each slope** (trees,
  bushes, flowers, lamps, mailboxes, fences, rocks) so there's no bare grass. Nearer bands overlap and
  occlude the ones behind, giving real depth. Sky stays the top ~28%; **[SceneBackdrop](../components/nest/village/scene-backdrop.tsx)**
  keeps every existing atmosphere feature (morning/afternoon/evening/night, sun, soft moon, clouds, birds,
  rain, snow). A tap glides to the house and opens a lightweight arrival card (placeholder for the real
  `HouseFront`). Time-of-day and weather pickers let us screenshot every atmosphere.

## Requirements → result (verified in-browser, 375×812)

- Sky always visible, ~28% ✓ · rolling (not flat, not spherical) hills ✓ · endless, no visible edge ✓
- Houses attached to the terrain, grounded shadows, no floating ✓ · roads follow the terrain and connect
  houses ✓ · decor fills the negative space (slope-scattered) ✓
- Camera glides, horizontal-dominant, vertical limited, never lost ✓ · streamed cells, never reach an edge ✓
- Lightweight: **~510 DOM nodes**, transform-only per-frame work, no new deps ✓
- Doesn't touch selection/arrival/tap/routing/atmosphere ✓

## Screenshots captured

initial · scroll left · scroll right · vertical pan · dense village · sparse countryside · roads
connecting houses · rain · night (soft moon, glowing windows) · mobile (375×812, ~510 nodes).

## Next (only after approval)

Replace `village-scene.tsx` to render the real `useVillage()` houses on these bands (creator identity,
online dot, `HouseFront` arrival), keeping the atmosphere and this camera. Not done in this sprint.

## Gates

typecheck ✓ · lint ✓ · test **450** ✓ · build ✓.
