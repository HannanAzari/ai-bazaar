# Golden Nest Renderer (M2)

> The first visual proof of the V2 Nest data contract: one **front-facing cinematic Nest**
> (ADR-028) rendered entirely from the M1 fixture. Internal prototype at **`/design/golden-nest`**
> (unlinked, noindex). No Composer, no editor, no Supabase, no asset generation — structure +
> interaction only.
>
> Contract: [`lib/nest-types.ts`](../lib/nest-types.ts) · fixture:
> [`lib/fixtures/golden-nest.ts`](../lib/fixtures/golden-nest.ts) · render helpers:
> [`lib/nest-render.ts`](../lib/nest-render.ts) · stage:
> [`components/nest/golden-nest-stage.tsx`](../components/nest/golden-nest-stage.tsx) · route:
> [`app/design/golden-nest/page.tsx`](../app/design/golden-nest/page.tsx).

## How the renderer works

1. **The page** (`app/design/golden-nest/page.tsx`, a server component) loads the four fixture
   exports — `GOLDEN_NEST_TEMPLATE`, `GOLDEN_NEST_ASSETS_BY_ID`, `GOLDEN_NEST_INTERACTIONS_BY_ID`,
   `GOLDEN_NEST_COMPOSED` — and passes them to the stage. It owns no layout logic.
2. **Pure resolution** (`lib/nest-render.ts`, `resolveRenderPieces`) turns the `ComposedNest`
   into an ordered `NestRenderPiece[]`: for each slot assignment it finds the slot on the template,
   looks up the asset, resolves the interaction (assignment → asset → slot precedence, reusing the
   M1 `resolveInteractionId`), resolves the variant, flags a missing asset, and **sorts by slot
   `zIndex`** (back to front). This is framework-free and unit-tested.
3. **The stage** (`components/nest/golden-nest-stage.tsx`, a client component) renders:
   - the **template background** image (`backgroundImageUrl`) with a warm gradient fallback,
   - each piece **absolutely positioned** from its normalized slot `bounds` (via `slotBoxStyle`
     → CSS `%`), at the slot's `zIndex`,
   - an **ambience tint** overlay from the active preset (soft-light blend, capped opacity),
   - tap interactions + a **selected-object state panel**,
   - a toggleable **slot debug overlay** (dashed bounds, `slotType · z · importance`, anchor dot).
4. **Aspect ratio** comes from the template (`aspectRatioCss("3:4")` → `"3 / 4"`); the scene is a
   mobile-first column (`max-width: min(92vw, 420px)`, centered) so it reads as a phone on desktop.

## What is fixture-driven (not hardcoded)

Everything structural reads from the contract:

| Rendered thing | Source field |
|---|---|
| Scene shape | `template.aspectRatio` |
| Background | `template.backgroundImageUrl` |
| Object position + size | `slot.bounds` (normalized 0..1) |
| Paint order | `slot.zIndex` |
| Which asset is where | `composed.slotAssignments[].assetId` |
| Object art | `asset.imageUrl` (with graceful fallback) |
| Variant tint | `assignment.variantId` → `asset.variants[]` |
| Interactivity + behaviour | resolved `interactionId` → `Interaction` |
| CTA label | `interaction.contentType` → `interactionActionLabel` |
| Content link | `assignment.content.url` |
| Ambience moods | `template.ambiencePresets[]` |
| Debug metadata | `slot.slotType / zIndex / importance / anchorPoint` |

Adding a slot, asset, interaction, or changing a bound in the fixture changes the render with **no
component edits**.

## Interactions (MVP)

Tapping an interactive object selects it (saffron ring), shows the state panel, and runs a
placeholder effect derived from the interaction's `animation` (`interactionEffect`):

| Interaction | Effect | Behaviour |
|---|---|---|
| `tv_glow_open_youtube` | `glow` | toggles a warm glow; panel shows **Open YouTube** (links out if `content.url` set) |
| `book_open_article` | `open` | toggles an "opened" scale/lift; panel shows **Open Article** |
| `lamp_toggle_ambience` | `ambience` | cycles the Nest's ambience preset; lamp glows |
| `frame_zoom_gallery` | `zoom` | toggles a zoom/raise; panel shows **Open Gallery** |
| `plant_wiggle` | `wiggle` | one-shot leaf-sway (re-keyed each tap); ambient, no content |

