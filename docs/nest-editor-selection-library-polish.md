# Nest Editor — Selection, Asset Library & Mobile Sheet Polish (M7B.2)

> A refinement pass over the M7A/M7B/M7B.1 editor that makes overlapping objects
> reliably selectable, packages asset calibration so it is authored once and reused
> everywhere, and unifies the Assets + Connect drawers on one native-style bottom sheet.
> Internal route: `/design/nest-editor` (noindex).
>
> **M7B.2 is a precision + feel sprint. It does not introduce Focus Areas, nested
> scenes, visitor camera zoom, AI generation, Supabase persistence, or new artwork.**
>
> **Asset calibration is authored once per approved library asset and reused by every
> Nest instance.**

## Overlap-aware hit testing (`lib/nest-editor-hit-testing.ts`)

Selecting a small asset resting on a larger one (books on a coffee table, decor on a
shelf, the avatar over furniture) used to be impossible: the topmost paint always
swallowed the pointer. `hitTestCandidates(objects, assetsById, point, opts)` now returns
**every** selectable object under the pointer, using **visible-content bounds** (not the
padded PNG box) expanded to a minimum tap target, ordered deterministically:

1. higher `zIndex` first (nearer the viewer),
2. then smaller visible area (a small item on top of a big one wins),
3. then nearer the tap,
4. then `instanceId` ascending (stable final tiebreak).

Hidden objects are always excluded; an `isExcluded` hook covers any future
selection-disabled flag. There is **no `Math.random`** — same inputs ⇒ same output.
Rotation is handled with axis-aligned visible bounds (an approximation, consistent with
the existing hotspot-drag math; see *Remaining limitations*).

## Repeated-tap cycling (`nextSelection`)

`nextSelection(prev, candidates, point, now)` decides which candidate a tap selects:

```
Tap 1 → topmost visible object
Tap 2 → next object underneath
Tap 3 → next object
Tap again → wraps to the first
```

The cycle **resets** (back to the topmost) when any of these change:

- the pointer moved past `TAP_CYCLE_MOVE_THRESHOLD` (0.045 normalized),
- the candidate set changed (objects added/removed/reordered under the point),
- `TAP_CYCLE_TIMEOUT_MS` (1600 ms) elapsed since the last tap,
- the mode changes (the canvas clears the cycle on Arrange⇄Connect).

`now` is injected (no `Date.now` in the pure module); the canvas passes
`performance.now()`. A plain tap commits no history (a `didMove` guard means only a real
drag/resize/rotate gesture pushes an entry).

## Long-press layer picker (`LayerPicker` in `editor-canvas.tsx`)

A long-press (~450 ms without travel) over a stack of ≥2 overlapping objects opens a
compact **Select object** popover listing each candidate in effective z-order
(topmost-first), with **thumbnails + names — never raw ids**, the current selection
ticked. Tap a row to select it; tap outside or press **Escape** to dismiss; rows are
focusable menu items (`role="menuitemradio"`) so it is keyboard accessible on desktop.
The contextual **Layer → Select object…** action opens the same component. The popover is
capped (`max-h-[44%]`, internal scroll) so it never covers most of the canvas.

## Minimum interaction targets (`lib/nest-editor-touch-targets.ts`)

`EditorTouchTargetPolicy` separates an object's **visual** size from its **interaction**
target size, authored in CSS pixels:

| Field | Default |
|---|---|
| `minimumObjectTapPx` | 44 |
| `minimumResizeHandlePx` | 32 |
| `minimumRotateHandlePx` | 36 |
| `rotateHandleGapPx` | 26 |

`minObjectTapNormalized(scene)` converts the px target into normalized units against the
live scene rect (with a conservative fallback before first layout). The invisible hit
padding only affects **selection candidacy** — it never changes the rendered art or the
reported `visibleArea`. Tapping padded space still respects overlap cycling.

## Small-object transform frame

The selection frame still wraps the **visible** content. The rotate handle now sits a
**constant 26 px above the frame** (a fixed pixel offset, not a percentage that collapses
onto a tiny object), with a ~44 px invisible touch target and a fixed-length connector,
so it is always clearly outside the frame and clear of the body — dragging the object body
never catches it. Corner resize handles use a 40 px invisible touch target around a small
visible dot. For tiny objects only the editing **chrome** enlarges, never the asset. The
transient rotation degree label is retained near the external handle.

