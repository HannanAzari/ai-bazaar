# Beta Polish 5 — Micro-Animations (branch `m12-nest-platform`)

> **Preview only.** Shipped on `m12-nest-platform`. **No merge to `main`, no production deploy.**
> **Pure delight — no features, no new libraries.** Calm, cozy, premium micro-animations: **CSS only,
> 60fps, reduced-motion respected.** Restraint is the point — Nestudio should feel relaxing, not
> game-like. Canonical record; see [changelog.md](changelog.md).

## What changed

| Surface | Animation |
|---|---|
| **Buttons** | A **soft spring** on release — one global rule on `[class*="active:scale"]` overrides the tap transition to a gentle overshoot easing (`cubic-bezier(0.34,1.26,0.5,1)`, 220ms). Calm, not bouncy; applies everywhere without touching each component. |
| **Like** | The heart **pops and settles** — a softer curve with a slight overshoot-back (`like-button.tsx`). |
| **Follow** | A **smooth morph** on toggle — colour transition + a subtle scale confirm (`follow-button.tsx`). |
| **Comment sheet** | A **softer slide** (slower, smoother decel) + a **backdrop fade-in** (`bottom-sheet.tsx`). |
| **Village** | Houses **breathe** with a barely-there float (`nest-float-map`, ±1.5px, 8.5s, staggered per house). Contact shadows are baked into each house so they float *with* it — still grounded, not stickers. |
| **House (arrival)** | Subtle breathing — the existing `nest-idle`, kept. |
| **Trees** | Terrain tree **canopies sway** gently in the breeze (`nest-sway` on the canopy group only; trunks stay put; staggered). |
| **Clouds** | **Smoother** drift — slower (34s) with a gentle vertical lull (`nest-drift`). |
| **Weather** | **More natural snow** — flakes sway left↔right as they fall (`nest-snow`). |
| **Room** | A **very subtle ambient light pulse** breathes over the visitor's composed room (`nest-ambient`, opacity 0→0.07, 8s). |
| **Door** | Smoother easing — kept from Beta Polish 3. |

## Performance & accessibility

- **CSS-only** — transforms + opacity, `will-change: transform` on the moving layers; **no JS
  animation loops, no new dependencies**.
- **Reduced motion** — every keyframe animation is disabled under `@media (prefers-reduced-motion:
  reduce)` (the global rule already zeroes `animation-duration`; `like`/`follow`/`sheet` also carry
  their own guards). The button spring is a tap-feedback *transition* (kept — it's momentary, not
  ambient motion).
- **60fps** — motions are small, composited transforms/opacity; amplitudes are deliberately tiny so
  the sum stays calm rather than busy.

## Verification (browser, mobile 375×812)

- Village, arrival, feed, and visitor pages render **unchanged in layout**; 20 house-float layers +
  terrain tree sways run with **no console errors**; the computed `animation-name` on a floated house
  is `nest-float-map`. `typecheck · lint · test (402) · build` all green (Node 20).

## Not changed (as required)

- **No features, no new libraries, no logic.** Only animation/timing — no tables, migrations, flags,
  dependencies, or component behaviour changes.

## Do not accidentally change

- **Keep amplitudes tiny + durations long.** The brief is *calm / premium / relaxing* — never
  playful/game-like. The village float is intentionally ±1.5px (grounded shadows stay put).
- **All ambient keyframes must stay behind `prefers-reduced-motion`.**
- **No JS/rAF animation loops or animation libraries** — CSS transforms/opacity only.
