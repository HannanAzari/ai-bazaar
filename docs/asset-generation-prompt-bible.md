# Asset Generation Prompt Bible — Production Pack V1

> **Exact generation prompts** for the Nestudio Production Pack V1 (Golden Nest). Every
> prompt is authored to the locked **front-facing cinematic camera** (ADR-028) and the
> **Visual DNA** ([`docs/nestudio-visual-dna.md`](nestudio-visual-dna.md)). Prompt jobs are
> keyed to [`metadata/asset-generation-queue-v1.json`](../metadata/asset-generation-queue-v1.json)
> (`promptRef` anchors) and produce the assets in
> [`metadata/production-pack-v1.json`](../metadata/production-pack-v1.json).
>
> **This sprint does not run generation.** These prompts are the operator's script for the
> *next* step. No images are produced here.

---

## 0. How to use this bible

For each generation job:

```
FINAL PROMPT = §1 BASE DNA PROMPT
             + the job's per-category prompt (§3–§4)
             + the specific asset's subject line (name + accent + material from the pack)
NEGATIVE     = §2 SHARED NEGATIVE (+ any per-category negative)
```

Generate at the job's `master` resolution, then cut out / deliver per §5, then run the §6
validation before the two-reviewer Style Lock (visual-dna §26, pass ≥ 85).

**The one-accent rule:** each object gets **exactly one** accent colour, drawn from the
locked personality set — *sage · caramel · dusty lilac · mustard · rust · teal · cobalt ·
emerald · electric violet · clay terracotta*. Neutral pieces (lamps, plants, rugs, generic
storage) stay accent-light. The pack's per-asset `tags` name the intended accent where it
matters.

---

## 1. BASE DNA PROMPT (prepend to every job)

```
Cozy handcrafted stylized 3D illustration in the "Nestudio" style: warm, premium-matte,
rounded, soft-edged forms with thick readable silhouettes. Warm earthy palette — oiled oak,
warm plaster, parchment, oatmeal — with restrained soft form-shading and subtle ambient
occlusion. Soft warm key light from the upper-left, gentle ambient fill, cool-plum shadow
(#46365a), never neutral grey. Front-facing cinematic camera, eye-level to slightly
elevated, gentle ~5-10 degree downward tilt — you feel inside the room facing the wall.
Parallel / near-orthographic, no strong perspective convergence. Matte finish throughout,
no gloss, no chrome, no plastic sheen. Friendly, slightly exaggerated but grounded
proportions. Calm, uncluttered, generous negative space. Crisp and readable at small size.
```

---

## 2. SHARED NEGATIVE (append to every job)

> Kept verbatim in the queue as `_meta.sharedNegative`.

```
photorealism, photo, photoreal render, harsh gloss, chrome, glass shine, specular
highlights, plastic sheen, neon, lens flare, dramatic lighting, sunset lighting, night
lighting, hard cast shadows, isometric, 30 degree angle, top-down, one-point tunnel
perspective, dutch tilt, fisheye, vanishing-point convergence, baked checkerboard,
transparency checkerboard pattern, white background, gray studio background, baked
room/floor/wall behind object, baked floor shadow, contact shadow, text, letters,
watermark, logo, UI, caption, signature, clutter, busy, ornate, baroque, anime, painterly,
flat vector, clipart, sticker-art, kawaii, chibi, Animal Crossing, Stardew Valley, The Sims,
Dreamlight Valley look
```

Per-category negatives are noted inline below.

---

## 3. Backgrounds (empty front-facing stages)

**Shared background rules.** 3:4 portrait, master 1080×1440, delivered WebP ≤ 350 KB,
**opaque** (no transparency). The stage is **EMPTY** — no furniture, props, or people baked
in. Full front wall + narrow slivers of the left/right walls + a floor that meets the wall
at a seam in band **y≈0.58–0.64**. Calm, low-detail, soft value range, generous empty wall
and floor so furniture (added by the engine) is the star. Soft window daylight + gentle warm
interior glow, upper-left consistent. Keep the floor band low-busy with enough value range
for a soft plum contact shadow to read on top of it.

