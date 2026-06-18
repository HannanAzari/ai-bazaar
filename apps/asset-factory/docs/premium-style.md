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

## Master prompt

```
Premium collectible game asset, a polished game-economy item. Slightly stylized with
clean, Pixar-inspired readability, optimized to stay crisp and recognizable at 64px
and 128px. Exactly one isolated object and nothing else, presented alone on a
transparent background as a transparent PNG. Consistent 3/4 isometric camera at
roughly a 30-degree downward angle, the object centered and filling most of the
frame, fully in view. Identical camera, scale, and framing for every asset. Soft,
even studio lighting with subtle ambient occlusion and a clean, bold silhouette.
Designed for a game inventory and room-decoration system.
```

## Negative prompt

```
room scene, furniture set, multiple objects, base, platform, pedestal, floor plane,
ground plane, rug, books, lamp, plant, side table, extra props, extra decorations,
cluttered, busy composition, text, watermark, logo, signature, photorealism,
realistic photography, painterly illustration, storybook rendering, flat vector,
toy-like, puffy, inflated, plastic toy, glossy plastic, random perspective,
front view, side view, top-down, cropped object, dramatic shadows, sunset lighting,
golden hour, white background, scene background
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
