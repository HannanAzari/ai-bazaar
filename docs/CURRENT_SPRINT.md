# 🎯 Current Sprint

> The single, always-current statement of *what we are doing right now*. One page. Keep it short and
> replace it each sprint — history lives in [design/CHANGELOG.md](design/CHANGELOG.md) and
> [roadmap.md](roadmap.md), not here.

**Sprint:** M34 — Premium Segmentation Experience (the founder's "M32.5" brief)
**Updated:** 2026-07-16 · **Branch:** `m12-nest-platform`
**Mode:** preview only — **no AI/prompt/Gemini/generation/style changes · no `main` merge · no prod.**

---

## The goal

> Creating an asset should feel effortless — the user should almost never feel like they're editing an image.
> They should feel like **Nestudio instantly understood what they meant.** Compared side-by-side with Telegram
> sticker creation, Nestudio should feel equally premium or better, and finish in **under 10 seconds** without
> reading instructions.

## What shipped (Stage-1 cutout only — no generation touched)

- **Real on-device segmentation** — [`lib/segmentation/`](design/../../lib/segmentation): MediaPipe Interactive
  Segmenter (`magic_touch`, bundled model, in-browser WASM — no server roundtrip, not Gemini) + a local
  **flood fallback** so it can never fail.
- **Segmentation-first**: auto-detect the subject → **tap the object you want** → background disappears. The
  erase/restore brush is a fallback ("Fix edges"), not step one.
- **Premium presentation**: object floats on a **warm paper card** (no giant checkerboard), soft glow outline,
  scale-pop, faded/desaturated background, tap-hint dots, shimmer instead of a spinner.
- **Premium floating modal**; focused edit tools (Erase · Restore · Undo · Redo · brush · Done, edges-only).
- **Verified <300ms** tap-to-select (~237ms measured), 60fps, local.

## Next: Sprint B — the Nestudio Art Engine

Generation *quality* (Asset DNA, provider benchmark) — see
[design/NESTUDIO_ASSET_DNA.md](design/NESTUDIO_ASSET_DNA.md) + [design/ASSET_BENCHMARK.md](design/ASSET_BENCHMARK.md).
Only once the whole create experience feels effortless.

## Do NOT (this sprint — hard rules from the brief)

Change prompts · tweak Gemini/GPT Image · modify the generation pipeline · change asset style · add generation
models · optimise AI quality. Also: no `main` merge, no prod deploy.

---

*Full orientation: [SESSION_HANDOFF.md](SESSION_HANDOFF.md) · founder's lens: [CEO_NOTES.md](CEO_NOTES.md) ·
visual authority: [design/NESTUDIO_WORLD_BIBLE.md](design/NESTUDIO_WORLD_BIBLE.md).*