**Background negative (add):** `furniture, sofa, chair, table, desk, lamp, plant, rug, tv,
shelf, people, person, pre-furnished room, floor plan, top-down room, tunnel room, single
flat wall backdrop`.

### <a id="background-living-warm-studio"></a>`background-living-warm-studio` → `bg-lr-warm-studio`
```
An empty cozy living-room stage. Warm plaster walls in soft honey-oatmeal (#e6cfa9), a warm
oiled-oak wood floor, a soft window on the upper-left casting gentle daylight. Full front
wall with narrow left and right wall slivers raking gently inward, floor tilting up to meet
the wall at a seam around 62% down the frame. Calm, warm, neutral, inhabited-feeling but
completely unfurnished. Soft warm upper-left light, cool-plum ambient shadow.
```

### <a id="background-living-gallery-loft"></a>`background-living-gallery-loft` → `bg-lr-gallery-loft`
```
An empty light gallery-loft living-room stage. Cool-tinted pale plaster walls (#ece4d6),
warm wood floor, clean art-forward feel, soft high window light from the upper-left. Same
front-facing camera and floor seam (~62%) as the warm-studio stage — a lighter recolour of
the same calm room, not a different scene. Unfurnished, calm, generous negative space.
```

### <a id="background-office-focused"></a>`background-office-focused` → `bg-so-focused-office`
```
An empty focused home-office stage. Warm plaster walls with a soft olive tint (#e3ddca),
warm wood floor, calm and quiet, soft upper-left window daylight. Full front wall + narrow
side slivers + floor meeting the wall at ~62%. Unfurnished, low-detail, room left for a desk
and shelving. Warm upper-left key, cool-plum shadow.
```

### <a id="background-office-garden-study"></a>`background-office-garden-study` → `bg-so-garden-study`
```
An empty garden-room study stage. Fresh green-tinted plaster walls (#d8e4c6), warm wood
floor, a soft large window on the front wall glowing with gentle daylight and hinting at
greenery outside (soft, abstract, no detailed foliage). Same front-facing camera + floor
seam (~62%). Unfurnished, planty, calm, airy.
```

---

## 4. Objects (transparent PNGs)

**Shared object rules.** One object, isolated, centered, fully in frame, **transparent
background with true alpha** — no baked room/floor/wall, **no baked floor or contact
shadow** (the engine composites the plum contact ellipse). Baked self-shading only, agreeing
with the upper-left key. Master transparent PNG 1024×1024; delivery WebP ≤ 400 KB. The
object's pixel aspect must match its `visualBounds.aspect` in the pack. Front-facing camera,
warm matte rounded DNA, one accent.

### <a id="object-seating-sofa"></a>`object-seating-sofa` → sofas (3)
```
A single cozy two-seater sofa, front-facing, rounded plump-but-tailored cushions and soft
rounded arms, warm oiled-oak feet. {SUBJECT}. Premium matte upholstery with gentle even
drape, one confident accent colour, soft upper-left shading, cool-plum self-shadow. Isolated
on transparent background, no floor, no shadow.
```
Subjects: bouclé cream two-seater (`ast-lr-sofa-boucle`, accent cream/oatmeal); linen sand
lounge sofa (`ast-lr-sofa-linen`, accent sand); rust velvet sofa (`ast-lr-sofa-velvet`,
accent rust — the accent piece). *Velvet = matte velvet nap, NO sheen.*

### <a id="object-seating-chair"></a>`object-seating-chair` → chairs (3)
```
A single chair, front-facing three-quarter, rounded soft forms, warm oak or matte frame.
{SUBJECT}. Premium matte, one accent, soft upper-left shading. Isolated on transparent
background, no floor, no shadow.
```
Subjects: soft task chair with a rounded matte-fabric back (`ast-so-chair-task`, accent
teal); wooden desk chair, warm oak, felt seat pad (`ast-so-chair-wooden`, accent caramel);
plump reading lounge chair (`ast-so-chair-lounge`, accent dusty lilac).

