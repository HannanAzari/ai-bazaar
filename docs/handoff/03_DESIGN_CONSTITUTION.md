# 03 · DESIGN CONSTITUTION

> The single, consolidated, permanent design system. All approved philosophy in one place.
> This supersedes the separate philosophy/alphabet/grammar/interaction/sound documents — they were merged here. **Do not re-fragment it.**

---

## I. Product philosophy

Nestudio is a **digital home**, and a Nest is a **self-portrait made of objects**. Every object must justify itself by answering one question:

> **"What does this reveal about the creator?"**

We are building the **visual language of digital identity** — not an asset library, not a furniture catalogue, not The Sims, not a metaverse. The promise every part of the system must keep: **a Nest feels beautiful before a single creator edits it.** Coherence by construction, not by user skill — the way Apple, Nintendo, Animal Crossing, IKEA and Muji feel coherent.

## II. The Alphabet of digital identity

Objects are **letters**. The vocabulary is small and expressive, like emoji: **≈57 objects, capped ~60**, enough for 95% of creators to build a personal Nest. **Coverage over quantity. If a new object doesn't add a new letter, it doesn't ship.** Objects are **iconic glyphs** — bold, readable, one signal detail — **not photoreal replicas**.

**Four classes** (a class is what an object *means* — intrinsic, fixed):

| Class | Role | Brand policy |
|---|---|---|
| **Story** (≈18) | Atmosphere — mood and taste. Mostly static. | Generic |
| **Identity** (≈21) | The "I am a ___" statement — the strongest declarations. | **Keep premium brands** where the choice signals identity (Canon vs Sony, PS5 vs Xbox, iPhone vs Galaxy) |
| **Portal** (≈8) | Interactive surfaces that connect to real digital content — the **UI** of Nestudio. | Preserve form where it's also Identity; else generic |
| **Memory** (≈10) | Objects that accumulate life; emotional. Tap reveals an **internal** memory, never an external link. | Generic, personal, one-of-a-kind |

The canonical vocabulary + per-object attributes live in the machine-readable spec (`nestudio-alphabet-spec.json`, referenced from `04`).

## III. Nest Grammar — the 12 laws

Grammar is how letters combine into a coherent, beautiful room. **Class (intrinsic meaning) is orthogonal to Role (contextual visual weight).** A Canon camera is always an *Identity* object; it is the **Hero** in a photographer's Nest and merely **Supporting** in a musician's. The composition system assigns roles.

**Five visual roles** (by how loud an object may speak): **Hero** (the thesis, one per room, dominant, haloed by space) · **Supporting** (context, clustered with the hero) · **Atmosphere** (mood, edges, quiet) · **Memory** (small, discovered on approach) · **Background** (the stage, competes with nothing).

**Composition recipe (one Nest):** 1 Hero · ~2 Portals · 5–8 Story · 2–4 Memory · **~12 objects total** · **≥40–55% empty surface** · asymmetric balance · 2–3 clusters with breathing space · one feature wall · one open corner · readable floor.

**The 12 laws:**
1. Class is what an object means; role is how loud it may speak.
2. A Nest is a subset, not a collection — twelve chosen objects beat sixty dumped.
3. One voice at full volume; everything else a whisper. (One primary focal point = the Hero; one secondary = a glowing Portal.)
4. The editor is a stylist, not a blank canvas.
5. Objects have friends; coherence is the friendship graph made visible.
6. Empty space is the frame that makes an object worth looking at — restraint creates identity, emptiness reads as luxury.
7. Visitors don't click a Nest; they wander it.
8. One hand authored this world — every motion proves it. (One interaction language.)
9. Sound confirms and warms; it never performs.
10. The background is a whisper; the objects speak.
11. A business Nest is a boutique you wander, not a billboard you skip.
12. Instagram is where you post. Nestudio is where you live.

## IV. Interaction philosophy

Every interaction feels authored by **one hand** — a single physics for the whole world. Durations ~200–300ms (focus) to ~400–650ms (content reveal), never past ~800ms. **Soft easing** (ease-out entrances, restrained spring settle; never linear or hard snaps). Motion = position/scale/opacity/small rotation with gentle weight — no spins, no flips, no violence. **Light is the primary feedback** (a warm glow bloom; screens wake with a spill). Particles rare and soft; one warm glow colour, never neon. Content **grows out of the object**, never a modal slamming in. The feeling is fixed: **calm, warm, premium, confident — nothing flashy.**

## V. Sound philosophy

Nestudio's sound identity = **Nintendo × Apple × Muji**: tiny, warm, premium, never annoying. Every sound < ~400ms, soft-attacked, low, organic (foley, not synth beep), mutable, spatial. **Material-based palette**, inherited by an object's material: wood (soft knock) · glass (gentle clink) · fabric (muffled whump) · metal (matte tap) · electronics (warm click/hum/unlock) · paper (page turn) · music (needle-drop/pluck) · nature (leaf rustle) · **memory (a warm swell / music-box note — the "heart sound")**. Optional low ambient bed per background (café murmur, rain). One tiny arrival signature — Nestudio's version of the Switch click. **Sound confirms and warms; it never entertains or demands.**

## VI. Business philosophy

Businesses build Nests too, with the **same** system. A business Nest is the brand's **home, not a billboard**. **Products become identity, not advertisements** — a coffee bag on the shelf, the espresso machine as Hero — discovered by wandering, never popped up. **Discovery is pulled, not pushed**: curiosity leads (tap the machine → its story → "our beans" → optionally the shop/Instagram/YouTube). The CTA is earned. Same grammar (one Hero, restraint, negative space), same warmth. That warmth is the moat a link page can't build. No dark patterns; discovery is genuine.

## VII. Memory philosophy

Memory objects **accumulate life** — a shelf gains trinkets, a corkboard gains notes, a trophy case fills. Tap reveals an **internal** memory (a photo, a note, a short story) — **never an external link**. The payoff is emotional and kept inside Nestudio. They start sparse and grow with the creator's history: the passage of a life, made visible. This is the emotional-retention layer no competitor has.

## VIII. The moat (why it can't be confused with anything else)

- **vs Instagram** — a feed of moments (performance, scroll, anxiety) vs a place of identity (presence, coherence, calm). You dwell, not scroll.
- **vs Linktree** — a utility menu vs an experience. Links are a byproduct of curiosity.
- **vs Pinterest** — others' inspiration aggregated vs your identity authored.
- **vs Rooms.xyz / Spatial** — open sandboxes (freedom → incoherence, empty worlds) vs grammar-guaranteed, human-scale, beautiful-by-default rooms. Not a metaverse — a portrait.

**The feed made us perform. Nestudio lets us simply be, somewhere.**
