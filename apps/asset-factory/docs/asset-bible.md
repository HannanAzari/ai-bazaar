# Nestudio Asset Bible

The **source of truth** for every generated/imported asset that enters the
Nestudio (AI Bazaar) catalog. If an asset does not satisfy this document, it does
not get approved. Pair it with [`../lib/prompts.ts`](../lib/prompts.ts) (the
machine-readable master/negative/category prompts) — this file is the *why*, that
file is the *what to type*.

---

## 1. Nestudio visual style

Nestudio is a **cozy creative village** — hand-illustrated, storybook-flavoured,
warm parchment palette. Assets are the furniture and props of a creator's room.
They must look like they belong in the same illustrated world as the village
houses: soft, warm, friendly, and calm. Never clinical, never edgy, never loud.

## 2. 2.5D cozy isometric direction

- **2.5D isometric** — objects are drawn in a consistent isometric projection (not
  flat front-on, not full 3D perspective).
- **Soft, rounded shapes** — gentle corners and edges; nothing sharp or angular.
- **Single, centered object** — one prop per asset, centered in the frame, with
  breathing room around it.
- **Cozy scale** — readable and charming at small sizes (objects render small in a
  room).

## 3. Camera angle

- A **consistent ~30° isometric camera**, viewed slightly from above and to the
  side. Every asset shares the same angle so a room composed of many assets reads
  as one coherent scene.
- **No random perspective**, no front elevation, no top-down, no dramatic foreshortening.

## 4. Lighting direction

- **Warm golden-hour lighting** from a consistent upper direction.
- **Soft, gentle shadows** grounding the object — and the **shadow must be fully
  contained within the frame** (never cut off at the edge).
- No harsh, high-contrast, or colored studio lighting.

## 5. Transparent background requirements

- **Clean transparent PNG** (or WebP) background — alpha, not white, not a color
  fill, not a scene.
- Edges must be clean (no halo, no leftover matte).
- **A white or opaque background is a quality warning** and should be fixed before
  approval.

## 6. Acceptable categories

Grouped exactly as the factory taxonomy ([`../lib/types.ts`](../lib/types.ts)):

- **Interior**: chair, table, desk, shelf, sofa, rug, plant, lamp, book, computer,
  microphone, camera, guitar, product_display, wall_art, tv_screen
- **Exterior**: door, window, tree, flower, fence, sign, lantern, mailbox, bench,
  market_stall
- **Avatar / support**: avatar_body, hairstyle, clothing, accessory, pet,
  instrument, tool
- **Business**: cafe_counter, restaurant_table, gym_equipment, medical_desk,
  workshop_tool, podcast_setup, shop_shelf

## 7. Forbidden styles

Mirror the master negative prompt. **Reject** anything that is:

- photorealistic / photographic / 3D-rendered
- harsh neon or oversaturated
- random or dramatic perspective; front-on flat 2D
- text baked into the image — **unless the asset is signage** (`sign`) where short
  text is the point
- shadows cut off at the frame edge
- white or otherwise opaque background
- multiple objects / busy scene / cropped subject
- dark, gritty, or moody (off-brand for a cozy village)

## 8. Scale rules

- Compose for a **square frame** (1:1). Recommended **512–2048px**; **1024×1024 is
  the default**. Below 256px triggers a "too small" warning, above 2048px a "too
  large" warning.
- Keep the subject within ~80% of the frame with margin for the contained shadow.
- The object's *in-room* size is controlled by `defaultScale` (per category), not
  by the source image size — keep the source consistent.

## 9. Naming rules

- **Display name**: short, friendly, title-case ("Cozy Reading Chair", "Wooden
  Market Stall").
- **Slug**: auto-derived (lowercase, hyphenated) — drives the exported id
  `ast-<slug>`. Keep names unique so slugs/ids don't collide (the factory warns on
  duplicate slugs).
- Avoid brand names, emoji, and version numbers in names.

## 10. Metadata rules

Every approved asset must carry:

- a **category** (from §6) — drives the Nestudio category, placement, compatible
  zones, default scale, and default action.
- **tags** — lowercase, a few discovery keywords (strongly suggested; missing tags
  is a warning).
- correct **dimensions** and a **transparency** flag.
- a **pack** name to group a batch (e.g. `interior-starter`).
- on approval, a **reviewer** and **reviewedAt** are stamped automatically.
- **placeability (V2.5):** the category's Nestudio category must be accepted by at
  least one of its compatible zones. Floor-standing items are `furniture`/
  `structure`/`plant`/`floor`; wall/shelf props are `decor`. There is **no room
  zone for `lighting`**, and floor zones do **not** accept `decor` — `CATEGORY_META`
  encodes valid mappings, and the **Reports → import validation** surface flags any
  asset that can't be placed. See [catalog-validation.md](catalog-validation.md).

## 11. Prompt template rules

- Always build from the **master prompt** + a **category descriptor** + the shared
  **style tokens**, with the shared **negative prompt** (see `../lib/prompts.ts`).
- Don't drop the style spine — it is what keeps the catalog visually consistent.
- Per-asset tweaks go in the *subject* / *extra* slots, never by rewriting the
  master prompt.
- **Generation style (V3.1):** the generation prompt system is now
  **Nestudio Premium Game Style V1** — polished mobile-game collectibles
  (single isolated object, transparent PNG, no platform/pedestal/props, 30°
  isometric, soft studio lighting, readable at 64–128px). It replaces the earlier
  storybook generation direction. The full identity + the master/negative prompts
  live in [premium-style.md](premium-style.md); calibrate it in the **Style Lab**
  before scaling.
- **Generation (V3):** the **Generate** tab feeds this prompt system to Replicate
  (`black-forest-labs/flux-schnell` by default). Generation is OFF by default;
  dry-run is free. **AI output is never auto-approved** — it enters `needs_review`
  and is auto-validated. Raw model output is **not transparent**, so every generated
  asset carries a `non_transparent` warning and needs a background-removal pass
  before it can meet §5. See [generation-ops.md](generation-ops.md).

## 12. Quality checklist (before Approve)

- [ ] Cozy 2.5D isometric, consistent ~30° camera
- [ ] Soft rounded shapes; single centered object
- [ ] Warm golden-hour lighting; soft shadow **fully in frame**
- [ ] Clean **transparent** PNG/WebP background, clean edges
- [ ] Readable at small size
- [ ] No photorealism, no neon, no random perspective
- [ ] No baked-in text (unless it's a `sign`)
- [ ] Correct category, helpful tags, sane dimensions (512–2048px)
- [ ] Unique name/slug (no duplicate-slug or duplicate-image warning)
- [ ] No critical quality issues outstanding
