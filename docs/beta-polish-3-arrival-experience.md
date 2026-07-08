# Beta Polish 3 — Arrival Experience (branch `m12-nest-platform`)

> **Preview only.** Shipped on `m12-nest-platform`. **No merge to `main`, no production deploy.**
> **Pure polish — no functionality changes.** This sprint is about *arriving at a Nest*: strip the
> arrival panel to what matters, make swiping between houses feel like Instagram Stories, and make the
> house feel alive with softer light, better shadows, and a smoother door. Canonical record; see
> [changelog.md](changelog.md).

## What changed (`components/nest/village/house-front.tsx` + door/CSS)

### Removed (unnecessary information)
- The **"Home" / "Out" presence chip** (top bar).
- The **"Online" / "Away"** stat (stats row).
- The **"Now showing: …"** latest-nest peek.
- The **duplicate time label** in the bottom-right corner — the single sky/weather chip (`Evening ·
  Clear`) is now the only atmosphere label.

### Kept
- **Creator** (avatar · name · @handle), **Followers**, **Nest count**, **Enter Nest**. Nothing else.

### Improved
- **Instagram-Stories swipe** — horizontal swipe (pointer/touch) on the arrival navigates houses:
  swipe **left → next**, swipe **right → prev** (threshold 55px, must be more horizontal than
  vertical so taps/scrolls aren't hijacked). The **arrows still work**; both drive the same
  `onPrev`/`onNext` the village already passes in — no navigation logic changed.
- **The house feels alive** — a barely-there idle **float** (`nest-idle`, ±4px, slow), on top of the
  existing chimney smoke / lit-window / tree sway. The house is **keyed by id** so it re-settles
  (`nest-approach`) on each swipe, like a Stories card changing.
- **Softer lighting** — a soft **pooled light** blurred behind the house (warmer + stronger at night).
- **Better shadows** — a grounded, blurred shadow ellipse under the house so it sits on the earth.
- **Better scale** — the house is larger + better proportioned (`max-w-[330px]`).
- **Smoother door** — `DoorTransition` fades its overlay in (`nest-fade`) instead of cutting to black,
  and the door opens on a gentler curve (`cubic-bezier(0.65,0,0.35,1)`, ~1s), then routes into the Nest.

## Fixed — hydration mismatch (from Beta Polish 2)

`VillageTerrain` and `SceneBackdrop` scattered their decor/particles with a `Math.sin`-based PRNG.
`Math.sin` is **not guaranteed bit-identical** between the Node server (SSR) and the browser, so the
computed SVG coordinates differed by ~1e-7 → the `transform="translate(…)"` strings didn't match on
hydration (a React hydration error, only visible on a **full SSR load** of `/village`, not on client
navigation). Replaced the PRNG with an **integer hash** (`Math.imul` mixing, `>>> 0`), which is
bit-identical on every platform. IEEE float arithmetic downstream is already deterministic, so the
coordinates now match exactly.

## Verification (browser, mobile 375×812)

- **Arrival (real creator):** shows **Back to village** + a single **Night · Rain** chip · the house ·
  **Hannan / @hannan** · **0 Followers · 1 Nest** · **Enter Nest** — and nothing else (no Home,
  Online, Now-showing, or duplicate time).
- **Swipe:** a leftward pointer swipe advances to the next house; a rightward swipe returns to the
  previous — arrows unchanged. **Enter Nest** still plays the door transition and lands inside
  `/nest/the-loft`.
- **Hydration:** a full SSR load of `/village` now logs **no console errors** (previously threw the
  hydration mismatch).
- `typecheck · lint · test (402) · build` all green (Node 20).

## Not changed (as required)

- **No functionality changes.** Navigation (tap → arrival → Enter/Exit, prev/next/back) is exactly as
  M19/M19.1; swipe is an added *input* to the existing prev/next, not new behaviour. No data model,
  tables, migrations, flags, or dependencies. The village map's ambient online dot is left as-is (this
  sprint is the arrival panel, not the map).

## Do not accidentally change

- **Never use `Math.sin`/`Math.cos` for SSR-rendered deterministic layout** — use the integer-hash
  PRNG. Trig isn't bit-identical server↔browser and reintroduces the hydration mismatch.
- **Swipe threshold + axis guard** keep taps (Enter) and vertical gestures from triggering navigation;
  don't lower them.
- **The arrival keeps only** Creator · Followers · Nest count · Enter — don't re-add presence/now-showing.