### <a id="object-surface-table"></a>`object-surface-table` → coffee/side tables (3)
```
A single low table, front-facing, rounded soft-cornered top, warm oiled-oak or walnut, tapered
soft legs. {SUBJECT}. The top surface is a clean, empty flat plane (nothing on it). Premium
matte, soft upper-left shading. Isolated on transparent background, no floor, no shadow.
```
Subjects: oak round coffee table (`ast-lr-table-oak-round`); walnut rectangular coffee table
(`ast-lr-table-walnut-rect`); pair of oak nesting side tables (`ast-lr-table-nesting`).
**Empty top** — projected accessories are added separately.

**Table negative (add):** `objects on table, books on table, cup on table, decor on top`.

### <a id="object-desk-surface"></a>`object-desk-surface` → desks (3)
```
A single work desk, front-facing, rounded soft-cornered warm-oak top, clean simple legs or
frame. {SUBJECT}. The desktop is a clean EMPTY flat surface — no laptop, no lamp, no mug,
nothing on it. Premium matte, soft upper-left shading. Isolated on transparent background,
no floor, no shadow.
```
Subjects: oak writing desk with a slim drawer (`ast-so-desk-oak`); minimal standing desk,
warm-oak top (`ast-so-desk-standing`); compact corner desk (`ast-so-desk-compact`).
**The desk is a Focus-scene parent — the empty surface is intentional** (laptop, lamp, mug,
notebook are projected children).

**Desk negative (add):** `laptop, monitor, computer, lamp, mug, books, clutter on desk`.

### <a id="object-media-editable-screen"></a>`object-media-editable-screen` → TV/media units, laptops, monitors (6)
```
{SUBJECT}, front-facing. The SCREEN is an EMPTY, flat, warm-dark matte panel with a very
subtle soft reflection — NO image, NO video, NO content on the screen, a blank warm-off
display. Rounded soft body, warm oiled-oak or matte casing, premium matte, one accent trim.
Soft upper-left shading, cool-plum self-shadow. Isolated on transparent background, no floor,
no shadow. Also provide the "open/on" state: the same object with the screen softly glowing
warm (still no baked content — just an even warm glow).
```
Subjects: oak media console with a wide TV on top (`ast-lr-media-oak-console`, console top a
clean surface); slim floating wall TV (`ast-lr-media-floating`); low media cabinet + TV
(`ast-lr-media-cabinet`); open laptop, warm-oak deck (`ast-so-laptop`); single desktop
monitor on a soft stand (`ast-so-monitor`); dual-monitor setup (`ast-so-monitor-dual`).

**Why empty screen:** the creator's `video`/`website` content is composited by the engine
into the `screen` editable surface. A baked screen image would be un-editable and off-DNA.
Generate **two states** (`idle`, `open`).

**Screen negative (add):** `screen content, image on screen, video on screen, youtube ui,
app ui, wallpaper on screen, bright white screen, glossy glass glare`.

### <a id="object-frame-editable-photo"></a>`object-frame-editable-photo` → frames/posters, mini-frames (5)
```
{SUBJECT}, front-facing, rounded soft-cornered warm-oak or matte frame with a warm mat
border. The photo APERTURE inside the frame is an EMPTY warm cream mat — NO photo, NO image,
NO picture inside it, just a soft blank inset. Premium matte, one accent on the frame edge,
soft upper-left shading. Isolated on transparent background, no floor, no shadow. Also
provide the "open/zoom" state (same frame, a soft warm highlight ring).
```
Subjects: portrait photo frame (`ast-lr-frame-portrait`); landscape photo frame
(`ast-lr-frame-landscape`); frameless arched art poster panel (`ast-lr-poster-arch` — the
whole panel is the empty art surface); tiny console mini-frame (`ast-fx-console-mini-frame`);
tiny shelf mini-frame (`ast-fx-shelf-frame-mini`).

