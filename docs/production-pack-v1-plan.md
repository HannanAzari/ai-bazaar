# Production Pack V1 — Plan (Golden Nest)

> **Sprint M9 — Production Asset & Background Pack V1.** The first curated Nestudio
> **production content pack** for the Golden Nest. This sprint is **documentation +
> metadata + generation prompts only** — no final images are generated, no editor
> features are built, no Supabase, no auth, no AI generation runs. Stop for review.
>
> **✅ M9.1 (contract alignment, done):** the four M9 decisions are approved and now live in
> the contract — 4 slot types added, 2 interactions added, cover/photo skins modeled as
> standalone `surface` assets, output paths confirmed. See §5. Still **no images generated.**
>
> **Sources of truth**
> - Data contract: [`lib/nest-types.ts`](../lib/nest-types.ts) (`NestAsset`, `SceneSlot`,
>   `NestTemplate`, `Interaction`, `ComposedNest`)
> - Worked examples: [`lib/fixtures/golden-nest.ts`](../lib/fixtures/golden-nest.ts),
>   [`lib/fixtures/golden-nest-v2.ts`](../lib/fixtures/golden-nest-v2.ts)
> - Visual law: [`docs/nestudio-visual-dna.md`](nestudio-visual-dna.md) ·
>   Production law: [`docs/golden-nest-production-bible.md`](golden-nest-production-bible.md) ·
>   Camera: ADR-028 (front-facing) · Renderer: [`docs/golden-nest-renderer.md`](golden-nest-renderer.md)
> - **This pack (machine-readable):** [`metadata/production-pack-v1.json`](../metadata/production-pack-v1.json)
> - **Generation queue:** [`metadata/asset-generation-queue-v1.json`](../metadata/asset-generation-queue-v1.json)
> - **Exact prompts:** [`docs/asset-generation-prompt-bible.md`](asset-generation-prompt-bible.md)

---

## 1. Goal

Define and prepare the first **production-ready** asset/background batch that turns the
Golden Nest from placeholder cut-outs into a real, composable content library, entirely
within the locked front-facing camera (ADR-028) and Visual DNA. Everything here is
authored **to** the V2 contract so approved assets drop straight into a fixture / the
future Nest Composer with no code change.

**Explicitly out of scope this sprint** (per the brief): new editor features, redesigning
Focus, authentication, AI generation runs, Supabase, and final image generation. No commit.

---

## 2. Pack structure & counts

**65 assets total** = **4 backgrounds** + **42 object assets** + **19 focus-detail assets**,
across three packs.

| Pack | Backgrounds | Objects | Focus detail | Subtotal |
|---|---:|---:|---:|---:|
| Living Room | 2 | 23 | — | 25 |
| Study / Home Office | 2 | 19 | — | 21 |
| Focus Detail | — | — | 19 | 19 |
| **Total** | **4** | **42** | **19** | **65** |

### 2.1 Living Room Pack (25)
2 backgrounds (warm studio · gallery loft) · **3 sofas** · **3 coffee tables** ·
**3 TV/media units** · **3 lamps** · **3 plants** · **3 frames/posters** · **2 rugs** ·
**2 books/decor** · **1 pinboard**.

### 2.2 Study / Home Office Pack (21)
2 backgrounds (focused office · garden study) · **3 desks** · **3 chairs** ·
**3 laptops/monitors** · **2 bookshelves** · **3 books/notebooks** · **2 table lamps** ·
**2 plants** · **1 pinboard**.

### 2.3 Focus Detail Pack (19)
**3** TV-console detail objects · **4** bookshelf detail objects · **4** desk-surface
objects · **3** book-cover surfaces · **2** frame/photo surfaces · **3** sticker/note
assets. These are the **child / projected objects** and **editable-surface skins** that
populate a parent's Focus detail scene (the completed Focus / nested-editable-scene /
projected-child / editable-surface features).

Every asset's full metadata (id, name, category, transparent-PNG requirement, visual
bounds, default scale, allowed planes, z-index guidance, compatible slot types, hotspot
regions, editable surfaces, projection behaviour, focus suitability, tags, production
status) lives in [`metadata/production-pack-v1.json`](../metadata/production-pack-v1.json).

---

## 3. How the metadata maps to the contract

Each pack asset maps onto a `NestAsset` (`lib/nest-types.ts`). The pack schema is a
**superset** — it adds production/authoring fields the runtime contract doesn't need yet
(visual bounds, hotspot regions, editable surfaces, projection behaviour, focus
suitability, priority, generation prompt id). Mapping:

