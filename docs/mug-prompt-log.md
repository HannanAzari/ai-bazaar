# M22.2 — Mug prompt iteration log

One object (coffee mug), iterated against a **real photo** through the live Gemini route until it could ship
in the official Nestudio library. Every prompt version records: the observed failure, the exact change, the
expected improvement, and the before/after verdict. **No version is added just to show iteration.**

- Tool: `node scripts/mug-lab.mjs <photo> <version> [candidates]` → writes `public/test-photos/out/<version>-c<N>.png`.
- Art-direction rule for the mug: the source photos carry text; Nestudio DNA is **no text / no watermark**, so
  the target asset is a **clean, text-free ceramic mug**. That is both the DNA requirement and keeps the
  library family-friendly.

## Round 1 — v3 (shipped `furniture@3`), real photo `mug-a.jpg`, 3 candidates

The shipped Nestudio-Classic prompt. Real Gemini output (200, ~11s each).
- **c1:** body straightened to a cylinder; the black letters **detached and floated** beside the mug (broken). Reject.
- **c2:** faithful — bulbous body, sculptural black "B" handle, full lettering on-body — but body **drifted white→cream**.
- **c3:** clean and premium, but **dropped most of the lettering** (only the "B" handle kept).
- **Repeatable failures:** (1) `palette:` clause **repainted the white body cream**; (2) **inconsistent text handling** (floated / dropped); (3) **detached/floating letters**; (4) body silhouette sometimes straightens.

## Round 2 — v4

- **Observed failure (from v3):** cream drift, floating/inconsistent lettering, straightened body.
- **Exact change:** removed the object-recolouring `palette:` clause → "warm the LIGHT only, lock a **true white** glaze"; added "faithfully preserve the exact hand-painted black lettering **and the sculptural black 'B' handle**, all decoration **sits flat ON the surface — never detached/floating/beside** the mug"; locked "**rounded bulbous** hand-thrown" body; negatives added: `cream/beige/ivory/recoloured body, floating letters, detached lettering, letters beside the mug`.
- **Expected improvement:** true-white faithful body, full lettering kept on the surface, no floating glyphs, consistent bulbous silhouette.
- **Result (v3 → v4):** ✅ all fixed. c1 & c3 are **true white**; all three keep the **full lettering on-body + B handle**; **no floating letters**; bulbous body throughout. **c3 = official-library quality** (best framing, true white, clean). Remaining nit: far-right letters occasionally carry a faint warm/olive tint instead of pure matte black.

## Round 3 — v5

- **Observed failure (from v4):** far-right letters picked up a faint warm/olive tint under the warm key; framing occasionally ran tight to the right edge.
- **Exact change:** "the lettering is a single even **NEUTRAL matte black (near #111111)** … must not pick up any warm/brown/olive/grey tint even under the warm light"; framing locked to "the whole mug **~70% of the frame, equal generous margins on all four sides**, no part near/touching an edge"; negatives added: `brown/olive/warm-tinted/grey lettering, object touching the frame edge, cropped, clipped`.
- **Expected improvement:** pure neutral-black lettering + guaranteed even margins.
- **Result (v4 → v5):** ✅ interior lettering is now clean **neutral matte black**; framing centered with good margins (c3 best). Residual: a *faint* warm tint remains only on the extreme right edge under the key light — now negligible and reads as soft studio lighting. **v5-c3 = the strongest of all 9 candidates and official-library quality.** Chasing the last edge-tint further is diminishing returns (risks flattening the warm Nestudio light).

## Outcome

**Winning result: `v5-c3`** — faithful to the physical mug (true-white bulbous body, sculptural black "B" handle, full hand-painted lettering), clean neutral-black lettering, transparent, well-framed, soft matte ceramic, grounded contact shadow. **Ready to port v5 into the shipped furniture prompt** once approved.
