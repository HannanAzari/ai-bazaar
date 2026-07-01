# Nest Editor V1 (M6 — Editor Foundation)

> The first foundation of Nestudio's visual **Nest Editor**. It loads the Golden
> Living Nest as a structured, editable document and lets a user select, move,
> resize, reorder, add, and remove objects; undo/redo; toggle grid + snapping; save,
> reload, export, and import locally; and preview the clean Nest. Internal route:
> `/design/nest-editor` (noindex).
>
> **The editor authors manifests. It never bakes the Nest into one image.**

## Purpose

Composition is now **human-authored**: Nestudio ships professionally authored
completed Nests, and creators may (1) publish a recommended Nest instantly, (2)
customise a completed Nest, or (3) build from an empty Nest. The same editor is the
shared tool behind all three paths (and, later, internal template authors and
approved template designers). This sprint builds only the editing *foundation* — not
onboarding, persistence, marketplace, AI generation, or scene-family selection.

### Three creator paths (the editor serves all three)
- **Instant** — open a recommended completed Nest and publish as-is.
- **Customise** — open a completed Nest and move/resize/swap objects.
- **Scratch** — start from an (eventually empty) Nest and add objects from the tray.

## Why structured manifests (not screenshots)

The editor manipulates **structured instance data**, never a flattened render. A saved
document is a small JSON manifest of object instances with normalized coordinates — so
it is responsive, diffable, re-renderable by the existing engine, publishable as a
template, and future-proof. A screenshot would freeze one resolution and throw away
every interaction, binding, and edit affordance.

## Document model

Two layers, kept separate from the catalog (`lib/nest-editor-types.ts`):

- **`EditableNestObject`** — one placed *instance*: `instanceId`, `assetId`, normalized
  box (`x,y,width,height` ∈ [0,1]), scene `anchor`, `plane`, integer `zIndex`, and
  optional `locked` / `hidden` / `interactionId` / `contentBinding` (reserved) /
  `variantId` / `scaleRef` / `contactShadow`. It references an asset by id and **never
  mutates the catalog** — many instances may share one asset.
- **`EditableNestDocument`** — `version`, `id`, `name`, `backgroundId/Url`,
  `aspectRatio`, `objects[]`, `ambiencePresetId`, timestamps. Serializes cleanly to
  JSON; no React/DOM types in the contract. Pure `validateEditorDocument` /
  `validateEditorObject` helpers gate every load/import.

Planes reuse the locked `NestPlane` union (`front_wall | left_sliver | right_sliver |
floor | foreground`) — aligned to the renderer rather than the sprint's example
`left_wall/right_wall` — so edited documents stay renderer-compatible.

## Normalized placement

All geometry is normalized 0..1 on the scene, so a layout authored on one screen
renders identically on any size (responsive by construction). The editor converts
pointer pixels → normalized coordinates against the canvas rect; the renderer maps
normalized boxes → CSS percentages. The conversion is the same one the Golden Living
Nest scale contract uses (avatar = 1.0).

## Core operations (pure, tested — `lib/nest-editor.ts`)

`createEditorDocumentFromTemplate` · `serializeEditorDocument` / `parseEditorDocument`
· `moveObject` · `resizeObject` (proportional, aspect-locked) · `addObject` (deterministic
default by plane — **no random**) · `removeObject` · `reorderObject` (front/back/
forward/backward, re-packed to deterministic integer z) · `setObjectProps` ·
`editorDocumentToStage` (reverse adapter → the existing renderer). Every operation is a
pure function returning a new document; none use `Math.random` or `Date.now`.

## Guardrails (`lib/nest-editor-policy.ts`)

Per-slot-type (and default) guardrails define `allowedPlanes`, `minWidth` / `maxWidth`
/ `recommendedWidth`, a default box aspect, `defaultAnchor`, `defaultZ`, and
`contactShadow`. `clampObject` keeps a box on-canvas **and** its base anchor in the
plane band (floor objects stay on the floor, wall objects on the wall) and preserves
aspect on clamp. `editorWarnings` produces advisory (non-blocking) notes: placeholder
art, sub-tap-target size, outside-safe-area, unusual plane. **Warnings inform; only
hard-invalid positions are prevented.**

## Asset tray (`components/nest/editor/asset-tray.tsx`)

Approved assets grouped into **Seating · Tables · Media · Lighting · Plants · Decor ·
Avatar · Floor**. Each card shows a thumbnail, name, category, an interaction-capability
dot, and a visible **Placeholder** / Approved badge (placeholder art is never shown as
final). Adding a card creates one instance at a deterministic default position by
plane, at the recommended scale, and selects it immediately.

## History model (`lib/nest-editor-history.ts`)

A generic bounded past/present/future history (default 50 states). The editor commits
**one entry per completed gesture** — a drag pushes once at pointer-up, not on every
move. A new action clears the redo (future) stack. Pure and unit-tested.

## Local persistence (`lib/nest-editor-storage.ts`)

`localStorage` behind an injectable `StorageLike` adapter (testable, SSR-safe), under a
namespaced key `nestudio:nest-editor:v1:<document-id>`. Supports **Save draft · Load
draft · Reset to Golden Living Nest · Export JSON · Import JSON**. Imports are validated
before they are trusted; malformed JSON is rejected with a clear error and never
auto-imported. **No Supabase, no network.**

## Preview mode (`components/nest/editor/nest-editor.tsx`)

Preview converts the editable document to the renderer's `{ template, composed }` pair
(`editorDocumentToStage`) and renders it with the **existing** `GoldenLivingNestStage`
— not a second engine. It hides all editor controls, grid, handles, warnings, and
labels; keeps interactions, ambience, and contact shadows live; and excludes hidden
objects. The locked Golden Living Nest route is untouched.

## Interaction scope (V1)

Creators do not choose animation technology; each asset keeps its predefined behaviour.
The editor exposes only the **semantic** interaction (TV→video, Frame→gallery,
Avatar→intro, Lamp→ambience, Plant→ambient). The `contentBinding` field is reserved but
content/link binding is **not** built this sprint.

## Future work (explicitly deferred)

- **Supabase persistence** — promote the local draft to durable, shareable storage.
- **Content binding** — connect a creator's links/media to an object's interaction.
- **Hotspot editor** — draw/edit interaction regions on an object.
- **Template publishing** — publish an edited document as an approved template manifest.
- **Permissions / roles** — internal authors vs creators vs approved designers; lock
  ranges, approval gates.
- **Polish pass** — the dark, game-like editor UI; richer guides; multi-select; copy.

## Known limitations (V1)

- One background (Golden Living Nest); no scene-family selection or empty-Nest start yet.
- Resize is proportional from a corner via horizontal travel; no aspect-free distortion
  (intended) and no rotation (out of V1 scope).
- Save stamps `updatedAt` at the UI layer (the pure core stays deterministic).
- Sofa / coffee-table / rug remain M5 placeholder art (flagged in the tray + warnings).
- Editor UI is functional, not yet visually art-directed (intentional, per the CTO note).