| Pack field | Contract field | Notes |
|---|---|---|
| `id` / `name` / `category` / `tags` | `NestAsset.id/name/category/tags` | direct |
| `assetType` | `NestAsset.assetType` | hero / standard / filler |
| `transparentPng` | `NestAsset.transparentPngUrl` requirement | true alpha, 1024², WebP delivery ≤ 400 KB |
| `visualBounds` | authors a hosting `SceneSlot.bounds` + `anchorPoint` | footprint + snap point on the 3:4 scene |
| `defaultScale` | `SceneSlot.scaleRef` | avatar height = 1.0 |
| `allowedPlanes` | constrains `SceneSlot.plane` | front_wall / left_sliver / right_sliver / floor / foreground |
| `zIndexGuidance` | `SceneSlot.zIndex` | back → front paint order |
| `compatibleSlotTypes` | `NestAsset.compatibleSlotTypes` | all 14 slot types now **live** (M9.1 — see §5) |
| `interaction.defaultInteractionId` | `NestAsset.defaultInteractionId` | resolves via `resolveInteractionId`; library incl. the 2 M9.1 interactions |
| `editableSurfaces` | `NestAsset.editableSurfaces` (**live, M9.1**) | screen/photo/cover/note-board/surface-projection; see §4 |
| `surfaceKind` (surface assets) | `NestAsset.surfaceKind` (**live, M9.1**) | set when `category === "surface"` |
| `hotspotRegions` | production-only (authoring) | tap sub-regions, mostly in Focus; see §4 |
| `projectionBehaviour` | production-only (authoring) | parent hosts children on a surface; see §4 |
| `focusSuitability` | production-only (authoring) | tap → editable Focus detail scene; see §4 |

Backgrounds map onto `NestTemplate` (`backgroundImageUrl`, `aspectRatio`, `sceneBox`,
`slots`). The pack declares each background's `sceneBox` (reusing the geometry already
proven in the golden-nest fixtures) and which slot layout it leaves clean room for.

---

## 4. The four production-only field families (what makes this a *production* pack)

These extend the runtime contract to carry the completed editor concepts. They are
authoring/production metadata; when the Focus editor and Composer consume them, they
become concrete `SceneSlot` / interaction wiring.

- **`editableSurfaces`** — a creator-customizable region on an object:
  - `screen` (TV/laptop/monitor) → binds `video`/`website`; **rendered empty (warm-off
    matte glass); content is composited by the engine, never baked.**
  - `photo` (frame/poster/mini-frame) → binds `gallery`; **aperture is an empty warm mat.**
  - `cover` (book/notebook/sticky note) → binds `article`; **cover/page left plain, no
    baked title text.**
  - `note-board` (pinboard) → hosts note children; **board empty, children composited.**
  - `surface-projection` (table / desk / shelf top) → a flat surface that hosts projected
    children (see projection below).
  Every surface declares normalized `bounds` + `aspect` so the raster aligns to the engine
  region (validation requirement `editableSurfaceAlignsToBounds`). These map to the live
  `NestAsset.editableSurfaces` / `NestSurfaceKind` (M9.1).

- **`hotspotRegions`** — tappable sub-regions (mostly meaningful inside a Focus scene, e.g.
  a TV screen vs the console surface below it). Each `{ id, label, bounds, action }`.

- **`projectionBehaviour`** — the parent/child model:
  - **Projection parents** (`isProjectionParent`) host children on a surface: media console,
    coffee/side table, desk, bookshelf, pinboard. Each lists which asset ids it `accepts`.
  - **Projectable children** (`isProjectable`) declare `projectionTargets` (slot types they
    can sit on): mugs, laptops, mini-frames, notes, small plants, book stacks.
  This is the "projected child assets" feature — children inherit the parent's placement +
  (by `resolveInteractionId` precedence) can carry their own interaction.

- **`focusSuitability`** — whether tapping zooms into an editable **Focus detail scene**
  (`focusable`, a `focusScene` id, and `childCapacity`). The Focus scenes referenced by the
  pack: `tv-console-detail`, `tv-screen-detail`, `bookshelf-detail`, `desk-surface-detail`,
  `photo-frame-detail`, `book-cover-detail`, `pinboard-detail`, `laptop-screen-detail`.

---

## 5. Decisions — RESOLVED in M9.1 (contract alignment) ✅

All four open decisions from M9 are **approved and implemented** in the live contract. No
image generation was done; this was type/schema/fixture/test alignment only.

### 5.1 Slot taxonomy — seat / table / rug / pinboard ADDED ✅
`NestSlotType` (and `NEST_SLOT_TYPES`) in [`lib/nest-types.ts`](../lib/nest-types.ts) now has
**14 types** — the original 10 plus `seat`, `table`, `rug`, `pinboard`. The exhaustive
`ICON_BY_SLOT` map in `components/nest/golden-nest-stage.tsx` gained matching icons. All
pack assets now snap to a live slot type; **nothing is composition-blocked on taxonomy.**

| Added slot | Assets | Role |
|---|---:|---|
| `seat` | 6 (3 sofas, 3 chairs) | floor seating |
| `table` | 3 (coffee/side tables) | non-desk surface furniture; projection parent |
| `rug` | 2 | floor covering (lowest z, no contact shadow) |
| `pinboard` | 2 | wall board hosting note children |

