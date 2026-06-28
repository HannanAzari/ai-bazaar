# Nestudio Visual DNA — V1.0 (LOCK CANDIDATE)

> **🔄 V2 update (ADR-027 + ADR-028, House → Nest).** This DNA **carries forward** — palette,
> warm-light/cool-shadow, rounded matte forms, one accent, cozy/handcrafted, north star *"this place
> feels like me."* **What changes — the camera (ADR-028):** the locked production camera is now the
> **front-facing cinematic Nest** (full front wall + side-wall slivers + floor, shallow depth,
> eye-level/slightly-elevated ~5–10° tilt, mobile-first) — **not** the ~30° parallel-isometric
> dollhouse of V1 (§11; the iso Perspective Contract is preserved as history in §11.1). This DNA now
> governs **front-facing Nest scenes + curated Asset-Library assets authored to that camera**.
> Wherever this doc says "iso"/"dollhouse"/"~30°", read it as **V1 reference**; the V2 model is
> **House → Nest → Objects → Content**. Master: [nestudio-production-pipeline.md](nestudio-production-pipeline.md).

> **Status: LOCK CANDIDATE.** This is the finalization pass that merges the V0.1 vision
> document and the Scene Calibration System into **one authoritative source of truth** for
> all Nestudio scene art — interior shells, exterior shells, village tiles, landscaping,
> and (reserved) characters. After this document is approved and locked, documentation
> work stops and **Interior Shell V1 generation begins.**
>
> **Authority & scope.**
> - This document is the **single source of truth for the *world* visual language**
>   (everything around objects).
> - It is **subordinate to the frozen object DNA V3.7.0**
>   ([`apps/asset-factory/docs/nestudio-dna-spec.md`](../apps/asset-factory/docs/nestudio-dna-spec.md),
>   `NESTUDIO_DNA_VERSION = "3.7.0"`). For *objects*, the object spec wins. This document
>   **extends** that language to scenes so all layers read as one universe (object DNA
>   principle 9). It does not edit the object DNA.
> - The full procedural detail of the production pipeline (golden-set review steps, the
>   calibration SOP, the per-family rubric anchors, the exact generation prompt) lives in
>   the companion [`docs/nestudio-scene-calibration.md`](nestudio-scene-calibration.md).
>   This V1.0 document **integrates the contracts authoritatively** and references that
>   doc for exhaustive procedure. Where the two ever disagree, **this document wins on
>   *language*; the calibration doc wins on *procedure*.**
>
> **Supersedes:** Visual DNA V0.1 (DRAFT). See the Change Summary (§30).
>
> **Grounding (verified against source):** object DNA V3.7.0 + `NESTUDIO_CAMERA_SPEC_V1`
> / `NESTUDIO_OBJECT_RULES_V1`; the 28 approved furniture assets (10 personalities ×
> sofa+table + 8 neutral chairs); the storybook village system (`components/scene/house/spec.ts`,
> `app/globals.css`); the room shell + five `ROOM_BACKGROUNDS` (`lib/room-visuals.ts`);
> the live template types and `nestudio-cozy-v1` calibration (`lib/types.ts`,
> `lib/templates/room-shells.ts`); ADR-021/022; the Scene Calibration System; and the
> Design Director critique of V0.1.

---

# PART I — IDENTITY

## 1. The Nestudio Moment (north star)

> **The question every visual decision must answer:**
> *"What should a creator feel the instant they open their Nestudio home for the first
> time?"*

**Emotional goal — *warm belonging, instantly.*** Not "here is an empty room to
configure," but **"this is mine, and it already feels like me, and I belong somewhere."**
A blend of homecoming, pride, calm, and quiet delight. The opposite of the cold "set up
your profile" moment every other product gives you. They should want to stay, look
around, and make it theirs — never feel they've been handed a chore.

**Visual goal — *already charming, already inhabited.*** The first room is **warm,
golden-lit, cozy, and complete-feeling before any decoration** — soft window daylight, a
warm wood floor, plaster walls in their accent, a few grounded pieces casting soft
contact shadows. Their identity is **already present**: their name on a small sign, their
one accent colour in the room. It looks *made for them*, not generated.

**Environmental goal — *a home inside a world.*** The room reads as a real place a
visitor steps *into*, and the world beyond is felt — soft light through the window, a
breadcrumb back to a street and a village. The creator feels **"I have a home, and my
home is part of a little world that has room for me."**

**The north-star test (apply to every shell, asset, sign, and tile):**
*Does this increase or decrease the warm-belonging of opening your home for the first
time?* If a decision makes the world colder, busier, more generic, or more "software,"
it is wrong — no matter how technically impressive.

## 2. Brand personality

In priority order. Earlier traits win conflicts.

1. **Cozy** — dominant. Warm, soft, safe, inhabited. Nothing cold, clinical, corporate, empty.
2. **Crafted** — premium and intentional, never cheap or default. Cozy is never an excuse for sloppy.
3. **Characterful** — full of personality and small human touches, never noisy.
4. **Calm** — quiet confidence; generous negative space; unhurried. The opposite of a feed.
5. **Welcoming** — friendly, rounded, approachable, a little whimsical. Invites you *in*.

**Anti-traits (never Nestudio):** corporate, sterile, techy/neon, gritty/edgy,
photorealistic, hyper-cute/kawaii, baroque/ornate, cluttered, flat corporate-illustration,
generic furniture-catalog, generic mobile-game, clipart/sticker.

## 3. Emotional goals (by moment)

| Moment | Target emotion |
|---|---|
| Village map | "What a charming little world — I want to wander in." |
| Village street | "Every house is someone's home; I'm curious who lives here." |
| Approaching a house | "This place has a personality before I even knock." |
| Stepping into a room | **"I entered *this person's* room."** |
| Noticing an object | "That looks like it does something / says something about them." |
| **Opening your own home (first time)** | **The Nestudio Moment (§1) — warm belonging.** |
| Decorating | "This is *mine*, and making it me is delightful and easy." |

**Primary target everywhere: *warm belonging.*** **Avoid:** overwhelm, coldness,
anonymity, "I'm using software," uncanny realism, sensory noise.

## 4. The one-sentence test

> **Something feels "Nestudio" when it is a *warm, rounded, matte, hand-made little
> world* — cozy enough to want to live in, crafted enough to feel premium, and so
> internally consistent that a sofa, a cottage, and a garden path read as if one studio
> made all three.**

