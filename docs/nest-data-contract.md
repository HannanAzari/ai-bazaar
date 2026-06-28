# Nestudio V2 — Nest Data Contract (M1)

> The typed contract for the V2 **House → Nest → Objects → Content** architecture
> (ADR-027), authored to the **front-facing cinematic camera** locked by ADR-028. This doc
> explains each type in plain English with example JSON. It is the shape future
> implementation will use — the **Nest Composer**, the **Asset Library**, and the mobile
> renderer — but **M1 builds the contract only**: no Composer, no editor UI, no Supabase
> tables, no asset generation.
>
> **Source of truth for the types:** [`lib/nest-types.ts`](../lib/nest-types.ts). Worked example:
> [`lib/fixtures/golden-nest.ts`](../lib/fixtures/golden-nest.ts). Tests:
> [`test/nest-types.test.ts`](../test/nest-types.test.ts). Masters:
> [nestudio-production-pipeline.md](nestudio-production-pipeline.md),
> [golden-nest-production-bible.md](golden-nest-production-bible.md).

## Why this is additive (read first)

V1 ships a working room engine in [`lib/types.ts`](../lib/types.ts) (`CatalogAsset`,
`AssetCategory`, `Room`, `RoomObject`, `VisualTemplate`, …). **None of it is changed or
removed.** The V2 types live in a new file and are namespaced `Nest*` to avoid any clash
(e.g. V1 `AssetCategory` vs V2 `NestAssetCategory`, V1 `CatalogAsset` vs V2 `NestAsset`). The
two models will coexist until V2 implementation replaces the V1 surface in a later sprint.

## The mental model

```
NestTemplate  ──defines──▶  SceneSlot[]        (where things can go, on the locked camera)
NestAsset     ──snaps into──▶ a compatible SceneSlot   (what goes there; curated, approved)
Interaction   ──bound to──▶  an asset/slot      (Object → Animation → Content behaviour)
ComposedNest  = template + (slot → asset + variant + content) + avatar + belongings + ambience
```

Composition = deterministically matching **approved, compatible** assets to slots. The
template author already solved placement/perspective for the camera, so any compatible asset
looks correct. **No free-form pixel placement, ever.**

## Locked constants

| Constant | Value | Meaning |
|---|---|---|
| `NEST_CAMERA_CONTRACT_VERSION` | `"front-facing-v1"` | The ADR-028 camera every template + asset is authored to. Frozen. |
| `CURRENT_NEST_DNA_VERSION` | `"nestudio-v2-1.0"` | The V2 visual-DNA lineage (front-facing successor to the V1 ~30° iso object DNA 3.7.0, now reference only). Placeholder until the V2 object DNA is formally re-locked. |
| `NEST_SLOT_TYPES` | 10 types | `media · desk · shelf · books · plant · window · avatar · frame · lamp · product` |

---

## 1. `NestAsset` — a curated reusable object

A library object (TV, sofa, lamp, book, plant, frame, avatar, personal belonging). Every
asset is authored to the locked camera + DNA, tagged with the **slot types** it can fill, and
**approved** before it can be composed. `category` is *what it is*; `assetType` is its
*production tier* (`hero`/`standard`/`filler`) and flags the two runtime-generated kinds
(`avatar`, `personal_belonging`). `source` records provenance — only `runtime_avatar` /
`runtime_personal` are generated per creator (ADR-027). LOD is `thumbnailUrl` (cards) →
`imageUrl` (in-Nest) → `transparentPngUrl` (master). `variants` are cheap color/material/accent
swaps; `states` are interaction visuals (idle/hover/open).

```json
{
  "id": "ast-tv",
  "name": "Wall TV",
  "category": "electronics",
  "tags": ["screen", "media", "video"],
  "dnaVersion": "nestudio-v2-1.0",
  "cameraContractVersion": "front-facing-v1",
  "assetType": "hero",
  "imageUrl": "/nests/golden-nest-v1/ast-tv.webp",
  "thumbnailUrl": "/nests/golden-nest-v1/ast-tv.thumb.webp",
  "transparentPngUrl": "/nests/golden-nest-v1/ast-tv.png",
  "compatibleSlotTypes": ["media"],
  "defaultInteractionId": "tv_glow_open_youtube",
  "variants": [{ "id": "tv-walnut", "name": "Walnut frame", "material": "walnut" }],
  "states": [{ "name": "idle" }, { "name": "open" }],
  "approvalStatus": "approved",
  "source": "curated",
  "createdAt": "2026-06-26T00:00:00.000Z",
  "updatedAt": "2026-06-26T00:00:00.000Z"
}
```

## 2. `NestTemplate` — a front-facing cinematic scene

A curated, **empty** front-facing scene (baked ambient room light) plus the **Scene Slots**
assets snap into. `sceneBox` describes the shallow "stage box" geometry (front wall + left/right
slivers + floor, a floor seam, and the ~5–10° camera tilt — ADR-028), all normalized 0..1.
`ambiencePresets` are global tint/glow moods (all keep the warm-light/cool-shadow law).
`defaultSlotAssignments` is a ready-to-compose starting point. Approved before use.

