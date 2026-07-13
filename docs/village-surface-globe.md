# Village Surface Globe — Surface-Anchored Correction (2026-07-13)

Branch `m12-nest-platform`, **preview only — no merge to `main`, no production deploy**. **No product
features; no changes to auth, publishing, social backend, editor data model, arrival flow, or
marketplace/AI.** Two things only: (1) a correct **surface-anchored** village architecture, proven in
the lab; (2) removing the Home feed's bottom overlay panel. Supersedes the projection approach in
[village-projection-rebuild.md](village-projection-rebuild.md).

## Why the previous projection was wrong

The pseudo-3D projection ([lib/village-projection.ts](../lib/village-projection.ts)) projected every
object **independently** against a **separate** decorative ground shape. The ground was a fixed SVG hill;
houses were positioned by their own screen math. The two never agreed, so houses read as a **floating
cloud around a detached hill** — not a village attached to the earth. Tuning constants could not fix an
architecture where the terrain and the objects are computed apart.

## The correction — one shared surface

Everything now derives from a **single surface projection**
([lib/village-surface.ts](../lib/village-surface.ts)). No object stores screen coordinates; each lives at
a `SurfacePoint { longitude, latitude }` and asks the same `projectSurface()` where that point is on
screen right now. Houses, roads, trees, bushes, flowers, lamps, labels and shadows all use it — so they
are, by construction, on the same curved ground.

### Model — a small planet (orthographic tilted sphere)

The village sits on a sphere we look at from outside, tilted down onto the near cap. Because the
projection is **orthographic**, the sphere's silhouette on screen is a **fixed circle** of radius
`radius` centred at `(width/2, height·centerYFraction)` — that circle **is** the terrain limb / horizon.

For a surface point, with `a = longitude − camera.longitude`:

```
p3 = ( cosLat·sin a , sinLat , cosLat·cos a )      // unit sphere point
tilt down by β = tilt + camera.tilt about screen X
z  = toward-camera component after tilt
```

- `z > 0` → **front** hemisphere: visible, anchored on the near surface.
- `z = 0` → the **limb**: exactly on the horizon circle.
- `z ≤ 0` → **back** hemisphere: **hidden behind the earth** (occluded, not merely faded).

A sphere's outward normal equals its point direction, so `z` is simultaneously the **occlusion test**,
the **foreshortening/scale** term, and the **z-index**. Rotating `camera.longitude` spins the world:
objects slide to a limb, cross `z = 0`, vanish behind the earth, and re-emerge from the opposite limb.
**No object can float in open sky** — its anchor is always a real point on this one surface.

### Anchoring

Each object's **bottom-centre** is pinned to its projected surface point via a pure transform
(`translate3d(calc(x − 50%), calc(y − 100%), 0) scale(s)`, `transform-origin: 50% 100%`), so the base
touches the ground and the shadow pad sits under it at the right scale. Houses never float above the
terrain and never render below the visible edge.

### Occlusion

Render order is sky → terrain disc → surface features (roads/graticule, clipped to the disc) →
front-side houses/decor → UI. Back-hemisphere objects are set `visibility: hidden` the instant `z ≤ 0`,
and a thin `limbFade` band dissolves a front object into haze as it approaches the limb — so it shrinks
and fades right as it crosses behind, no hard pop.

## Camera + input

[components/nest/village/use-village-globe.ts](../components/nest/village/use-village-globe.ts) owns the
camera (`{ longitude, tilt }`) and gestures with native **Pointer Events + requestAnimationFrame** — no
Three.js, no Canvas, no gesture/animation libraries.

- Horizontal drag → rotate longitude; vertical drag → tilt the camera onto the cap (clamped).
- Inertia (friction + velocity clamp), a tap-vs-drag threshold so houses stay tappable, `onWheel` for
  trackpads, and `prefers-reduced-motion` (no inertia).
- Per frame the hook projects every registered element and writes `transform`/`opacity`/`z-index`
  **straight to the DOM via refs — never React state** — so dragging triggers no React render. Blur is
  applied only at rest (transform + opacity only while moving). A `setOnFrame` hook lets the caller
  redraw surface features (roads, graticule) with the same `projectPoint`.

## The lab — proven before integration

[/village-projection-lab](../app/village-projection-lab/lab-client.tsx) is the tuning bench (noindex).
It draws the one terrain disc and places 16 placeholder houses + roads + trees/bushes/flowers/lamps + a
rotating lat/long graticule, **all** through `projectSurface`, with live sliders for every constant.

Verified in-browser at 375×812 (all 10 lab acceptance criteria):

1. one curved visible world ✓ 2. houses anchored to it ✓ 3. houses disappear behind the horizon ✓
4. houses emerge on rotation ✓ 5. no house in open sky ✓ 6. roads rotate with the world ✓
7. trees rotate with the world ✓ 8. horizontal + vertical drag ✓ 9. all objects share one projection ✓
10. terrain occlusion correct ✓ — sky held ≥ ⅓, no console errors.

**`/village` is intentionally NOT replaced yet.** Per the brief, the real Village adopts the globe only
after the lab look is approved; it still uses the prior projection until then.

## Part B — Home feed panel removed

The Home feed ([components/nest/app-shell/discovery.tsx](../components/nest/app-shell/discovery.tsx),
`FeedCard`) showed an olive band across the bottom third. Cause: the room was full-bleed, but the bottom
scrim was a tall three-stop gradient (`h-1/3 from-black/45 via-black/12`) whose mid plateau read as a
solid card over light rooms. Replaced with a single smooth two-stop fade
(`h-2/5 from-black/45 to-transparent`) — no plateau, no edge. The Nest image is edge-to-edge from below
the header to the bottom nav; identity, title, tags, Visit House and the like/comment/share rail float
directly over it on their own text-shadows. No full-width panel; verified in-browser.

## Files

- **New** — [lib/village-surface.ts](../lib/village-surface.ts),
  [test/village-surface.test.ts](../test/village-surface.test.ts) (14 tests),
  [components/nest/village/use-village-globe.ts](../components/nest/village/use-village-globe.ts)
- **Changed** — [app/village-projection-lab/lab-client.tsx](../app/village-projection-lab/lab-client.tsx)
  (rewritten to the globe), [components/nest/app-shell/discovery.tsx](../components/nest/app-shell/discovery.tsx)
  (Home scrim)

## Gates

typecheck ✓ · lint ✓ · test **435** ✓ · build ✓.