---

# PART II — ONE UNIVERSE

## 5. The three layers are one universe

Nestudio is rendered at **three layers** that the Design Director critique correctly
flagged as a "two/three art styles" risk:

- **Objects** — premium collectible furniture (the heroes, examined up close).
- **Shells** — interior/exterior backgrounds (the stages furniture sits in).
- **Village** — the map/street world (seen at distance and small scale).

They are **one universe** because they share a single **constitution** — the invariant
DNA below — and differ only in **fidelity**, which is a function of how close the viewer
is, not a difference in style. This is the core resolution of the "two styles" concern.

### 5.1 The invariants — what is IDENTICAL across all three layers

These **must** hold at every layer regardless of medium or fidelity. They are the "one
universe" guarantees:

| Invariant | Objects | Shells | Village |
|---|---|---|---|
| **Shape language** | rounded, soft-cornered, thick readable silhouettes | rounded architecture, soft eased edges | rounded plump cottages, soft forms |
| **Colour** | warm earthy base + **one** confident accent | warm base + the room's one accent | warm base + each house's one accent |
| **Lighting law** | warm key **upper-left**, **cool-plum** shadow | same UL warm light, cool shadow | **warm-light `#fff6e0` / cool-shadow `#46365a`** (already the village's signature) |
| **Surface reading** | premium **matte**, never gloss | matte, never gloss | reads matte (flat but never glossy/shiny) |
| **Proportions** | friendly, slightly exaggerated, grounded | friendly, settled, grounded | friendly, settled cottages |
| **Palette family** | oak / plaster / parchment + accents | same | same parchment/meadow/roof palette |
| **Camera** *(V2, ADR-028)* | authored to the front-facing Nest camera (§11) | **front-facing cinematic** (§11) | flat stylized world (established village system, §18) |

> **The litmus:** strip colour and material away and the silhouette says "Nestudio"
> (object DNA). Strip *fidelity* away and the **palette + warm-light/cool-shadow + rounded
> shape + one-accent** still say "Nestudio." That residue is the universe.

### 5.2 Shared shape language (example)
The same rounded, soft-eased geometry scales across layers: a **sofa's rounded arm**, a
**cottage's plump plastered wall and eased roof ridge**, and a **garden path's softly
meandering rounded edge** are the same hand. No sharp corners, no thin spindly parts, no
brutalist or machined edges — at any scale.

### 5.3 Shared material language (example)
**Warm oiled oak is the universe's signature wood**, present at every layer: a *sofa leg*,
a *room's floor and window frame*, a *house's door and trim*, a *fence rail and signpost*.
Plaster (`#f0dfbc`) is the universe's wall. Powder-coated matte (never chrome) is its only
metal. See §6 for how "material" is *expressed* differently per layer.

### 5.4 Shared lighting language (example)
**Warm light from the upper-left, cool-plum shadow** is the single strongest unifier.
It's already the village's coded signature (`WARM_LIGHT #fff6e0` → `COOL_SHADOW #46365a`
in `house/spec.ts`) and the object key light. A furniture object's baked shading, a
shell's baked room light, and a village house's flat two-tone shading all lean the **same
direction with the same warm/cool split** — so a sofa lit in a room and a house lit on a
street feel lit by the same sun.

### 5.5 Shared visual language (example — the zoom)
The journey **map → street → house → room** is one continuous flight into the same world
because each step keeps the invariants and only *adds fidelity* as you get closer. You
never cross a style border; you cross a **distance**.

## 6. The Material Reconciliation framework — "One Universe, Three Fidelities"

**The conflict (from the critique):** the current village is **flat SVG-style art**;
objects and shells use **rendered premium-matte materials with soft form-shading**. V0.1
demanded rendered materials universally, which the flat SVG village cannot express — while
also (correctly) forbidding a village redraw. This is the formal resolution.

**Resolution: fidelity is budgeted by viewing distance. The *style logic* is invariant;
the *rendering technique* is not.**

| Layer | Viewing distance | Rendering technique | "Matte" achieved by | Detail budget |
|---|---|---|---|---|
| **Objects** | near / examined | **fully rendered** stylized 3D — soft form shading, subtle ambient occlusion, material texture | actual matte shading + AO | **high** (but still readable at 64/128px) |
| **Shells** | mid / backdrop | **rendered, reduced** — baked soft room light, gentle form shading, **low** AO, no fussy texture | soft baked shading, restrained | **low–medium** (calm backdrop; must not compete with furniture) |
| **Village (tiles + houses)** | far / small | **flat stylized illustration** (the existing SVG language) | **colour + the two-tone warm-light/cool-shadow split** — flatness reads matte because there is no specular/gloss highlight, ever | **low** (legible at map scale) |

**The governing rule:** *as the viewer gets closer, fidelity rises; the colour, light,
shape, and palette logic never change.* A flat SVG cottage and a rendered matte sofa are
the same universe because they obey the same palette + warm/cool light + rounded shape —
the cottage just doesn't *need* (and shouldn't pay for) render fidelity at map scale.

**What this means concretely:**
- **Applies to objects:** full §8 material spec (oak, wool, bouclé, matte ceramic, AO,
  soft form shading). Frozen, unchanged.
- **Applies to shells:** §8 materials *suggested* via soft baked light and gentle
  shading — warm plaster, warm wood floor, soft window light — but **calm and low-detail**
  so furniture is the star. Shells are rendered, not flat.
- **Applies to village tiles + houses:** the **existing flat SVG language stays**. No
  AO, no rendered texture, no gloss — *and none is required.* "Matte" is guaranteed by the
  absence of specular highlights plus the warm/cool two-tone. **The village is not
  redrawn.** If a future village sprint raises village fidelity, it must still obey the
  invariants — but that is explicitly **out of scope** and not required for the universe
  to cohere.

**Why this eliminates the contradiction:** the universe is defined by the **invariants
(§5.1)**, not by a single rendering technique. The three fidelities are *intended*, not a
defect — they're how every cohesive world handles near-vs-far. The critique's contradiction
("demand AO from flat SVG while forbidding its redraw") dissolves: we no longer demand AO
from the village; we demand the **invariants**, which the village already satisfies.

---

# PART III — THE SHARED DNA (the constitution)

