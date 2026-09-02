# Studio View (landscape) — future design note

**Status: RECORDED, NOT SCHEDULED.** Nothing here is a task. It exists so that decisions
taken *now* — mainly about how backgrounds are generated — do not make this expensive later.

Date recorded: 2026-09-03 · Author: founder · See `07_DECISIONS` D45.

---

## The idea

A **landscape "Studio View"** for both surfaces — the editor and the visitor Nest. A room
seen wide, the way a studio or a living space is actually seen, rather than through a
portrait window.

**Portrait remains supported.** This is an additional view, not a replacement. A Nest
authored in portrait must keep working, unchanged, forever.

## The hard constraint — do not act on this yet

**Do not change the frozen 3:4 scene architecture.** `EDITOR_BETA_V1_FREEZE.md` §1 stands
in full: the canonical 3:4 scene, `0..1` normalisation, geometry stored as the creator's
actual box, the Stage outside the document, the camera never persisted.

Every stored Nest is written in that coordinate system. A second aspect is a *view* problem
before it is a *document* problem, and the freeze document exists because changing one of
these contracts has repeatedly broken another. When this is scheduled, it starts with a
written plan for what a landscape view does to existing documents — not with a code change.

## What to do now instead — background composition

The one thing that is cheap now and expensive later is **how new backgrounds are composed**.
The guidance, for the Nest/Background pipeline:

1. **Generate from a wider master composition.** A background should preferably originate
   as a wider image (landscape master) that contains a **strong 3:4 central safe area**.
   The portrait Nest is a crop of the master; a future landscape Studio View then reveals
   more of the *same room* rather than needing every background regenerated.
2. **The 3:4 safe area must stand alone.** The crop has to be a complete, well-composed
   room by itself — correct camera, correct horizon, nothing important half-cut at the
   crop edge. A master that only works wide is a failed master.
3. **Keep the canonical camera.** Wider does not mean a different camera, a different eye
   height, or a different perspective. Same camera, more of the room.

## What to do now — more "canvas rooms"

**Increase the share of simple canvas rooms**: clean walls and floor, generous negative
space, and **less baked-in decoration**.

A room dense with pre-painted furniture leaves the creator nowhere to put themselves, and
every baked-in object is one the creator cannot move, connect, or remove. The objects are
the alphabet; the room is the page. Lean rooms also crop and re-crop far better, which is
what makes point 1 above work.

This is a **mix** instruction, not a ban on characterful rooms — some Nests want a strongly
authored space. It shifts the ratio toward rooms that get out of the way.

## Open questions, to answer when this is scheduled

- Does a landscape view show more room (wider crop of the master), or the same room larger?
  These are different products; the first needs the master, the second needs nothing new.
- What happens to a Nest authored in portrait when viewed in landscape — letterbox, or
  reveal? Reveal requires background pixels that may not exist for older backgrounds.
- Does the editor author in landscape, or only *view* in it? Authoring in two aspects means
  two safe areas, and that is a document-level change.
- Device orientation lock: today the app assumes portrait. Which surfaces unlock, and does
  a mid-session rotation preserve the camera?

None of these are answered here on purpose.