**Why empty aperture:** the creator's `gallery` image is composited into the `photo` surface.

**Frame negative (add):** `photo inside frame, picture inside frame, portrait of a person,
image inside, printed art inside`.

### <a id="object-books-editable-cover"></a>`object-books-editable-cover` → books/notebooks (6)
```
{SUBJECT}, front-facing, rounded soft-cornered warm matte covers. The visible top cover /
open page is a CLEAN PLAIN warm surface — NO title, NO text, NO printed cover art, just a
soft matte cover in a warm tone. Premium matte cloth/paper feel, one accent. Soft upper-left
shading. Isolated on transparent background, no floor, no shadow.
```
Subjects: small stack of coffee-table books (`ast-lr-books-stack`); single closed notebook
(`ast-so-notebook`); short row of books (`ast-so-books-row`); open journal (`ast-so-journal-open`,
blank warm pages); desk notebook (`ast-fx-desk-notebook`); shelf book row (`ast-fx-shelf-book-row`).

**Why plain cover:** the `cover` editable surface / a cover-skin (§4.13) supplies the design.

**Books negative (add):** `title text, cover text, printed title, author name, book cover art,
lettering on spine`.

### <a id="object-bookshelf"></a>`object-bookshelf` → bookshelves (2)
```
{SUBJECT}, front-facing, warm oiled-oak, rounded soft-cornered frame, open shelves. Shelves
are mostly EMPTY with only a few soft structural books/objects built in — leave open room on
the shelves. Premium matte, one accent, soft upper-left shading. Isolated on transparent
background, no floor, no shadow. Also provide the "open" state (a soft warm highlight).
```
Subjects: tall four-shelf bookshelf (`ast-so-shelf-tall`); low cube storage shelf
(`ast-so-shelf-cube`). **Mostly-empty shelves are intentional** — projected shelf children
(book rows, mini plants, trinkets, mini-frames) fill them in the Focus scene.

### <a id="object-lamp"></a>`object-lamp` → lamps (5)
```
{SUBJECT}, front-facing, warm oak or powder-coated matte stem, soft rounded matte shade.
Premium matte, warm and inviting, one gentle accent. Soft upper-left shading. Isolated on
transparent background, no floor, no shadow. Provide two states: "off" (shade unlit, warm
matte) and "on" (the shade glowing a soft warm amber from within — glow only on the shade
itself, NO cast light pool, NO light rays, NO glow on any ground).
```
Subjects: arc floor lamp (`ast-lr-lamp-arc`); tripod floor lamp (`ast-lr-lamp-tripod`); small
globe table lamp (`ast-lr-lamp-globe`); articulated desk task lamp (`ast-so-lamp-desk`);
brass-look table lamp — **powder-coated matte, not shiny brass** (`ast-so-lamp-brass`).

**Lamp negative (add):** `light rays, glowing floor, cast light pool, lens glow, chrome, shiny
brass, mirror finish`.

### <a id="object-plant"></a>`object-plant` → plants (6)
```
{SUBJECT}, front-facing, soft matte rounded leaf masses (simplified, not photoreal leaves),
warm matte or woven pot. Premium matte, gentle green palette, soft upper-left shading.
Isolated on transparent background, no floor, no shadow.
```
Subjects: fiddle-leaf fig in a warm pot (`ast-lr-plant-fiddle`); monstera in a woven basket
(`ast-lr-plant-monstera`); small trailing pothos in a hanging/shelf pot (`ast-lr-plant-trailing`);
tiny desk succulent (`ast-so-plant-desk-succulent`); corner palm (`ast-so-plant-corner-palm`);
mini shelf plant (`ast-fx-shelf-plant-mini`).

### <a id="object-rug"></a>`object-rug` → rugs (2)
```
{SUBJECT}, viewed front-facing and foreshortened as if lying flat on the floor, tilting away
from the viewer at a gentle angle (matching a ~7 degree camera tilt). Soft matte woven
texture, warm palette, simple rounded pattern, one gentle accent. Even soft shading. Isolated
on transparent background, no floor beneath, no shadow (the rug IS the floor layer).
```
Subjects: rectangular berber-style cream rug (`ast-lr-rug-berber`); round sage rug
(`ast-lr-rug-round-sage`).