## 7. Shape language
- **Rounded, confident forms.** Soft rounded corners, gently chamfered edges, elegant
  curves. No sharp/hard corners, no thin spindly parts. (Object DNA principle 1–3.)
- **Soft edge transitions / soft geometric base.** Surfaces meet with softened fillets;
  forms read as simplified, slightly idealised geometry.
- **Silhouette-first.** Recognisable with colour and material removed.
- At building/world scale: plump walls, generous eased roofs, soft meandering paths.

## 8. Materials
- **Premium matte above all** — soft matte finish, restrained sheen, subtle AO (objects).
  **No** gloss, chrome, glare, or plastic at any layer.
- **Signature wood: warm oiled oak** (walnut as the dark variant), consistent across every
  category and layer.
- **Textiles:** wool, bouclé, felt, soft leather, corduroy, linen — gentle even drape,
  plump-but-tailored, readable at small size.
- **Plaster / stone:** warm matte, hand-finished.
- **Metal:** sparingly, **powder-coated matte only** — never chrome/reflective.
- **Greenery:** soft matte rounded leaf masses, no photoreal leaves.
- **Material feel test:** every surface should look warm and soft to the touch, never cold
  or slick.
- See §6 for how each layer *expresses* these materials at its fidelity.

## 9. Colours
**Warm neutral base ("the world's paper"):** parchment `--parchment-light #faf1dc` /
`--parchment #f2e4c4` / `--parchment-deep #e3cfa3`; oatmeal/oak/cream/sand; plaster
`#f0dfbc`; stone `#c7b393`. Warm ink for line/shadow/text: `--ink #38291d`,
`--ink-soft #6b5847`.

**One confident accent per thing** (object, house, character) — a deliberate highlight,
never the whole form. The locked personality-accent set (from object DNA, mapped to the
10 personalities — authoritative source is the object DNA / `NESTUDIO_SIGNATURE`):

> sage · caramel · dusty lilac · mustard · rust · teal · cobalt · emerald ·
> electric violet · clay terracotta

**Environment palette (village/landscape):** meadow `#b5c77d`/`#93ac5f`/`#6e8a47`,
canopy `#4e6b3a`; water `#8fc4d6`/`#5d93ac`; roofs terracotta `#a65b3f`, slate `#5b6b73`,
thatch `#c9a35c`, green shingle `#6b7f4f`; timber `#8a5c3b`/`#5c3e26`.

**Light & glow:** warm light `#fff6e0` / `--dusk #f6d8a8`; **cool-plum shadow `#46365a`**
(the signature shadow — never neutral grey); glow `--lantern #ffc55c`, `--ember #e08f3f`.

**Rules:** warm light / cool shadow everywhere; muted never neon; cohesion over variety
(mixed personalities still read as one family); **one accent per thing**.

## 10. Lighting
- **One light signature for the whole universe:** soft warm **key from upper-left**,
  gentle ambient fill, soft contact shadow.
- **Warm light, cool shadow** — the single most important "Nestudio" cue after silhouette
  and matte.
- **Soft and even, never dramatic** — no hard cast shadows, no rim/neon, no sunset/golden-
  hour, no chiaroscuro.
- **Objects** are lit on transparent with **no baked floor shadow** (frozen). **Shells**
  bake their own soft inhabited room light, matched to the same UL warmth. **Village**
  expresses light as the flat warm/cool two-tone.
- **Glow as warmth signal** (lamp/window/lantern) — sparingly; says "inhabited," never a
  light show.

## 11. Perspective & camera *(V2 Front-Facing Camera Contract — authoritative)*

> **🔒 V2 CAMERA LOCK (ADR-028, 2026-06-26).** This section is **superseded** by the
> **front-facing cinematic Nest camera**. The earlier ~30° parallel-isometric "dollhouse"
> Perspective Contract (calibrated to the 28 approved iso assets) is **V1 reference/history
> only** — it is preserved verbatim under §11.1 below but is **no longer the production
> standard**. For all V2 work, the contract is the front-facing camera defined here.

**The V2 universe camera (the single most important compatibility rule):** one locked
**front-facing cinematic Nest camera**, frozen for the whole product. Every Nest Template and
every V2 Asset Library asset is authored *to* it, so any asset looks correct in any Nest.
Changing it later invalidates the V2 library — treat as immutable without a superseding ADR.

- **Front-facing, eye-level to slightly-elevated, gentle downward tilt (~5–10°)** — you feel
  *inside* the room facing the main wall. **Not** isometric, **not** ~30° parallel projection,
  **not** top-down, **not** a dramatic vanishing point, **no** dollhouse cutaway.
- **Shallow "stage box" depth (locked depth planes — the only places assets live):**
  1. **Front wall plane** (fronto-parallel) — wall-mounted assets (TV, frames, shelves, pinboard).
  2. **Left/right wall slivers** (gentle inward rake, ~18–22°) — accent/decor only, never primary.
  3. **Floor plane** (slight up-tilt to meet the front wall) — floor furniture (sofa, desk, rug,
     plant, avatar).
  4. **Foreground layer** — small near objects for depth.
- **Parallel/near-orthographic on each plane** (no strong perspective convergence) so an asset
  authored once fits every Nest at its slot. A **Scene Slot** encodes the exact plane + footprint.
- **No perspective-warping of flat images** (rejected, ADR-027) — assets are authored to the
  camera, not warped into it.
- **Mobile-first aspect:** portrait primary (the Nest fills a phone); a landscape variant of the
  *same* camera may exist for desktop/share, authored to the same angles.

> **Resolves the architecture↔DNA contradiction (ADR-028):** V1.0 pinned a ~30° parallel iso
> camera (to match the iso furniture), which conflicted with ADR-027's front-facing Nest. V2 picks
> **front-facing** as the official direction; the iso assets become V1 reference, and the V2 Asset
> Library is authored/re-authored to this front-facing camera. Exterior shells and village tiles
> are **out of V2 Nest scope** — the village art is the established system (§18) and is not
> re-cameraed by this decision.

### 11.1 Historical — V1 ~30° parallel-iso Perspective Contract *(superseded by ADR-028; reference only)*

> Kept as historical reference for the V1 isometric exploration. **Not the V2 production standard.**

Derived directly from the (V1) `NESTUDIO_CAMERA_SPEC_V1`. Full diagrams + tolerances:
[calibration §4](nestudio-scene-calibration.md).

