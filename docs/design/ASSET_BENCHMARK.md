<!-- Governed by docs/design/NESTUDIO_WORLD_BIBLE.md — read that first. -->
# 🧪 Asset Benchmark — how we choose a provider

> **Authority:** subordinate to [NESTUDIO_ASSET_DNA.md](NESTUDIO_ASSET_DNA.md). The benchmark measures
> providers *against* the DNA; it never changes the DNA.

Founded **M32**. The internal tool lives at **`/dev/asset-benchmark`** (noindex, not a user surface).

## The principle

> Our advantage is **not** picking the "right AI." It is a pipeline where the **provider is interchangeable
> while the Asset DNA stays constant.** The benchmark exists to answer *which provider best satisfies the
> DNA* — **objectively, by consistency, not by prompt cleverness.**

## How it works

1. **One source image** in. One **cutout** (Stage 1) — the *same* cutout for every provider.
2. The identical **DNA-assembled prompt** (from [`lib/asset-dna.ts`](../../lib/asset-dna.ts)) goes to **every
   available provider** through the exact same `generateAsset()` path — no per-provider prompt tuning.
3. Results render **side by side**. Unavailable providers (no key) are shown honestly, never faked.
4. The **human scores** each result against the DNA scorecard (10 dimensions × 0–2 = max 20 — see
   [NESTUDIO_ASSET_DNA.md §4](NESTUDIO_ASSET_DNA.md)). GPT creates · **Human judges** · Claude records.

## What it is NOT

- Not a place to iterate prompts (that rule is frozen — see the Asset DNA §3).
- Not automated scoring — a person judges the *rendered result on screen* (Reality wins).
- Not a user feature.

## Current providers

| Provider | State |
|---|---|
| OpenAI **GPT Image** | wired · key present |
| Google **Gemini** | wired · key present · current `ACTIVE_ASSET_PROVIDER` |
| Google **Imagen** | adapter present · **no key** |
| **Flux** | adapter present · **no key** |
| **Local (Canvas)** | offline fallback · not a reinterpretation |

Switching the model Nestudio ships is **one line** (`ACTIVE_ASSET_PROVIDER` in
[`lib/asset-pipeline/router.ts`](../../lib/asset-pipeline/router.ts)) or the `NEXT_PUBLIC_ASSET_PROVIDER`
env — nothing downstream changes.

> **No winner is chosen yet.** We are *building the factory before judging the products.* The benchmark is how
> that judgement will happen, on real renders, when the founder is ready to run it.
