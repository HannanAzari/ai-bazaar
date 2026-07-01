# Nest Hybrid Focus V1 (M7C.1)

> M7C proved structured in-Nest navigation (`Main Nest → Focus Area → Detail Scene →
> Back`). M7C.1 **refines** it: a Focus Area now resolves to one of **two target types**
> — a **Zoom Region** (enlarge a crop of the existing scene) or a **Detail Surface** (a
> separately authored close-up). It also adds a **measured resolution audit** so we
> decide whether existing artwork holds up under zoom *before* recommending any
> replacement. No new artwork is generated. See **ADR-030**; refines **ADR-029**.

## Why two target types

The original "every focus opens another room" model is wrong for content that already
exists in the Main Nest and only needs to be **bigger** (a bookshelf, a TV console, a
frame). Re-authoring a whole room for those adds nothing. But some surfaces genuinely
*cannot* be revealed by zooming a front-facing scene (a desk top, a benchtop) — there the
camera, not the resolution, is the problem, and a separately composed close-up is right.

| | **Zoom Region** | **Detail Surface** |
|---|---|---|
| What | Enlarge a crop of the **existing** Main scene | A **separately authored** close-up scene |
| Mechanism | CSS transform of the same stage (no scene swap) | Transition into a `NestDetailScene` |
| New art | None | None (composed from existing assets) |
| Use for | bookshelf, TV console, frame, pinboard | desk top, benchtop, DJ console |
| Field | `zoomRegion` (crop + children + strategy) | `detailSurfaceId` (→ Detail Scene) |

## Contract ([`lib/nest-focus-types.ts`](../lib/nest-focus-types.ts))

`NestFocusArea` gains (all additive / optional):

```ts
targetType?: "zoom_region" | "detail_surface";   // absent ⇒ inferred
zoomRegion?: {
  cropBounds: NestFocusBounds;                    // normalized region to enlarge
  maxScale?: number;                              // cap the enlargement
  imageSources?: { standardUrl?; highResolutionUrl? };
  childObjects?: EditableNestObject[];            // crop-LOCAL; active only after focus
  childHotspots?: NestAssetHotspot[];             // crop-LOCAL
  resolutionStrategy?: FocusResolutionStrategy;
};
detailSurfaceId?: string;                         // detail_surface target (= targetSceneId)
```

**Backward compatibility / migration.** Pre-M7C.1 documents have no `targetType` and only
`targetSceneId`. `focusTargetTypeOf(fa)` infers the type (explicit `targetType` →
`zoomRegion` payload → else `detail_surface`); `migrateFocusArea(fa)` fills the explicit
fields (a legacy detail link becomes `detail_surface` with `detailSurfaceId = targetSceneId`).
Every pre-M7C.1 document still validates and loads. `transition` adds `"smooth_zoom"`.

**Validation** ([`lib/nest-focus-scenes.ts`](../lib/nest-focus-scenes.ts), target-type
aware): a `zoom_region` requires `zoomRegion.cropBounds` within `[0,1]` and needs no detail
scene; a `detail_surface` requires `detailSurfaceId`/`targetSceneId` (existing + non-circular);
child object coordinates must be region-local `[0,1]`.

## Resolution audit ([`lib/nest-focus-resolution.ts`](../lib/nest-focus-resolution.ts))

The sprint's central rule: **measure before replacing.** Pure, deterministic math — no OCR,
no computer vision. For a crop we compute the **source pixels available** vs. the **display
pixels** it must fill once zoomed:

```
sourcePixelsPerDisplayPixel = cropSourcePx / (displayPx × devicePixelRatio)
```

`auditFocusResolution()` returns the full sprint shape (`cropPixelWidth/Height`,
`targetDisplayWidth/Height`, `scaleX/Y` enlargement, `sourcePixelsPerDisplayPixel`,
`verdict`). The verdict policy is deterministic:

| source-px / display-px | verdict |
|---|---|
| ≥ 1.0 | **excellent** |
| ≥ 0.66 | **acceptable** |
| ≥ 0.4 | **soft** |
| < 0.4 | **unusable** |

The composed-scene zoom audits each *object* against its own native resolution
(`auditZoomObject`) as well as the background (`auditZoomBackground`), because cut-outs are
far higher-res per display pixel than the background — which is exactly what justifies the
`reuse_source_with_child_assets` strategy.

### Measured source dimensions (real px, read from the files)

| Asset | Source px | Notes |
|---|---|---|
| Background | 1086 × 1448 | 3:4; 2.4× headroom at full scene |
| TV / media (`ast-tv`) | 1489 × 962 | very high headroom |
| Frame (`ast-framed-photo`) | 843 × 814 | high headroom |
| Books (`ast-stacked-books`) | 1119 × 640 | high |
| Bookshelf (`ast-bookshelf`) | 535 × 1499 | tall/narrow |
| Desk (`ast-desk`) | 1149 × 1015 | composite / front-facing |

