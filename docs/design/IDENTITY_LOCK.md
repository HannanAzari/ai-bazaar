<!-- Governed by docs/design/NESTUDIO_WORLD_BIBLE.md — read that first. -->
# 🔒 Identity Lock Pipeline (M36)

> **Status: implemented, gates green, but the mug test does NOT yet fully pass — HELD, not pushed.**
> Priority order: **IDENTITY > FUNCTION > Nestudio DNA.** Style may only change finish, edges, lighting,
> material and polish — it must never redesign or recolour the object's critical identity. Code:
> [`lib/identity/`](../../lib/identity). No prompts were tweaked by adding adjectives; this is architecture.

## The pipeline

```
photo → segmentation → identity extraction → identity CONTRACT (immutable)
      → single generation (cutout + original + mask + identity-constrained prompt)
      → identity validator (Gate 1, HARD) → targeted repair (only the failing area)
      → style validator (Gate 2, report) → finished asset
```

**One generation + one optional targeted repair.** No regenerate-until-acceptable loop (that wasted tokens
and lost identity — each retry fixed one thing and broke another).

## 1. Identity Contract — [`extract.ts`](../../lib/identity/extract.ts)

Structured data, never prose: `objectType`, `silhouette` (mask + aspect), `colours` (dominant clusters WITH
spatial regions + coverage), `criticalColours` (distinctive darks/lights/saturated that MUST survive),
`hasGraphics` (lettering detected), `preserveDetails`, plus re-appliable **identity/detail layers**. For the
mug this recognises: cream body, black handle region, black lettering marks, the cup silhouette. Immutable.

## 2. Identity-constrained prompt — [`prompt.ts`](../../lib/identity/prompt.ts)

Assembled FROM the contract as immutable constraints ("keep its colours where they are; the black parts must
stay black; keep the lettering; Nestudio may only change finish/edges/lighting/polish"), prepended to the DNA
prompt. Not adjective-piling.

## 3. Original + mask + cutout to the model

The route + Gemini provider now accept the **original photo and mask** alongside the cutout
([route](../../app/api/ai/generate/route.ts) · [shared](../../lib/asset-pipeline/providers/shared.ts)) — the
original carries information the cutout loses.

## 4. Identity Validator (Gate 1) — [`validator.ts`](../../lib/identity/validator.ts)

**Hard pass/fail, never a weighted score.** Checks silhouette (IoU), critical colours (present in ~the right
place + amount), proportion, and graphics/lettering (when Preserve Details is on). ANY failure → Gate 1 fails
→ targeted repair. Runs BEFORE the style gate.

## 5. Targeted Repair — [`repair.ts`](../../lib/identity/repair.ts)

Never rebuilds the whole asset. Repairs only the failing dimension by **re-applying the source's own critical
regions** (the black handle, the lettering), bbox-aligned + matte-adapted onto the styled body, and clipping
drift back to the source silhouette. Zero extra generation cost. This is where "the handle stays black" is
guaranteed — we enforce identity in post, never trusting the model.

## 6. Style Validator (Gate 2)

The Art Engine gate ([art-engine](../../lib/art-engine)) runs only after identity is enforced — report only,
no regeneration (identity is already locked).

---

## Honest status — the mug test

The mug test passes ONLY if, with ≤1 generation + 1 optional repair: black B-handle stays black · B silhouette
intact · lettering preserved (Preserve Details) · cream body cream · belongs beside official assets.

**Current measured result (in the internal test harness):**
- ✅ **Black handle preserved** (~13% black present — the identity prompt + original/mask + repair hold it).
- ⚠️ **Cream body** borderline; **lettering** borderline-absent; **style** reads *off-family* (identity>style
  trade-off, worsened by the harness).
- **The available harness (`/dev/art-engine`) is confounded:** it uses `autoCutout`, which keeps the *hand* in
  the mug photo. The faithful test is the **editor** flow, which segments the mug cleanly (tap-to-select) — but
  that flow could not be driven to completion in this environment (the editor navigated away mid-generation),
  so a clean end-to-end pass was not verified.

**Per the sprint instruction ("do not push until the mug test passes"), this work is HELD and NOT pushed.**
Remaining to close it: verify (and if needed tune the repair alignment) on a **clean segmented mug cutout**
(the real editor path on a phone), where the hand is excluded and the identity layers align to the object.