- **The V1 anchor (from the 28 approved assets):** 3/4 isometric, **~30° downward**,
  **parallel / orthographic** projection (no vanishing point), subject centered, fills frame,
  uncropped, no floor/pedestal/shadow, one scale for all.
- **All layers shared the ~30° parallel iso camera** (tolerance 28–32°; visible vanishing-point
  convergence a hard failure).
- **Room shells = iso dollhouse stage:** back wall fronto-parallel; floor receding upward at ~30°,
  parallel; horizontal floor seam in band y ≈ 0.58–0.64 (0.611 for `nestudio-cozy-v1`).
- **Exterior shells / village tiles:** same ~30° parallel iso.

*(These V1 rules informed the iso prototypes and the `nestudio-cozy-v1` calibration; under ADR-028
they no longer govern V2 Nest authoring.)*

## 12. Shadow & grounding *(integrated Shadow Contract — authoritative)*

Objects are **frozen transparent with no baked shadow.** Therefore **grounding shadow is
composited by the engine at render time — never baked into the asset, never baked into the
shell.** This keeps objects reusable across every shell + light, and shells reusable across
every furniture set. (ADR-021's stage already does this; here it's law.) Full spec:
[calibration §5](nestudio-scene-calibration.md).

**Three shadow layers, three owners:**
- **Ambient room light/shade** — *the shell bakes it* (intrinsic, never changes).
- **Contact shadow** — *the engine composites it:* soft horizontal ellipse at the object's
  `baseY`, width ≈ 0.8–1.0× object width, height ≈ 0.18–0.25× width, colour **cool-plum
  `#46365a` at ~0.18–0.28 alpha** (never black), soft blur, offset slightly **down-right**
  (light is UL). Wall objects instead get a small soft drop shadow **on the wall plane**.
- **Object self-shadow** — *baked in the asset* (frozen), must agree with the shell's UL light.

**Grounding:** an object's `baseY` is its contact line; the contact shadow draws first,
then the object on top → reads "resting on the floor." z-order = floor depth (further back
= lower z). Shells must keep the floor near the placement band **low-busy with enough value
range** for the soft plum shadow to read.

## 13. Scale rules
- **One implied scale per layer family;** in-room sizing via `defaultScale`, not re-render.
- **Believable relative scale** (sofa : chair, door : house, house : tree); friendly
  exaggeration applied **uniformly**, never one piece puffy and its neighbour realistic.
- **Cross-scale agreement** — same rounding/matte/light/palette at object, room, house,
  and village scale is what makes the zoom feel like one world.
- **Furniture sits, not floats** — floor objects grounded at `baseY`; the shell floor and
  the object iso must agree (§11–§12).

---

# PART IV — DOMAIN LANGUAGES

## 14. Architecture language
- **Storybook-cottage massing** — small, friendly, single-family scale; homes not blocks.
- **Rounded, settled forms** — soft corners, plump walls, eased edges at building scale.
- **Hand-made, not engineered** — plastered/hewn/thatched/painted surfaces; tiny warm
  irregularities. No curtain-wall glass, exposed steel, parametric facades.
- **Honest roof grammar** (existing kit): `gable · hip · round (hobbit) · dutch`; generous
  overhangs, soft ridges.
- **Small legible parts kit** — door (round/arched/plank), window (arched/round/square),
  optional shutters, chimney, dormer, half-timber. Variety from **deterministic
  recombination of a small kit** (per `deriveHouseSpec`), never unbounded one-off detail.
- **Inside↔outside continuity** — a house's exterior plaster/oak/light continues into its
  interior shell.

## 15. Exterior design language
- **Subject:** one cozy storybook cottage, ~30° parallel-iso front-dominant three-quarter,
  centered, fully in frame, minimal baked ground (the tile provides ground).
- **Silhouette-first** — recognisable from roof + chimney + door alone.
- **Materials:** warm plaster/whitewash walls (`#f0dfbc`), timber trim/half-timber
  (`#8a5c3b`/`#5c3e26`), roofs in the locked palette (terracotta/slate/thatch/green
  shingle). Matte throughout.
- **One accent per house** (door/shutters/trim) from the accent set — the house's "outfit."
- **Warmth cues, sparingly** — a glowing window (`--lantern`), chimney smoke, a doormat, a
  hanging sign. A few, never many.
- **Affordances are art** — the **door** (way in) and the **sign/nameplate** (address /
  owner, §22) are first-class designed elements in predictable zones.
- **DON'T:** suburban tract house, glass box, apartment block, storefront branding,
  ruins/spooky, ornate mansion, photoreal.

## 16. Interior design language
- **Front-facing cinematic Nest scene** (§11, ADR-028) — full front wall + slivers of the
  left/right walls + a floor, viewed front-on with shallow depth so furniture reads naturally.
  *(The earlier "three-wall iso dollhouse cutaway" is V1 reference/history — superseded by the
  front-facing camera.)*
- **The shell is a calm warm backdrop, never the star** — low detail, soft value range,
  generous empty wall + floor so furniture breathes. If the empty shell looks busy, it's
  wrong.
- **Warm inhabited light** — soft window daylight + gentle warm interior glow, UL-consistent.
- **Materials:** warm plaster/painted walls, warm wood or soft-rug floor, a window with
  soft light, optional beams — same oak as the furniture.
- **Background-variant family (carry forward)** — the five locked moods are recolours of
  *one* calm shell, not five different scenes:

  | Variant | Wall | Mood |
  |---|---|---|
  | Warm studio (default) | `#e6cfa9` | warm, neutral, cozy |
  | Gallery wall | `#ece4d6` + cool tint | clean, light, art-forward |
  | Shop floor | `#ecd0b0` + caramel tint | warm, retail-friendly |
  | Office | `#e3ddca` + olive tint | focused, calm |
  | Garden room | `#d8e4c6` + green tint | fresh, planty |

- **Placement contract is sacred** — every shell leaves clean, well-lit zones for the
  nine-zone model and emits calibratable geometry (§25). Composition serves placement.
- **DON'T:** a pre-furnished render (furniture is the live layer — the shell paints **no**
  furniture), photoreal interior photography, clutter, a flat single-wall backdrop, harsh
  top-down or one-point tunnel.

