# Nestudio Master Style V2 (V3.4)

The **single, locked** visual identity for AI-generated Nestudio assets. V3.4
**retires the multi-style experiments** (`royal_match` / `modern_designer` /
`clash`) and the V3.1 "Premium Game Style V1" spine in favour of ONE direction —
`nestudio_v2` — that we calibrate, score, and lock before any mass generation.

> **Quality references (do NOT mimic the art):** premium-casual mobile games for the
> bar on craft and clarity; Disney/Pixar for readability. We borrow the *standard*,
> never copyrighted designs. This is **not** a Royal Match clone, a Clash clone, an
> Apple product render, or photorealism.

This is the source of truth for the generation prompt system
([`../lib/prompts.ts`](../lib/prompts.ts)) and the locked specs
([`../lib/nestudio-spec.ts`](../lib/nestudio-spec.ts)). The cozy storybook direction
still governs the village/room art in the main app; this document governs **what we
generate into the catalog**.

---

## Target visual identity

A **premium collectible game asset** — a polished game-economy / inventory item:

- highly readable at **64px** and **128px**,
- **slightly stylized** with clean, Pixar-inspired readability,
- bold, clean silhouette; smooth confident forms; refined matte materials with
  restrained sheen; neutral premium palette.

**Not:** toy-like · puffy · realistic · storybook · painterly · plastic · cluttered.

---

## Nestudio Camera Spec V1 (locked)

One camera for the entire catalog so every object reads as a single set
([`NESTUDIO_CAMERA_SPEC_V1`](../lib/nestudio-spec.ts)):

- 3/4 isometric view, approximately **30° downward** angle
- object **centered**, **filling most of the frame**, **fully visible (no cropping)**
- **no pedestal, no floor/ground plane, no environment, no room scene, no shadow platform**
- **identical** camera, scale, and framing across every object

## Nestudio Object Rules V1 (locked)

Exactly **one** object — a chair is the chair, never chair + lamp + rug + side table
([`NESTUDIO_OBJECT_RULES_V1`](../lib/nestudio-spec.ts)):

- single subject only, isolated, transparent-PNG target
- **no** extra props, supporting furniture, decorative scene, or secondary objects

Both specs carry a **forbidden-token list**; a unit test proves the master prompt and
each fragment never re-open a banned door (the positive prompt stays purely positive —
all "no X" language lives in the negative prompt).

---

## Nestudio Visual DNA (V3.5 — the identity layer)

V3.4 locked the camera + object rules but left the **style language** generic
("neutral premium palette", "game inventory item"), so outputs read as generic
furniture icons that don't belong to one world. V3.5 adds the **Nestudio DNA**
([`NESTUDIO_DNA`](../lib/prompts.ts)) — the positive signature that makes every object
recognizably Nestudio. It is **style language only**: it does not touch the camera,
transparency, or object isolation.

- **Modern Scandinavian influence**, soft rounded geometry, gently chamfered edges,
  designer-furniture craftsmanship, friendly and approachable.
- **Tactile natural materials** (oiled oak, wool, bouclé, felt, soft leather, matte
  ceramic) in a **warm cozy palette of muted earthy tones with ONE confident accent**.
- **One locked lighting/rendering signature**: cohesive stylized 3D render, soft matte
  finish, gentle warm key light from the upper-left, soft ambient fill, smooth
  subtle gradients — the *same* on every object.
- **Signature Design Language (V3.7)** ([`NESTUDIO_SIGNATURE`](../lib/prompts.ts)): the
  manufacturer-consistency layer applied to *every* category — gentle rounded corners +
  softened edges, soft geometric forms, elegant curves, thick readable silhouettes,
  slightly exaggerated friendly-premium proportions, consistent warm-oak wood detailing,
  consistent edge treatment, consistent material transitions, and a consistent soft matte
  render finish. The goal: any two products read as one furniture manufacturer,
  recognizable even with colour and material stripped away.

**Personality varies per object via the subject, never by changing the DNA** — the
goal is *"same world, different personality."*

### Personality DNA + silhouette diversity (V3.6)

Discovered + strengthened on the sofa-only experiment
([`lib/sofa-dna.ts`](../lib/sofa-dna.ts)). Ten **lifestyle personality groups**
(Creator, Musician, Gamer, Artist, Explorer, Reader, Minimalist, Collector, Dreamer,
Adventurer) drive shape language, materials, accent colours, and details — never props,
scenes, or extra objects. Silhouettes are deliberately diverse (low-profile lounge,
wrapped cocoon, cloud, retro loft, chunky camp, floating modular, asymmetrical gallery,
S-curve conversation, reclined gamer pod, organic pebble) so the personality is
**readable from silhouette alone**. A **DNA stress test** pairs **5 safe + 5 bold**
personalities; the bold ones push uniqueness while staying recognizably Nestudio.

