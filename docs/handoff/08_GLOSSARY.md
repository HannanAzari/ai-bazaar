# 08 · GLOSSARY

> Every important Nestudio term, defined once. If a term isn't here, it may not be real — add it deliberately.

**Nestudio** — the product: a digital home; the visual language of digital identity.

**Nest** — one creator's (or business's) room. A self-portrait made of objects. The core unit.

**Alphabet** — the small (~57), curated vocabulary of objects. Each object is a "letter" of identity; add one only if it adds a new letter.

**Grammar (Nest Grammar)** — the design system (12 laws) that makes any Nest coherent and beautiful before editing. Governs composition, hierarchy, spacing, interaction and sound.

**Object** — one item in a Nest. In the architecture, a data record referencing shared registries (see UOS). Has one **class** and, per room, one **role**.

**Class** — what an object *means* (intrinsic, fixed): **Story**, **Identity**, **Portal**, or **Memory**.

**Role** — how an object *functions in a given room* (contextual, assigned by composition): **Hero**, **Supporting**, **Atmosphere**, **Memory**, or **Background**. Class ⟂ Role.

**Story Object** — atmosphere only; sets mood and taste (sofa, plant, lamp, rug, art). Mostly static.

**Identity Object** — reveals *who* the creator is (Canon camera, MacBook, PlayStation, guitar). The strongest identity statement; keeps premium brands where the choice signals identity.

**Portal Object** — an interactive surface connecting to real digital content (laptop, TV, phone, bookshelf, speaker). The **UI of Nestudio**, not decoration.

**Memory Object** — accumulates life; tap reveals an **internal** memory (photo/note/story), never an external link (trophy, polaroids, letter, snow globe).

**Hero Object** — the role of the single dominant object that answers "who is this?" at a glance. One per Nest; haloed by empty space.

**Supporting Object** — the role of objects that give the Hero context (the desk under the laptop); clustered with it.

**Atmosphere** — the role (usually Story-class objects) that sets mood at the edges; quiet, low visual weight.

**Background** — the room/stage behind everything: lighting, palette, walls, window, depth. A whisper; never competes with objects. (Designed later — categories only.)

**Surface** — a content channel an object exposes (a laptop's "portfolio", a camera's "gallery", a business's "products"). Decoupled from objects; each **type** (link-grid, gallery, video, feed, player, product, story, profile) has one consistent viewer. Creators connect a **source** (URL/upload/OAuth).

**Interaction Pattern** — one of the 8 reusable behaviours an object selects (SCREEN, OPEN, BOOK, DRAWER, DISPLAY, PLAY, EXAMINE, TOGGLE). Never bespoke per object.

**Lifecycle** — the single state machine every object runs: `Load → Idle → Hover → Focus → Interact → Content → Close → Idle`.

**Universal Object System (UOS)** — the data-driven object architecture: an object = identity + geometry + references into four registries (Patterns, Animation, Sound, Surfaces). Adding an object is data, not code.

**Starter Nest** — a prebuilt, grammar-valid Nest for an archetype (Developer, Photographer, Musician…); the creator only connects content.

**Creator** — the person who owns and builds a Nest.

**Visitor** — someone exploring a Nest. Wanders out of curiosity; discovers who the creator is.

**Business Nest** — a brand's Nest, built with the exact same system; products are objects (identity, not ads), discovered by wandering.

**Asset Factory** — the content pipeline that turns a real photo into a stylised 3D Nestudio object image (GPT Image + identity extraction + cleanup). Produces the *art*; the UOS gives it *behaviour*.

**furniture@8** — the current generation prompt/DNA in the Asset Factory (canonical camera, matte look, no external shadow, official style refs). Being made material-aware (see `06`/`D18`).

**Calibration batch** — a small pre-scale generation run that proves the render is correct (material, iconic, coherent) before producing the real library. The gate before scaling.
