# Nestudio Production Asset Plan (V3.7 lock)

Companion to [nestudio-dna-spec.md](nestudio-dna-spec.md). Machine-readable manifest +
cost math: [`lib/production-plan.ts`](../lib/production-plan.ts) (guarded by
[`test/production-plan.test.ts`](../test/production-plan.test.ts)). Every prompt below
inherits the frozen V3.7 master spine + `NESTUDIO_DNA` + `NESTUDIO_SIGNATURE`
automatically (`buildStyledPrompt(category, "nestudio_v2", { subject })`); only the
**subject** changes per asset.

---

## PHASE 1 — Audit: minimum changes to lock V3.7

V3.7 is already coherent. The audit found the visual language complete; the only
"changes" required to LOCK are process/guard changes, not style changes:

1. **Freeze marker (done):** `NESTUDIO_DNA_VERSION = "3.7.0"`, `STYLE_FROZEN = true`,
   plus a freeze test ([`test/dna-freeze.test.ts`](../test/dna-freeze.test.ts)) that
   fails the build if the ten DNA principles drift.
2. **Formal spec (done):** [nestudio-dna-spec.md](nestudio-dna-spec.md).
3. **One wording clarification (no code change):** the brief calls for "premium
   toy-like quality" while the negative prompt bans "toy-like". These are **not** in
   conflict — the negative targets *cheap* toy / children's / glossy-plastic looks,
   while the intended *premium collectible-toy* quality is already carried positively by
   "premium collectible", "slightly exaggerated friendly-premium proportions", and the
   matte materials. **Resolution: keep the negatives as-is.** Do not add "toy".
4. **Character gap (doc only):** principle 9 (characters share the universe) is handled
   in the spec's Character Compatibility section; no characters are generated yet, so no
   prompt change.

**Net: no redesign, no new style, no new personalities.** The style is locked.

Empirical confirmation (the runtime Style Lock: 10/10 approved + calibration ≥ 85,
OpenAI `nestudio_v2`) still requires one real calibration pass — see Go/No-Go.

---

## PHASE 3 — Production asset categories

Strategy: **hero seating (sofa, armchair) is generated per personality** (carries
identity); **everything else is a shared pool** (the frozen DNA makes it read as one
family, so a handful is reused across all rooms). Personalities + accents are the
locked set in [`lib/sofa-dna.ts`](../lib/sofa-dna.ts) (`PERSONALITIES`).

Common color strategy for **shared** pieces: warm neutral base (oak / wool / cream),
accent kept subtle so they sit under any personality's hero piece. **Hero** pieces use
the personality's signature accent.

### Tier 1

| Category | Strategy | Variants | Shape rules | Color strategy |
|---|---|---|---|---|
| **Sofa** | per-personality | 10 | locked sofa silhouettes (cloud, cocoon, lounge, modular, pod, pebble…) | personality accent |
| **Armchair** | per-personality | 10 | chair echoes the personality's sofa form | personality accent |
| **Coffee Table** | shared | 4 | low oak top, softly rounded corners, rounded legs | warm oak, subtle accent edge |
| **Rug** | shared | 4 | flat rounded/organic shape, thick readable border | one warm tone + one accent |
| **Shelf** | shared | 3 | open oak shelving, rounded uprights, thick frame | warm oak neutral |
| **Cabinet** | shared | 3 | closed oak storage, soft rounded doors, thick base | warm oak neutral |
| **Desk** | shared | 3 | oak top, rounded edges, friendly tapered legs | warm oak neutral |
| **Lamp** | shared | 3 | rounded shade, soft matte, thick readable stem | warm neutral + accent shade |
| **Plant** | shared | 3 | rounded matte pot, simplified friendly foliage | green + warm pot |
| **Wall Art** | shared | 4 | thick rounded frame, simple abstract warm composition | warm + accent |

Tier 1 = **47** assets.

### Tier 2

