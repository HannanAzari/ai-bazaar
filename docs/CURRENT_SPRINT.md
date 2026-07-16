# 🎯 Current Sprint

> The single, always-current statement of *what we are doing right now*. One page. Keep it short and
> replace it each sprint — history lives in [design/CHANGELOG.md](design/CHANGELOG.md) and
> [roadmap.md](roadmap.md), not here.

**Sprint:** M35 — The Nestudio Art Engine (the founder's "M33" brief)
**Updated:** 2026-07-16 · **Branch:** `m12-nest-platform`
**Mode:** preview only — **no prompt/Gemini/generation changes · no `main` merge · no prod.**

---

## The goal

> Make AI-generated assets **indistinguishable from official Nestudio assets** — *one artistic language*, not
> "better AI." The Definition of Done is a **human blind test**: 10 generated mixed with 10 official; if they
> can't be reliably told apart, done.

The lever (consistent with the frozen "stop optimising prompts" rule): **measure the official style, conform
generated output to it, and gate on it** — not ask the model differently.

## What shipped ([`lib/art-engine/`](design/../../lib/art-engine))

- **Measured DNA** (Phase 1): fingerprint the real official library → a mean+variance profile. Measuring
  corrected wrong assumptions (officials are crisp-edged, tightly cropped, matte ≈ 0.60). See
  [design/NESTUDIO_DNA_MEASURED.md](design/NESTUDIO_DNA_MEASURED.md).
- **Style Validator** (Phase 2/4): the quality gate. ~7/8 officials belong; neon/gloss fails; palette
  discipline is the one hard veto.
- **Conform + gated retry** (Phase 3/4/7): pull output into one material language (identity-preserving),
  regenerate only on failure. Cost-aware.
- **Family test + benchmark** (Phase 5/6): `/dev/art-engine` — generated beside the official
  sofa/bookshelf/lamp/table/plant + the 9 benchmark objects, each scored.

## Honest status

The validator is a **calibrated proxy**; the human blind test is the final word. A real generated coffee mug
now clears the gate at ~63% ("belongs"); pure-white objects sit closest to the line (they read brighter than
warm furniture). Next iteration = run the blind test and tighten conform/thresholds from real judgements.

## Do NOT (this sprint — hard rules from the brief)

Change prompts · tweak Gemini/GPT Image · modify generation logic · add models · redesign screens/buttons or
the Create flow (those are finished). Also: no `main` merge, no prod deploy.

---

*Full orientation: [SESSION_HANDOFF.md](SESSION_HANDOFF.md) · founder's lens: [CEO_NOTES.md](CEO_NOTES.md) ·
visual authority: [design/NESTUDIO_WORLD_BIBLE.md](design/NESTUDIO_WORLD_BIBLE.md).*
