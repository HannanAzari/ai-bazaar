# 🎯 Current Sprint

> The single, always-current statement of *what we are doing right now*. One page. Keep it short and
> replace it each sprint — history lives in [design/CHANGELOG.md](design/CHANGELOG.md) and
> [roadmap.md](roadmap.md), not here.

**Sprint:** M33 — Asset Creation Experience Polish (the founder's "M31 polish" brief)
**Updated:** 2026-07-15 · **Branch:** `m12-nest-platform`
**Mode:** preview only — **no AI/prompt/model changes · never merge to `main` · never deploy production.**

---

## The goal

> Make asset creation *feel* like a premium Nestudio feature. The metric: **"Would someone happily create
> five objects in a row?"** Make the user **forget they are using AI at all.** Even a 70%-perfect mug should
> feel 100% premium. (Making the AI *smarter* is Sprint B — the Nestudio Art Engine.)

## What shipped (all UX/interaction/motion — no generation changes)

- **Original photo first**, then **auto-cutout first** (editor/brush is a fallback, not step one).
- **One generation** (not three) + a **refinement loop** (Use / Improve → "what to change?" → regenerate one,
  reusing the result as reference via the existing `notes` param).
- **Premium glass modal**, **crafted staged loading** (Studying → Sketching → Painting → …), **success moment**
  (✓ Added to My Assets + sparkle) that auto-returns and **reveals the asset in My Assets** (scroll + pulse).
- **Library ownership tabs**: Official (read-only) · My Assets (deletable) · Recent. Polished Create tile,
  warm empty states, gentle motion everywhere.

## Next: Sprint B — the Nestudio Art Engine

Only once the workflow feels effortless. That sprint is where generation *quality* improves (Asset DNA,
provider benchmark, preprocessing) — see [design/NESTUDIO_ASSET_DNA.md](design/NESTUDIO_ASSET_DNA.md) +
[design/ASSET_BENCHMARK.md](design/ASSET_BENCHMARK.md). **Do not** start it until the founder confirms the
experience feels premium.

## Do NOT (this sprint — hard rules from the brief)

Change prompts · tweak Gemini/GPT Image · modify the generation pipeline · change asset style · add models ·
optimise AI quality · experiment with prompts. Also: no `main` merge, no prod deploy.

---

*Full orientation: [SESSION_HANDOFF.md](SESSION_HANDOFF.md) · founder's lens: [CEO_NOTES.md](CEO_NOTES.md) ·
visual authority: [design/NESTUDIO_WORLD_BIBLE.md](design/NESTUDIO_WORLD_BIBLE.md).*
