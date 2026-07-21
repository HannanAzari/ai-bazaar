# 🎯 Current Sprint

> The single, always-current statement of *what we are doing right now*. One page. Keep it short and
> replace it each sprint — history lives in [design/CHANGELOG.md](design/CHANGELOG.md) and
> [roadmap.md](roadmap.md), not here.

**Sprint:** M36 — Production Asset Factory polish (on top of M35b GPT Image)
**Updated:** 2026-07-21 · **Branch:** `m12-nest-platform`
**Status:** ✅ **PASSING — full production pipeline validated on both mugs (Latin + Persian). Ready to freeze.**

---

## M36 — the six production priorities (all done, verified on real calls)

- **P1 · No external shadows.** Automatic post-gen alpha cleanup ([`lib/asset-pipeline/cleanup.ts`](../lib/asset-pipeline/cleanup.ts)):
  harden faint alpha (kills glow/halo) → keep the largest connected component (drops detached floor/contact
  shadows) → despeckle → feather → trim → pad. Internal shading/AO kept. No recolour, no repair.
- **P2 · Camera locked forever.** One [`CANONICAL_CAMERA_CLAUSE`](../lib/asset-pipeline/camera.ts) reused by furniture@8 — no per-asset angle drift.
- **P3 · Rich identity extraction.** A vision model ([`/api/ai/identity`](../app/api/ai/identity), gpt-4.1-mini) describes
  shape/materials/colours/decorative elements/text/logos/proportions BEFORE GPT Image. Graceful fallback to the
  deterministic extractor. ("white mug" → "white ceramic mug · cartoon eyes with eyelashes · red heart cheeks · بغل؟".)
- **P4 · Multi-object segmentation.** Batch card on [`/dev/gpt-image`](../app/dev/gpt-image): tap several objects; each generates as its
  own independent asset (never combined). The future batch workflow.
- **P5 · Official style references.** The route attaches a curated official-furniture set (sofa, table, lamp, plant)
  as STYLE-only refs so GPT learns the house look. Identity still comes only from the object.
- **P6 · Identity first.** furniture@8 states identity outranks style explicitly; the style refs did NOT corrupt
  identity in testing.

**Verified (real gpt-image-1, full auto path):** Mug A (cream, black B-handle, "Bitch") and Mug B (face, red
cheeks, Persian "بغل؟") — identity + text preserved, native transparent, **no external shadow**, belongs beside
official furniture, no manual editing. ~$0.44 / ~45s each (incl. 4 style refs + vision identity).

## The M35b goal (unchanged, still true)

> Stop using Gemini. Upload a real object → isolate it → generate ONE premium Nestudio version with
> **GPT Image (`gpt-image-1`)** → preserve its identity → show the genuine result. **No repair layers.**
> See the model's real output before adding any correction.

## What's built

- **Active provider → `gpt-image`** ([`lib/asset-pipeline/router.ts`](../lib/asset-pipeline/router.ts)). No silent
  fallback to Gemini or local in the honest path — OpenAI errors surface in full.
- **`furniture@8`** prompt ([`lib/asset-pipeline/furniture-8.ts`](../lib/asset-pipeline/furniture-8.ts)): explicit
  priority order (transform while keeping identity), an object-specific identity block stated as *fact*, and
  **meaningfully different Preserve vs Simplify** instructions (unit-tested from the payload).
- **Honest orchestrator** ([`lib/asset-pipeline/honest.ts`](../lib/asset-pipeline/honest.ts)): ONE generation,
  cutout + original photo sent together, **no conform / no repair / no regeneration**. Native transparent
  background (`background:transparent`, `input_fidelity:high`). Framing only (trim + pad). Truthful metadata:
  model · latency · cost · retries · dims · true-alpha.
- **OpenAI route** ([`app/api/ai/generate/route.ts`](../app/api/ai/generate/route.ts)): server-side key only,
  multi-image edit, returns the real model + token usage → cost estimate.
- **Bench:** [`/dev/gpt-image`](../app/dev/gpt-image) — both mugs, every stage side by side, all metadata,
  errors never hidden. The human judges (nothing auto-scored/auto-selected).
- Editor create-flow now uses the honest path too.

## Result — the two mug tests (real `gpt-image-1`, furniture@8, Preserve)

- **Mug A** (cream, black B-handle, "Bitch"): black B-shaped handle ✓ · cream body ✓ · lettering preserved ✓ ·
  solid 3D ✓ · hand/curtain gone ✓ · belongs beside the official sofa/table ✓ — **PASS**.
- **Mug B** (face, red cheeks, Persian "بغل؟"): eyes & personality ✓ · red cheeks ✓ · Persian writing ✓ ·
  handle/opening ✓ · no duplicated face ✓ · premium 3D ✓ — **PASS**.
- Both `true alpha: native`, `fallback: no`, `retries: 0`, ~$0.35 / 50s per image. Visibly far beyond Gemini.

## Known / honest notes

- gpt-image-1 latency is ~50s and cost ~$0.35 at `quality:high`. On Vercel, the API route may need a raised
  `maxDuration` (serverless default can time out at 60s).
- The M36 Identity Lock code still exists but is **not run** in the GPT-Image path (by design — see the goal).
- Mug A's segmentation cutout still included a hand fragment; GPT Image dropped it anyway (furniture@8 forbids
  hands). A perfectly clean cutout would only help.

---

*Full orientation: [SESSION_HANDOFF.md](SESSION_HANDOFF.md) · founder's lens: [CEO_NOTES.md](CEO_NOTES.md).*
