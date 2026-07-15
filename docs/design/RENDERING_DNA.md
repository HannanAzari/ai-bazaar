<!-- Governed by docs/design/NESTUDIO_WORLD_BIBLE.md — read that first. -->
# Rendering DNA

> **Authority:** subordinate to [NESTUDIO_WORLD_BIBLE.md](NESTUDIO_WORLD_BIBLE.md).
> **Camera is IMMUTABLE:** the camera/perspective section below is the current top authority and inherits
> [`../nestudio-camera-dna-lock.md`](../nestudio-camera-dna-lock.md) verbatim. If any other doc states a
> different camera, **this one wins.**
> **Palette & lighting inherited from** [`../nestudio-visual-dna.md`](../nestudio-visual-dna.md) (do not
> redefine hex values elsewhere).

How a Nestudio form becomes a finished pixel. Everything here is a **locked rule**. The pipeline never
changes; a new look is a new *prompt version* under [ART_DIRECTION_PROCESS.md](ART_DIRECTION_PROCESS.md),
never an engine edit.

---

## 1. Colour — the canonical palette

All hex values originate in [`../nestudio-visual-dna.md`](../nestudio-visual-dna.md). Never invent a new
Nestudio colour in code or a prompt; pull from here.

**Warm neutral base (bodies, walls, ground):**
`#faf1dc` parchment-light · `#f2e4c4` parchment · `#e3cfa3` parchment-deep · `#f0dfbc` plaster · `#c7b393` stone

**Ink (line, deep accents):** `#38291d` ink · `#6b5847` ink-soft

**Light & glow:** `#fff6e0` warm light · `#f6d8a8` dusk · `#ffc55c` lantern · `#e08f3f` ember

**Signature shadow:** `#46365a` **cool-plum** — the shadow is *never neutral grey*. Warm light + cool-plum
shadow is the single strongest unifier of the whole world.

**Environment:** meadow `#b5c77d`/`#93ac5f`/`#6e8a47`, canopy `#4e6b3a`; water `#8fc4d6`/`#5d93ac`; roofs
terracotta `#a65b3f`, slate `#5b6b73`, thatch `#c9a35c`, green-shingle `#6b7f4f`; timber `#8a5c3b`/`#5c3e26`.

**Ten personality accents (one per object, max):** sage · caramel · dusty lilac · mustard · rust · teal ·
cobalt · emerald · electric violet · clay terracotta.

**Colour laws.** One restrained warm palette. **One accent per object**, never more. Nothing fully
saturated; no pure white, no pure black, no pure RGB. An object keeps its **own true colours** — only the
*light* is warm; the object is never recoloured or tinted by the palette (the hard-won M22 fidelity rule).

---

## 2. Lighting

- **Key:** a single **soft warm key from the upper-left** (`#fff6e0`). No rim light, no HDR, no studio
  softbox, no dramatic light.
- **Ambient occlusion:** gentle, warm, pooling in crevices, undersides and the inside of cut-outs — a soft
  painterly terminator that models volume. AO reads as *hand-painted shading*, not a render pass.
- **Shadow tone:** cool-plum `#46365a`. Warm light → cool-plum shadow two-tone everywhere.

## 3. Material

- **Deeply matte, hand-painted finish** with a soft chalky surface and gentle visible brush shading — like
  a hand-crafted illustrated toy. **Never** glossy, plastic, chrome, wet-look, specular, or reflective.
- Only a soft powdery grain; no photographic texture, no procedural noise.
- **Material diversity, not "oak everywhere"** (per the camera lock): flooring/walls/finishes vary widely
  (timber, concrete, stone, ceramic, terrazzo, plaster, brick, fabric, etc.). The *finish language* (matte,
  hand-painted) is constant; the *material* varies with the object.

## 4. Ambient occlusion & Shadows

- **Self-shadow / AO:** warm, soft, in-form (see §2).
- **Contact shadow:** cool-plum `#46365a`, **alpha ≈ 0.18–0.28**, an ellipse ~0.8–1.0× object width, height
  ≈ 0.18–0.25× width, soft blur, offset slightly down-right. It is **engine-composited, never baked into the
  asset PNG.** One soft grounded contact shadow; never floating, never a dramatic cast shadow.

  > ⚠️ **Known deviation (do not silently ignore).** The current object prompt `furniture@6` instructs
  > "one soft grounded contact shadow directly beneath." A grounded shadow baked into the asset conflicts
  > with the "no baked shadow / engine-composited" rule. Reconcile in a future prompt version — see
  > [ART_DIRECTION_PROCESS.md](ART_DIRECTION_PROCESS.md) and the World Bible's open-gaps list. **Not changed
  > this sprint (M26 is documentation-only).**

## 5. Transparency

- Assets are delivered as **isolated transparent PNGs** — no scene, no ground plane, no baked background,
  no text, no watermark.
- The generator's raw output may arrive opaque (some providers paint a fake transparency checker); real
  transparency is produced by the pipeline's `removeBackground` step, not by the model. Never ship an
  opaque asset.

## 6. Camera & Perspective — IMMUTABLE (inherits the Camera DNA lock)

The finalized camera language for **every** Nestudio background and asset — an **Animal Crossing–inspired
life-simulation camera.** It must never change again. *If an asset is beautiful but the perspective is
wrong, REJECT IT — perspective conformance outranks object quality.*

| Parameter | Locked value |
|---|---|
| Camera height | ~**180 cm** (standing human viewpoint) |
| Downward tilt | **8–12°, target 10°** |
| Perspective | **slightly elevated, front-facing**, subtle natural convergence |
| Focal length (equiv.) | ~**35–40 mm** (no wide-angle distortion) |
| Horizontal position | centered |
| Aspect (scenes) | portrait **3:4**, mobile-first |

**Slightly-elevated ⇒ visible top surfaces:** desk/table tops fully visible · rugs from above with visible
thickness · sofa cushion tops partially visible · shelves seen slightly from above. Every asset shares the
**same camera height, 10° tilt, horizon and light direction** as the backgrounds so it sits in the world.

**The validation question for every asset:** *"Would this look natural inside Animal Crossing?"* If no →
reject and regenerate.

  > ⚠️ **Known deviation.** `furniture@6` says "front-facing, **eye-level**." The lock requires **slightly
  > elevated (10° tilt) with visible top surfaces**, and lists "eye-level furniture photos" as *forbidden*.
  > Reconcile in a future prompt version (see open-gaps). Not changed this sprint.

## 7. Composition

- Object centered, whole object visible, **generous even margins on all four sides**, nothing clipped or
  touching an edge (the ~70% framing rule).
- Backgrounds are **game environment stages**: back wall ~70% of frame width, ~15% each visible side wall,
  a clear central placement zone, furniture minimal/ideally none baked in. Personality via **architecture**
  (materials, lighting, windows, trim, arches, shelving), not large furniture.

## 8. Allowed vs Forbidden styles

**Allowed:** stylized life-sim game look (Animal Crossing / The Sims); matte hand-painted illustrated-toy
finish; soft warm key + cool-plum shadow; rounded single-radius forms; calm premium restraint.

**Forbidden (reject on sight):** photorealism / product / catalogue / ecommerce photography · glossy /
plastic / chrome / wet-look / specular · HDR / studio softbox / rim / dramatic light · isometric or ~30°
parallel · straight orthographic / eye-level furniture photos · wide-angle distortion · strong cinematic
perspective · busy or opaque backgrounds · baked scene/text/watermark · more than one accent colour ·
pure white / pure black / fully saturated colour · trend-chasing visual gimmicks.