## 17. Furniture language *(the proven layer — frozen)*
The frozen object DNA V3.7.0 is the furniture law: rounded confident forms, soft edges,
thick readable closed silhouettes, warm oiled-oak detailing, premium matte materials,
friendly slightly-exaggerated proportions, warm base + one accent, silhouette-readable,
crisp at 64/128px; **one object, isolated, transparent, one camera.**

**Personality system (the engine of variety):** ten lifestyle personalities — **Creator,
Musician, Gamer, Artist, Explorer, Reader, Minimalist, Collector, Dreamer, Adventurer** —
each with its own accent/character/silhouette, expressed *the same way across every
category* ("same world, different personality"). Personality lives in the **subject's
shape/material/accent — never in props or scenes.** Neutral pieces (lamp, plant, rug,
storage, the generic chairs) stay personality-light and reusable; **hero seating carries
the room's personality.**

**Current reality / gap:** approved set is **furniture-only** (sofas, tables, chairs).
Broadening to wall art, plants, rugs, lighting, storage, decor, and connectors (door,
stairs) is a post-DNA pack; all must obey everything above.

## 18. Village language *(established system — do not redesign)*
- **A little hand-made world** — a charming storybook map, not a utilitarian tilemap or
  city grid.
- **Houses are the heroes** — each plot a recognisable cottage with its own roof/door/accent.
  Low friendly density, breathing room, a soft frontier of empty plots inviting new
  residents.
- **Soft organic layout** — the existing **hex honeycomb world** (`/`, `/bazaar`) and the
  **horizontal street** of 24 detached houses (`/bazaar/[slug]`). *(V1.0 describes the
  village as it is — a hex map + a side-scrolling street — not as a single bird's-eye;
  this corrects a V0.1 overstatement.)*
- **Shared world palette** (§9): meadow greens, warm earth paths, water blues, plaster +
  roof colours.
- **Variety via the deterministic kit** — recombine the small house/landscape kit from
  stable seeds (never randomness); SSR/hydration-safe.
- **One continuous zoom** — map → street → house → room, each scale matte/rounded/warm-lit.
- **DON'T:** a feed, a dashboard, a flat icon grid, a satellite map, a neon game-world, an
  isometric city-builder grid.

> **Guardrail:** the village/street/house-exterior art is an established system. Per the
> standing decision (architecture §3, roadmap principle 9, ADR-022), **do not redesign it
> without an explicit, separately-scoped visual sprint.** This document describes and
> extends it; it does not authorise a redraw. The §6 framework lets the flat village
> coexist with rendered shells/objects **without** redrawing it.

## 19. Roads & landscaping language
- **Soft hand-made paths** — warm earth/cobble/plank with rounded meandering edges; garden
  paths between homes, never asphalt/markings/signage clutter.
- **Cozy rounded planting** — simplified matte foliage (rounded canopies, soft shrubs,
  flower clusters, hedges) in the meadow-green family; trees as friendly canopy blobs on a
  warm trunk.
- **Gentle natural features** — soft hills, a winding stream/pond (water blues), warm stone
  walls, low oak fences — all rounded, matte, storybook.
- **"Tended and loved"** — a few well-placed plants, a path lantern, a bench; restraint over
  density.
- Same light + scale rules; **DON'T:** highways, parking, traffic furniture, realistic
  terrain, dense jungle clutter, hard geometric/grey hardscape.

## 20. Character language *(reserved — not yet generated)*
Reserved so inhabitants read as one universe (object DNA principle 9):
- **Same DNA applied to people:** rounded geometry, soft edges, friendly slightly-exaggerated
  proportions, premium **matte** materials (matte skin/hair/fabric, no gloss), warm base +
  **one accent**, same warm UL key light, same ~30° iso camera for catalog/portrait renders.
- **Friendly stylised humans** — approachable, warm, characterful; **not** realistic, **not**
  photoreal, **not** hyper-cute/chibi, **not** mascot-brand, **not** AC-style animal-villagers
  (see §24).
- **One accent per character** (their "outfit colour"); may align to the 10-personality system
  so a creator's avatar rhymes with their hero sofa.
- In-room posing/animation is a later concern, out of V1.0 scope.

---

# PART V — TYPOGRAPHY & SIGNAGE

## 21. Typography DNA

Nestudio uses two type families with sharply separated jobs. The guiding principle:
**in-world text feels diegetic (part of the world); functional chrome feels clean and
quiet.**

**Fraunces — "the heart / the voice."** A warm, characterful display serif. Used wherever
Nestudio is *speaking as itself* and for anything that should feel hand-made and personal.
- House names, creator names, room labels, all **signage and nameplates** (§22), page/section
  headings, the welcome message, empty-state warmth copy.
- Treatment: warm ink (`--ink #38291d`), generous, never tight; optical-size large for
  display. When it appears **on a material** (a sign, a plaque) it is rendered as
  **carved/painted/engraved into that material**, lit and shadowed with the scene (diegetic).

**Nunito Sans — "the helper."** A soft humanist sans, friendly but neutral. Used for
everything *functional* that must stay quiet and legible.
- UI chrome, body text, metadata, counts, form fields, buttons, insights/dashboard, tooltips,
  timestamps, navigation.
- Treatment: clean overlay; `--ink` / `--ink-soft`; never decorative.

**Diegetic vs chrome (the key distinction):**
- **Diegetic type** lives *in the world* — on signs, plaques, nameplates, addresses. It is
  Fraunces, sits on a material, and is lit by the scene. It should feel like it was *made*
  by the resident.
- **Chrome type** lives *over the world* — UI panels, drawers, controls. It is Nunito,
  clean, flat, and never pretends to be part of the scene.

**Address presentation (`moon.blue.hour`):** the three-word address is the resident's
identity. Presented in **Fraunces**, dot-separated, like a **hand-painted house number /
plaque** — warm ink on a wood or ceramic plate near the door (diegetic) and echoed in
Nunito in chrome where it's a functional link/label.

**Creator name presentation:** **Fraunces**, warm and personal — on the house sign, the
in-room plaque, and the profile. The name should feel *signed*, like an artist's signature,
not a username.

**Village signage:** carved/painted **wood signs in Fraunces** (street names, district
names, plot signs) — diegetic, in the village palette, lit by the village two-tone.

**Type DON'T:** Fraunces for dense body or UI controls; Nunito for signage/house names;
neon/techy/condensed/all-caps-shouty faces; drop-shadowed "game UI" lettering; text that
floats with no diegetic or chrome home.

## 22. Nameplate & signage DNA