Stage = `min(94vw, 460px)` at 3:4 → **352×469** (375w) … **460×613** (desktop).

### Prototype audit results (measured)

source-px / display-px (verdict). Background crop is the wall texture; "object" is the
interactive cut-out (the TV, the framed photo, the bookshelf) — what the visitor actually
zooms to. Desktop = 460 px stage; mobile = 375 px device.

| Region | Crop (norm) | Zoom × | bg @desktop | bg @375 | object (dpr1) | bg @dpr3 (375) |
|---|---|---|---|---|---|---|
| **TV console** | 0.66 × 0.34 | 1.52× | 1.56 **excellent** | 2.03 **excellent** | 4.4 **excellent** | 0.68 acceptable |
| **Frame** | 0.36 × 0.32 | 2.78× | 0.85 **acceptable** | 1.11 **excellent** | 4.2–5.5 **excellent** | 0.37 *unusable* |
| **Bookshelf** | 0.42 × 0.74 | 1.35× | 1.75 **excellent** | 2.28 **excellent** | 2.7–3.5 **excellent** | 0.76 acceptable |

> **Honest finding.** At the capped stage (≤460 px) the existing assets are **crisp** under
> zoom: every interactive cut-out is **excellent**, and every background crop is
> *acceptable or better* at dpr 1. **No higher-resolution replacement is required for
> M7C.1** → `resolutionStrategy = reuse_source` everywhere. The single soft/unusable case is
> the **background wall around the tight Frame crop on dpr-3 phones** (0.37) — but that is
> only the wall texture; the framed **photo** (the point of the zoom) stays excellent there.
> So a future `highResolutionUrl` for the *background* would only improve the surrounding
> wall on high-density phones; it is genuinely optional, which is why it is left undefined.
> This is surfaced as a non-blocking author warning, never a publish block.

## Resolution strategy policy (Phase 2)

`recommendStrategy({ verdict, hasHighRes, perspectiveMismatch, childAssetsSharper })`,
deterministic:

- **perspective mismatch** → `use_detail_surface` (no pixels fix a wrong camera);
- **excellent / acceptable** → `reuse_source`;
- **soft** → `load_high_res_variant` (if a hi-res can exist) → else
  `reuse_source_with_child_assets` → else `reuse_source`;
- **unusable** → `load_high_res_variant` → else `use_detail_surface`.

## Progressive high-resolution loading (Phase 12)

`imageSources.standardUrl` renders immediately; `highResolutionUrl` (optional, **undefined
in M7C.1**) is preloaded during/after the transition and cross-faded in. A
missing/failed hi-res keeps the standard source — no broken-image state, crop alignment
preserved (`selectFocusImageSource`). No files are generated; no arbitrary external fetch.

## True crop-zoom renderer (Phase 4)

`zoomTransform(crop, maxScale)` → a **uniform** scale `min(1/cropW, 1/cropH)` (preserves
aspect ratio) about the crop centre, plus a translate that recentres the crop in the
viewport. Applied as a CSS transform on the **same** Main stage —
[`nest-scene-navigator.tsx`](../components/nest/nest-scene-navigator.tsx) — so there is no
scene swap, no second renderer, no white flash, no layout jump (~420 ms; 180 ms reduced-
motion). **Back** restores the identity transform exactly (`IDENTITY_ZOOM_TRANSFORM`).
Interaction is locked mid-transition; Escape / browser-back / a keyboard Back all return.

## Child objects inside a Zoom Region (Phase 9)

`zoomRegion.childObjects` (and `childHotspots`) are stored in **crop-local** `[0,1]`
coordinates, mapped to the scene with `cropLocalRectToScene` and rendered *inside* the
transformed layer so they scale with the zoom. They are **inactive in the Main view** and
fade/scale in only once the zoom settles (`zoomChildrenActive`). They serialize, support
z-index and hotspots, and never modify parent-scene objects — the foundation for hidden
items, nested content, puzzles and product discovery (all deferred beyond their data shape).

## Interaction priority (Phase 13)

- **Main scene:** `object hotspot → Focus Area → whole-object fallback → empty`
  (`resolveFocusNavigation`; a hotspot always wins, so focus entry never double-fires the
  whole-object interaction).
- **Zoom Region:** `child hotspot → child object → zoom background` (`resolveZoomInteraction`,
  point is crop-local; children respond only while focused).
- **Detail Surface:** `detail hotspot → whole-object fallback → empty` (unchanged from M7C).
- Back / close stays highest priority everywhere.

