# Golden Living Nest — Architectural Scale Calibration (M5)

> The scale contract for the Golden Living Nest, calibrated against the locked
> front-facing camera (ADR-028) and the baked `background-v2.png` architecture.
> Reference unit: **avatar standing height = 1.00**. Typed constants live in
> [`lib/nest-scale.ts`](../lib/nest-scale.ts); the calibrated bounds are authored in
> [`lib/fixtures/golden-living-nest.ts`](../lib/fixtures/golden-living-nest.ts).

## Why calibrate against architecture (not just each other)

Assets are authored to one camera, so believable size comes from relating each
object to a shared reference **and** to the room it sits in. We anchor the avatar to
**0.42 of the scene height**, then size every object as a physical ratio of the
avatar, then convert that physical length into a normalized box using the cut-out's
pixel aspect (so `object-contain` fills the box with no letterbox and the object
"sits, not floats"). Objects are cross-checked against the visible wall height, the
floor seam (`y ≈ 0.62`), room depth, the floorboard run, and the side-wall rake.

## The conversion

`lib/nest-scale.ts` `ratioToBox(ratioOfAvatar, anchorAxis, pixelAspect)`:

- 1 avatar height = `AVATAR_SCENE_HEIGHT_FRACTION = 0.42` of scene height (y-axis).
- Because the scene is 3:4, a physical length is `4/3 ×` wider as an x-fraction than
  as a y-fraction (`xPerY = SCENE_ASPECT_H / SCENE_ASPECT_W`).
- Furniture is **height-anchored** (the ratio describes height); the TV and frame are
  **width-anchored** (the ratio describes width). The other dimension follows from the
  cut-out's pixel aspect.

## Starting ranges vs. ratios actually used

| Object | Spec range (× avatar) | **Used (× avatar)** | Anchor | Pixel aspect (w/h) | Final box `w × h` |
|---|---|---|---|---|---|
| avatar | height 1.00 | **height 1.00** | — | 0.410 | 0.230 × 0.420 |
| sofa | h 0.42–0.52, w 1.20–1.60 | **h 0.46 → w ≈ 1.21** | height | 2.632 (placeholder) | 0.678 × 0.193 |
| coffee table | h 0.22–0.30 | **h 0.26 (w ≈ 0.49)** | height | 1.889 (placeholder) | 0.275 × 0.109 |
| media console + TV | console 0.28–0.38; TV w 0.65–0.95 | **TV w 0.86** | width | 1.548 | 0.482 × 0.233 |
| floor lamp | h 0.85–1.05 | **h 0.96** | height | 0.289 | 0.155 × 0.403 |
| side plant | h 0.45–0.75 | **h 0.60** | height | 0.717 | 0.241 × 0.252 |
| frame | w 0.20–0.35 | **w 0.28** | width | 1.036 | 0.157 × 0.114 |
| rug | — | **floor span ≈ 1.5 wide** | footprint | 2.656 (placeholder) | 0.620 × 0.175 |

> Sofa & coffee-table pixel aspects are set by the **placeholder SVGs** (a real
> sofa reads low + wide, so the placeholder is authored at aspect ≈ 2.6 to keep the
> width inside the 1.2–1.6 avatar range at a 0.46 height). When final art lands, keep
> the avatar-ratio and re-derive the box from the real cut-out's aspect.

## Architectural anchors (`LIVING_NEST_ARCHITECTURE`)

| Anchor | Value | Used for |
|---|---|---|
| floor seam `y` | 0.62 | furniture grounds at/above this band; TV console base ≈ 0.655 |
| front-wall band | y 0.04 → 0.62 | frame (wall), TV (against wall) |
| left/right wall slivers | x < 0.16 / x > 0.82 | lamp tucked left, plant against right wall |
| camera tilt | 7° | matches the cut-out authoring |
| floorboards | front-to-back | informs the rug's foreshortened footprint |

## Grounding & depth (z-order back → front)

`rug(0) → frame(1, wall) → TV+console(2) → lamp(3) / plant(3) → sofa(4) →
coffee-table(5) → avatar(6)`. Further-forward objects (larger `baseY`) get higher z,
so the avatar reads in front of the seating and the rug reads under it. Floor objects
carry a soft cool-plum contact-shadow ellipse; the rug (the floor layer) and the wall
frame do not.

## Verified

Mobile **375×812 · 390×844 · 430×932** and **desktop**: full Nest visible, no
horizontal overflow, scene capped at a 460px column on desktop, objects grounded (no
floats), avatar reads as a believable human in the room.