### Manufacturer collection (V3.7)

The personality line is now a shared **collection** across categories (sofa, chair,
coffee table — extensible). Each personality keeps the **same accent, character, and
tier across every category**, expressed as a category-appropriate form, so the line
reads as one manufacturer. The Style Lab "🧬 Manufacturer Collection" panel has a
category selector; generating a category drops its 10 variants into that category's
golden panel for a side-by-side comparison grid that also feeds calibration.

## Master prompt

```
Premium collectible game asset, a polished, characterful room object. Slightly
stylized with clean, Pixar-inspired readability, optimized to stay crisp and
recognizable at 64px and 128px. Exactly one isolated object and nothing else,
presented alone on a transparent background as a transparent PNG. Consistent 3/4
isometric camera at roughly a 30-degree downward angle, the object centered and
filling most of the frame, fully in view. Identical camera, scale, and framing for
every asset. Soft studio lighting with subtle ambient occlusion and a clean, bold
silhouette. Part of one cohesive, recognizable Nestudio world.
```

The **DNA** above is appended as the style-descriptor layer, followed by the style
tokens, so every prompt = master spine + subject + DNA + tokens.

## Negative prompt

```
room scene, furniture set, multiple objects, base, platform, pedestal, floor plane,
ground plane, rug, books, lamp, plant, side table, extra props, extra decorations,
cluttered, busy composition, text, watermark, logo, signature, photorealism,
realistic photography, painterly illustration, storybook rendering, flat vector,
toy-like, puffy, inflated, plastic toy, glossy plastic, random perspective,
front view, side view, top-down, cropped object, dramatic shadows, sunset lighting,
golden hour, white background, scene background, generic furniture catalog,
furniture showroom, icon pack, app icon, clipart, sticker, realistic furniture
photography, product photograph, luxury mansion furniture, ornate, baroque carving,
children's furniture, kids furniture
```

Per-category descriptors stay single-object (`"a single accent chair"`, …) so the
object-only rule holds across the catalog.

---

## Golden Calibration Set (permanent benchmark)

The fixed ten-item benchmark every calibration session generates and scores
([`GOLDEN_ITEMS`](../lib/style-lab.ts)):

1. Accent Chair · 2. Sofa · 3. Desk · 4. Bookshelf · 5. TV · 6. Plant ·
7. Floor Lamp · 8. Coffee Table · 9. Guitar · 10. Computer

## Calibration Session (OpenAI-first)

The **Style Lab** (`/style-lab`) runs the Calibration Session. Generate the golden
set (**1 image per item** from **OpenAI GPT Image**, the calibration provider),
then per sample: **approve / reject**, **mark closest**, write a **note**, and
**score five dimensions** (0–10 each). Replicate stays available for a side-by-side
**Shootout** but is **comparison-only** — it never affects the calibration score or
the lock.

Dry-run (placeholders) runs at zero cost for workflow testing; real images come from
the provider when generation is enabled (`/api/generate/style`, calibration only —
**never** creates catalog candidates).

## Scoring system (Task 6)

Each sample is scored on five dimensions, 0–10 → **0–50** per asset, normalized to
**0–100** ([`../lib/calibration.ts`](../lib/calibration.ts)):

| Dimension | What it measures |
|---|---|
| **Consistency** | Matches the rest of the set (camera, scale, palette). |
| **Readability** | Reads clearly at 64/128px. |
| **Silhouette** | Bold, clean, recognizable shape. |
| **Style Fit** | On-identity (not toy/puffy/realistic/storybook). |
| **Production Readiness** | Usable as-is (framing, isolation, transparency). |

The **Overall Calibration Score (0–100)** averages each golden item's representative
(closest, else highest-scoring approved) sample across **all ten** items — so a
missing or unscored item drags the score down.

## Style Lock (Task 7)

The style is **Locked** — and V4 mass generation may proceed — **only** when:

- **all 10** golden assets are **approved**, **and**
- the **Calibration Score ≥ 85**,

scoped to **OpenAI `nestudio_v2`** samples only. Until both hold, the Style Lab and
the Calibration Report show the style as **not locked** with the specific blocking
reasons. **Do not mass-generate before the style is locked.**

## Calibration Report (Task 8)

`/style-report` (the **Calibration** tab) renders the report: approved assets,
rejected assets, average score, per-dimension averages, visual-consistency notes,
remaining issues, and the lock status.
