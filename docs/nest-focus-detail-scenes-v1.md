# Nest Focus Areas & Detail Scenes V1 (M7C)

> **Refined by M7C.1 (the Hybrid Focus system) — see
> [nest-hybrid-focus-v1.md](nest-hybrid-focus-v1.md) and ADR-030.** The single "every
> focus opens another room" model below is now one of **two** target types: a **Detail
> Surface** (this document) for perspective/composition close-ups, and a **Zoom Region**
> for content that already exists in the Main Nest and only needs to be enlarged (true
> crop zoom, no new scene). Pre-M7C.1 `targetSceneId` detail links migrate automatically
> to `detail_surface`; everything below still holds for that target type.

> **M7C.6 (ADR-031) note:** a Focus Area is now an **entrance to a child editable scene** —
> the parent defines the entrance rectangle; the child scene (a `NestDetailScene`,
> `sceneType:"focus"`, `parent_crop` base) has its own local objects/hotspots/areas. The
> Detail-Scene machinery described here *is* that child-scene storage + editor; M7C.6 adds
> the scene-graph abstraction, the editor "Enter area" flow, and the persistence fix.

> **M7C.4 (V1) note:** a `zoom_region` Focus Area is now ONE creator-authored fixed-ratio
> rectangle (`focusBounds`) and the visitor zoom is an **in-place** cinematic transform of
> the existing stage (no modal/duplicate stage). **Detail surfaces (`detail_surface`)
> described below remain a separate architecture** (a real scene swap) — unchanged.

> M7C proves Nestudio's next major experience: a visitor enters a full Nest, taps a
> meaningful area (a desk), transitions into an authored close-up **Detail Scene**,
> interacts with smaller objects there, and returns to the Main Nest. Internal routes:
> `/design/nest-focus` (visitor) and `/design/nest-editor` (authoring) — both noindex.
>
> **This is structured navigation, not browser zoom.** One navigation level only:
> `Main Nest → Focus Area → Detail Scene → Back`. It builds on the completed
> **M7A → M7B → M7B.1 → M7B.2** editor foundation; see ADR-029.

## Focus Area definition

A **Focus Area** ([`lib/nest-focus-types.ts`](../lib/nest-focus-types.ts)) is a navigable
region of a scene: normalized `bounds` + optional `shape` (rect/ellipse), a
`sourceSceneId` → `targetSceneId` link, a `trigger` (tap/double_tap), a `transition`
style (zoom/push/fade_zoom), `enabled`/`locked`, and `previewHint` + `ariaLabel`
accessibility metadata. Examples: a desk, a bookshelf, a TV setup, a pinboard.

## Focus Area vs hotspot

A **hotspot** opens or controls *content in place* (Object → Animation → Content) and
never changes scene. A **Focus Area** *navigates* — it transitions the visitor into a
separate Detail Scene. Hotspots are asset-local sub-regions; Focus Areas are
scene-space regions that own a target scene. When they overlap, the hotspot wins (see
*Interaction priority*).

## Main Scene vs Detail Scene

A **Detail Scene** ([`NestDetailScene`](../lib/nest-focus-types.ts)) is a separately
authored close-up composition with its own background, **scene-scoped object manifest**,
z-order, hotspots, content bindings, ambience, and viewport. It is **not** the Main Nest
magnified — magnifying the room would expose low-res raster and add no new interactive
objects. A Detail Scene renders through the **same** `GoldenLivingNestStage` as the Main
Nest (via `editorDocumentToStage`), so there is no second renderer.

## One-level scene graph