Non-interactive pieces (desk, books-with-no-binding, avatar) render statically and are not
focusable. The selected panel lists the interaction id, animation, content type, live state, and
the **reduced-motion fallback**.

## Reduced motion

Honored via the existing global rule in `app/globals.css`
(`@media (prefers-reduced-motion: reduce)` neutralizes keyframe animations app-wide). The stage's
scoped `<style>` additionally disables its transitions and the wiggle animation under the same
query, so glow/open/zoom/wiggle become instant state changes rather than motion.

## The art pack (M3)

As of M3 the Nest renders a **real front-facing art pack** instead of icon blocks.

**Where the files live:** `public/nests/golden-nest-v1/` — served at `/nests/golden-nest-v1/*`.

**Naming convention** (one PNG per fixture stem; the fixture's `asset({ art })` field maps
asset → file):

| File | Used by |
|---|---|
| `background.png` | `template.backgroundImageUrl` (the empty front-facing stage) |
| `tv.png` | `ast-tv` (media slot) |
| `frame.png` | `ast-framed-photo` (frame slot) |
| `bookshelf.png` | `ast-bookshelf` (shelf slot) |
| `books.png` | `ast-stacked-books` (books slot) |
| `desk.png` | `ast-desk` (desk slot) |
| `plant.png` | `ast-potted-plant` (plant slot) |
| `lamp.png` | `ast-floor-lamp` (lamp slot) |
| `avatar.png` | `ast-avatar` (avatar slot) |

**Image requirements** (ADR-028 + Visual DNA):
- **Background**: 3:4 portrait, front-facing cinematic stage — full front wall + small left/right
  wall slivers + a slight floor depth. **No** isometric, **no** perspective-warped wall image.
  Baked warm ambient light (key from upper-left), an empty stage (no furniture baked in).
- **Assets**: **transparent PNG**, front-facing, one object isolated, warm/rounded/matte, a single
  accent, the **same upper-left key light** and one consistent scale language. Wall assets read
  fronto-parallel; floor assets are bottom-anchored in their slot.

**How these were produced (current state = designed placeholders):** real raster/photoreal art was
not available, so the pack is **hand-authored vector art** (DNA-following SVGs) rasterized to PNG by
[`scripts/build-golden-nest-art.mjs`](../scripts/build-golden-nest-art.mjs) (Node 20 + `sharp`).
They are *not* AI-generated and *not* final art — they are designed stand-ins that prove the
front-facing emotional direction. Regenerate with: `node scripts/build-golden-nest-art.mjs`.

**How to replace an asset with final art:** drop a real PNG over the **same filename** in
`public/nests/golden-nest-v1/` (e.g. overwrite `tv.png`). No code change — the fixture and renderer
already point there. (To add separate LOD/thumbnail or WebP, set `imageUrl`/`thumbnailUrl` in
`lib/fixtures/golden-nest.ts`.) The renderer shows the icon-block fallback only if an image is
missing or 404s.

**Renderer behaviour with art:** `Piece` shows `asset.imageUrl` by default and reveals the
icon-block placeholder *only* on a missing/failed image — a deterministic, hydration-safe rule (no
dependence on `onLoad` firing after SSR). The background image behaves the same, falling back to the
warm gradient. Selection ring, glow/open/zoom/wiggle effects, and z-ordering wrap the art unchanged.

## What remains placeholder

- **The art itself** is designed-placeholder vector art (see above), not final raster/photoreal
  Nestudio art. Replace per the table above when the real Asset Library V2 is authored.
- **Slot geometry** is hand-authored in the fixture (reasonable, not final calibration).
- **Content links** are sample URLs in the fixture; interaction effects are placeholder visuals
  (no real content views yet).

## What is intentionally NOT built (M2/M3 scope)

- The **Nest Composer** (creator profile → template → assets-into-slots).
- **Editor UI**, **drag-and-drop**, **AI composition**.
- **Supabase / persistence** and SQL parity for the V2 types.
- **Real asset/image generation**; no OpenAI calls.
- Any change to V1 code (room engine, village, studio) — this is purely additive under `/design`.

## V2 — premium transparent cut-outs + zoned recomposition