## Bookshelf hotspot calibration fix (`lib/nest-hotspot-catalog.ts`)

The bookshelf cut-out has a solid top cap ending ≈ y0.12; the previous **Upper shelf**
region (`y0.08`) sat *in that cap*, above the first shelf's contents. The three regions
now land on the actual compartments (interior x≈0.28–0.72), never the cap or frame walls.
**Exact normalized values (asset-local):**

| Region | Shape (rect, asset-local 0..1) |
|---|---|
| Upper shelf | `x 0.28, y 0.14, w 0.44, h 0.15` |
| Middle shelf | `x 0.28, y 0.46, w 0.44, h 0.15` |
| Lower shelf | `x 0.28, y 0.77, w 0.44, h 0.14` |

The values live in the predefined catalog, so **all bookshelf instances inherit the
correction**. A range-oriented unit test guards the upper region (within the visible
shelf, below the cap, above and non-overlapping with the middle) — no brittle screenshot.

## Asset calibration package (`lib/nest-asset-calibration.ts`)

One reusable record per approved asset — **author once → approve once → reuse in every
Nest**. `NestAssetCalibration` consolidates an asset's intrinsic authoring metadata:

```
visualBounds · groundContactPoint · defaultScale · defaultRotation
placementMode · supportRule · rotationPolicy · flipPolicy
predefinedHotspots · selectionPriority · productionStatus
```

To avoid two sources of truth, the geometric/policy fields are **assembled from the
existing pure data** (`nest-visual-bounds`, `nest-placement`, `nest-editor-policy`,
`nest-hotspot-catalog`); the new intrinsic fields (`selectionPriority`,
`productionStatus`, explicit `defaultScale`) live in this module. `buildCalibration` /
`calibrationFor` are the single read path; `validateCalibration` rejects malformed
metadata; a missing asset falls back to a safe `DEFAULT_CALIBRATION`. Everything is
serializable JSON. There is **no per-Nest hotspot recreation and no image
auto-analysis** (deferred).

### Future Asset Factory workflow

```
asset image
 → visual-bound calibration
 → placement metadata
 → hotspot calibration
 → interaction states
 → approval
 → reusable library package (NestAssetCalibration)
```

## Telegram-inspired asset library (`components/nest/editor/asset-drawer.tsx`)

A dense, **image-first** grid like a sticker/emoji keyboard, reusing Telegram's
information hierarchy with Nestudio's visual DNA (no Telegram branding/colours/icons):

- **Search** stays visible; **Recent** and **Favourites** stay prominent.
- Category navigation uses **compact icons with accessible labels** (`aria-label` +
  `sr-only`), with child-category chips from the asset-index tree.
- Tiles are image-only by default — **no visible name/category** — so far more assets fit.
  Names remain in the **accessible name** (`aria-label`/`title` + `sr-only`), **search**,
  **long-press details**, and the details card. Search still resolves hidden
  name/category/tags.
- Compact corner **badges only**: interactive/animated sparkle; a placeholder dot (advanced
  only); a premium mark. The favourite star is subtle (shown when starred or on hover/focus).
- **Long-press** (or right-click / the info affordance) reveals a details card: name,
  category, production status, interaction support. Normal tap adds the asset (selecting
  the new instance) per existing behaviour.

## Reusable bottom sheet (`components/nest/editor/mobile-bottom-sheet.tsx` + `lib/nest-bottom-sheet.ts`)

One foundation for the Assets drawer, the Connect drawer, and future Focus-Area drawers.
Snap points: `collapsed | half | expanded`. The sheet is a single surface sized to its
**positioned parent** (the canvas area, so the mode bar stays visible) and translated down
to reveal the chosen fraction — snap changes are pure GPU transforms and content stays
**mounted** across snaps (so unsaved form input is never lost).

- **Drag** the handle to change snap; **tap** the handle to cycle; a hard **swipe down**
  from the lowest snap closes (when dismissible); **tap outside** dismisses (optional
  scrim/transparent backdrop, or `none` to keep the canvas live); **Escape** closes.
- **Focus** is moved into the sheet on open and **restored** on close; the body scroll is
  locked behind an open sheet; ARIA `role="dialog"` with a label; internal scroll only
  when content overflows.
- **Reduced motion** (detected or forced) disables the spring transition.

