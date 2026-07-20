# 🎯 Current Sprint

> The single, always-current statement of *what we are doing right now*. One page. Keep it short and
> replace it each sprint — history lives in [design/CHANGELOG.md](design/CHANGELOG.md) and
> [roadmap.md](roadmap.md), not here.

**Sprint:** M36 — Identity Lock Pipeline (the founder's "M34" brief)
**Updated:** 2026-07-16 · **Branch:** `m12-nest-platform`
**Status:** ⚠️ **HELD — architecture complete + gates green, but the mug test does NOT yet fully pass.
NOT pushed** (per the explicit "do not push until the mug test passes" instruction).

---

## The goal

> A real object uploaded by a user must remain recognisably THAT object after becoming a Nestudio asset.
> Reverse the priority: **IDENTITY > FUNCTION > Nestudio DNA.** If the mug has a black B-handle, the handle
> stays black. Style may only change finish/edges/lighting/polish — never redesign or recolour identity.

## What's built ([`lib/identity/`](design/../../lib/identity), all gates green)

- **Identity Contract** (structured extraction: silhouette, colours-with-regions, critical colours, graphics,
  re-appliable identity/detail layers).
- **Identity-constrained prompt** (from the contract, not adjectives) + **original + mask + cutout** sent to
  the model.
- **Identity Validator** (Gate 1, hard pass/fail) → **Targeted Repair** (re-apply the source's own critical
  regions; never rebuild) → **Style Validator** (Gate 2). One generation + one optional repair.
- Spec: [design/IDENTITY_LOCK.md](design/IDENTITY_LOCK.md). Model benchmark (investigation only):
  [design/IDENTITY_MODEL_BENCHMARK.md](design/IDENTITY_MODEL_BENCHMARK.md).

## Honest status — the mug test

- ✅ Black handle preserved (~13%).
- ⚠️ Cream body / lettering / "belongs" style not yet cleanly passing in the available test harness
  (`/dev/art-engine` uses `autoCutout`, which keeps the **hand** in the mug photo — not a faithful test).
- The faithful path is the **editor** (clean tap-to-select segmentation), which could not be driven
  end-to-end here (it navigated away mid-generation).

## To close it (next session / on a phone)

1. Run the mug through the **editor** on a phone (clean segmented cutout, Preserve Details on).
2. Confirm: black B-handle black · B silhouette · lettering preserved · cream body cream · belongs.
3. If the re-applied layers misalign, tune the bbox alignment in
   [`lib/identity/repair.ts`](design/../../lib/identity/repair.ts). **Only then push.**

## Do NOT

Change the UI / Create Asset. Add descriptive words to prompts. Change the art style. **Do not push until the
mug test passes.**

---

*Full orientation: [SESSION_HANDOFF.md](SESSION_HANDOFF.md) · founder's lens: [CEO_NOTES.md](CEO_NOTES.md).*