### 5.2 New interactions ADDED ✅
`laptop_screen_website` (screen_on → website) and `speaker_pulse_music` (pulse → music) are
defined in [`lib/fixtures/production-pack-v1.ts`](../lib/fixtures/production-pack-v1.ts) as
`PRODUCTION_PACK_INTERACTIONS` (the Golden Nest five + these two). The existing
`NestAnimation` / `NestContentType` enums already supported them, so **no type change was
needed** — data only. Every pack `defaultInteractionId` now resolves.

### 5.3 Cover/photo skins → standalone surface assets ✅
Modeled as **standalone surface assets, not variants** (approved). The contract gained
`NestAssetCategory` value `surface`, a `NestSurfaceKind` union, a `NestEditableSurface` type,
and optional `NestAsset.editableSurfaces` / `NestAsset.surfaceKind` (all additive — V1
fixtures unchanged). The 5 skins are materialized as `PRODUCTION_PACK_SURFACE_ASSETS` and the
metadata assets are now `category: "surface"` + `surfaceKind` with `compatibleSlotTypes: []`.

### 5.4 Output paths CONFIRMED ✅
`public/nests/production-v1/{backgrounds,objects,surfaces}/` (recorded in the pack `_meta`
and the queue). The surface fixture points its (not-yet-generated) art at
`/nests/production-v1/surfaces/`.

> **Remaining blockers before generation:** none in the contract. Assets are `spec` /
> `draft` because **no artwork exists yet** — the only remaining input is the go-ahead to run
> generation (tooling + model choice) per the M9 queue. See §8.

---

## 6. Priority & sequencing

Priority is encoded per-asset (`priority`) and batched in the queue.

- **P0 — 10 assets — “prove two premium scenes.”** The smallest slice that upgrades the
  Golden Nest beyond placeholder cut-outs into two real production rooms:
  `bg-lr-warm-studio`, `bg-so-focused-office`, the oak media console (editable screen), a
  bouclé sofa, an oak round coffee table, a portrait frame (editable photo), an oak desk, a
  task chair, and a tall bookshelf. Everything mapped to existing slot types except the
  sofa/chair/table (need §5.1).
- **P1 — 21 assets — “complete both scenes.”** Second backgrounds, lamps, plants, rugs,
  books/notebooks, pinboards, laptops/monitors.
- **P2 — 34 assets — “focus detail.”** All focus-detail children + surface skins; depend on
  the P0 parents existing and the Focus editor.

---

## 7. Validation requirements (the gate every asset must pass)

Enforced at cutout/QA time (queue `validationGate`; full list in the pack `_meta`):

**Object PNGs**
- **True alpha** — real per-pixel transparency; **no** baked white/gray/solid background.
- **No baked checkerboard** — no transparency-checkerboard pattern in the raster.
- **No baked background** — no room/floor/wall/environment behind the object.
- **No baked floor shadow** — objects ship shadowless; the engine composites the cool-plum
  contact ellipse (visual-dna §12). Baked **self-shading** must agree with the upper-left key.
- **Isolated, uncropped, centered**; **aspect matches `visualBounds.aspect`** so
  `object-contain` fills the slot box with no letterbox.
- **Mobile readability** — silhouette + key detail read at **64px and 128px**.
- **Editable surface / hotspot alignment** — screen/photo/cover/board regions land on the
  declared normalized bounds.

**Backgrounds**
- **Opaque**, **3:4**, master **1080×1440**, WebP **≤ 350 KB**.
- **Empty stage** — no baked furniture/props/people.
- **Floor seam in band y≈0.58–0.64**, matching the declared `sceneBox.floorSeamY`.
- **Clean, well-lit zones** for the declared slot layout; floor band low-busy with enough
  value range for the plum contact shadow to read.

**Shared (all)**
- **Front-facing cinematic camera**, ~5–10° tilt — **not** iso/top-down/~30°/one-point tunnel.
- **Warm matte, rounded, one accent**, warm-light `#fff6e0` / cool-plum-shadow `#46365a`,
  upper-left key. **No photorealism, no harsh gloss, no baked text** (unless explicitly a
  text surface and requested). **Originality pass** (reads as Nestudio, not Game X).

---

## 8. Deliverables produced this sprint

- [`docs/production-pack-v1-plan.md`](production-pack-v1-plan.md) — this plan.
- [`docs/asset-generation-prompt-bible.md`](asset-generation-prompt-bible.md) — exact
  generation prompts (base DNA + per-category + negatives + validation) for backgrounds,
  transparent objects, pinboard, editable-screen media, editable-photo frames,
  editable-cover books, desk-surface assets, and the surface skins.
- [`metadata/production-pack-v1.json`](../metadata/production-pack-v1.json) — the full
  typed metadata for all 65 assets + 4 background templates.
- [`metadata/asset-generation-queue-v1.json`](../metadata/asset-generation-queue-v1.json) —
  the prioritized, dependency-ordered generation queue (20 prompt jobs → 65 assets) with a
  per-job validation profile.

**No images. No code changes. No commit.** All four gates (`typecheck · lint · test ·
build`) are run before review because docs/metadata sit in a live repo.