```json
{
  "id": "golden-nest-v1",
  "name": "Golden Nest — Warm Studio",
  "description": "The first front-facing cinematic Nest template…",
  "cameraContractVersion": "front-facing-v1",
  "dnaVersion": "nestudio-v2-1.0",
  "backgroundImageUrl": "/nests/golden-nest-v1/template-warm-studio.webp",
  "aspectRatio": "3:4",
  "sceneBox": {
    "frontWall": { "x": 0.12, "y": 0.05, "width": 0.76, "height": 0.57 },
    "leftSliver": { "x": 0.0, "y": 0.05, "width": 0.12, "height": 0.6 },
    "rightSliver": { "x": 0.88, "y": 0.05, "width": 0.12, "height": 0.6 },
    "floor": { "x": 0.0, "y": 0.62, "width": 1.0, "height": 0.38 },
    "floorSeamY": 0.62,
    "cameraTiltDeg": 7
  },
  "slots": [ /* SceneSlot[] — see §3 */ ],
  "ambiencePresets": [
    { "id": "warm_day", "name": "Warm day", "tint": "#fff6e0", "glow": "#ffe9b8", "intensity": 0.25 }
  ],
  "defaultSlotAssignments": [{ "slotId": "slot-media", "assetId": "ast-tv" }],
  "approvalStatus": "approved",
  "createdAt": "2026-06-26T00:00:00.000Z",
  "updatedAt": "2026-06-26T00:00:00.000Z"
}
```

## 3. `SceneSlot` — a named placement region

One named spot inside a template. It encodes everything needed for guaranteed composition:
the `slotType`, which asset `acceptedAssetCategories` it takes, the `bounds`/`anchorPoint`
(normalized footprint + base-centre the asset snaps to), the depth `plane`, paint order
(`zIndex`), `importance` (`primary` = identity-driving, expected to be filled; `optional` =
ambient/filler), and an optional `defaultInteractionId`.

```json
{
  "id": "slot-media",
  "name": "Media wall",
  "slotType": "media",
  "acceptedAssetCategories": ["electronics"],
  "bounds": { "x": 0.16, "y": 0.12, "width": 0.34, "height": 0.24 },
  "anchorPoint": { "x": 0.33, "y": 0.36 },
  "zIndex": 1,
  "plane": "front_wall",
  "importance": "primary",
  "defaultInteractionId": "tv_glow_open_youtube"
}
```

## 4. `Interaction` — Object → Animation → Content

A reusable behaviour, keyed by id, inherited by any asset that points at it. `trigger` is what
fires it (`tap` is the primary mobile trigger; `auto` is ambient), `animation` is the
lightweight motion, `contentType` is what opens. `reducedMotionFallback` is mandatory (what
plays under prefers-reduced-motion — usually `none` = instant). `sound` is optional and used
sparingly.

```json
{
  "id": "tv_glow_open_youtube",
  "name": "TV — glow → video",
  "trigger": "tap",
  "animation": "glow",
  "contentType": "video",
  "reducedMotionFallback": "none",
  "notes": "Screen warms up, then opens the creator's video content."
}
```

## 5. `ComposedNest` — one creator's assembled Nest

A **lightweight manifest** (not a baked image): a template + the creator's chosen assets-in-slots
with content bindings + avatar + a few personal belongings + an ambience preset. `quickLinks`
is the mandatory flat, crawlable link list rendered alongside every Nest (SEO/accessibility/"I
just want the link" — carried forward from ADR-024). The renderer composes template image +
snapped assets + ambience on device.

```json
{
  "id": "composed-golden-nest-v1",
  "ownerId": "demo-owner-1",
  "houseId": "demo-house-1",
  "templateId": "golden-nest-v1",
  "slotAssignments": [
    {
      "slotId": "slot-media",
      "assetId": "ast-tv",
      "variantId": "tv-walnut",
      "content": { "contentType": "video", "url": "https://youtube.com/@creator", "title": "My channel" }
    }
  ],
  "avatarAssetId": "ast-avatar",
  "personalAssetIds": [],
  "ambiencePresetId": "warm_day",
  "accessLevel": "public",
  "quickLinks": [{ "id": "ql-yt", "label": "YouTube", "url": "https://youtube.com/@creator" }],
  "createdAt": "2026-06-26T00:00:00.000Z",
  "updatedAt": "2026-06-26T00:00:00.000Z"
}
```

### `SlotAssignment` and `NestContentBinding`

A `SlotAssignment` binds one asset to one slot (with an optional `variantId`, an `interactionId`
override, and a `content` binding). `NestContentBinding` is the destination an interaction opens
(`contentType` + `url`/`title` + a loose `data` bag that can grow without a migration).

---

## Helpers / validators (pure, tested)

These live in `lib/nest-types.ts`. They are the rules the future Composer must compose *to* —
they are **not** the Composer.

| Helper | What it does |
|---|---|
| `findSlot(template, id)` | Look up a slot by id. |
| `primarySlots(template)` | The identity-driving slots expected to be filled. |
| `isSlotCompatible(slot, asset)` | True iff the asset declares the slot's type **and** the slot accepts the asset's category. |
| `resolveInteractionId(slot, asset, assignment?)` | Interaction precedence: assignment override → asset default → slot default → none. |
| `isRuntimeGenerated(asset)` | True for `runtime_avatar` / `runtime_personal` sources. |
| `validateComposedNest(nest, template, assetsById)` | Returns `{ ok, errors[], warnings[] }`. Hard errors: template mismatch, unknown/duplicate slot, unknown asset, incompatible asset, unapproved asset, bad variant, bad ambience preset, non-avatar avatar, unknown personal asset. Soft warning: an unfilled primary slot. |

## Open items deferred to later milestones

- **SQL parity / Supabase tables** for `nest_assets`, `nest_templates`, `composed_nests` (the
  two-layer rule applies when persistence lands — M-later, not M1).
- **The Nest Composer** (creator profile → template → assets-into-slots) — M-later.
- **Editor UI** and the **mobile front-facing renderer** — M-later.
- **Asset generation** — the V2 Asset Library must be authored to the front-facing camera
  (ADR-028); the fixture image URLs are placeholders until then.
