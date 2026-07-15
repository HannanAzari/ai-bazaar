<!-- Governed by docs/design/NESTUDIO_WORLD_BIBLE.md — read that first, then LIVING_WORLD.md. -->
# Furniture Library — Craft Cycle 01

> **Authority:** subordinate to [NESTUDIO_WORLD_BIBLE.md](NESTUDIO_WORLD_BIBLE.md) and its sub-docs
> ([RENDERING_DNA](RENDERING_DNA.md) · [GEOMETRIC_ALPHABET](GEOMETRIC_ALPHABET.md) ·
> [ASSET_RULES](ASSET_RULES.md) · [CREATOR_TRANSLATION](CREATOR_TRANSLATION.md) ·
> [ART_DIRECTION_PROCESS](ART_DIRECTION_PROCESS.md)). This is the **production catalog** — the manufactured
> output, not a source of new rules. The Bible is locked; assets conform to it, never the reverse.

The transition from *inventing* to *manufacturing*. Craft Cycle 01 builds the Official Furniture Library —
assets that read as one studio's work, "That's a Nestudio object," without a logo.

## Status workflow

Nothing enters the library automatically. Every asset moves through:

```
Candidate → Review → Approved → Official        (rejected → Archived, never deleted)
```

- **Candidate** — freshly manufactured; unreviewed.
- **Review** — scored against the [evaluation scorecard](ART_DIRECTION_PROCESS.md#evaluation) + the
  3-second silhouette test + the "would another company ship this?" consistency test.
- **Approved → Official** — passes every gate and coheres with the existing library.
- **Rejected → Archived** — kept as **learning material** (documented below), never deleted.

State of record: `public/test-photos/library/manifest.json`. Visual board:
`public/test-photos/furniture-library-board.html`. Production line: `scripts/craft-cycle.mjs`.

## Production pipeline (per asset — obeys the locked Bible)

```
Subject → Identity extraction → Remove noise (logos/text/damage) → Keep identity
→ Translate into Nestudio DNA (Pebble·Capsule·Arch, matte, warm, 10° life-sim camera)
→ Generate → Art-Direction review → Silhouette review → Library approval → Publish
```

Only the alphabet ([Pebble · Capsule · Arch](GEOMETRIC_ALPHABET.md)) and the locked
[Rendering DNA](RENDERING_DNA.md) are used. Never glossy, never photoreal, never a product shot — always
soft, warm, matte, calm, crafted, timeless.

## Catalog — Official (14)

**Kitchen (7):** Coffee Mug · Teacup · Cereal Bowl · Dinner Plate · Kettle · Teapot · Water Bottle
**Living Room (7):** Stack of Books · Potted Plant · Picture Frame · Table Vase · Mantel Clock · Candle ·
Speaker

All share: one warm off-white body + a single terracotta accent · a deeply matte hand-painted finish · soft
single-radius forms lifted on small feet · arch handles/openings only where the real object has them.

## Archive — Rejected (kept as learning material)

| Asset | Reason rejected | Lesson |
|---|---|---|
| Teacup v1, Cereal Bowl v1, Dinner Plate v1, Kettle v1, Water Bottle v1 | shape rules **over-applied** — pedestal sprouted extra legs (creature look), cut-out carved holes into solid bodies (pierced plate), ambiguous silhouettes | **Identity-first.** The alphabet is a *vocabulary, not a mandate*: no extra legs, one handle max, cut-outs only where a real object has an opening, sit level. Prompt tuned to v2; all five passed on re-manufacture. |
| Candle v1 | read as a lidded pot, not a candle | simple objects need an explicit identity cue (a visible flame) |
| Bookshelf Speaker v1 | fine mesh cone texture + sheen + a baked drop shadow → looked like **another company's product render** | the consistency test working as intended — matte + no fine photographic texture; re-manufactured matte and approved |

## Production learnings

1. **Identity before alphabet.** The single biggest failure mode was the shape language overriding the
   object's identity. Fixed by ordering the prompt "read as a `${subject}` FIRST, then speak the language."
2. **The consistency test earns its keep.** The speaker was technically fine but *off-family* — exactly the
   "belongs to another company" reject the brief calls for.
3. **⚠️ Assets are not yet true transparent PNGs.** The raw generation route (`/api/ai/generate`, used by
   the production script) returns **opaque JPEGs with a painted fake-transparency checker** — real
   transparency comes from the app pipeline's `removeBackground` step, which this raw line bypasses. So the
   silhouette panel on the board is partially unreliable (the keyer fails on denser painted checkers), and
   **these candidates must pass through `removeBackground` (cut-out) before they are truly library-ready.**
   This is the top hardening item for the next cycle — see recommendations. It does **not** affect the proven
   result: the *family/rendering consistency* is real and visible on the tint board.

## Success criterion

> "If someone sees 20 Nestudio furniture pieces side by side, they immediately believe they were designed by
> the same studio."

Craft Cycle 01 reaches 14 official pieces across two categories that pass this test on the tint board. The
cycle continues (Office, Decor, and more Kitchen/Living variety) toward ~100, in batches of 5–10, each
reviewed before the next — never generate 100 at once.