All in-world labels are **small crafted objects**, not floating UI. They obey the universe
DNA (rounded, matte, warm, one accent, warm/cool light) and Fraunces (§21).

| Element | Material | Shape | Scale | Placement | Hierarchy |
|---|---|---|---|---|---|
| **House sign** | oak or matte ceramic plaque (optionally hanging) | rounded rectangle / gentle oval, hanging signs swing-shaped | readable at **street** distance | beside or above the **door** | **1 (highest)** — the house's name to the world |
| **Plot sign** (village) | small painted **wood post sign** | rounded plank on a post | readable at **map/street** small scale | at the plot edge by the path | 2 |
| **Creator plaque** | matte ceramic / oak, subtle accent edge | rounded rectangle | readable at **room** distance | by the door inside, or on the profile | 2 |
| **Room label** | **engraved nameplate** (existing engine V5 treatment) | small engraved bar at the object/zone base | small, room distance | at the room/zone base, not floating | 3 |
| **Object label** | **engraved nameplate at the object's base** (per room spec §7) | small engraved bar | small | at the object base | 4 (lowest) |

**Universal signage rules:**
- **Materials:** oak, matte ceramic, painted plaster, powder-coated matte metal — **never
  chrome, never glass, never glossy.**
- **Shape:** rounded rectangles, gentle ovals, hanging plaques; eased corners always.
- **Colour:** warm ink lettering on a warm material; the resident's **one accent** may edge
  or back the plate — never a second accent.
- **Lettering:** **Fraunces, carved/painted/engraved into the material**, lit + shadowed by
  the scene (warm/cool) so it reads as made, not printed.
- **Scale & legibility:** sized for its viewing distance (house sign = street; object label
  = room); must satisfy §23 accessibility.
- **Placement:** anchored to a real surface (door, post, base) — **never free-floating**;
  diegetic labels never overlap the live interactive layer ambiguously.
- **Hierarchy:** house name > plot sign / creator plaque > room label > object label. Only
  one element at the top of the hierarchy per house.

## 23. Accessibility rules

The world stays **warm and cozy *and* usable**. Cozy is not an excuse for low legibility.
The room engine already provides keyboard focus + screen-reader labels (room spec §7.5);
these are the **visual** standards on top of that.

- **Contrast — chrome text (Nunito UI):** meet **WCAG AA** — **≥ 4.5:1** body, **≥ 3:1**
  large text & meaningful UI/affordance edges. The warm-ink-on-warm-paper palette
  (`#38291d` on `#f2e4c4`) clears this comfortably, so warmth and contrast are not in
  tension.
- **Contrast — diegetic text (Fraunces signage):** atmospheric, but any sign conveying
  **essential information** (house name, address, room label) must either hit **≥ 3:1**
  against its plate **or** be backed by an accessible chrome label / alt text. Decorative
  carved text below 3:1 is allowed only when the same info exists accessibly elsewhere.
- **Small-size readability (carry the object rule to scenes):** every label and key form
  must read at **64px and 128px**; if detail dies, **simplify the form, don't add detail**.
  Signage must remain legible at its intended map/street/room distance.
- **Never colour-alone.** Interactivity, state, and meaning must not rely on the accent
  colour alone (colour-blind safety) — pair with shape, an affordance cue, label, or icon.
  The "one accent" is identity, never the sole signal.
- **Mobile-first constraints:** tap targets **≥ 44×44px**; type scales for small portrait
  viewports; interactive objects keep enough spacing not to crowd (the room engine's known
  small-viewport crowding is a placement concern — calibration keeps zones spaced).
- **Motion (reserved):** any future ambient motion (lantern flicker, door open) must respect
  reduced-motion and never be required to understand state.

## 24. Originality defense

The object DNA's anti-copy principle ("we copy **no** existing game — original Nestudio
language") **extends to every layer.** Nestudio must be recognisably itself, never a
visual imitation of existing cozy-life games (Animal Crossing, Stardew Valley, Cozy Grove,
The Sims, etc.).

**The identity carriers — what makes it unmistakably Nestudio (lean on these):**
1. **Warm-light `#fff6e0` / cool-plum-shadow `#46365a` two-tone** — our specific signature,
   not a generic cozy palette.
2. **The Nestudio palette** — parchment + meadow + terracotta/slate/thatch roofs + the
   ten specific accents.
3. **One accent per thing** — a disciplined rule few games hold to.
4. **Front-facing cinematic Nest camera** *(V2, ADR-028)* — a warm, eye-level "step inside this
   person's room" view, distinct from the iso/top-down cameras most cozy games use for interiors.
5. **Rounded premium-matte** — neither pixel-art (Stardew) nor glossy-cartoon nor realistic
   (Sims).
6. **Hex honeycomb village + three-word address + room-as-product** — a structural identity
   no cozy game shares.

**Per-layer guidance for staying Nestudio while avoiding imitation:**
- **Interiors:** the dollhouse cutaway is universal; differentiate via **our** palette,
  parallel-iso, soft matte, and calm negative space. **Avoid** another game's signature
  wallpaper/floor motifs, prop sets, or colour grading.
- **Exteriors:** storybook cottages are folk-universal; differentiate via the **roof
  palette + warm/cool light + rounded premium-matte**. **Avoid** copying a specific game's
  roof-shape/colour combinations, fencing, or villager-house silhouettes.
- **Village:** the **hex world** is already distinctive — not an island, not a farm grid, not
  an iso city. Keep it. **Avoid** iso city-builder clichés and recognisable game-map motifs.
- **Characters:** friendly stylised humans. **Avoid** AC-style animal-villagers, Sims
  realism, and chibi/kawaii. Same DNA, our proportions.

**The originality test:** show a render cold. If the honest reaction is *"this looks like
[Game X],"* it fails. If it's *"this looks like Nestudio,"* it passes. The carriers above
are what should produce the second reaction.

---

# PART VI — PRODUCTION SYSTEM (integrated calibration)

> Authoritative summary. Full procedure, diagrams, rubric anchors, and the exact generation
> prompt: [`docs/nestudio-scene-calibration.md`](nestudio-scene-calibration.md).

