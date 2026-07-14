# Rolling Village V2 — Chunk-Based Infinite World (2026-07-14)

Branch `m12-nest-platform`, **preview only — no merge to `main`, no production deploy**. **No product
features; no changes to auth, publishing, social backend, editor data model, arrival flow, or
marketplace/AI.** Evolves the `/village-lab` prototype ([village-rolling-v2.md](village-rolling-v2.md))
from per-cell random generation to a **hand-authored chunk engine**. `/village` is unchanged.

## Core principle

The world is **not randomly generated** — it is assembled from a small set of carefully designed,
reusable **chunks**, like a hand-crafted game map. A chunk is a little scene with **fixed house plots
beside the road** and rule-placed decor, so every village reads as intentional. When you explore you
should feel like you're strolling a neighbourhood where every house belongs somewhere — never
"the computer placed these randomly."

## Architecture — [lib/village-chunks.ts](../lib/village-chunks.ts) (pure, 12 tests)

- **ChunkTemplates** (`CHUNK_WIDTH = 1000` world px): eight hand-authored scenes across the required
  variety — `residential` (row + pair), `crossroads`, `square`, `forestEdge`, `meadow`, `hilltop`,
  `park`. Each names its house **plots** (fraction across the chunk + a hue seed) and its **decor** with
  rules baked in: *trees behind houses or beside the road, flowers at entrances, bushes soften gaps,
  lamps + mailboxes line the road*. Crossroads/square/park add **connectors** (a lane linking the road to
  the plots).
- **Sequencer** — `templateFor(band, index)` deterministically picks a template per chunk from a
  per-band pool (near = dense villages, far = quiet country), steering off the previous pick so
  repetition never looks obvious; `isMirrored` flips some chunks for extra variety. `resolveChunk`
  turns a chunk into absolute-world houses / decor / connectors. All pure functions of the index →
  exploring back and forth is perfectly stable.
- **Seamlessness** — the rolling ground (`hillY`) and the road ribbon (`roadPath`) are **continuous
  global functions** (from [lib/village-street](../lib/village-street.ts)); chunks only place content, so
  roads leaving one chunk always continue into the next and you never see a boundary.

## Camera + depth — [use-village-street.ts](../components/nest/village/use-village-street.ts)

Horizontal exploration stays primary and unbounded. Vertical is a **subtle, clamped** look that now
reads as *walking into / back out of* the village: each band drifts vertically at its own rate
(`depthLift`) and scales a hair (`depthGain`), so dragging up eases the distant hills gently forward and
larger while the near row settles — **gentle, no exaggerated perspective**, and you can't get lost.
Bands are GPU-transform layers; only the visible chunk window is React state (streamed on shift). Tap →
glide to the house + arrival card (placeholder for the real `HouseFront`).

## Deliverables → verified in-browser (375×812)

Left/right exploration · slight forward/back (gentle depth) · multiple connected chunks · roads
connecting across chunks · houses emerging naturally · dense residential neighbourhoods · quieter
meadow/forest countryside · smooth streaming without obvious repetition · designed plots (mailboxes +
flowers at entrances, lamps by the road, connectors at junctions) · tap → "Saffron vale" arrival card ·
~18 houses visible, no console errors.

## Next (only after approval)

Feed the real `useVillage()` creators onto chunk plots (identity, online dot, `HouseFront` arrival) in
`village-scene.tsx`, keeping this engine + atmosphere. Not done in this sprint.

## Gates

typecheck ✓ · lint ✓ · test **462** ✓ · build ✓.
