<!-- Governed by docs/design/NESTUDIO_WORLD_BIBLE.md — read that first. -->
# Creator Translation — how a real object becomes a Nestudio object

> **Authority:** subordinate to [NESTUDIO_WORLD_BIBLE.md](NESTUDIO_WORLD_BIBLE.md).
> **Companion to:** [GEOMETRIC_ALPHABET.md](GEOMETRIC_ALPHABET.md), [PHYSICS_DNA.md](PHYSICS_DNA.md),
> [RENDERING_DNA.md](RENDERING_DNA.md), [ASSET_RULES.md](ASSET_RULES.md),
> [ART_DIRECTION_PROCESS.md](ART_DIRECTION_PROCESS.md).

The core creative act of Nestudio: a creator brings a real object (a photo, an idea) and Nestudio returns
something that looks as if **Nestudio invented it from scratch** — recognizable, but unmistakably a member
of this one family. This is **translation, not reproduction.** Fidelity to the *identity* is sacred;
fidelity to the *photograph* is not.

> **The governing question at every stage:** *"If a child drew this object from memory after seeing it
> once, what would they remember?"* Keep exactly that. Discard the rest.

---

## The pipeline

```
   Reference image
        ↓   ① Identity Extraction    — what makes it itself?
   Identity
        ↓   ② Noise Removal          — delete everything incidental
   Essence
        ↓   ③ Shape Interpretation   — re-author the form in the Alphabet
   Nestudio form
        ↓   ④ Physics                — inflate, settle, soften, balance
   Living form
        ↓   ⑤ Rendering              — matte finish, warm light, cool-plum shadow
   Rendered asset
        ↓   ⑥ Cut-out & Compose      — isolate to transparent PNG, frame, ground
   Final asset  → Evaluation scorecard → Approve / Reject
```

### ① Identity Extraction
Name the **few** features that make the object read as itself — its essential silhouette, its one signature
feature, its character. Nothing else. (Mug → a rounded body + one distinctive handle. Not the brand, not
the exact glaze, not the printed words.)

### ② Noise Removal
Delete all incidental detail: logos, printed text, surface grime, photographic lighting, harsh contrast,
pure-white/pure-black values, busy patterns. *Removing is a design act; keep only what strengthens identity.*
This is where most of the "it looks AI / it looks like a photo cut-out" failures are prevented.

### ③ Shape Interpretation
Re-author the form in the [Geometric Alphabet](GEOMETRIC_ALPHABET.md): a **Pebble** mass, lifted on a
**Capsule** foot, with any opening as an **Arch** cut-out — one signature radius throughout. Do **not** copy
the reference's proportions or outline. The output must pass the **3-second silhouette test** as a Nestudio
form, not a scan of the original.

### ④ Physics
Apply the invisible rules ([PHYSICS_DNA.md](PHYSICS_DNA.md)): internal inflation, soft gravity, living
asymmetry, calm exaggeration, impossible stability, breathing negative space. The form stops looking
*modelled* and starts looking *alive and settled*.

### ⑤ Rendering
Apply [RENDERING_DNA.md](RENDERING_DNA.md): deeply matte hand-painted finish, single soft warm key from
upper-left, warm AO, cool-plum shadow, true object colours (only the light is warm), one accent max. Match
the **immutable camera** (10° slightly-elevated, visible top surfaces — *not* eye-level).

### ⑥ Cut-out & Compose
Isolate to a clean **transparent PNG** (`removeBackground`), centre with generous margins (~70% framing),
whole object visible, nothing clipped. Contact shadow is **engine-composited cool-plum**, not baked.

---

## What "translation, not reproduction" means (worked example — the mug)

The M22–M25 mug is the reference case (`docs/mug-prompt-log.md`, and the boards under
`public/test-photos/`):

1. **Reference:** a real ceramic mug photographed against a bright window, hand-painted with a word, held
   in a hand — a photograph full of incidental noise.
2. **Identity kept:** a rounded bulbous body + one thick sculptural handle.
3. **Noise removed:** the hand, the window, the printed word, the harsh contrast, the pure-white glaze.
4. **Shape re-authored:** a Pebble body lifted on a Capsule pedestal, with the handle as an Arch cut-out —
   a *new* silhouette that passes the 3-second test (M24), where the original was "just a mug."
5. **Physics + rendering:** inflated, settled, matte, warm-lit, cool-plum grounded.
6. **Result:** an object that could ship in an official Nestudio library and reads as one family with a
   lamp, chair and house it has never met — because they share the Alphabet, the Physics and the Rendering.

## Failure modes to reject at translation time

- **Reproduction, not translation** — output is a stylized photo of the reference (kept its exact outline,
  proportions, or logo). Fails silhouette originality.
- **Noise survived** — printed text, photographic lighting, or busy pattern carried through.
- **Off-family shape** — sits flat (no pedestal), sharp corners, thin fiddly handle (no Arch cut-out).
- **Recolour drift** — the palette repainted the object's true colours (only the *light* may be warm).
- **Wrong camera / baked shadow** — eye-level, no top surfaces, or a baked cast shadow (see the known
  deviations in [RENDERING_DNA.md](RENDERING_DNA.md)).

Every candidate is scored on the [Evaluation scorecard](ART_DIRECTION_PROCESS.md#evaluation) before approval.