## 25. Placement zone calibration
Every generated shell must emit the room-engine geometry, all normalized 0..1:
`floorBounds`, `wallBounds`, `safeArea` (`NormalizedRect`), and `placementZones`
(`ShellPlacementZone {id, label, cx, baseY, width, z}`). SOP: find floor seam (band
0.58–0.64, aim **0.611**) → find wall rect → set safe area (≈ `{0.06,0.08,0.88,0.86}`) →
lay 4–6 slots (cx/baseY/width/z, back→front) → apply depth rule (further back = smaller
width, lower z) → **Composition QA** with the Golden Furniture probe → emit a typed
registry entry. The layout **never invents coordinates at runtime** (matches
`nestudio-cozy-v1`). A calibration overlay tool is the scale fix (§29), spec-only now.

## 26. Scene Style Lock
Six dimensions, each **0–10** → raw 0–60 → normalized **0–100**: **DNA Fidelity ·
Perspective Conformance · Lighting Consistency · Composition & Negative Space · Furniture
Compatibility · Production Readiness.** **Pass ≥ 85.** **Hard-gates (cannot be averaged
away): Perspective Conformance ≥ 8/10 and Furniture Compatibility ≥ 8/10.** Auto-reject on
any scene-negative violation (§28), uncalibratable geometry, or wrong aspect/resolution.
**Two-reviewer** workflow with band agreement (Reject <70 / Revise 70–84 / Approve ≥85);
third reviewer adjudicates disagreement. A **family locks** only when its Golden Scene Set
(§27) is complete and every member is approved with family-average ≥ 85.

## 27. Golden Scene Set
The lock benchmark per family (scene equivalent of the object Golden 10):
- **Interior (required for Interior Shell V1 lock):** **5–6** shells, one per locked mood
  (warm studio, gallery, shop, office, garden) + a neutral baseline; warm-studio is the
  hardest-graded **anchor** and canonical reference.
- **Exterior (required for Exterior Shell V1 lock):** **4–5**, one per roof type (gable,
  hip, round, dutch) + one with a shop sign; must pass a **"one street" cohesion** check.
- **Village tile (deferred):** **4** (plot, path, junction, landscape) + a **seam/tessellation**
  test — defined now, locks in a later village sprint; **not** required for Interior/Exterior V1.
- **Golden Furniture probe** (composition test): 1 hero sofa + 1 table + 1 accent chair + 1
  neutral chair, drawn only from the 28 approved assets.

## 28. Scene negative prompt
Scenes **invert** the object negatives (objects forbid floors/rooms; a shell *requires*
them) while keeping identity guards. A **shared scene base** forbids: photorealism, generic
mobile-game/royal-match/clash/gacha art, anime, painterly, flat vector, clipart/sticker,
excessive detail/clutter, ornate/baroque, **text/watermark/logo/UI**, neon/lens-flare/
dramatic/sunset/night light, **fisheye/vanishing-point/one-point/two-point/tilted/dutch
perspective**, people/animals (except character renders), inconsistent style/mismatched
lighting, white/gray studio. **Per-family deltas:** interiors also forbid **baked
furniture/props/people, top-down, floor plan, tunnel/box room** (the shell is an EMPTY
stage); exteriors forbid interiors/multiple houses/city/storefront/mansion; tiles forbid
baked houses/buildings/non-tiling seams. Enforced by a scene freeze test (spec-only).

## 29. Technical specification
| | Interior shell | Exterior shell | Village tile |
|---|---|---|---|
| Aspect | **3:4 portrait** | **1:1** | **1:1** |
| Master res | **1080×1440** (master 1440×1920 ok) | **1024×1024** | **1024×1024** |
| Delivered | 1080×1440 **WebP** | 1024² WebP (+512² LOD) | 512² WebP (+256² LOD) |
| Transparency | none (background) | house edge may be transparent | edges may be transparent |
| File budget | **≤ 350 KB** | **≤ 250 KB** | **≤ 120 KB** |

Objects stay frozen transparent PNG 1024² (recommend a WebP **delivery** variant ≤ 400 KB
— encoding only, not a language change). Versioning: image/calibration change → bump
`template.version`; language change → bump **`NESTUDIO_SCENE_DNA_VERSION`** (§32). Never edit
a locked template in place without a version bump.

---

# PART VII — SCALE, DO/DON'T, GOVERNANCE

## 30. Scale risk (summary)
The small curated kit is a **strength at 1k, a risk at 100k+**. Arc of mitigation (full
table: calibration §9): **1k** — ship golden sets, broaden assets (furniture-only is the
near-term gap). **10k** — ~15–25 shells + cheap **accent recoloring** of shells. **100k** —
build the **calibration overlay tool**, **combinatorial theming** (shell × accent × pack),
expand the 10-personality taxonomy. **1M** — **procedural recombination of curated parts
within the locked DNA** (never free runtime generation, per ADR-006), automated calibration,
WebP/AVIF + CDN + LOD. (10M deliberately out of scope.)

## 31. Do / Don't (quick reference)

| Dimension | ✅ DO | ❌ DON'T |
|---|---|---|
| Feel | cozy, crafted, warm, hand-made little world | corporate, sterile, techy, gritty, photoreal |
| Geometry | rounded, soft corners, plump forms | sharp corners, spindly parts, brutalist |
| Silhouette | thick, closed, readable from outline | fussy, gappy, breaks at small size |
| Materials | premium matte (objects/shells), flat-matte (village) | gloss, chrome, plastic, glass, specular |
| Wood | warm oiled oak everywhere | cool/grey wood, lacquered shine |
| Colour | warm earthy base + ONE accent | neon, cool greys, pure black/white, many accents |
| Light | soft warm UL key, cool-plum shadow | dramatic/sunset, hard shadows, neon, grey shadow |
| Perspective *(V2, ADR-028)* | front-facing cinematic Nest (front wall + side slivers + floor, shallow depth) | isometric, ~30° parallel, top-down, one-point tunnel, dutch, warped wall projection |
| Shadow | engine-composited plum contact ellipse | baked-in object shadows, black shadows |
| Scale | consistent, believable, uniform exaggeration | mismatched scales, one puffy + one realistic |
| Furniture | one object, isolated, personality in form | object + props, personality via added scene items |
| Room shell | calm empty warm stage, clean zones | pre-furnished, busy, flat single wall, tunnel |
| Exterior | storybook cottage, one accent, warmth cues | glass box, tract house, mansion, storefront brand |
| Village | charming hex world, houses as heroes | feed, dashboard, icon grid, neon, city grid |
| Roads/land | soft garden paths, rounded matte planting | asphalt + markings, photoreal terrain, hardscape |
| Characters | friendly stylised, matte, one accent, our proportions | realistic, photoreal, chibi, AC animal-villager |
| Type | Fraunces in-world (diegetic), Nunito chrome | Fraunces UI, Nunito signage, neon/game-UI lettering |
| Signage | crafted oak/ceramic plaques, carved Fraunces | floating UI labels, chrome/glass, glossy |
| Composition | generous negative space, calm | maximalist clutter, busy, noisy |
| Variety | recombine a small kit from stable seeds | random one-off detail, inconsistent dialects |

