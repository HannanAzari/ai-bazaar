# M24C + M24D — Sprint Report

**Branch** `m12-nest-platform` · **Commits** `52bd654` (M24C), `c9bb259` (M24D)
**Gates at `c9bb259`:** typecheck ✅ · eslint 0 errors ✅ · **900 tests / 96 files** ✅ · `next build` ✅ (132 pages)
**Deployed:** ❌ — Vercel returns `402 DEPLOYMENT_DISABLED`. See §6.

---

## 0. One-paragraph summary

M24C found that two founder-reported "rendering bugs" were actually **data loss in the
editor↔document conversion** — the room background and every focus region were being
dropped on save. M24D then built the runtime that *replays* what M24C preserved: scene
resolution was extracted out of components into a pure module, so Editor Preview and the
public visitor now read the same functions over the same document and cannot disagree. The
blurred surround was replaced with a deterministic adaptive matte. Nothing here is a new
feature; it is the completion of the "what you build is what everyone sees" contract.

---

## M24C — the canonical runtime (`52bd654`)

### C1. The background was being thrown away on every save

**Symptom:** "Editor Preview does not show the room background" — a plain beige field.

**Cause:** `nestDocumentToEditable()` set `backgroundImageUrl` but **not** `backgroundId`.
A reopened editor therefore carried the golden-living fixture's id. `NestPreview` builds
its document from `doc.backgroundId`, `resolveBackground()` matched nothing, and the scene
drew empty. The serious part was not the display: **saving or publishing from that editor
wrote the wrong id back**, so a creator could lose their background permanently.

**Fix:** `nestDocumentToEditable()` now sets `backgroundId`. Covered by
`test/nest-scene-roundtrip.test.ts`, including a 3× round-trip that asserts no drift.

### C2. Objects placed inside a focus region never existed outside React

**Symptom:** "A plant placed inside a focused area disappeared completely."

**Cause:** `EditableNestDocument` has carried `focusAreas` / `detailScenes` for a long
time, but only `doc.objects` — the **main** scene — was ever serialised. Focus regions and
everything inside them lived solely in component state and died with the component.

**Fix:** a versioned `NestSceneExtras` (`NEST_SCENE_VERSION`) is now part of the canonical
document and travels through save → draft → publish → visitor load, via
`editableSceneExtras(doc)` on the way out and restoration on the way back in.

The plant is **not** promoted into the main scene. It stays inside its focus scene with its
parent relationship intact — duplicating it into the root placements was explicitly ruled
out as fabricating creator intent. `test/nest-scene-roundtrip.test.ts` asserts this by name.

### C3. Schema tolerance — a self-inflicted outage, and the rule that came out of it

`scene_extras` needs a new column. Selecting it unconditionally produced
`column nests.scene_extras does not exist` on **every feed read** against the live
database — the whole app down, the same shape of failure M23B had already fixed once for
`profiles.house_style`.

The repository now probes once (`sceneExtrasAvailable`), falls back to the base column set
(`NEST_COLS()`), omits the column on write, and gives the creator a clear message for the
one feature that genuinely needs it.

> **Rule (D-30):** a column that is not there yet must **degrade a feature, never break the
> product.**

### C4. One coordinate space, restored background, letterbox replaced

Also in M24C: the flat colour bands around the fixed-aspect scene were replaced with the
room's own background, enlarged and blurred. *(M24D then replaced that in turn — see D2.)*

---

## M24D — visitors actually replay it (`c9bb259`)

### D1. Scene resolution left the components — this is the load-bearing change

New `lib/nest-scene.ts`: **pure, React-free, Supabase-free.**

```
resolveFocusRegions(doc)      → region + its child scene + the crop
focusCameraTransform(crop)    → { scale, originX, originY }
resolvePlacementSurfaces(p)   → surfaces that have content, with object-local bounds
placementIsInteractive(p)     → link / interaction id / hotspots
focusObjectsInPaintOrder(o)   → z-sorted children
```

The old split — a static renderer for visitors, `NestSceneNavigator` for the editor —
existed *because* scene resolution lived inside components. With it extracted, both modes
read the same functions over the same document.

**Focus** is one camera transform applied to the **whole stage**, so the background and
every object move together: a focused view is the main scene under a transform, never a
re-laid-out scene. The smaller axis wins so nothing outside the crop leaks in. Visitors get
a discoverable tap target (never the editor's authoring rectangle) and always a way back
out ("Back to the room"). A zoom-only region with no child scene still resolves — dropping
it would discard creator intent.

**Surfaces** resolve from the placement's own `interaction.surfaces` bag plus the asset
catalogue's geometry. No editor state anywhere in the path — which is exactly why a visitor
could not render one before. Image, text and sticker content all draw; content for a
surface the asset no longer declares is ignored rather than crashing.

22 cases in `test/nest-runtime-focus-surface.test.ts`.

### D2. The blurred surround → an adaptive matte

The enlarged blurred background produced visible green/beige/dark bands on real rooms and
read as an accident. It is replaced by `SceneSurround`:

- one deep desaturated colour derived from the background id — `hsl(<hue> 14% 11%)`,
  **deterministic**, so it never flickers and needs no pixel sampling;
- a soft vertical gradient, a warm radial glow behind the scene, and an edge vignette.

Geometry is untouched — this paints *behind* the fixed 3:4 stage.

### D3. The 9:16 immersive background — documented, not built

`ImmersiveBackground` in `lib/nest-scene.ts` is a typed seam only:

```
canonicalBackgroundUrl   3:4    the editable scene (today's backgroundId)
immersiveBackgroundUrl   9:16   coordinated extension, generated from the same room
safeArea                        which band of the 9:16 the 3:4 scene occupies
```

Adopting it requires **no geometry change** — supplying the URL only swaps what is drawn
behind the stage. Nothing generates it yet.

---

## 4. Verified in-browser

- Editor Preview renders `bg-creator-loft.webp` at **opacity 1**, stage aspect **0.750** —
  the beige-field bug is fixed.
- Home shows the charcoal matte with **no colour bands**.

## 5. NOT verified — blocked

None of the following has been exercised end-to-end, because both a deployment and a
migration are outstanding:

- a focus region driven through **save → publish → visitor**;
- surface content viewed by a second account;
- view counting (needs `nest_views`);
- draft save/publish against the live DB (needs `nests.draft_doc`).

The logic is unit-tested (22 + 15 cases). That is not the same as proven.

## 6. Founder actions required

1. **Vercel** — clear the `402 DEPLOYMENT_DISABLED` block and redeploy
   `m12-nest-platform`. Nothing since `235d2ab` has shipped, which is why several
   already-fixed issues kept being re-reported.
2. **Supabase SQL editor** — apply `supabase/provision/m24b_provision.sql`
   (`nest_views`, `nests.draft_doc`, `nests.draft_updated_at`, `nests.scene_extras`).
   Additive and idempotent.

Then walk: create a Nest → place an object inside a focus region → save → publish → open
`/nest/<slug>` **signed out** → tap the focus → confirm the object is there.