| Category | Strategy | Variants | Shape rules | Color strategy |
|---|---|---|---|---|
| **Books** | shared | 2 | small rounded-spine stack | warm mixed + accent |
| **Electronics** | shared | 2 | soft matte rounded monitor/console | neutral + accent |
| **Gaming accessory** | shared | 2 | rounded controller/headset, matte | neutral + accent (violet/teal lean) |
| **Decor object** | shared | 3 | small rounded vase/sculpture/bowl | warm + accent |
| **Storage object** | shared | 2 | soft basket/box, woven or matte | warm neutral |

Tier 2 = **11** assets.

### Per-category prompt template

All templates are: `MASTER_PROMPT + subject + NESTUDIO_DNA + NESTUDIO_SIGNATURE + tokens`
(handled by `buildStyledPrompt`). Author only the **subject**:

- **Hero (sofa/armchair):** reuse [`lib/sofa-dna.ts`](../lib/sofa-dna.ts) `variantsForCategory("sofa"|"chair")` — `a single {noun} {form}, {material}, a {accent} accent, {character}`.
- **Shared Tier 1/2:** `a single {object} {soft-rounded form detail}, {warm-oak / matte material}, a subtle {warm accent} accent`.
  - e.g. Coffee Table: `a single coffee table with a low oak top, softly rounded corners and rounded legs, oiled oak with a soft matte top, a subtle caramel accent`.
  - e.g. Lamp: `a single floor lamp with a rounded matte shade and a thick readable stem, warm oak and matte metal, a subtle sage accent`.
  - e.g. Plant: `a single potted plant with simplified friendly foliage in a rounded matte pot, warm terracotta pot, soft green leaves`.

---

## PHASE 4 — Batch generation plan

**Goal:** the smallest set that assembles **20 unique rooms across 10 personalities**,
minimum API cost.

**Coverage logic:** 2 hero seats per personality (sofa + armchair) → 2 distinct rooms
per personality → 10 × 2 = **20 rooms**. The shared pool (tables, storage, lighting,
greenery, art, decor) is reused across all rooms; rooms differ by personality hero
piece + shared-pool selection + layout in the Room Designer Sandbox.

### Batch generation order (cheapest-risk first)

1. **Hero seating — per personality (20):** sofas (10) then armchairs (10). Generate +
   calibrate these FIRST; they carry identity and gate everything else.
2. **Shared Tier 1 (27):** coffee table, rug, shelf, cabinet, desk, lamp, plant, wall art.
3. **Shared Tier 2 (11):** books, electronics, gaming accessory, decor object, storage object.

Generate sequentially (OpenAI, rate-limit safe), review/approve in the calibration
workflow, then run the Sandbox room-assembly test before committing to Tier 2.

### Estimated asset count

| | Assets kept |
|---|---|
| Tier 1 | 47 |
| Tier 2 | 11 |
| **Total unique assets** | **58** |

### Estimated API cost (OpenAI gpt-image-1, ~$0.04/image)

| Scenario | Images | Cost |
|---|---|---|
| Minimal (1 candidate / asset) | 58 | **~$2.32** |
| Recommended (2 candidates / asset, approve 1) | 116 | **~$4.64** |

(Confirm live pricing on your OpenAI plan. A ~1.3× regen buffer → ≈$6 worst case.)

---

## Go / No-Go

**GO — with one gating step.** The visual language is locked, the spec is formal, the
plan is minimal (58 assets / ≤ ~$5), and the pipeline (calibration, scoring, lock,
sandbox) is in place. Before the full 58-asset spend, run **batch step 1 only** (the 20
hero seats) through a real OpenAI calibration pass and confirm:

- the runtime **Style Lock** reaches 10/10 approved + score ≥ 85, and
- a quick **Sandbox** room places 2 personalities with zero unplaced assets.

If step 1 passes, proceed to Tier 1 shared + Tier 2 (no further iteration). If it fails,
fix prompts/metadata before scaling — do not redesign the DNA.