## Authoring UX (Phase 10) — current state

After selecting/drawing a region the author chooses **"Zoom into this area"** vs **"Open a
detailed surface."** Zoom authoring exposes trigger bounds + a separate crop, a resolution
estimate, child objects/hotspots, the resolution strategy, and an optional future hi-res
URL — all via normalized rectangles and visual preview (no camera matrices). The pure
contract + audit that drive this UI are complete and tested; the in-canvas editor wiring of
the two-way picker reuses the existing Focus mode + bottom sheet
([`focus-sheet.tsx`](../components/nest/editor/focus-sheet.tsx)) and is the main remaining
integration surface (see *Deferred*).

## Resolution warnings (Phase 11)

`creatorResolutionWarning(verdict)` → ordinary creators see only *"This area may look blurry
when enlarged."* and only when `soft`/`unusable`. `authorResolutionGuidance(audit)` gives
template authors the richer line ("Zoom quality: Excellent", "…soft on high-density
phones", "Recommended: provide a high-resolution focus image"). Publishing is **never**
blocked unless the verdict is `unusable` (`blocksPublishing`).

## Fixtures ([`lib/fixtures/golden-hybrid-focus.ts`](../lib/fixtures/golden-hybrid-focus.ts))

**Honest shape (important).** The Main Golden Living Nest contains a media wall, a frame, a
sofa, a coffee table, a lamp, a plant and an avatar — **no bookshelf and no desk**. Per the
sprint's own rule (a trigger must sit over a present object; test #28), the fixtures split:

- **`goldenLivingNestHybrid()`** — the real Golden Living Nest with a **TV Console Zoom**
  and a **Frame Zoom** over their real objects. No detail scenes, never links to an absent
  desk/bookshelf. The TV's screen hotspot and the frame's photo hotspot carry through the
  zoom automatically (they live on the objects).
- **`studioNestHybrid()`** — an example **Workspace Nest** that genuinely contains the
  parked `ast-bookshelf` + `ast-desk`, hosting a **Bookshelf Zoom** (with a separate child
  book object) and a **Desk Detail Surface**. The bookshelf's upper/middle/lower shelf
  hotspots carry through the zoom; the child book demonstrates Zoom-Region child objects.

The **Desk Detail Surface** (`studioDeskSurface`) replaces M7C's wide-room desk scene with
a tight tabletop: the desk fills ~90% width anchored low, the framed photo stands low on
the desk (no large empty wall), books rest on the surface, and the laptop → website,
notebook/books → article, lamp → ambience, photo → gallery interactions are bound, with one
disabled **microphone → podcast (coming soon)** region (no mic art invented). *Documented
deferral:* a dedicated shallow tabletop **background** asset is wanted later; for now the
warm room background is reused but the desk dominates so little wall shows.

The original [`golden-desk-detail.ts`](../lib/fixtures/golden-desk-detail.ts) is retained
unchanged as the superseded M7C proof (kept green for back-compat tests).

## Navigation depth

`Level 0: Main Nest → Level 1: Zoom Region OR Detail Surface → Level 2: interactive child
object/content`. **No Focus Region inside another Focus Region** (one navigation level;
nested focus is rejected by validation).

## Verification

- **484/484 unit tests** green ([`test/nest-hybrid-focus.test.ts`](../test/nest-hybrid-focus.test.ts),
  32 new — transform centring/aspect/identity, audit math, verdict + strategy policy,
  validation, fixtures, child coords/activation, interaction priority, persistence,
  progressive sources — plus the 452 baseline).
- `npm run typecheck` / `npm run lint` clean; `npm run build` succeeds and prerenders
  `/design/nest-hybrid-focus` (the internal visitor surface: Living Nest / Studio Nest
  toggle + debug). The production server serves the page with the TV + Frame zoom
  affordances and the live stage rendered.
- *Environment note:* the local `next dev` server in this sandbox fails to register a
  subset of `app/design/*` routes (an fsevents/watcher quirk affecting pre-existing routes
  too); verification was done via `next build` + `next start`, which serve every route
  correctly.

## M7C.2 — Focus-first interaction & composition polish

> **The rule, recorded plainly:** *In Main view, a Focus Area owns the first tap.
> Interactions inside the focused subject become available only after focus entry.*
> First enter the place, then interact with what is inside it.

### Main vs Focused interaction priority

**Main Nest** ([`resolveMainScenePointerAction`](../lib/nest-focus-scenes.ts)):

```
enabled Focus Area  →  object hotspot (only if no Focus Area claims the tap)
                    →  whole-object fallback  →  none
```

A Focus Area **wins over the parent object's hotspot/content** when the pointer is inside
its trigger region — tapping the TV zooms in, it does **not** start the video; tapping the
frame zooms in, it does **not** open the gallery. Overlapping Focus Areas resolve
deterministically: **smallest trigger region first → explicit `priority` (higher wins) →
stable id**. No `Math.random`.

**Inside a Zoom Region** ([`resolveZoomInteraction`](../lib/nest-focus-scenes.ts)):

```
child hotspot  →  child object  →  focused parent-object hotspot  →  zoom background
```

The parent **Focus Area never fires again while focused**. The focused parent object's own
hotspots stay live (the TV screen → video, the framed photo → gallery, a shelf → content),
so the inner interaction works only *after* entry.

**Detail Surface:** `detail hotspot → detail object → empty surface` (unchanged). Back/close
always has the highest priority. (The legacy `resolveFocusNavigation` is retained for the
M7C double-tap path; the M7C.2 Main path is `resolveMainScenePointerAction`.)

### Trigger bounds vs crop bounds

A Focus Area now distinguishes two related-but-independent rectangles
(`triggerBoundsOf` / `cropBoundsOf`):

- **Trigger** (`bounds`) — the forgiving visitor **tap target**; includes the meaningful
  object, excludes unrelated assets (avatar, plant, sofa) and nearby Focus Areas.
- **Crop** (`zoomRegion.cropBounds`) — the **visual focused composition**; minimal empty
  wall, subject centred; may be larger or smaller than the trigger. Validated independently
  (both inside scene bounds, ≥ min size). Debug shows them distinctly: **trigger = solid
  cobalt**, **crop = dashed amber**; visitors see neither.

### Corrected prototype bounds (exact)

| Region | Trigger (`bounds`) | Crop (`cropBounds`) | Change |
|---|---|---|---|
| **TV** | `{0.26, 0.41, 0.30, 0.23}` | `{0.17, 0.35, 0.40, 0.30}` | trigger pulled left of the avatar (x≥0.575) + plant (x≥0.73); reliably enters TV Zoom |
| **Frame** | `{0.15, 0.12, 0.23, 0.18}` | `{0.11, 0.09, 0.30, 0.24}` | crop tightened from the old wall-heavy `{0.08,0.06,0.36,0.32}`; frame is the hero |
| **Bookshelf** | `{0.04, 0.16, 0.34, 0.68}` | `{0.02, 0.12, 0.42, 0.74}` | unchanged; already distinct |

### Visitor discovery (no persistent CTA)

The persistent **"Zoom to…" pills are removed**. The whole trigger region is a transparent,
accessible button (keyboard focus ring + subtle press feedback). On first visit, the
**primary** Focus Area shows a single transient label + gentle pulse
([`selectDiscoveryHint`](../lib/nest-focus-scenes.ts)); after the first focus entry, hints
are suppressed and areas rely on press/hover feedback. Only **one** hint is emphasised at a
time; reduced motion → static label, no pulse. Debug mode may still show explicit labels.

### Input-state protection & Back

A pure state machine `main_idle → entering_focus → focused_idle → exiting_focus`
(`canEnterFocus` / `focusEntryBegin` / `focusEntrySettle` / `focusExitBegin` /
`focusExitSettle`) guarantees **rapid taps create exactly one transition** and **no content
fires during entry**; child hotspots are inactive until the zoom settles
(`zoomChildrenActive`). Browser **Back** / **Escape** exit the focused view first, restore
focus to the semantic trigger button, and close any open drawer; no stale child hotspot
remains in Main.

### Recommended-crop helper

[`recommendCrop(visualBounds, category)`](../lib/nest-focus-scenes.ts) deterministically
suggests a crop from the subject's calibration/visual bounds + category-aware padding
(`frame` = small balanced; `media` = moderate, includes the console; `bookshelf` = vertical
shelf context), clamped to the scene and guaranteed to contain the subject. The creator can
override; it **never silently overwrites** an authored crop ("Use recommended crop"). No
computer vision. The editor surfaces the creator vocabulary **"Tap area"** / **"Zoomed
view"** (never `triggerBounds`/`cropBounds`, never transform matrices); full in-canvas crop
authoring remains the noted editor follow-up.

### Desk Surface — deferred art (Phase 9)

The Studio Desk Detail Surface stays **provisional/internal**: linked only where a desk is
visibly present (the Studio Nest), never from the Living Nest, and **not** "fixed" by
further cropping the current room. The final surface needs a **dedicated approved
background**, to be designed separately:

```
Dedicated Desk Surface template (future, NOT generated this sprint):
- 20–30° downward angle
- desktop fills most of the viewport
- minimal wall / background; no full-room floor; no large empty wall
- slots for laptop, notebook, phone, lamp, mic, cup, personal objects
```

## M7C.3 — Creator-authored crops & true full-screen focus

> **Recorded plainly:** *The system can recommend a crop, but the creator visually authors
> and owns the final zoomed composition.* A suggested crop is never silently authoritative.

### Full-screen COVER transform (Phase 1)

The focused view now **covers** the usable viewport (it no longer fits-inside, which left
empty wall). [`focusViewportTransform`](../lib/nest-focus-scenes.ts):

```
cropX = x·sceneWidth   cropY = y·sceneHeight   cropW = width·sceneWidth   cropH = height·sceneHeight
scale = max(viewportWidth / cropW, viewportHeight / cropH)          // COVER (max, not min)
translateX = viewportWidth/2  − (cropX + cropW/2)·scale             // crop centre → viewport centre
translateY = viewportHeight/2 − (cropY + cropH/2)·scale
```

Applied as `translate(translateX px, translateY px) scale(scale)` with `transform-origin: 0 0`
on the scene element (rendered 3:4 at the container width). It is computed against the
**usable focused viewport** (the caller passes the measured container, excluding header /
safe areas), never the full document. It never alters the saved crop — it only maps it to
the screen. `mapScenePointThroughFocus` verifies a scene point (e.g. a hotspot) lands where
expected after the transform.

### Full-screen focused viewport (Phase 2)

A Zoom Region opens a `fixed inset-0` overlay ([`FocusedZoomStage`](../components/nest/focused-zoom-stage.tsx))
that **locks document scroll**, respects safe areas, overlays Back/title (no layout cost),
and hides the prototype Living/Studio/Debug switches (it covers them; they don't affect the
focused size). The focused hero is a **full-width 3:4 frame** on a dark cinematic backdrop
(centred, `max-width 560px` on desktop) — not a small cream card. The frame matches the
scene aspect so a well-authored crop **covers it exactly** (the complete subject is shown,
not a clipped sliver). The Stage gains a `fill` prop to drop its centred max-width card
chrome so the focused container can size it.

> **Honest geometry note.** Cover into a fixed-aspect frame clips the crop's mismatched
> axis. We chose a 3:4 hero (matching the 3:4 scene) so square-ish crops (TV, frame) show
> **100% / 100%** at every viewport. A full-bleed *portrait* frame would fill more height
> but clip wide subjects — rejected because "show the complete TV, not cut off" is explicit.
> A very tall, narrow subject (the bookshelf) cannot fill a 3:4 cover frame without
> including the adjacent desk, so it is shown as a **deliberately chosen shelf section**.

### Trigger vs crop are the product contract (Phase 3)

`triggerBounds` (= `bounds`) and `cropBounds` (in `zoomRegion`) are fully independent:
editing one never changes the other. The creator authors them with a **photo-crop-style
editor** in Focus mode — a "Tap area" / "Zoomed view" toggle in the focus sheet swaps the
trigger overlay ([`focus-editor-overlay.tsx`](../components/nest/editor/focus-editor-overlay.tsx))
for a dedicated **crop overlay** ([`focus-crop-overlay.tsx`](../components/nest/editor/focus-crop-overlay.tsx))
that dims outside the crop, moves by dragging inside, resizes from 40px corner hit-targets,
clamps inside the scene at a minimum size, uses pointer capture, and **blocks asset
selection beneath it** (it replaces, not overlays, the trigger overlay — `focusOverlayMode`).
One gesture commits once = one undo entry.

### Live preview (Phase 4)

**"Preview zoom"** renders `FocusedZoomStage` with the **current unsaved crop** through the
exact same cover transform visitors get — child hotspots active, but no gallery/video fires
automatically. It is **read-only** (never mutates the document); "Back to crop" returns to
editing without losing changes. `Edit crop → Preview → Back → Edit` round-trips freely.

### Suggested crop, never forced (Phase 5)

`recommendCrop` is now only a **suggestion** (`cropSource: "suggested"`, shown with a
"Suggested" chip). The moment the creator drags the crop it becomes
`cropSource: "creator_authored"` — the source of truth. `shouldAutoApplySuggestedCrop(fa)`
returns **false** once authored, so moving/resizing assets or re-creation never silently
overwrites it; the creator must press **"Use suggested crop"** to re-apply. Absent
`cropSource` ⇒ `suggested` (back-compat); fixture crops are now `creator_authored`.

### Recalibrated crops (Phase 6) — creator-authored

| Region | Trigger | Crop | Focused result (3:4 frame) |
|---|---|---|---|
| **Frame** | `{0.15,0.12,0.23,0.18}` | `{0.13,0.08,0.26,0.26}` | frame is the hero, **100%×100%**, modest wall |
| **TV** | `{0.26,0.41,0.30,0.23}` | `{0.135,0.30,0.44,0.44}` | full TV screen + console, **100%×100%**, avatar+plant excluded (crop right edge = avatar box at 0.575) |
| **Bookshelf** | `{0.04,0.16,0.34,0.68}` | `{0.01,0.12,0.40,0.78}` | full width, central shelf section (desk excluded — crop right 0.41 < desk 0.42) |

### Hotspot alignment (Phase 7)

Hotspots are part of the scene and scale **with** the cover transform (one transformed
layer), so the TV screen stays over the TV, the photo inside the frame, the shelves on their
shelves — no separate rounding drift. Child objects/hotspots use crop-local coordinates
mapped via `cropLocalRectToScene`. Debug mode outlines hotspots in the focused view.

### Persistence & history (Phase 10)

`cropBounds` + `cropSource` (and trigger, target type, transition, child objects/hotspots)
ride the existing `EditableNestDocument`, so Save/Load, Export/Import and Undo/Redo cover
them; one crop drag/resize = one history entry; previewing does not mutate the document.
Old documents migrate (absent `cropSource` ⇒ suggested).

### Known limitations (M7C.3)

- A very tall, narrow bookshelf shows a chosen shelf section in a 3:4 cover frame, not the
  full height (would otherwise include the desk). All three shelf hotspots remain authored.
- The TV's right edge sits behind the avatar in the Main composition, so the TV crop shows
  the screen up to the avatar (the unoccluded extent), by design (avatar excluded).
- Final pixel-perfect crop calibration is best done interactively in the crop editor; the
  fixtures ship math-informed creator-authored defaults.

## M7C.4 — V1 fixed-ratio Focus Areas + in-place cinematic zoom (final for V1)

> **Recorded plainly:** *A V1 Focus Area is ONE creator-authored rectangle with the exact
> Nest aspect ratio. The same rectangle is both the tap target and the cinematic
> destination. The existing scene transforms in place — there is no modal, no backdrop, no
> duplicate stage; the Nest viewport stays in the same place and dimensions throughout.*

### One rectangle (`focusBounds`)

The M7C.1–3 split (`triggerBounds` + `cropBounds` + `cropSource` + `maxScale` + the cover
transform) is **retired**. A Focus Area now carries a single `focusBounds`
([`lib/nest-focus-types.ts`](../lib/nest-focus-types.ts)). Because scene `x` is normalized
to width and `y` to height of the **same** 3:4 box, a rectangle whose on-screen aspect
matches the Nest is a **normalized square** (`width == height`) — that *is* the ratio
constraint. `triggerBoundsOf` and `cropBoundsOf` now both resolve to `focusBoundsOf`.
`zoomRegion` survives only to carry `childObjects` / `childHotspots` / `imageSources`.

### Migration (Phase 2)

`focusBoundsOf(fa)` / `normalizeLegacyFocusArea(fa)` migrate deterministically, **without
destroying legacy data**: prefer the new `focusBounds` → else legacy `cropBounds` → else
`bounds` (trigger) → else a default, each coerced to the locked ratio (`fitRectToAspectRatio`,
centre preserved) and clamped. New documents are written with `focusBounds`. `transition`
adds `cinematic_zoom`.

### Fixed-ratio geometry (Phase 3)

Pure, deterministic ([`lib/nest-focus-scenes.ts`](../lib/nest-focus-scenes.ts)):
`fitRectToAspectRatio` (square, centre-preserved, clamped, min size); `moveRectInsideBounds`
(translate without changing dimensions, clamped); `resizeRectWithLockedAspect` (corner
resize with the **opposite corner anchored**, ratio locked, min size, inside the scene).

### Cinematic same-stage transform (Phase 5)

`focusBounds` has the viewport ratio, so the fill is a uniform scale + translate
(`cinematicFocusTransform` / `cinematicFocusTransformCss`, `transform-origin: 0 0`):

```
scale       = viewportWidth / (focusBounds.width · viewportWidth)   (= 1 / focusBounds.width)
translateX  = −focusBounds.x · viewportWidth  · scale
translateY  = −focusBounds.y · viewportHeight · scale
```

This maps the focus left/top/right/bottom edges exactly to the viewport edges (unit-tested),
fills with no blank area and no clipping beyond the rectangle, and the full-scene rect
`{0,0,1,1}` is the identity — so **Back restores Main exactly**.

### In-place, one stage (Phase 4)

[`CinematicFocusStage`](../components/nest/focused-zoom-stage.tsx) renders ONE Nest viewport
(same position/size/radius). The scene — background, objects, hotspots and child assets —
is a **single transformed layer**: `focusBounds` undefined ⇒ identity (Main); set ⇒ the
cinematic transform. **No modal, no `fixed inset-0` backdrop, no second stage, no portal.**
The CSS transition (≈540 ms, `cubic-bezier(.22,.61,.36,1)`, no bounce/opacity-swap; reduced
motion = no transition) animates the camera into / out of the area. Interaction is locked
during the transition; child interactions activate only after it completes. The visitor
[navigator](../components/nest/nest-scene-navigator.tsx) and the editor **"Preview focus"**
render the *same* component → the preview is exactly what the visitor gets (Phase 13).

> Detail surfaces (`detail_surface`) remain a **separate architecture** (a real scene swap);
> only `zoom_region` uses the in-place cinematic transform.

### Focus editor — repaired (Phase 9–11)

**Root cause of the broken editor:** the old focus overlay was `absolute inset-0 z-40`
with default `pointer-events`, a **full-canvas capture layer** that swallowed every pointer
(compounded by the M7C.3 crop overlay and a `fixed inset-0` preview). **Fix:** the overlay
host is now `pointer-events-none`; only the focus rectangles + corner handles capture
pointers, so the rest of the canvas is never blocked. The editor authors **one fixed-ratio
rectangle** per area: drag inside to move, drag a corner to resize (ratio locked, opposite
corner anchored, 44px hit-targets), one gesture = one undo entry, and it never selects
assets beneath it. The sheet is simplified to **Add focus area · Preview focus · Reset ·
Delete** — no Tap-area/Zoomed-view, no oval, no crop ratio, no crop-source, no transform
math. Switching Arrange / Assets / Connect / Preview keeps working.

### V1 prototype focus areas (fixed ratio, square)

| Area | `focusBounds` | Focused result |
|---|---|---|
| **Frame** | `{0.11, 0.06, 0.30, 0.30}` | frame fills the viewport, limited wall, no TV |
| **TV** | `{0.135, 0.31, 0.46, 0.46}` | TV + console, right edge ≈0.595 keeps the avatar body + plant out |
| **Bookshelf** | `{0.0, 0.22, 0.40, 0.40}` | upper/middle shelf section; right edge 0.40 < desk 0.42 (desk excluded) |

### Fixed-ratio limitation (honest)

A very tall, narrow subject (the bookshelf) cannot fully fit a single square focus rectangle
without including the adjacent desk, so it is framed as a **shelf section**; all three shelf
hotspots remain authored and the creator can re-position the rectangle. Final pixel
positions are best reviewed interactively in the repaired Focus editor.

## M7C.5 — Focus integration repair + minimal creator UX

> Creator Focus authoring is intentionally minimal — **select, move, resize, preview,
> rename, delete**. Enabled / Lock / Reset / hint text / advanced metadata are
> **Template/Internal** capabilities only. **Editor Preview and the visitor route use the
> same `NestSceneNavigator` + `CinematicFocusStage`.**

### Editor layer model

A single documented z-index map ([`lib/nest-editor-layers.ts`](../lib/nest-editor-layers.ts))
replaces ad-hoc values so authoring overlays never paint above the drawer:

```
scene 0 < assets 10 < focusRegions 20 < selectedFocus 25 < contextualActions 30
        < drawerBackdrop 40 < drawer 50 < topToolbar 60
```

The **root cause** of the M7C.4 bug: the focus overlay host was `z-[40]` while the bottom
drawer was `z-10`, so handles/borders painted over the sheet. **Fix:** the focus overlay
host sits at `focusRegions` (20); the Focus sheet passes `drawerBackdrop` (40) / `drawer`
(50) to the shared `MobileBottomSheet`. The drawer is now above every authoring overlay, so
the part of the canvas it covers visually masks the overlays and (being opaque + pointer-
active) intercepts their pointers. The overlay host stays `pointer-events-none` (only the
rectangles/handles capture), so nothing under the sheet receives input.

### Preview = the visitor navigator (single source of truth)

The editor **Preview** mode previously rendered a static `GoldenLivingNestStage`, so
authored Focus Areas didn't work. It now renders **`NestSceneNavigator`** with the live
`EditableNestDocument` — identical focus-first resolution, cinematic in-place zoom,
hotspots and interactions to the visitor route. The Focus-sheet **"Preview focus"** shortcut
collapses the drawer, enters Preview, and **auto-enters** the selected area via the
navigator's `autoEnterFocusId` prop (no separate preview component, no duplicate stage);
**Back** returns to Preview-Main, **Edit** returns to Focus authoring with the same area
selected.

### Minimal creator UX

The Focus sheet is compact: title · horizontally-scrollable area chips · **+ Add area** ·
the selected area's name (tap / pencil → inline rename) · **Preview** · **Delete**. The room
stays visible. **+ Add area** drops a default fixed-ratio square centred in the scene,
auto-names it `Focus area N` (`nextFocusAreaName`), and selects it immediately (handles
shown) — no form first. The visitor hint defaults to `Explore <name>` and follows renames.

### Creator vs Template/Internal capability split

Creator mode (`capabilitiesFor("creator").showPrecision === false`) exposes only **select ·
move · resize · preview · rename · delete**. **Enabled**, **Lock**, **Reset**, the explicit
**hint** field, the entry/transition selectors and the detail-surface link are
**Template/Internal-only** (`showPrecision === true`). `enabled` stays in the persisted
contract (default `true`) and `locked` for template authors — both simply hidden from
creators, so older documents are unaffected.

## M7C.6 — Focus Areas are entrances to nested editable scenes (ADR-031)

> A Focus Area is an **entrance from one editable Nest scene into a child editable scene.**
> The parent scene defines the entrance rectangle; the child scene inherits a transformed
> view of the parent as its visual base and has its own local objects, hotspots,
> interactions and optional child Focus Areas. **The same editor and visitor navigator
> operate on the scene graph.**

### Scene graph (built over the existing detail-scene storage)

- **Root** = the Main scene (`getEditorScene(doc, "")`): the document's `objects` + `focusAreas`.
- **Child scenes** = `detailScenes` with `sceneType:"focus"` and
  `backgroundSource:{type:"parent_crop", parentSceneId, focusBounds}`. Each Focus Area links
  one via `childSceneId` (`childSceneIdOf`).
- `getEditorScene(doc, id)` returns a unified view (objects, focusAreas, parent refs,
  background source) for the root or any child — the editor edits whichever is active.

### Persistence repair (release blocker)

Two bugs are fixed: (1) the visitor/Preview filter required a `zoomRegion` payload, hiding
**editor-authored** areas (which have only `focusBounds`) — now `isVisitableFocusArea` needs
only a valid focus rectangle; (2) `validateFocusArea` no longer hard-requires `zoomRegion`
for a zoom area. Authored Focus Areas now appear in normal Preview and survive
save/load/export/import (they ride the same document; child scenes are `detailScenes`).

### Editor "Enter area"

The Focus sheet's primary action is **Enter** (`ensureFocusChildScene` → switch the active
scene). Inside the child scene the creator keeps **Arrange · Assets · Connect** operating on
the child's *scene-local* objects (the existing detail-scene editor + `commitActive` /
`setDetailSceneObjects`), the breadcrumb shows **Main Nest / <area>**, and **Back** returns
directly to the parent editor (not Preview). **Preview** from a child scene auto-enters that
area in the visitor navigator (`autoEnterFocusId`) and Back-to-edit restores the editing
scene. Deleting an area with authored content asks to confirm (Undo restores the area *and*
its child scene via the existing cascade).

