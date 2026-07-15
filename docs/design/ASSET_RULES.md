<!-- Governed by docs/design/NESTUDIO_WORLD_BIBLE.md — read that first. -->
# Asset Rules — how each category interprets the same DNA

> **Authority:** subordinate to [NESTUDIO_WORLD_BIBLE.md](NESTUDIO_WORLD_BIBLE.md).
> **Companion to:** [VISUAL_DNA.md](VISUAL_DNA.md), [PHYSICS_DNA.md](PHYSICS_DNA.md),
> [GEOMETRIC_ALPHABET.md](GEOMETRIC_ALPHABET.md), [RENDERING_DNA.md](RENDERING_DNA.md),
> [CREATOR_TRANSLATION.md](CREATOR_TRANSLATION.md).

There is **one** DNA. Every category below applies the *same* Visual DNA, Physics DNA, Geometric Alphabet
and Rendering DNA — categories differ only in **which parts of the world they occupy** and **which
Alphabet letters dominate**. A category never gets its own palette, its own light, or its own camera. If a
category seems to need an exception, the exception is wrong.

**Universal rules (every category, no exceptions):** matte hand-painted finish · warm key + cool-plum
shadow · one accent max · single-radius soft forms · pass the 3-second silhouette test · obey all six
Physics laws · the immutable 10° life-sim camera · isolated transparent PNG (assets) with engine-composited
contact shadow.

---

## Furniture *(the enabled vertical — reference implementation)*
- **Dominant letters:** Pebble (seat/top) + Capsule (legs/uprights) + Arch (backs/frames).
- **Interpretation:** everyday objects re-authored as lovable Nestudio forms; the pedestal + cut-out shape
  rules apply directly. Visible top surfaces are required (desk top, seat surface, table top).
- **Prompt:** `furniture@6` (see [ART_DIRECTION_PROCESS.md](ART_DIRECTION_PROCESS.md#prompt-architecture)).

## Plants
- **Dominant letters:** Capsule (trunk/stem) + Pebble (canopy/pot).
- **Interpretation:** foliage is **massed**, not detailed — a Pebble canopy, not thousands of leaves.
  Living asymmetry gives gentle life; calm exaggeration keeps them friendly, never wild. One green accent.

## Decorations
- **Dominant letters:** Pebble, small.
- **Interpretation:** tiny, calm, characterful accents. The strongest test of restraint — a decoration must
  add warmth without adding noise. Never ornate. Removing detail is the whole job.

## Houses
- **Dominant letters:** Pebble (body) + Arch (roof + door) + Capsule (chimney).
- **Interpretation:** a house is a *big lovable object*, not architecture. Same inflation and soft gravity
  as a mug, at scale. Reads as home from silhouette. Personality via material + trim, not clutter.

## Architecture *(scenes / backgrounds)*
- **Interpretation:** backgrounds are **game environment stages**, not interior renders. Back wall ~70% of
  frame, ~15% each side wall, a clear central placement zone, furniture minimal/ideally none baked in.
  Personality via architecture (materials, windows, arches, shelving, lighting). Portrait 3:4, the 10°
  life-sim camera. This is the one category that is *not* an isolated PNG — it is the stage assets sit on.

## Avatars
- **Dominant letters:** Pebble (head/body) + Capsule (limbs).
- **Interpretation:** warm, rounded, characterful, friendly — the same softness and inflation as objects.
  Expressive but calm (never uncanny, never zany). Runtime-generated is acceptable here (the one place raw
  generation reaches users), still human-reviewable against the scorecard.

## Backgrounds
- See **Architecture** — backgrounds *are* the environment stages. Every asset must share the background's
  camera height, tilt, horizon and light direction so objects sit *in* the world, not *on* it.

## Tools *(creator / business objects)*
- **Dominant letters:** Pebble + Capsule + Arch as needed.
- **Interpretation:** cameras, mics, easels, shop goods — the widest identity range, so identity extraction
  matters most: keep the one signature feature, translate the rest. Still one family, one finish, one light.

## Interactive objects
- **Interpretation:** an interactive object is a normal asset that also carries a behaviour
  (**Object → Animation → Content** — TV → glow → video; lamp → light → ambience). The *visual* rules are
  unchanged; the interaction never distorts the DNA. Affordance is expressed through calm form, not through
  glossy "clickable" styling. Animations are lightweight and reduced-motion-safe.

---

## Adding a new category
A new category (e.g. vehicles, pets) is a **governed change** ([ART_DIRECTION_PROCESS.md](ART_DIRECTION_PROCESS.md)).
It must: (1) reuse the existing DNA unchanged, (2) declare its dominant Alphabet letters, (3) declare which
part of the world it occupies, (4) pass the same evaluation scorecard, (5) require **no** new palette,
light, or camera. If it can't, it isn't Nestudio yet.
