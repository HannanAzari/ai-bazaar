# Nest Editor — Mobile UX (M7A)

> M7A redesigns the **creator-facing** Nest editor into a compact, full-screen,
> mobile-first surface while preserving the M6 engine unchanged. Internal route:
> `/design/nest-editor` (noindex).
>
> **The Telegram mobile photo/sticker editor is a UX *reference only* — its patterns
> (large stage, minimal contextual controls, a bottom "keyboard" of assets, a clear
> transform boundary on the selected item). Nestudio keeps its own brand, palette,
> terminology, icons, and interaction system. No Telegram branding/colours/icons are
> copied.**

## Full-screen editor shell

The editor renders as a **fixed, full-screen surface** (portalled to `document.body`
so it sits above the site chrome) with three bands:

```
Top toolbar (~56px, safe-area aware)
Hero Nest canvas (remaining space — the visual hero)
Bottom command bar (~64px) + asset drawer overlay when open
```

The Nest stays visible at all times (the asset drawer overlays only the lower ~58%).
Normal editing requires **no page scroll** and there is **no horizontal overflow** at
375 / 390 / 430 / desktop. iOS safe-area insets are respected via `env(safe-area-inset-*)`.

## Top toolbar

`Back · Undo · Redo  —  [Saved ✓ / Saving… / Unsaved]  —  More · Done`. Icons are from
the project's `lucide-react` (no emoji). Buttons are ≥44px touch targets with
disabled/active states. Routine saves use the compact status chip and a debounced
**autosave** — never a large banner. `More` holds the secondary actions: Advanced,
Guides/grid, Snap, Save now, Load draft, Import JSON, Export JSON, Reset. A small amber
dot on `More` signals advisory warnings.

## Modes: Arrange / Assets / Preview

- **Arrange** — select, move, resize (handle + pinch), rotate (where permitted), and
  the contextual actions (layer, duplicate, flip, lock, hide, delete).
- **Assets** — opens the asset keyboard (selection is cleared so the drawer is clean).
- **Preview** — renders the edited document through the **existing** Golden Living Nest
  stage with **no editor chrome** (just a single "‹ Edit" button to return).
- **Connect** — reserved. Not implemented; the mode architecture leaves room to add it.

## Transform frame

The selected object keeps a **polished, intentional transform boundary** (retained on
mobile, per the explicit requirement): a thin high-contrast cobalt outline with softened
corners and a white halo so it reads clearly even when assets overlap — never a solid
card around the object. It carries four corner **resize handles** and one dedicated
**rotation handle** (only when the asset policy permits rotation). The bottom-centre
**anchor dot** appears only in Advanced/debug. The frame disappears entirely in Preview.

## Resize & rotation gestures

- **Resize:** corner-handle proportional drag **and** two-finger pinch. Aspect ratio is
  always preserved (no freeform distortion); size is clamped to the asset's min/max.
- **Rotation:** the rotation handle **and** two-finger twist, both routed through the
  pure `rotateObject`, which respects policy: rugs rotate freely, frames are tightly
  constrained (±15°), and upright objects (sofa, TV, avatar, lamp, plant, table) are
  **not** rotatable (no handle shown, gesture is a no-op). Optional angle snapping near
  0/±15/±30/45/90 when Snap is on.
- **Move:** one-finger drag; normalized coordinates preserved; clamped to safe bounds +
  plane band; **one history entry per completed gesture** (committed at the final
  pointer-up, not during the drag).

## Contextual actions

When an object is selected, a compact action bar floats **beside** it (above, flipped
below near the top edge) so it doesn't cover the object: **Duplicate · Layer · Flip ·
Lock · Delete**. `Layer` opens a small popover — Bring to front / Bring forward / Send
backward / Send to back (raw z-index is *not* the primary experience; it lives in
Advanced). `Flip` is hidden when the asset disallows mirroring (e.g. the avatar).
`Delete` is immediate and **undoable** (no blocking confirmation). `Lock` keeps the
object selectable but rejects move/resize/rotate until unlocked.

## Asset keyboard

A bottom-sheet "keyboard" (the long vertical library is gone). It keeps the Nest visible
above, can be collapsed with one tap, and **remembers its last category** (localStorage).
Driven by the asset-index data architecture (`lib/nest-editor-asset-index.ts`):

- **Search** — name / id / category / child category / tags / slot type / "animated".
- **Recent** — locally tracked, most-recent-first, deduped, capped.
- **Favourites** — local star toggle, persisted as JSON.
- **Category tabs** — All · Recent · Favourites · Seating · Tables · Media · Lighting ·
  Plants · Decor · Avatars · Floor · Animated, with **child categories** (e.g. Tables →
  Coffee / Side / Desks) expressed in the tree (not hardcoded in the component).
- **Tiles** — image-first, compact; an animated/interactive sparkle; a **Placeholder**
  badge only in Advanced/internal mode; a favourite star.

Adding a tile creates one instance at its **deterministic** recommended position (no
random), selects it immediately, and closes the drawer to reveal it.

## Advanced mode (internal — hidden by default)

Normal creators never see raw geometry. `More → Advanced` opens a bottom sheet with the
precision controls for the selected object: x / y / width / height, anchor x/y, numeric
z-index, plane, contact shadow, rotation slider (when permitted), flip, **reset to
recommended scale**, the semantic interaction, and the object's advisory warnings +
placeholder note. The technical data always exists in the manifest — it is only hidden
from the default UI.

## Viewport (zoom)

A small cluster offers **Zoom in / Fit / Zoom out** (Fit = 100% here). Zoom scales the
authoring viewport only — it never changes manifest coordinates or sizes. Because pointer
math reads the live scene rect, gestures stay correct under zoom.

## Gesture conflict strategy

- One active pointer ⇒ move (or a handle drag); a second pointer landing on the object
  promotes the gesture to a two-finger **transform** (pinch + twist).
- `touch-action: none` on the canvas stops page scroll/zoom *inside* the editor; the page
  outside is unaffected (browser accessibility zoom elsewhere still works).
- Pointer capture is wrapped in try/catch (it can throw for synthetic/edge pointers) so a
  gesture never breaks.
- Every gesture ends with exactly one history commit.

## Accessibility fallbacks

Pinch/twist are conveniences; the **corner handles and rotation handle are accessible
single-pointer fallbacks** with enlarged (≥28–32px) touch hit areas around small visible
circles. Tap selects; tap empty canvas deselects. All controls have `aria-label`/titles
and ≥44px targets.

## Preserved M6 systems

The editable manifest schema, normalized placement, the pure move/resize/add/remove/
reorder operations, guardrails, history, localStorage persistence, JSON import/export,
Preview, the existing Golden Living Nest route, and all existing tests are unchanged. The
new rotation/flip fields are additive and optional, so older manifests stay compatible.

## Honest browser limitations

- **Viewport zoom has no panning** in this sprint: zoom-in is centred and the overflow is
  clipped (no page overflow), so the far edges aren't reachable while zoomed > 100%.
  Panning is deferred.
- The editor portals over the global site header to achieve true full-screen; `Back`/
  `Done` are the exits.
- Two-finger gestures depend on the browser delivering multiple pointer events; on a
  trackpad without touch, the handle fallbacks are the path.

## Intentionally deferred

- **Connect mode** (content/link binding) — reserved in the mode architecture, not built.
- **Hotspot authoring** — deferred.
- **Focus Area / Detail Scene zoom** — deferred (terminology reserved); this sprint ships
  authoring-viewport zoom only.
