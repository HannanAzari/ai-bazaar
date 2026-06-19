# Nestudio DNA Specification (V3.7 — FROZEN)

**Status: LOCKED.** V3.7 is the production baseline visual language. This document is
the formal, frozen specification. The machine-readable source of truth is
[`lib/prompts.ts`](../lib/prompts.ts) (`MASTER_PROMPT`, `NESTUDIO_DNA`,
`NESTUDIO_SIGNATURE`, `NEGATIVE_PROMPT`) + [`lib/nestudio-spec.ts`](../lib/nestudio-spec.ts)
(Camera Spec V1, Object Rules V1), version-pinned by `NESTUDIO_DNA_VERSION = "3.7.0"`
and guarded by [`test/dna-freeze.test.ts`](../test/dna-freeze.test.ts). Changing the
language requires bumping the version and updating the freeze test — it is not edited
casually.

> Nestudio is a **premium stylized world**, not a furniture catalog. Inspiration is
> high-end stylized game art (readable silhouettes, warm materials, rounded forms,
> friendly proportions, premium collectible-toy quality, expressive but believable).
> We copy **no** existing game — this is an original Nestudio visual language.

## The ten DNA principles (frozen)

1. Rounded geometry
2. Soft edge transitions
3. Thick readable silhouettes
4. Warm oak detailing
5. Premium matte materials
6. Friendly stylized proportions
7. Consistent visual language across categories
8. Strong personality expression
9. Room assets and characters belong to one universe
10. Distinct from generic furniture catalogs

---

## Shape language

- **Rounded, confident forms.** Soft rounded corners, gently chamfered edges, elegant
  curves. No sharp/hard corners, no thin spindly parts.
- **Soft edge transitions.** Surfaces meet with softened fillets and smooth material
  transitions, never crisp machined seams.
- **Soft geometric base.** Forms read as simplified, slightly idealised geometry
  (rounded boxes, gentle cylinders, organic blobs for bold pieces).
- Recognisable **even with colour and material removed** — the silhouette alone says
  "Nestudio."

## Proportions

- **Friendly, slightly exaggerated.** Chunkier than real furniture (thicker cushions,
  slightly oversized soft volumes, generous radii) but still believable — never puffy,
  never inflated, never cartoon-toy.
- Stable, grounded stances; visual weight low and reassuring.
- Consistent relative scale across the catalog (see Scaling rules).

## Materials

- **Premium matte** above all. Soft matte finish, restrained sheen, subtle ambient
  occlusion. No glossy plastic, no high-gloss, no chrome glare.
- Tactile, natural, believable: oak, wool, bouclé, felt, soft leather, matte ceramic,
  matte stone, matte technical fabric.

### Wood treatment

- **Warm oiled oak is the signature wood** (walnut as the warm-dark variant). Soft
  matte finish, gentle grain implied not photoreal, softened edges, rounded legs/feet.
- Wood detailing is **consistent across every category** — the same oak language on a
  sofa leg, a shelf, and a table edge.

### Metal treatment

- Sparingly used, **powder-coated matte** only (no chrome/polished metal). Tubular
  bent forms with rounded bends; reads as soft, friendly, premium — never industrial.

### Fabric treatment

- Soft matte textiles (wool, bouclé, felt, soft leather, corduroy, linen, microfibre).
- Gentle, even drape; plump-but-tailored cushions; visible-but-soft texture that stays
  readable at small sizes. No deep wrinkles, no photoreal fuzz.

## Color philosophy

- **Warm, optimistic, inviting.** A warm cozy base of muted earthy tones (oatmeal,
  oak, cream, sand) per object.
- **One confident accent color** per object — the personality's signature accent
  (sage, caramel, dusty lilac, mustard, rust, teal, cobalt, emerald, electric violet,
  clay terracotta). Accent is a deliberate highlight, never the whole object.
- Palette is cohesive across the catalog so mixed assets still harmonise in a room.

## Silhouette rules

- **Thick, readable, closed silhouettes.** A single confident outline; avoid thin
  legs, gaps, or fussy detail that breaks up at small sizes.
- Personality must be readable from silhouette alone (see the personality system in
  [`lib/sofa-dna.ts`](../lib/sofa-dna.ts)).
- One isolated object, centred, fully in frame (Object Rules V1 + Camera Spec V1).

## Readability rules

- Must read clearly at **64×64** and **128×128**. If detail disappears at those sizes,
  simplify the form rather than add detail.
- Bold silhouette + high value contrast between object and (transparent) background.
- Soft, even directional key light (warm, upper-left) for consistent legibility.

## Scaling rules

- **One camera, one scale, one framing for every asset** (Camera Spec V1: 3/4
  isometric ~30°, centred, fills most of frame, no cropping). This is what lets assets
  drop into the room engine at a consistent size.
- Object fills most of the frame; relative real-world scale is implied by the form, not
  by frame size. Room-engine `defaultScale` (see `CATEGORY_META`) handles in-room sizing.
- Transparent PNG target; no floor, pedestal, platform, or shadow plate.

## Asset compatibility

- Every category obeys the **same** DNA + Signature Design Language (`NESTUDIO_SIGNATURE`
  is folded into every prompt), so any two assets read as one manufacturer.
- Mixed assets share lighting, camera, palette logic, wood language, and edge
  treatment → they compose without clashing.

## Room compatibility

- Assets are single, isolated, transparent, consistently scaled and lit → they place
  cleanly into the nine-zone room template (`lib/zones.ts`) and the Room Designer
  Sandbox without per-asset fixes.
- Shared neutral pieces (lamp, plant, rug, wall art, storage) are personality-light so
  they reuse across many rooms; hero seating carries the room's personality.

## Character compatibility

- Characters are **not yet generated**, but the language is authored to extend to them:
  the same rounded geometry, soft edge transitions, friendly stylised proportions,
  premium matte materials, warm palette + one accent, and the same warm directional
  key light. A future character spec inherits this DNA so rooms and their inhabitants
  read as **one universe** (principle 9). Characters will use the same Camera Spec for
  catalog/portrait renders; in-room posing is a later concern.

---

## What is explicitly OUT (frozen negatives)

Generic furniture catalog / showroom / marketplace listing, stock furniture or product
photography, interior-design renders, icon-pack / app-icon / clipart / sticker looks,
luxury-mansion / ornate / baroque furniture, children's / kids' furniture, cheap
toy-like / puffy / inflated / glossy-plastic looks, photorealism, painterly/storybook,
flat vector. (See `NEGATIVE_PROMPT`.)
