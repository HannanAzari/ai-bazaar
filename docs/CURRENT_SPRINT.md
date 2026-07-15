# 🎯 Current Sprint

> The single, always-current statement of *what we are doing right now*. One page. Keep it short and
> replace it each sprint — history lives in [design/CHANGELOG.md](design/CHANGELOG.md) and
> [roadmap.md](roadmap.md), not here.

**Sprint:** M32 — Asset Pipeline (Architecture Reset)
**Updated:** 2026-07-15 · **Branch:** `m12-nest-platform`
**Mode:** preview only — **never merge to `main`, never deploy production.**

---

## The shift

> The M31 workflow was right; the *generation architecture* was wrong. We **froze the workflow** and
> **replaced the generation architecture** with a **factory**: a constant **Nestudio Asset DNA** + an
> **interchangeable provider layer**. Our advantage is not picking the "right AI" — it's a pipeline where the
> AI is swappable while the DNA stays constant.

**Rule, now permanent:** *Stop optimising prompts.* Improve, in order — **preprocessing · cutout · provider
routing · rendering pipeline · Asset DNA.**

## What shipped this sprint (all preview)

- **Asset DNA** — spec [design/NESTUDIO_ASSET_DNA.md](design/NESTUDIO_ASSET_DNA.md) + code `lib/asset-dna.ts`
  (prompts assembled *from* the DNA).
- **Cutout stage** — `lib/cutout.ts` (Stage 1, separate from generation; Telegram-style erase/restore).
- **Provider-independent `generateAsset()`** — `lib/asset-pipeline/`; one switch `ACTIVE_ASSET_PROVIDER`;
  adapters GPT Image + Gemini (real) · Imagen + Flux (no-key) · Local (fallback).
- **Editor-first Create Asset** — `+ Create` is the first tile in the editor Assets; whole flow stays in the
  editor. Verified end-to-end on mobile with real Gemini.
- **Asset Benchmark Studio** — `/dev/asset-benchmark` (internal); one source · every provider · scored against
  the DNA by a human. See [design/ASSET_BENCHMARK.md](design/ASSET_BENCHMARK.md).

## The next concrete steps

1. Push the preview; the founder runs the **benchmark** on a few real objects (GPT Image vs Gemini).
2. Score against the DNA; decide which provider best satisfies it — or add an Imagen/Flux key and re-run
   (one config change).
3. Only then invest in *product* quality. **We built the factory; judging the products comes next.**

## Do NOT (this sprint)

Optimise prompts · redesign the locked visual DNA · marry a single provider · add features · merge `main` or
deploy prod.

---

*Full orientation: [SESSION_HANDOFF.md](SESSION_HANDOFF.md) · founder's lens: [CEO_NOTES.md](CEO_NOTES.md) ·
visual authority: [design/NESTUDIO_WORLD_BIBLE.md](design/NESTUDIO_WORLD_BIBLE.md).*
