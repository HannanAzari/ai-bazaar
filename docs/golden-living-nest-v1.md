# Golden Living Nest V1 (M5 — Premium Visual Lock candidate)

> The Golden Nest, made explicit as a **Golden Living Nest**: a warm, premium living
> room for a creator's digital identity. This sprint makes ONE living-room Nest
> visually coherent and interaction-ready. It does **not** extend the Composer, add
> scene-family selection, or build onboarding/persistence/marketplace.
>
> Route: `/design/golden-living-nest` (internal, noindex). The prior V2
> (`/design/golden-nest`) is untouched. Scale: [golden-living-nest-scale.md](golden-living-nest-scale.md).

## Product decision

The Golden Living Nest is a **living room** — it must not contain office furniture.
Removed from the active composition (kept in the library for a future **Home Office
Nest**, not deleted): **desk · desk chair · loose desk books · centre-floor plant**.

## Active objects (8)

| Slot | Asset | Art source | Interaction |
|---|---|---|---|
| slot-media | Media Unit (TV + console) | approved cut-out `tv-v2` | TV screen-only light → video |
| slot-frame | Framed Gallery | approved cut-out `frame-v2` | focus/enlarge → gallery |
| slot-sofa | Cozy Sofa | **placeholder** `sofa.svg` | — (static seating hero) |
| slot-coffee-table | Coffee Table | **placeholder** `coffee-table.svg` | — (static) |
| slot-rug | Floor Rug | **placeholder** `rug.svg` | — (floor layer) |
| slot-lamp | Floor Lamp | approved cut-out `lamp-v2` | localized glow → smooth ambience |
| slot-plant | Potted Plant | approved cut-out `plant-v2` | leaf-only sway (ambient) |
| slot-avatar | Creator Avatar | approved cut-out `avatar-v2` | breathing idle → greeting |

## Art constraint — what is real vs. placeholder

No approved sofa / coffee-table / rug / side-table / speaker cut-outs exist in this
repository. Per the sprint's art constraint, those are **clearly-labelled temporary
placeholders** (warm matte SVGs under
`public/nests/golden-living-nest-v1/placeholders/`), flagged `placeholder: true` on
the asset, surfaced in the debug overlay (⚠PLACEHOLDER) and the debug notes. They are
**not** production-ready and do not match the photoreal approved cut-outs.

**Missing final art to commission (production-ready, front-facing, transparent, DNA):**
- **Sofa** — the seating hero; 3/4 view, seat-forward (never seen from behind), low + wide.
- **Coffee table** — warm oiled oak, rounded, small accent tray.
- **Rug** — foreshortened floor footprint, warm, one accent border.
- (Optional, not used yet) compact side table · speaker · small bookshelf.

Replace by dropping a real transparent PNG/WebP at the same path and clearing the
`placeholder` flag — bounds re-derive from the new cut-out's aspect (see scale doc).

## Layered interactive asset contract (`lib/nest-visual-types.ts`)

Additive, optional, non-breaking (a plain single-image `NestAsset` is unchanged):

- `NestAssetVisualState` — idle / active / reduced-motion; optional still or
  animated-WebP / Lottie / alpha-WebM source (never GIF), duration, loop.
- `NestAssetLayer` — a stacked image layer with `zOffset`, an `interactive` flag, and
  an optional `clip` sub-region (the "clipped screen region" pattern).
- `NestAssetStatePack` — `idle` / `active` / `reducedMotion` states, optional
  `layers`, a `screenRect` (media), and a `leafSplitY` (plant).
- `LivingNestAsset` — `NestAsset` + `statePack` + a `placeholder`/`artNote` flag, with
  the slot taxonomy widened (`LivingNestSlotType` adds sofa/table/rug/…).

## Premium interactions (CSS transforms + clipped raster layers only — no Three.js/WebGL/GIF)

- **TV** — a div clipped to `statePack.screenRect` lights up (warm wash + a play
  glyph) plus a localized radial light spill; **the base TV/console image never
  glows**. Drawer: "Watch latest video".
- **Plant** — the single cut-out is drawn as **two clipped layers** from one image:
  a static lower band (pot, `clip-path inset` below `leafSplitY`) and an upper leaf
  band that sways (`transform-origin` at the split line). Only the leaves move; the
  pot stays planted. Idle: a gentle continuous sway; tap: a stronger sway burst.
  *(Documented temporary approximation — true leaf-only motion wants a separate leaf
  layer in the final art.)*
- **Avatar** — a subtle **breathing** idle (`scaleY`/`translateY`, origin bottom) and
  a small **greeting lean** on tap. *(A real wave/blink wants separate arm + eye
  layers; this is the documented approximation.)*
- **Frame** — gentle **focus**: the frame enlarges + lifts and the rest of the scene
  softly **dims**, so the image area becomes prominent. Drawer: "Open gallery".
- **Lamp** — a localized warm **glow** near the lamp top + a **smooth** room-ambience
  transition (0.7s ease) — no abrupt full-scene flash. Drawer: "Change ambience".

**Reduced motion:** a scoped `@media (prefers-reduced-motion: reduce)` neutralizes
breathing, sway, transitions, and the sheet animation (calm static states).

## Presentation vs debug

- **Presentation (default)** — the Nest is the hero: compact header + scene + a
  collapsed bottom drawer ("Tap an object to explore"). No debug labels.
- **Debug** — calibration overlays per object: slot id · asset id (+ ⚠PLACEHOLDER) ·
  slotType · z · plane · scale ratio · bounds · anchor · **state-pack availability**;
  plus the placeholder/missing-art notes.

## Honest visual weaknesses

1. **Placeholder ↔ photoreal style mismatch (the big one).** The sofa, coffee table,
   and rug are flat warm-matte SVGs; the room, avatar, plant, TV, lamp, and frame are
   photoreal cut-outs. The seating zone therefore reads as "illustrated furniture in a
   rendered room" — acceptable as a labelled placeholder, **not** a premium final.
2. **Calm upper-centre wall.** Generous negative space per the DNA, but a future
   layout could lift the TV or balance the wall with a second small object.
3. **TV thumbnail is a play glyph,** not a real video thumbnail (no thumbnail art).
4. **Avatar greeting is a lean, not a true wave;** plant sway is a clipped-band
   approximation — both want layered final art for the premium version.
5. **Contact shadows are uniform ellipses,** not per-footprint perspective shadows.

## Acceptance bar — honest status

Passes: no desk, no centre plant; nothing floats; the TV console does **not** glow as
one rectangle (screen-only); the whole plant does **not** move (leaves only); the
avatar does **not** use the decor wiggle (breathing + greeting); the scene is
inhabited and balanced, not sparse or catalogue-like; interaction effects don't expose
rectangular PNG card bounds. **Not yet** a fully premium "this is a real designer
living room" — gated on the missing sofa/coffee-table/rug final art (weakness #1).

## Out of scope (unchanged)

Composer changes, scene-family selection, alternate catalogs, onboarding, persistence,
marketplace, Supabase, and any edit to the locked V2 art/camera or `lib/nest-types.ts`.