**Rug negative (add):** `standing upright, hanging, wall rug, thick pile, shadow under rug`.

### <a id="object-pinboard"></a>`object-pinboard` → pinboards (2)
```
{SUBJECT}, front-facing, rounded soft-cornered warm frame. The board face is COMPLETELY EMPTY
— NO notes, NO photos, NO pins, NO paper on it, just a clean bare board surface (soft cork
texture / warm wire grid). Premium matte, warm, one gentle accent on the frame. Soft
upper-left shading. Isolated on transparent background, no floor, no shadow.
```
Subjects: cork pinboard in a warm oak frame (`ast-lr-pinboard-cork`); wire-grid pinboard,
powder-coated matte (`ast-so-pinboard-grid`).

**Why empty board:** note/photo children are composited on top via the `note-board` surface.

**Pinboard negative (add):** `notes on board, photos on board, pinned papers, sticky notes,
pins, clutter on board, text`.

### <a id="object-small-decor"></a>`object-small-decor` → small decor + console/desk/shelf accessories (7)
```
{SUBJECT}, front-facing, small rounded matte object, warm palette, one gentle accent. Premium
matte ceramic / oak / soft matte. Soft upper-left shading. Isolated on transparent
background, no floor, no shadow. Must stay clearly readable when shown very small.
```
Subjects: ceramic vase + bowl set (`ast-lr-decor-ceramic-set`); TV remote (`ast-fx-console-remote`);
small speaker, soft matte fabric (`ast-fx-console-speaker`); shelf trinket / small sculpture
(`ast-fx-shelf-trinket`); coffee mug (`ast-fx-desk-mug`); pen cup with pens (`ast-fx-desk-pencup`);
desk clock, matte face, static hands (`ast-fx-desk-clock`). *No live time; static hands, no
numerals text if it hurts small-size readability.*

### <a id="object-note-sticker"></a>`object-note-sticker` → notes / stickers (3)
```
{SUBJECT}, front-facing flat, small, soft matte paper / tape, warm palette, one gentle accent.
The note face is a CLEAN blank warm surface — NO handwriting, NO text. Soft even shading.
Isolated on transparent background, no floor, no shadow.
```
Subjects: square sticky note, slight curl at one corner (`ast-fx-note-sticky`); short strip of
washi tape (`ast-fx-note-washi`); single push pin, matte head (`ast-fx-note-pin`, carries the
room accent).

**Note negative (add):** `handwriting, text, letters, doodle, printed note`.

### <a id="surface-book-cover"></a>`surface-book-cover` → book cover skins (3)
```
A flat book-cover design skin, front-facing, filling the frame. A soft matte cover in a warm
DNA-consistent palette with a simple rounded abstract motif (soft shapes, gentle bands) and
ONE accent colour. NO title, NO text, NO author name, NO lettering of any kind. Premium
matte cloth/paper feel, even soft shading. Transparent background outside the cover
rectangle.
```
Subjects: warm-toned cover (`ast-fx-bookcover-a`, accent caramel); sage cover
(`ast-fx-bookcover-b`, accent sage); cobalt cover (`ast-fx-bookcover-c`, accent cobalt — the
accent skin). These re-texture a book/notebook's `cover` editable surface.

### <a id="surface-photo"></a>`surface-photo` → photo surface skins (2)
```
A soft, abstract, matte placeholder "photo" card, front-facing, filling the frame — a gentle
warm out-of-focus scene of soft shapes and warm light (like a cozy blurred memory), NO faces,
NO people, NO recognizable objects, NO text. Warm DNA palette, even soft shading. Fills the
whole rectangle to sit inside a frame aperture. Transparent background outside the card.
```
Subjects: portrait 3:4 (`ast-fx-photo-surface-portrait`); landscape 4:3
(`ast-fx-photo-surface-landscape`). These fill a frame's `photo` surface so an unbound frame
still reads as "a photo."

