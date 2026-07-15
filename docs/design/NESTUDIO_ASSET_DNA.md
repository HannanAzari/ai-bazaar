<!-- Governed by docs/design/NESTUDIO_WORLD_BIBLE.md — read that first. -->
# 🧬 Nestudio Asset DNA — the provider contract

> **Authority.** Subordinate to [NESTUDIO_WORLD_BIBLE.md](NESTUDIO_WORLD_BIBLE.md) and
> [RENDERING_DNA.md](RENDERING_DNA.md). This document does **not** invent new visual rules — it is the
> **operational, provider-facing restatement** of the locked DNA, written so that *any* image provider
> (GPT Image, Gemini, Imagen, Flux, a future LoRA or fine-tune) can be measured against one constant target.
> Where a value here could conflict with RENDERING_DNA or the [camera lock](../nestudio-camera-dna-lock.md),
> **those documents win** and this one must be corrected.
>
> **Machine mirror:** [`lib/asset-dna.ts`](../../lib/asset-dna.ts) is the code counterpart — the same spec as
> a typed constant (`NESTUDIO_ASSET_DNA`). Prompts are **assembled from the DNA**, never hand-written. When
> this document and the constant disagree, reconcile them in the same commit.

Founded **M32** — the *Asset Pipeline (Architecture Reset)*. The lesson that created it:

> **We were asking a foundation model to invent an art style that does not yet exist.** Changing prompts is
> not a strategy. Changing providers is not a strategy. Nestudio needs its own visual language, expressed as
> a **specification every provider must satisfy** — not as a clever paragraph buried in one prompt.

---

## 0. Why this exists (the architecture principle)

Our advantage is **not** picking the "right AI." It is a pipeline where **the provider is interchangeable
while the Asset DNA stays constant.** Therefore:

- The DNA lives in **one place** (this doc + `lib/asset-dna.ts`), not inside prompts.
- Every provider receives the **same** DNA and the **same** cutout. Switching provider is one config change
  (`ACTIVE_ASSET_PROVIDER`). The rest of Nestudio never knows which provider produced an asset.
- Providers are judged **by consistency against this DNA**, never by prompt cleverness — see
  [ASSET_BENCHMARK.md](ASSET_BENCHMARK.md) and the scorecard in §4.

The pipeline is **two separate problems** (never conflate them):

```
Stage 1  Photo ──▶ high-quality CUTOUT      (Telegram-like: fast, forgiving, manual erase/restore)
Stage 2  Cutout ─▶ Nestudio ASSET GENERATOR  (reinterpret into an original Nestudio object)
```

Stage 1 is a *masking* problem. Stage 2 is an *art-direction* problem. **Never output a photo cutout.** A
Nestudio asset is a **collectible designer object**, rebuilt from scratch — not a sticker.

---

## 1. The DNA fields (the source of truth)

Each field lists its **canonical origin** so nothing is duplicated as a new rule. Providers must satisfy all
of them; the benchmark scores each one.

| # | Field | Locked value (origin) |
|---|---|---|
| 1 | **Camera** | Animal-Crossing life-sim camera; ~180 cm height, front-facing **slightly elevated** — never eye-level, never isometric. *(camera lock · RENDERING_DNA §6)* |
| 2 | **Lens** | ~35–40 mm equivalent; no wide-angle distortion, no strong cinematic perspective. *(camera lock)* |
| 3 | **Perspective / tilt** | **8–12°, target 10°** downward tilt → subtle visible top surfaces; subtle natural convergence only. *(camera lock)* |
| 4 | **Scale & framing** | Whole object visible, centered, the **~70% framing rule** — object occupies ~70% of the frame. *(RENDERING_DNA §7)* |
| 5 | **Padding** | Generous **even transparent margins on all four sides** (~12% of the square); nothing clipped or edge-touching. *(engine `padding: 0.12`)* |
| 6 | **Lighting** | A **single soft warm key from the upper-left** (`#fff6e0`); no rim, HDR, softbox, or dramatic light. *(RENDERING_DNA §2)* |
| 7 | **Material response** | **Deeply matte, hand-painted**, chalky; **never** glossy / plastic / chrome / wet-look / specular / reflective. Material *varies* (wood, ceramic, fabric…); the *finish language* is constant. *(RENDERING_DNA §3)* |
| 8 | **Texture** | Soft powdery grain only; **no photographic texture, no procedural noise.** *(RENDERING_DNA §3)* |
| 9 | **Edge softness** | Clean, gently soft edges (feathered alpha) — not razor-cut sticker edges, not fuzzy halos. *(pipeline `featherAlpha`)* |
| 10 | **Ambient occlusion** | Gentle, **warm**, pooling in crevices/undersides/inside cut-outs; reads as hand-painted shading, not a render pass. *(RENDERING_DNA §2)* |
| 11 | **Shadow rules** | **No baked shadow in the asset.** The contact shadow is cool-plum `#46365a`, **engine-composited** at placement. *(RENDERING_DNA §4)* |
| 12 | **Colour grading** | Object keeps its **own true colours**; only the *light* is warm (never recolour/tint the object). **One accent per object, max.** Nothing fully saturated; no pure white, no pure black, no pure RGB. *(RENDERING_DNA §1)* |
| 13 | **Silhouette rules** | Must pass the **3-second silhouette test**: readable as its identity from the outline alone; pedestal foot · pebble body · negative-space cut-out where natural. *(GEOMETRIC_ALPHABET · PHYSICS_DNA)* |
| 14 | **Shape language** | Built from the primitives **Pebble (mass) · Capsule (limb) · Arch (span)**; rounded single-radius forms, softly/gently inflated. *(GEOMETRIC_ALPHABET)* |
| 15 | **Rendering** | Stylized life-sim game look (Animal Crossing / The Sims); **reinterpret, don't reproduce** — keep the identity, discard the photograph. *(World Bible M31 · RENDERING_DNA §8)* |
| 16 | **Transparency** | Delivered as an **isolated transparent PNG** — true alpha, no scene, no ground plane, no baked background, **no painted checkerboard**, no text, no watermark. *(RENDERING_DNA §5)* |
| 17 | **Export** | Square RGBA PNG at the studio output size (default **640 px**), centered, generous margins, one object only. *(engine `outputSize`)* |

