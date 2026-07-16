<!-- Governed by docs/design/NESTUDIO_WORLD_BIBLE.md — read that first. -->
# 📐 Nestudio DNA — Measured (the Art Engine)

> **Authority:** subordinate to [NESTUDIO_WORLD_BIBLE.md](NESTUDIO_WORLD_BIBLE.md) · [RENDERING_DNA.md](RENDERING_DNA.md)
> · [NESTUDIO_ASSET_DNA.md](NESTUDIO_ASSET_DNA.md). This document records the DNA **measured from the actual
> official assets** (Phase 1 of the Art Engine), and the calibration that flows from it. Code:
> [`lib/art-engine/`](../../lib/art-engine). Lab: `/dev/art-engine` (internal).

Founded **M35** — *The Nestudio Art Engine*. The goal is not "better AI"; it is **one artistic language** — a
user should not be able to tell which assets an artist drew and which were generated. This is achieved by
holding generated assets to numbers taken from the real handcrafted library.

---

## 0. The method (Phase 1)

Instead of *guessing* the style, we **measure** it from the official golden-nest library
([`lib/art-engine/official.ts`](../../lib/art-engine/official.ts)): each official asset is fingerprinted
([`fingerprint.ts`](../../lib/art-engine/fingerprint.ts)) and the library's **mean + natural spread** become
the target profile. *Documentation records discoveries* — measuring corrected several wrong assumptions.

## 1. What measuring revealed (and corrected)

| Dimension | Assumed | **Measured (official)** | Consequence |
|---|---|---|---|
| Saturation | ~0.42 | **0.32** — calmer than assumed | confirm: calm palette |
| Warmth (R−B) | ~0.07 | **0.13** — warmer | confirm: warm light |
| Value (lightness) | ~0.60 | **0.69** — brighter | officials are light |
| Matte-ness | ~0.97 | **0.60** — much lower | officials are 3D-rendered with bright highlights; "matte" isn't pixel-flat |
| **Edge softness** | ~0.5 (soft) | **0.09 — CRISP** | officials have hard cutout edges; feathering generated output is an AI tell in the *other* direction |
| **Coverage / crop** | ~0.4 | **0.91 — tightly cropped** | framing is a crop/pipeline choice, not a style tell |
| Purity (no pure px) | ~0.99 | **0.75** | officials do have bright near-white highlights |

**Two corrections to the pipeline followed directly from the data:**
1. The conform pass no longer **feathers** edges (officials are crisp → extra softness reads as AI).
2. **Edge-softness, coverage and painterly-variance are NOT gated** — they're render/crop artifacts that vary
   across the official library itself, so gating on them would penalise our own correct pipeline.

## 2. The Style Validator (Phase 2/4) — the gate

[`validator.ts`](../../lib/art-engine/validator.ts) scores a candidate against the measured profile. Tolerances
come from the **library's own variance** (`buildProfile`, k·σ), so official assets score high and the loud AI
tells score low. Calibration on the real library:

- **~7/8 official assets clear the bar** (the lone low outlier is the glowing **lamp** — a bright-bulb edge case).
- The **one hard veto is palette DISCIPLINE** (a neon/garish palette is the only unambiguous "not Nestudio"
  tell, and it can't be conformed away without destroying identity). Matte-surface and pure-pixels are weighted
  heavily but not vetoes — a legitimately light object reads brighter than warm-brown furniture, so the
  holistic score decides.
- A real generated **coffee mug** clears the gate at **~63% ("belongs")** after conforming.

## 3. Conform + gated retry (Phase 3/4/7)

[`conform.ts`](../../lib/art-engine/conform.ts) pulls any provider's output into the one material language,
**identity-preserving** (hue untouched — the M22 rule): `matteGrade` (gloss ↓, warm light, blacks lifted) then
**tame the extremes** (blown-out highlights & pure whites → warm matte cream; pure blacks → warm near-black —
proven to lift measured matte-ness 0.51 → 1.00 on neutral whites). Deterministic and **free** (no extra
generation cost). The validator then gates; the pipeline **regenerates only on failure**, at most a couple of
attempts (Phase 7 — intelligence over brute force, not brute force per call).

## 4. Family test + benchmark (Phase 5/6)

`/dev/art-engine` places a generated asset **beside the official sofa · bookshelf · lamp · table · plant**
(the family test) and scores the **9 benchmark objects** (coffee mug, book, plant, headphones, keyboard,
camera, chair, watch, backpack) against the gate. Judge by the validator **and** the eye.

## 5. Honest status vs. the Definition of Done

The DoD is a **human blind test** (10 generated mixed with 10 official — indistinguishable). This sprint builds
the **machinery** that makes that achievable and measurable, and demonstrates it: the DNA is measured from
real assets, the validator is calibrated so officials belong and neon/gloss doesn't, and generated output is
conformed + gated. The validator is a **calibrated proxy**, not the human eye — the blind test remains the
final word, and pure-white objects (which read brighter than the warm furniture) sit closest to the line.

> No prompts, no Gemini, no generation logic were changed in this sprint — the Art Engine works on
> **measurement, conforming, and gating**, not on asking the model differently.
