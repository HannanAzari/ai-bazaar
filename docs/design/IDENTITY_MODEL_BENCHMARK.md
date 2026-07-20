<!-- Governed by docs/design/NESTUDIO_WORLD_BIBLE.md — read that first. -->
# 🔬 Identity-preservation model benchmark (investigation only)

> **This is a proposal + preliminary assessment, NOT a production change.** No model was swapped. It answers
> the CTO's question: is Gemini even the right model for the generation stage, or does GPT Image / a hybrid
> preserve object identity better? Run it before optimising the pipeline around the wrong model.

## What to compare

1. **Gemini 2.5 Image** (`gemini-3.1-flash-image`, current) — image-EDIT model.
2. **GPT Image** (OpenAI `gpt-image-1`) — already wired as a provider (key present).
3. **Hybrid** — Gemini for *segmentation/understanding* (identity contract extraction) + GPT Image for
   *generation*, or vice-versa.

## Harness (already exists — no new build needed)

`/dev/asset-benchmark` (M32) runs one source image through **every provider** via the same
provider-independent `generateAsset()` path and shows them side by side. With the Identity Lock in place, each
result also carries the **identity report** (silhouette / critical colours / graphics) — so the benchmark can
score *identity preservation* objectively, not just "looks Nestudio".

## Objective metrics (per object, per model)

Reuse the Identity Validator ([`lib/identity/validator.ts`](../../lib/identity/validator.ts)):

| Metric | Meaning |
|---|---|
| **Silhouette IoU** | shape preserved |
| **Critical-colour retention** | e.g. black handle stays black (source→generated coverage ratio) |
| **Graphics retention** | lettering/marks survived |
| **Proportion delta** | aspect preserved |
| **Repairs needed** | how much post-repair was required (fewer = the model preserved more itself) |
| **Style score** | Art-Engine "belongs" score after identity is enforced |

## Fixed input set (same for every model)

The 9 benchmark objects: **coffee mug, book, plant, headphones, keyboard, camera, chair, watch, backpack** —
plus the reference **mug** (cream body · black B-handle · black lettering) as the identity stress test.

## Method

1. One clean **segmented** cutout per object (not `autoCutout` — segment cleanly so nothing extraneous is in
   the frame). Same cutout to every model.
2. Generate with each model through the identical Identity-Lock path (same contract, same constraints).
3. Record the metrics table above **before** targeted repair (so it measures the *model's own* preservation).
4. A model "wins" on identity if it needs the **fewest repairs** and has the highest critical-colour / graphics
   retention across the set — with an acceptable style score.

## Preliminary assessment (from this sprint's observations — not a conclusion)

- Gemini (image-edit) preserved the mug's **black handle** reasonably under the identity-constrained prompt +
  original/mask, but **dropped fine lettering** and drifted on style. It tends to *restyle* toward its own
  aesthetic — the exact "style over identity" failure the sprint targets.
- GPT Image (`/v1/images/edits`) was not measured head-to-head here; it should be run on the same set.
- **Hypothesis worth testing:** the strongest setup may be *understanding with one model, generation with the
  one that drifts least*, with the deterministic Identity Lock as the safety net regardless. The **repair
  layer means the pipeline is robust to whichever model we pick** — so the benchmark decides which model
  minimises how hard the repair has to work, not which one is "magic".

## Recommendation

Run the benchmark on the fixed set with clean cutouts **before** further pipeline optimisation. Do not assume
Gemini is best because it's integrated. Keep the provider interchangeable (it already is — one config switch);
let the identity metrics choose. **No production model change until this report has real numbers.**
