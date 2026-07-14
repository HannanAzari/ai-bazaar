# M22 — Production AI Art Direction (2026-07-14)

Branch `m12-nest-platform`, **preview only**. This was an **art-direction** sprint, not an engineering one
(≤20% code): no new features, no new infrastructure — the M20/M21 engine already exists. The whole job was
to make generated objects read as *"this belongs to Nestudio,"* and to prove it by generating a full
collection that looks like one artist made it.

> North star: someone seeing one generated asset, without context, thinks **"Nestudio"** — never "AI".

## The locked visual language (Phase 3/4 — "Nestudio Classic")

Every object is forced into one language by two locks that apply identically to all of them:

1. **Master prompt `furniture@3`** ([lib/ai/prompts.ts](../lib/ai/prompts.ts)) — the DNA the hosted model
   consumes: front-facing, centered, soft warm upper-left key, subtle AO, one soft grounded contact shadow
   (never floating), **soft matte only — never glossy/plastic/chrome**, rounded restrained proportions, no
   unnecessary detail, **gently desaturated warm-neutral palette, never exaggerated saturation**,
   transparent, no text/watermark, and framed as *"one asset in the Nestudio Classic collection… as if
   handcrafted to sit beside their other objects."*
2. **Tonal lock** ([lib/ai/canvas.ts](../lib/ai/canvas.ts) `paletteLock` + `relight`) — the treatment the
   local provider applies, and the same params travel in the prompt so hosted output matches: a **whisper**
   of warm form-light, saturation calmed + capped, cool casts warmed toward parchment/clay, and — the key
   coherence move — **neutrals warmed** (grey pixels pick up a parchment bias, so a grey camera joins the
   same warm family as the clay mug). One soft grounded contact shadow on every asset.

## Prompt version history (Phase 2 — the iteration lab)

| ver | change | why |
| --- | --- | --- |
| furniture@1 | baseline "clean placeable asset" | read generic/AI; inconsistent tone + framing |
| furniture@2 | explicit framing/lighting/shadow | better, but drifted on saturation + material feel |
| **furniture@3** | palette + saturation ceiling + "no gloss / no exaggerated saturation / no extra detail" + "calm, premium, timeless, part of a matching set" | **locks the collection to one language, not just per-asset nice** |

## The consistency test (Phase 7) — the actual work

An internal art-direction tool ([/creator-studio/review](../app/creator-studio/review), dev-mode) generates
the whole [12-object collection](../app/creator-studio/reference-collection.ts) (mug, book, camera,
controller, keyboard, headphones, plant, chair, lamp, guitar, notebook, clock) and lays it on a Nest tint
beside an **Official Nestudio reference** strip, so coherence is judged at a glance. I iterated four rounds,
critiquing the grid each time:

- **R1** — coherent palette + shadow, but a hard **diagonal light-sweep** on flat faces and **neutrals
  drifting cold grey**.
- **R2** — warmed the neutrals (fixed the cold outliers); light softened but diagonal still faint.
- **R3** — diagnosed the diagonal as the **posterize step banding the light ramp**, not the light itself.
- **R4** — removed posterize → clean matte faces. **All twelve now read as one artist's hand.** No object
  is tonally out of place.

## Other phases

- **P1** hosted-default: [lib/ai/provider.ts](../lib/ai/provider.ts) makes Gemini the default when opted in
  (`NEXT_PUBLIC_AI_PROVIDER=gemini` + server `GEMINI_API_KEY`); the engine **falls back to the local
  provider** on any hosted failure, so the Studio always produces an asset and the UI never changes.
- **P5/P8** reference + curation: the review panel shows the official reference, the generated collection,
  and toggles each asset on the Nest tint vs alpha for immediate quality judgement.
- **P6** iterative quality: reuses M21's generate→score→improve→keep-best.
- **P9** distraction removed: the Studio's pipeline-timing telemetry is now dev-only — the output is the hero.

## Honest note

A *truly generative* photo → new-3D-geometry leap needs the hosted model + an API key (not provisioned in
this environment). So the coherence proven here comes from (a) the locked tonal/light/shadow/framing
treatment and (b) in-DNA reference sources. The **furniture@3 prompt is the same art direction the hosted
model runs**, and the tonal params travel with it — so switching on a key lifts geometric richness to the
official bar while keeping this locked language.

## Gates
typecheck ✓ · lint ✓ · test **497** ✓ · build ✓. No new features/infra; quality only.