The Golden Nest now ships a **V2** pack of real transparent cut-outs with a re-authored spatial
layout. The prototype at `/design/golden-nest` has a **V1 / V2 comparison switch**
([`components/nest/golden-nest-compare.tsx`](../components/nest/golden-nest-compare.tsx)); V1 and V2
art are never mixed (one pack at a time). V1 fixture is unchanged.

### Cut-out pipeline (how V2 objects got real alpha)
The supplied `-v2` source art was flattened RGB (opaque white / baked checkerboard). Genuine
transparent cut-outs are produced by **rembg** segmentation — model **`isnet-general-use`** with
alpha matting — then light Pillow post-processing (drop near-zero alpha halo, trim to content,
re-pad ~8% so the subject never touches an edge):
[`scripts/cutout-golden-nest-v2.py`](../scripts/cutout-golden-nest-v2.py) (isolated venv; not an app
dependency). Sources stay untouched in `public/nests/golden-nest-v1/`; outputs go to
**`public/nests/golden-nest-v1/cutouts-v2/`**. Validation:
[`scripts/validate-golden-nest-v2-cutouts.py`](../scripts/validate-golden-nest-v2-cutouts.py) →
`metadata/reports/golden-nest-v2-cutout-validation.*` (all 8 objects: RGBA, min α 0, 48–88%
transparent, no checkerboard, no edge-touch). Visual contact sheet (checkerboard/charcoal/plaster):
`metadata/reports/golden-nest-v2-cutouts-preview.png`.

### Final relative-scale system (avatar height = 1.0)
Authored in [`lib/fixtures/golden-nest-v2.ts`](../lib/fixtures/golden-nest-v2.ts); avatar rendered
height = **0.44** of scene height. Each slot records its ratio as `slot.scaleRef` (shown in the
overlay). Box width:height matches the cut-out's pixel aspect so `object-contain` fills the box
with no letterbox.

| Object | scaleRef (×avatar) |
|---|---|
| avatar | 1.00 |
| floor lamp | 0.95 |
| TV (width) | 0.78 |
| plant | 0.48 |
| desk (height) | 0.46 |
| frame (width) | 0.28 |
| books (width) | 0.14 |
| ~~bookshelf~~ | ~~0.95~~ *(library only — not in the presentation Nest)* |

### Final V2 composition — **seven** objects (visual lock)

The presentation Nest renders **seven** objects. The **bookshelf was removed** from the composed Nest
(`GOLDEN_NEST_V2_COMPOSED`): the background's baked right-wall niche already reads as the architectural
storage, so an extra bookshelf duplicated it. The `ast-bookshelf` asset **and** `slot-bookshelf`
remain in the library/template for future use — only the *assignment* was dropped. (Seven excellent
objects > eight crowded ones.)

| Slot | Asset | Zone | Plane | bounds `{x,y,w,h}` | anchor | z | shadow |
|---|---|---|---|---|---|---|---|
| slot-frame | framed photo | media (wall) | front_wall | `0.205,0.20,0.165,0.12` | `0.288,0.26` | 1 | no |
| slot-media | TV + console | media (hero) | floor | `0.27,0.48,0.46,0.222` | `0.50,0.702` | 2 | yes |
| slot-lamp | floor lamp | ambience (back-left) | floor | `0.01,0.30,0.16,0.418` | `0.09,0.718` | 3 | yes |
| slot-desk | desk + chair | workspace (low-right) | floor | `0.55,0.748,0.305,0.202` | `0.703,0.95` | 4 | yes |
| slot-plant | plant | centre-front (balance) | floor | `0.3395,0.775,0.201,0.21` | `0.44,0.985` | 4 | yes |
| slot-books | books | accessory (on desk) | foreground | `0.648,0.788,0.085,0.0365` | `0.691,0.825` | 5 | no |
| slot-avatar | avatar | foreground-left | floor | `0.03,0.525,0.241,0.44` | `0.1505,0.965` | 6 | yes |
| ~~slot-bookshelf~~ | ~~bookshelf~~ | *(removed — niche is architecture; asset kept in library)* | — | — | — | — | — |

Z-order back→front: frame(1) → media(2) → lamp(3) → desk(4)/plant(4) → books(5) → avatar(6).

**Final visual-lock slot changes** (this sprint): bookshelf assignment **removed**; **plant** moved
from the crowded left (`0.18,0.73` ×0.58) to centre-front for balance (`0.3395,0.775` ×0.48);
**avatar** nudged left (`x 0.045→0.03`) so it sits clearly left of the media zone. (The failed V1
layout — all objects clustered on the front wall — is **not** reused.)

