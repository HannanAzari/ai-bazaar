<!-- Governed by docs/design/NESTUDIO_WORLD_BIBLE.md — read that first. -->
# Geometric Alphabet

> **Authority:** subordinate to [NESTUDIO_WORLD_BIBLE.md](NESTUDIO_WORLD_BIBLE.md).
> **Companion to:** [VISUAL_DNA.md](VISUAL_DNA.md) (why forms feel the way they do),
> [PHYSICS_DNA.md](PHYSICS_DNA.md) (how they behave), [RENDERING_DNA.md](RENDERING_DNA.md) (how they are lit).
> **Frozen:** M25. Supersedes `docs/nestudio-alphabet.md` (now a redirect stub).

Every Nestudio object is assembled from a tiny set of geometric **primitives** — the letters of the
alphabet. Pixar had the Luxo lamp; LEGO has the brick; Nestudio has three letters. A small alphabet is
what lets a mug, a lamp, a chair, a house and a tree read as **one family from silhouette alone**.

## The three letters (current, frozen)

| Letter | Name | Role | It builds |
|---|---|---|---|
| **I** | **Pebble** | the **MASS** | bodies, bases, seats, canopies, domes, roofs-as-mass |
| **II** | **Capsule** | the **LIMB** | legs, stems, trunks, uprights, stacks, chimneys |
| **III** | **Arch** | the **SPAN** | roofs, doorways, chair backs, handles, bridges, openings |

Hero renders (reference, do not treat as production assets):
`public/test-photos/out/alpha-hero-{pebble,capsule,arch}-c1.png`. Full discovery board:
`public/test-photos/alphabet-board.html`.

### Letter shapes (schematic)

```
  PEBBLE (mass)        CAPSULE (limb)        ARCH (span)
     .-''''-.              .--.                _.-''-._
    /        \            |    |             .'        '.
   |          |           |    |            /   .----.   \
    \        /            |    |           |   /      \   |
     '-....-'             |    |           |  |        |  |
                          '--'             '--'        '--'
   one calm ovoid      upright pill      plump horseshoe portal
   single radius       rounded ends      two thick legs + opening
```

## How they combine

Objects are **compositions** of the three letters, then rendered in the [RENDERING_DNA.md](RENDERING_DNA.md)
finish and governed by the [PHYSICS_DNA.md](PHYSICS_DNA.md). The M24 shape rules are simply *how the letters
are arranged*:

- **Pedestal rule** = a Pebble lifted onto a Capsule (never sitting flat).
- **Cut-out rule** = an Arch subtracted from a Pebble (negative-space handle/opening).
- **Single-radius rule** = every letter shares one soft corner radius, so joints read as one hand.

Speculative assemblies (sketches only — see the board; **not** production assets):

| Object | Assembly |
|---|---|
| Mug | Pebble body · Capsule foot · Arch handle |
| Lamp | Pebble base · Arch arm · Capsule head |
| Chair | Pebble seat · Capsule legs · Arch back |
| Shelf | Capsule uprights · Pebble slabs · Arch top |
| House | Pebble body · Arch roof + door · Capsule chimney |
| Tree | Capsule trunk · Pebble canopy |

## Why exactly three (what was destroyed)

M25 generated ~80 pure abstract forms across nine geometric languages and silhouette-tested each.
Six languages were destroyed because they were **redundant, unstructural, or not forms at all**:

- *Ceramic primitives* (egg/sphere/dome) → the same atom as the **Pebble**.
- *Softened polygons* → a squished Pebble; cornered and cool.
- *Melted clay* → no crisp silhouette (reads as a lump — fails the silhouette law).
- *Nested rings* → decorative, not structural.
- *Carved voids* → an **operation** (Pebble − Arch), already the cut-out rule.
- *Impossible balance* → a **relationship** (pedestal), already the shape rule — not a letter.

The survivors are a **mass**, a **limb**, and a **span** — the minimal grammar that can build a world.

## Adding a future primitive (governed change)

The alphabet is deliberately small. A fourth letter is a **major DNA change** and follows the full
[ART_DIRECTION_PROCESS.md](ART_DIRECTION_PROCESS.md) approval flow. Admit a new primitive **only** when:

1. A real, needed object **cannot** be expressed by Pebble + Capsule + Arch (e.g. a genuinely new
   behaviour: a *sheet/plane* for fabric, a *filament* for very thin wire, a *lens* for glass).
2. It passes the **3-second silhouette test** as a distinct, lovable, timeless form.
3. It composes with the existing three without breaking family resemblance.
4. It is logged with a hero render, a silhouette, and a CHANGELOG entry, and the World Bible + this
   document are updated in the same change.

Prefer **combining existing letters** over adding a new one. The moat is the *smallness* of the alphabet.