**The one validation question for every asset:** *"Would this look natural inside Animal Crossing — and does
it look like this real thing was **rebuilt by Nestudio's own artists**?"* If no → reject and regenerate.

---

## 2. What belongs to the DNA vs. what belongs to the provider

| Belongs to the **DNA** (constant, in `lib/asset-dna.ts`) | Belongs to the **provider adapter** (swappable) |
|---|---|
| All 17 fields above | How the DNA description is delivered to that model's API |
| The assembled positive/negative language | Model id, endpoint, auth, request shape |
| The export target (size, alpha, padding) | Response parsing, retries, rate limits |
| The benchmark scorecard | Latency / cost characteristics |

A provider adapter is **thin**: it takes `{ cutout, subject, dna, variantCount }` and returns candidate
images. It contains **no art direction** — the art direction is the DNA it was handed.

---

## 3. Prompt assembly (derived, never authored)

Prompts are **generated from the DNA**, so improving the look means improving the DNA (or the cutout, or the
provider), **not** rewriting a prompt. `buildAssetDnaPrompt(subject)` in `lib/asset-dna.ts` composes:

- **Positive:** the reinterpretation instruction + the DNA fields as plain constraints (camera, lighting,
  material, shape, colour-fidelity, transparency).
- **Negative:** the RENDERING_DNA §8 *forbidden* list (photoreal / glossy / isometric / eye-level / baked
  shadow / checkerboard / multi-accent / pure white-black / trend gimmicks).

> **Rule (M32, permanent): Stop optimising prompts.** Do not spend hours rewriting prompts. Improve, in order:
> **preprocessing · cutout · provider routing · rendering pipeline · Asset DNA.** A prompt is one component,
> not the strategy.

---

## 4. The benchmark scorecard (judge by consistency, not prompts)

Every provider's output is scored **against the DNA**, one row per dimension, 0–2 each
(0 = violates · 1 = partial · 2 = satisfies). A provider "wins" by **total consistency**, not by any single
pretty result.

| Dimension | Passes when… |
|---|---|
| **Camera & perspective** | slightly-elevated ~10°, not eye-level, not isometric |
| **Material & finish** | matte hand-painted, no gloss/plastic/photo texture |
| **Lighting & AO** | single warm upper-left key + warm pooled AO, no HDR/rim |
| **Colour fidelity** | keeps the object's true colours; one accent; no pure white/black |
| **Silhouette** | passes the 3-second silhouette read |
| **Shape language** | rounded, softly inflated, Pebble/Capsule/Arch |
| **Transparency** | true alpha, no checker, clean feathered edge |
| **Reinterpretation** | reads as a rebuilt Nestudio object, **not** a photo cutout |
| **Framing & padding** | centered, ~70%, generous even margins, nothing clipped |
| **Identity preserved** | still recognisably the user's real thing |

Max 20. The benchmark tool ([ASSET_BENCHMARK.md](ASSET_BENCHMARK.md)) renders providers side-by-side and
records these scores; **the human is the judge** (GPT creates · Human judges · Claude records).

---

## 5. Status (honest)

- **Constant + assembly:** implemented (`lib/asset-dna.ts`), version `asset-dna@1`.
- **Providers wired:** **Gemini** (real, key present) · **GPT Image** (real, key present) · **Imagen** /
  **Flux** (adapters exist, **unavailable — no key**, registered so switching is one config change when a key
  arrives).
- **Not yet decided:** which provider best satisfies this DNA. That is *exactly* what the benchmark exists to
  answer — objectively, later. **We are building the factory before judging the products.**
- **Scope note:** M32 builds the *factory*. It does **not** require perfect generated assets. A better factory
  produces better assets for years; a better prompt improves one object.