---

## 5. Delivery & cutout

- **Objects & surfaces:** master transparent **PNG 1024×1024** → cut out to **true alpha**
  (no white/gray halo, no checkerboard baked in), trim to the object's pixel bounds so the
  aspect matches `visualBounds.aspect`, deliver a **WebP ≤ 400 KB** variant beside the PNG.
  Multi-state assets (media/frame/lamp/bookshelf) deliver one file per state
  (`<id>.png`, `<id>--open.png`, etc.), matching `NestAsset.states[].transparentPngUrl`.
- **Backgrounds:** **opaque WebP ≤ 350 KB**, 1080×1440, no alpha.
- **Paths:** `public/nests/production-v1/{backgrounds,objects,surfaces}/` (confirm — see
  plan §5.4). Wire into a fixture (`imageUrl`/`thumbnailUrl`/`transparentPngUrl`) after
  approval.

---

## 6. Validation (before the Style Lock)

Auto-reject on any hard failure (queue `validationGate`):

**Objects/surfaces:** true alpha · no baked background · no checkerboard · **no baked floor
shadow** · self-shadow matches upper-left key · isolated & uncropped · aspect matches
`visualBounds` · readable at 64px & 128px · **editable surface region is empty and aligns to
the declared bounds** (screen/photo/cover/board carry no baked content).

**Backgrounds:** opaque · 3:4 · empty stage (no furniture) · floor seam in band 0.58–0.64 ·
clean well-lit zones · value range for the contact shadow.

**Shared:** front-facing camera (5–10° tilt) · warm matte rounded DNA · one accent ·
warm-light/cool-plum-shadow · no photorealism · no harsh gloss · no baked text ·
**originality pass** (cold viewer says "Nestudio," not "Game X").

Then the two-reviewer **Style Lock** (visual-dna §26): six dimensions, pass ≥ 85, hard-gates
on **Perspective Conformance** (front-facing) and **Slot/Furniture Compatibility**.

---

## 7. Coverage — every prompt job

| promptRef anchor | Job id | Assets | States |
|---|---|---:|---|
| `#background-living-warm-studio` | `gp-bg-lr-warm-studio` | 1 | — |
| `#background-living-gallery-loft` | `gp-bg-lr-gallery-loft` | 1 | — |
| `#background-office-focused` | `gp-bg-so-focused-office` | 1 | — |
| `#background-office-garden-study` | `gp-bg-so-garden-study` | 1 | — |
| `#object-media-editable-screen` | `gp-obj-media-editable-screen` | 6 | idle, open |
| `#object-frame-editable-photo` | `gp-obj-frame-editable-photo` | 5 | idle, open |
| `#object-seating-sofa` | `gp-obj-sofa` | 3 | — |
| `#object-seating-chair` | `gp-obj-chair` | 3 | — |
| `#object-surface-table` | `gp-obj-coffee-table` | 3 | — |
| `#object-desk-surface` | `gp-obj-desk-surface` | 3 | — |
| `#object-bookshelf` | `gp-obj-bookshelf` | 2 | idle, open |
| `#object-lamp` | `gp-obj-lamp` | 5 | idle, active |
| `#object-plant` | `gp-obj-plant` | 6 | — |
| `#object-rug` | `gp-obj-rug` | 2 | — |
| `#object-books-editable-cover` | `gp-obj-books-editable-cover` | 6 | — |
| `#object-pinboard` | `gp-obj-pinboard` | 2 | — |
| `#object-small-decor` | `gp-obj-decor-object` | 7 | — |
| `#object-note-sticker` | `gp-obj-note-sticker` | 3 | — |
| `#surface-book-cover` | `gp-surf-book-cover` | 3 | — |
| `#surface-photo` | `gp-surf-photo` | 2 | — |

**20 jobs → 65 assets** (4 backgrounds + 42 objects + 19 focus-detail).
