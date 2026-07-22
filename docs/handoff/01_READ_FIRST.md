# 01 · READ FIRST

> The only document you must read before doing anything. ~10 minutes.
> If you read nothing else, read this, then `06_NEXT_SPRINT.md`.

---

## What Nestudio is

**Nestudio is a digital home — the visual language of digital identity.**

A **Nest** is a personal room you assemble from objects. Each object reveals something about you (your Canon camera, your PlayStation, your guitar). Visitors don't scroll a feed or scan a link list — they **wander a place** and discover who you are.

The one-line thesis: **"Instagram is where you post. Nestudio is where you live."**

## Why it exists

The internet made identity into performance — feeds, comparison, infinite scroll, anxiety. Nestudio makes identity into **presence**: a warm, calm, coherent place that says *this is who I am*, and is **beautiful before you edit it**. It replaces the link-in-bio (Linktree), the aesthetic feed (Instagram), and the empty metaverse sandbox (Spatial/Rooms.xyz) with a curated, always-coherent personal room.

## What makes it different

- **A place, not a page.** You *dwell* in a Nest; you don't scroll it.
- **Coherent by construction.** A design *grammar* guarantees every Nest looks good without design skill. (See `03`.)
- **Objects are an alphabet.** A small, expressive, emoji-scale vocabulary of identity — not a furniture catalogue. Add an object only if it adds a new "letter." (See `03`.)
- **Curiosity, not utility.** Visitors explore because it's a world worth exploring; links are a byproduct, never the point.
- **Products become identity.** Businesses build Nests too; a product is an object in a room, discovered — never an ad. (See `03`.)

Nestudio is **not**: a social feed, a link page, a furniture catalogue, The Sims, or a metaverse.

---

## Current phase

**Design & architecture are frozen. Implementation of the new vision has not started.**

There is an **existing codebase** (a working Next.js app + an "Asset Factory" that turns photos into stylised 3D assets via GPT Image) built in earlier sprints, **before** the design pivot below. Treat that code as a *partial, pre-pivot implementation* to be re-aligned to the frozen design — not as the current product. See `02_PROJECT_STATE.md` and `04_TECHNICAL_ARCHITECTURE.md`.

The design work of the last phase produced four frozen documents, now consolidated into `03_DESIGN_CONSTITUTION.md`:
1. **Product philosophy** — the digital-home thesis.
2. **The Alphabet** — the ~57-object identity vocabulary (Story / Identity / Portal / Memory classes).
3. **Nest Grammar** — the 12 laws that make rooms coherent.
4. **Universal Object System (UOS)** — the data-driven object architecture (`04`).

## Current priorities

The immediate path (see `06_NEXT_SPRINT.md` for the exact next step):
1. Founder **approves** the object vocabulary + grammar + UOS (or edits them).
2. Make the generation engine **material-aware** (it currently renders everything wooden/beige — the reason the first library batch was rejected).
3. Run a small **Phase-0 calibration batch** (a few objects across classes/materials), review by eye.
4. **Only then** scale to the full vocabulary.

**Nothing for the new vision has been generated, frozen, tagged, committed, or pushed.** Do not skip the calibration gate.

## What is frozen — do not re-open without a founder decision

- The **design constitution** (`03`): philosophy, the 4 object classes + 5 visual roles, the 12 grammar laws.
- **One of each**, forever: one **camera**, one **interaction language**, one **sound language**, one **design language**. (See `10_FUTURE_RULES.md`.)
- The **UOS architecture** — objects are data that reference shared registries; objects ship no bespoke code.
- **GPT Image (`gpt-image-1`)** is the generation engine. **Gemini is deprecated — never revisit it.**
- Identity extraction is **objective facts only** (no style/material/finish words — those fight the render engine and caused regressions).
- Branch **`m12-nest-platform`, preview only. Never merge `main`. Never deploy production.**

## What must never change (the soul)

- **Objects are the alphabet of identity.** If a new object doesn't add a letter, it doesn't ship.
- **Coherence before freedom.** The grammar always wins; the editor is a stylist, not a blank canvas.
- **Negative space is luxury.** Restraint creates identity.
- **Curiosity before engagement. Places accumulate life. Products become identity.**

## What is intentionally postponed

Backgrounds (only categories noted, not designed) · the **village** layer (rooms before the village) · business-mode *implementation* · the AI room composer · the memory-accumulation system · sound *implementation* · scaling to 200–1000 objects. All are designed-for in the architecture but built later.

---

## Where to go next

Read in this order, then start: **`02_PROJECT_STATE` → `03_DESIGN_CONSTITUTION` → `04_TECHNICAL_ARCHITECTURE` → `06_NEXT_SPRINT`**, then work.
Reference as needed: `05_ROADMAP`, `07_DECISIONS`, `08_GLOSSARY`, `09_REPOSITORY_STRUCTURE`, `10_FUTURE_RULES`.