### Contact-shadow behaviour
Floor-standing objects (`slot.contactShadow: true`) get a soft `.nest-contact-shadow` ellipse:
warm **cool-plum** `rgba(70,54,90,~0.34→0)` radial gradient, width 72% of the box, `aspect-ratio
6:1` (flat), blurred 2px, nudged just below the object base — never hard black. Wall objects (frame)
and on-surface accessories (books) get **no** floor shadow. The fields are optional on `SceneSlot`,
so V1 slots (which omit them) render exactly as before.

### Presentation vs debug modes (visual lock)
`/design/golden-nest` has two explicit modes ([`golden-nest-experience.tsx`](../components/nest/golden-nest-experience.tsx)):
- **Presentation (default)** — the Nest is the hero: a compact header (Nestudio · Nest name + a small
  *Debug* button) and the scene with its bottom drawer. **No** ADR/contract copy, file refs, object
  count, V1/V2 switch, or overlays. Always renders **V2**.
- **Debug (internal)** — adds the **V1 Reference / V2 Golden Nest** switch (selected = solid dark
  pill), the slot-overlay toggle, the object count, and the implementation notes. Overlays show slot
  id · asset id · z · plane · scaleRef · bounds · anchor. Debug content never leaks into presentation.

### Interaction drawer
Tapping an object selects it and opens a compact **bottom sheet** inside the scene
([`Drawer` in golden-nest-stage.tsx](../components/nest/golden-nest-stage.tsx)): object name, content
type/title, **one** clear action, and a close (×). Actions: TV → *Watch latest video*↗, Frame →
*Open gallery*, Books → *Read article*↗, Lamp → *Change ambience*, Avatar → *Meet the creator*, Plant →
ambient (no action). When collapsed it is a small high-contrast "Tap an object to explore" pill that
does **not** permanently reduce the room area. Effect halos use silhouette-following `drop-shadow`
(never rectangular `box-shadow`/ring), so no object reads as a pasted sticker/card.

### Mobile
Verified at **375×812 · 390×844 · 430×932**: scene uses **91–93%** of width, 3:4 preserved, **no
horizontal overflow**, the **entire Nest is visible without scrolling**, TV + avatar are large tap
targets, zones stay separated. `prefers-reduced-motion` is honored (global rule + scoped guard
neutralizing transitions, wiggle, and the drawer slide).

## Future animation contract (documented only — not implemented)
When animated states are added later, extend an asset's interaction state with these optional fields
(no heavy system this sprint; MVP stays CSS transforms + state-image swaps):

```
idleImageUrl          // resting frame (defaults to imageUrl)
activeImageUrl        // hover/selected still
animationUrl          // short loop source
animationFormat       // "css" | "webp" | "lottie" | "webm-alpha"  (NOT gif)
durationMs            // loop length
loop                  // boolean
reducedMotionFallback // still image to show under prefers-reduced-motion
```
Preferred formats, in order: **CSS transforms** (simple movement) → **animated WebP** (short
transparent raster loops) → **Lottie** (vector effects) → **alpha WebM** (richer approved loops).
GIF is not a production format.

## Remaining visual weaknesses (honest)
- **Plant is centre-front** — it balances avatar-left / desk-right and de-crowds the left, but a plant
  in the middle of the floor is slightly unusual; a future background with a clear side niche could
  return it to a side.
- **Contact shadows are uniform ellipses**, not per-footprint perspective shadows (fine for MVP).
- **Interaction effects are placeholder CSS** (glow/zoom/lift/sway/ambience) — no real content panels
  yet (video/gallery/article views); the drawer CTA links out or is inert.
- The right niche is **baked into the background**, so its "storage" can't be interactive until a real
  shelf asset is placed there later.

## What is still NOT built (scope)
- The **Nest Composer** (creator profile → assets-into-slots), editor UI, drag-and-drop, AI composition.
- **Supabase / persistence** + SQL parity for the V2 types.
- **Real interaction content panels** (video embed/gallery/article) — effects remain placeholder
  CSS states; wire real views later (reuse V1 `object-action-modal` patterns).
- Any change to V1 app code (room engine, village, studio) — all V2 work is additive under `/design`.