## 32. Change control & versioning
This document, once **locked**, is frozen like the object DNA: change requires a version
bump + a freeze-test update + a rationale in [decision-log.md](decision-log.md). Two coupled
axes: **`NESTUDIO_SCENE_DNA_VERSION`** (semver — the *language*) and per-template `version`
(int — an individual shell). A locked scene DNA must declare the **object DNA version it was
calibrated against** (currently **3.7.0**) because §11–§12 depend on it. Scene and object DNA
version independently but are explicitly coupled at lock time. This document never silently
overrides the frozen object DNA.

---

# §30. Change summary from V0.1

| Area | V0.1 | V1.0 |
|---|---|---|
| **The Nestudio Moment (§1)** | absent | **added** as the north-star test |
| **Object↔shell↔village** | named the tension, *asserted* a bridge | **resolved** via the "One Universe, Three Fidelities" invariants framework (§5) with worked examples |
| **Material contradiction** | demanded rendered AO universally (broke flat village) | **resolved** (§6): fidelity budgeted by viewing distance; objects rendered, shells reduced-render, village flat-matte — invariants hold, village **not** redrawn |
| **Perspective** | "eye-level-ish" interior (conflicted with iso furniture) | **fixed** (§11): parallel **~30° iso** across all layers, floor seam 0.611, pinned to the frozen camera |
| **Shadow & grounding** | absent | **added** (§12): engine-composited cool-plum contact shadow; objects/shells never bake object shadows |
| **Calibration / Lock / Golden set / Negatives / Tech spec** | absent | **integrated** (§25–§29) from the Scene Calibration System |
| **Typography (§21)** | absent | **added**: Fraunces (diegetic/voice) vs Nunito (chrome), address/name presentation |
| **Nameplate & signage (§22)** | absent | **added**: materials/shapes/scale/placement/hierarchy for all label types |
| **Accessibility (§23)** | absent | **added**: WCAG AA chrome, 3:1 diegetic-or-labeled, 64/128px, never-colour-alone, 44px targets |
| **Originality defense (§24)** | scenes undefended | **added**: identity carriers + per-layer anti-imitation + the originality test |
| **Village description (§18)** | overstated as "bird's-eye" | **corrected** to the actual hex map + side-scroll street |
| **Status** | DRAFT, not lockable | **LOCK CANDIDATE** |

# Final V1.0 Review

### Scores

| Dimension | V0.1 | **V1.0** | Why it moved |
|---|---:|---:|---|
| **Cohesion** | 6 | **9** | The three-layer "one universe" framework + material reconciliation + integrated perspective/shadow make it read as one system; the central risk is resolved, not asserted. |
| **Scalability** | 4 | **6** | Scale arc + fidelity-by-distance framework + recoloring/combinatorics path are defined; but the small-kit-at-scale fixes (tooling, procedural recombination) are **designed, not built** — a real ceiling remains. |
| **Originality** | 6 | **8** | Identity carriers + per-layer anti-imitation + an explicit originality test now defend every layer, not just objects. |
| **Production Readiness** | 3 | **8** | Perspective pinned to the frozen camera, shadow/grounding/calibration/lock/negatives/tech-spec integrated, and an exact Interior Shell V1 prompt exists — generation can begin and be judged objectively. Not 10 only because no reference renders exist yet (they can only come *from* generation). |

### Remaining risks (genuinely unresolved)

1. **No reference renders yet (the real residual).** The DNA is locked on *description*;
   the first generations may reveal the language needs a small tweak. *Mitigation:* lock
   permits a patch bump after the warm-studio anchor is rendered and reviewed.
2. **Generation may not reliably hit parallel ~30° iso.** Empirical — only candidates will
   confirm the prompt produces the contract. *Mitigation:* the hard-gate rejects drift; the
   anchor shell is the first thing tested.
3. **Furniture-only assets.** Rooms stay sparse until categories broaden — a **product**
   risk, not a DNA defect. *Mitigation:* sequence the asset-broadening pack next.
4. **Scale fixes are designed, not built** (calibration tool, combinatorics). Fine for V1.0
   (gates generation, not 100k launch).
5. **Village-shell coexistence is a framework, not yet visually proven** side by side.
   *Mitigation:* validate when the first interior shell renders against the live street.
6. **Character DNA is reserved, unproven** (no characters exist). Out of V1.0 critical path.

None of these block *starting generation*; they are the normal residue a language lock
hands to the generation phase.

### Lock recommendation

## ✅ LOCK VISUAL DNA V1.0

**The project is ready to proceed to Interior Shell V1 generation.** Every blocker the
Design Director's critique raised against V0.1 is resolved: the object↔shell↔village
relationship is a coherent **one-universe, three-fidelities** system; the material
contradiction is formally resolved without redrawing the village; the perspective is pinned
to the frozen object camera; shadow/grounding, placement calibration, the Scene Style Lock,
the Golden Scene Set, the scene negatives, and the technical spec are integrated into one
authoritative document; and typography, signage, accessibility, and originality — all
previously missing — are defined.

What remains (reference renders, empirical perspective confirmation, asset breadth, scale
tooling) is, by nature, **downstream of generation** — a language cannot produce its own
reference images. Holding the lock for them would be circular. The correct move is to
**lock the language now** (allowing a patch bump after the anchor shell is reviewed) and
**begin Interior Shell V1 generation** using the exact warm-studio anchor prompt in
[calibration §10](nestudio-scene-calibration.md), treating outputs as calibration
candidates until the interior family clears the Lock.

**Documentation work stops here. Visual generation begins.**

---

*Documentation only. No images, assets, code, runtime changes, village redesign, or commits
were produced. The frozen object DNA V3.7.0 is untouched; this document is subordinate to it
and pinned to its camera.*