The graph attaches **additively** to `EditableNestDocument` as optional `focusAreas` (the
Main scene's) + `detailScenes`. Absent ⇒ the document is a Main-only Nest, so **every
pre-M7C document still validates and loads**. `buildSceneGraph(doc)` derives the
serializable `NestSceneGraph` view (`rootSceneId`, `mainScene.focusAreas`,
`detailScenes`). Nested `Detail → Detail` is **deferred**: a Detail Scene owns no further
Focus Areas (validation rejects nested ones).

> **Deviation from the suggested contract (documented):** the sprint's example
> `NestDetailScene.slots: LivingNestSlot[]` is modelled as `objects: EditableNestObject[]`
> — the editor's own manifest type — so the Detail Scene editor reuses every existing
> pure op (move/resize/hotspots/history/calibration) and the navigator renders it through
> the existing adapter with no second engine.

## Pure scene-graph helpers ([`lib/nest-focus-scenes.ts`](../lib/nest-focus-scenes.ts))

Deterministic, framework-free: `validateFocusArea` / `validateDetailScene` /
`validateSceneGraph`; `addFocusArea` / `updateFocusArea` / `removeFocusArea`;
`createDetailScene` / `duplicateDetailScene` / `removeDetailScene` /
`setDetailSceneObjects`; `linkFocusAreaToScene` / `unlinkFocusArea`;
`findFocusAreaAtPoint` / `resolveFocusNavigation` / `getParentScene` /
`orphanDetailScenes`. Rules enforced: Focus Areas stay inside scene bounds and at/above a
**minimum size** (0.05); the target scene must exist; parent references must match;
ids are unique and **deterministic** (`focus-<n>` / `detail-<n>`, no random); circular
links are rejected; orphaned Detail Scenes are reported as warnings; removing a Focus
Area safely cascades its now-unreachable Detail Scene; malformed imports are rejected.

## Transition model

A lightweight, premium CSS transition (transform + opacity), ~420 ms (180 ms under
reduced motion), origin derived from the Focus Area bounds. The outgoing scene scales
toward the region and cross-fades into the incoming scene; **Back** reverses it.
Interaction is **locked** during a transition (no double-navigation), there is no white
flash or layout jump, and the pure state machine (`canNavigate` / `beginEnter` /
`beginExit` / `settleScene` / `focusTransitionDurationMs`) is unit-tested. No WebGL, no
generated images.

## Visitor navigation ([`components/nest/nest-scene-navigator.tsx`](../components/nest/nest-scene-navigator.tsx))

```
Main Nest → tap "Explore desk" (or double-tap the area) → transition → Desk Detail
          → interact with objects → Back (or Escape / browser back) → Main Nest
```

The navigator renders the current scene through the real stage, overlays a subtle,
accessible **affordance** ("Explore desk") on the Main scene, and a compact **Back** +
scene title on the Detail scene. It supports browser back (`history.pushState` on entry,
`popstate` closes), and is fixture-agnostic.

## Interaction priority

- **Main scene:** `object hotspot → Focus Area → whole-object fallback → empty`. The
  affordance is the primary, discoverable entry; the optional double-tap path runs
  `resolveFocusNavigation` with the hotspot-hit test, so a hotspot always wins.
- **Detail scene:** `selected detail hotspot → whole-object fallback → empty` (no Focus
  Areas at this level). Detail hotspots reuse the existing model + safe-link validation;
  only the tapped region responds; the stage suppresses the whole-object interaction when
  hotspots exist (no double firing).

## Editor Focus mode ([`components/nest/editor/nest-editor.tsx`](../components/nest/editor/nest-editor.tsx))

The mode bar is now **Arrange · Assets · Connect · Focus · Preview** (Focus is shown on
the Main scene only — one navigation level). In Focus mode the canvas shows the Focus
regions in a distinct cobalt style (vs teal hotspots) via
[`focus-editor-overlay.tsx`](../components/nest/editor/focus-editor-overlay.tsx); a creator
selects, moves and resizes a region (one geometry gesture = one history entry), and the
shared bottom sheet ([`focus-sheet.tsx`](../components/nest/editor/focus-sheet.tsx)) guides
**"Select an area visitors can explore"** → name it → **Create detail scene** → **Edit
scene**. Template authors (Advanced) also set the entry trigger, transition style, and see
exact geometry. Focus regions are hidden in Preview. Ordinary object gestures are inert in
Focus mode (the overlay covers the scene).

## Detail Scene editor (shared architecture)

Opening a Detail Scene switches the **active scene**; the same editor edits that scene's
scoped object manifest with the **existing** Arrange / Assets / Connect / Preview, the
asset library, the bottom sheets, hotspots, and undo/redo — no forked second editor. A
context banner shows **Main Nest** vs **Main Nest / Desk**, with one tap **Back to Main
Nest**. Object edits in a Detail Scene write back through `setDetailSceneObjects` and never
touch the Main scene's objects.

## Scene-scoped manifests & persistence

Everything lives on the one `EditableNestDocument`, so the existing localStorage
Save/Load, JSON Export/Import, and Undo/Redo automatically cover the scene graph, Focus
Areas, Detail Scenes, detail objects, hotspots, bindings, ambience and transition
settings. Import/Load additionally run `validateSceneGraph`, so bad cross-references are
rejected with a clear error. Undo/Redo support focus add/delete, move/resize, link/unlink,
create/delete Detail Scene, rename, and transition changes (each a discrete history entry;
one continuous geometry gesture = one entry). Older Main-only documents load unchanged. **No
Supabase.**

## Accessibility & reduced motion

Focus Areas are keyboard-activatable buttons with `aria-label`s (e.g. "Explore desk");
**navigation is never double-tap-only** (tap/Enter always works). In a Detail Scene,
**Escape** and a keyboard **Back** return; focus moves to the Detail heading after entry
and back to the triggering affordance after exit. The transition respects
`prefers-reduced-motion` (a short fade). Small Focus Areas still meet a practical touch
size via the minimum-size rule.

## Internal debug mode

Internal/template-author surfaces may reveal Focus Area bounds, the source/target scene,
trigger, transition (the navigator's `debug` overlay and the Focus overlay's Advanced
geometry readout). Orphan Detail Scenes are reported by `validateSceneGraph`. Normal
creators and visitors never see raw scene ids.

## Golden Desk Detail fixture ([`lib/fixtures/golden-desk-detail.ts`](../lib/fixtures/golden-desk-detail.ts))

The proof target, built **entirely from existing approved assets — no new artwork**. The
current `ast-desk` art is composite, so the scene is an honest structured composition: the
writing desk carrying its calibrated **laptop → website**, **notebook → article**,
**desk lamp → ambience** hotspots, an independent framed **photo → gallery**, and stacked
**books → article**, plus one clearly-marked **microphone → podcast (coming soon,
disabled)** region — no microphone art is invented. It reuses the warm background language
but reads as a close-up workspace, not the room enlarged.

## Known M7B.2 bugs retained for deployment testing

Deliberately recorded, **not fixed** in M7C (they do not block the feature chain):

- the bookshelf upper hotspot may still be slightly misaligned;
- repeated-tap overlap selection can occasionally feel inconsistent;
- small mobile interaction refinements may be needed after on-device testing.

## Honest remaining weaknesses

- The transition is a polished CSS illusion, not a physical camera simulation; origin is
  derived from the Focus Area bounds, not a per-pixel match.
- The visitor double-tap path measures the scene rect on-demand; the affordance is the
  primary, fully-accessible path.
- The Focus overlay and navigator align via measuring the rendered scene element; correct,
  but a layout thrash on resize re-measures.
- DOM behaviours (transition lock, Escape/Back, focus restore, reduced-motion fade) are
  covered by **pure unit tests of their decision helpers** plus browser verification — the
  test runner is node-only by design.

## Deferred beyond M7C

Nested `Detail → Detail` scenes, endless/recursive zoom, puzzle authoring, multiplayer, AI
generation, Supabase persistence, provider embeds, new/edited artwork, and marketplace
work.