The pure decision logic — snap points, drag-release resolution, translate offset,
transition string, dismiss policy — lives in `lib/nest-bottom-sheet.ts` and is fully
unit-tested without a DOM.

### Drawer snap points

- **Assets** — collapsed: handle + search/category strip; half: search + categories + a
  few rows; expanded: full searchable library with internal scroll. Active search/category
  is component-local and preserved across snap changes; tap-outside closes.
- **Connect** — collapsed prefers geometry editing (most of the canvas visible); half shows
  the hotspot chips + binding summary; expanded shows the full binding form + advanced
  authoring. Focusing a field auto-expands so the mobile keyboard never hides the form.
  Backdrop is `none` so the canvas stays interactive; hotspot overlays stay clipped beneath
  the sheet. Unsaved form input survives snapping (the component stays mounted; snapping
  mutates no document data).

## Support-surface suggestions (`lib/nest-placement.ts`, `placeOnSupport`)

When a surface-asset (loose books) floats, the editor offers an actionable **Place on
{surface}** chip instead of only warning. `supportCandidates` ranks compatible supports
deterministically by overlap → distance → z-order → id. Accepting calls `placeOnSupport`,
which anchors the object's visible base centred on the support's top via `moveObject`
(consistent clamping) and lifts its paint order just above the support. It is one commit,
so **Undo/Redo** works. No physics engine; no hidden automatic movement.

## Overlap advisories (`lib/nest-overlap-advisories.ts`)

Lightweight, **advisory (never blocking)** notes about visually implausible overlaps,
using visible bounds and tuned to be useful not noisy:

- **avatar-furniture** — the avatar standing *inside* tall furniture (e.g. a bookshelf),
- **floor-floor** — two large floor objects of the same kind stacked in one spot,
- **wall-window** — a wall object covering the window,
- **covers-builtin** — a movable object covering the built-in niche.

Intentional support relationships (books on a table) are skipped, advisories require high
overlap, and results are deduplicated — so the normal Golden Living Nest layout produces
**zero** advisories (no warning spam). Advisories fold into the existing compact
selected-object chip + the `More` amber dot; internal mode sees the detail list. No large
canvas-covering banners.

## Mode-specific selection rules

- **Arrange** — tap selects (overlap-aware); repeated tap cycles overlaps; long-press opens
  the layer picker; the selection frame uses visible bounds; gestures move/resize/rotate.
- **Assets** — the drawer overlays the lower canvas; adding a tile selects the new instance
  and returns to Arrange. Tapping a tile never selects an object behind the drawer.
- **Connect** — tapping an asset selects it (overlap-aware, so underneath assets are
  reachable); tapping a hotspot selects the hotspot (its own handler stops propagation, so
  the overlap cycle never conflicts); long-press still opens the layer picker. Arrange
  gestures are disabled.
- **Preview** — no author selection; only visitor hotspots/interactions respond.

## Accessibility & reduced motion

Category tabs, the favourite affordance, the layer picker, and the sheet all carry
`aria-label`s; the picker rows are radio menu items; the sheet is an ARIA dialog with focus
move-in / restore and Escape. Asset names stay in the accessible name even though tiles
hide them visually. The bottom-sheet spring and (existing) hotspot pulses respect
`prefers-reduced-motion`.

## Remaining limitations / honest weaknesses

- Hit testing and the transform/hotspot drag math use **axis-aligned visible bounds**;
  on a *rotated* asset selection/cycling track approximately (consistent with M7B/M7B.1).
- The bottom-sheet DOM behaviours (tap-outside, Escape, focus restore, reduced-motion) are
  verified by **pure unit tests of their decision helpers** plus Phase-15 browser checks —
  the project's test runner is node-only (no jsdom) by design, so there is no mounted-DOM
  test.
- Bookshelf hotspot values are authored from the visible cut-out, not measured by CV.
- Two-finger gestures still depend on the browser delivering multiple pointer events.
- Viewport zoom still has no pan (carried from M7A).

## Deferred to M7C

Focus Areas / Detail Scenes, nested scenes, visitor camera zoom / endless zoom, puzzles,
marketplace features, AI generation, Supabase persistence, new/approved artwork
(sofa/coffee-table/rug stay tracked placeholders), polygon hotspots, provider API
integrations, and image auto-analysis for calibration.