### Scene stack & nesting

A pure stack (`rootEditorSceneContext` / `enterEditorScene` / `exitEditorScene` /
`parentEditorScene` / `canExitEditorScene`, `MAX_FOCUS_DEPTH = 3`) models nesting
deterministically. V1 wires one active level (Main → Focus) in the UI; deeper nesting is
exercised in pure logic and capped at the limit.

### Visitor rendering of a child scene

`CinematicFocusStage` renders the parent-crop base (the parent stage cinematic-transformed to
`focusBounds`) and, when the area links a child scene, overlays that scene's objects via a
**transparent** `GoldenLivingNestStage` (full hotspots/interactions), 0..1 of the focused
viewport. Order: transformed parent base < child-scene objects < child-scene hotspots < chrome.
No modal, no duplicate page; Back reverses to the exact parent composition.

### Migration

`ensureFocusChildScene(doc, areaId)` (idempotent) and `migrateDocumentToSceneGraph(doc)` give
each Focus Area a deterministic child scene; legacy `zoomRegion.childObjects` (crop-local,
which equals the focused-viewport 0..1) move into the child scene's objects. Old documents +
drafts are never lost. The fixtures stay as-is (the bookshelf demonstrator still renders via
the legacy child-objects path; child scenes are created on first **Enter**).

### V1 limitations

Active nesting is one level (Main → Focus) in the UI; the exact parent-crop base **inside the
editor canvas** is a follow-up (the visitor already shows it — Preview to see the true
result); deeper nesting is pure-logic only.

## Deferred beyond M7C.1

Nested `Detail → Detail` / recursive zoom; puzzle authoring; game state; multiplayer; AI
generation; Supabase persistence; provider embeds; **new/edited artwork**; *generating*
high-resolution variants (only the URL/metadata contract is added); the dedicated tabletop
background asset; full in-canvas wiring of the zoom-vs-surface authoring picker; marketplace.
