<!-- Governed by docs/design/NESTUDIO_WORLD_BIBLE.md — read that first. -->
# Design System Changelog

The governed history of the Nestudio visual language. Append-only; newest first. Every entry follows the
experiment discipline in [ART_DIRECTION_PROCESS.md](ART_DIRECTION_PROCESS.md) (hypothesis · variable ·
constants · result · decision · lesson). No design rule changes without an entry here.

---

## M30 — Icon Exploration · Building the Laboratory
*Documentation stops leading; experimentation begins. Infrastructure only — nothing generated.*

- **New permanent World-Bible principle:** *"Documentation records discoveries. Documentation never predicts
  discoveries."* + the division **GPT creates · Human judges · Claude records** + the closing question
  *"Did we create something people will remember, or just something that looks nice?"*
- **Built the Icon Exploration system (laboratory only):**
  - Pipeline harness [`scripts/icon-lab.mjs`](../../scripts/icon-lab.mjs) — engines gpt-image→gemini,
    candidate lifecycle, versioning, status workflow, archive. **Generation hard-gated OFF in M30.**
  - Experiment database — `public/test-photos/icon-lab/manifest.json` (schema-documented) + archive structure
    (`.../archive/`, never-delete).
  - Five review instruments — `icon-review-board.html` (compare 2–5 · zoom · hide labels · silhouette · night
    · weather · emoji/favicon/app-icon previews · print), `icon-comparison-board.html`,
    `icon-silhouette-board.html`, `icon-weather-board.html`, `icon-memory-board.html` (all data-driven from
    the manifest; `?demo=1` previews the controls).
  - Docs: [ICON_EXPERIMENTS](ICON_EXPERIMENTS.md) · [EXPERIMENT_WORKFLOW](EXPERIMENT_WORKFLOW.md) ·
    [REVIEW_PROCESS](REVIEW_PROCESS.md) · [EXPERIMENT_HISTORY](EXPERIMENT_HISTORY.md).
- *ZERO assets, ZERO prompts, ZERO production code, no winners chosen, no DNA changed, no commit. The search
  begins M31.*

---

## M29 — Icon Lab · The Search for the Face of Nestudio
*Broadens the search from "the house" to "the image people remember five years later."*

- **Created [ICON_LAB.md](ICON_LAB.md)** — the permanent framework for discovering Nestudio's **visual
  identity**, at every scale (the icon may be a house, a window, a roof, a curl of smoke, a single glow):
  the mission ("the image someone remembers five years later, not a beautiful house"), **~30 icon directions**
  across three scales (🏠 whole · 🧩 component · 🌫️ atmospheric) in **7 emotional families** (Comfort · Wonder
  · Nature · Architecture · Fantasy · Craft · Minimal), the **30→15→8→4→2→1 tournament** (R1 Glance · R2
  Five-Year Memory · R3 Reduction · R4 Seasons & Solitude · R5 **The Uncopyable**), an expanded **test
  battery** (Five-Year Memory, Stop-Scrolling, Warm Window, Snow, Sunset, Lonely Road, Logo, LEGO, Plush,
  Emoji, Souvenir + new Homesick/Wordless/Doodle/**Tattoo** tests, each PASS/FAIL), five **board types**
  (Round · Comparison · Silhouette · Weather · Memory), a **10-stage roadmap**, and the pivotal section
  **"How We Know We Have Found It"** (the Uncopyable Test — the real icon is the emotional image a rival
  could never copy).
- **Positioned as the parent of [HOUSE_LAB.md](HOUSE_LAB.md)** — Icon Lab decides *what kind of thing* the
  face is; House Lab runs the deep house tournament only if the face is a whole house.
- **Empty board scaffold** — `public/test-photos/icon-lab-board.html` (tournament + five board-type templates
  + the 30-direction Round-1 grid, all empty until M30).
- *ZERO assets, ZERO prompts, ZERO code, no winner chosen, references-only added to prior docs, no commit.*

---

## M29 — House Lab · The Search for the Icon
*The first sprint where documentation follows experimentation. Builds the lab, not the house.*

- **Created [HOUSE_LAB.md](HOUSE_LAB.md)** — the permanent framework for discovering the iconic Nestudio
  house: purpose ("we are searching for the first iconic Nestudio house"), **30 described house directions**
  across **7 hypothesis categories** (Natural · Playful · Architectural · Fantasy · Minimal · Historic ·
  Experimental), a **30→15→8→4→2→1 emotional tournament** (each round judges emotion, never beauty), two
  families of evaluation criteria (the [ICON_TESTS](ICON_TESTS.md) battery + the LEGO/logo/plush/emoji
  reducibility gate), the review-board spec, and a **9-stage generation roadmap** (Stage 1 begins M30).
- **Empty review-board scaffold** — `public/test-photos/house-lab-board.html`: the full tournament bracket +
  the Round-1 template of all 30 specimens as empty review cards (House · Silhouette · Emotion · Pros · Cons ·
  Decision), ready to fill in M30.
- **Deliberately includes expected failures** (Wizard Tower, Floating House, Glass House…) to test the edges
  of the [House DNA](HOUSE_DNA.md) laws.
- The Lab **does not choose a winner** — it defines *how* a winner is discovered.
- *ZERO assets generated, ZERO prompts, ZERO code changes, no edits to M23–M28 substance (references only),
  no commit — preview only.*

---

## M28 — The Soul of Nestudio
*From how the world **behaves** to **why anyone would wish it were real.***

- **Founding filter added to the top of the [World Bible](NESTUDIO_WORLD_BIBLE.md):** *"Nestudio is not a
  social network with beautiful rooms. It is a place people genuinely wish they could visit."* — now the
  filter for every future decision.
- **Created six soul documents** under `docs/design/`:
  - [SOUL_OF_NESTUDIO.md](SOUL_OF_NESTUDIO.md) — why people bond to places; the **Warm Window** soul-image;
    the emotional arc (longing → safety → curiosity → belonging).
  - [HOUSE_DNA.md](HOUSE_DNA.md) — the house as the brand icon; the Child Drawing Test; the six unchanging
    signatures; the one glowing window as the emotional center.
  - [WORLD_ATMOSPHERE.md](WORLD_ATMOSPHERE.md) — the invisible living layer, *alive without distracting.*
  - [THE_CREATOR_SPIRIT.md](THE_CREATOR_SPIRIT.md) — **the Glow**, the invisible soul of every Nest (not a
    pet/avatar/assistant); felt always, seen rarely, remembers you.
  - [HOUSE_EXPLORATION.md](HOUSE_EXPLORATION.md) — the arrival journey as an emotional experience.
  - [ICON_TESTS.md](ICON_TESTS.md) — ten soul tests (Empty World, Winter Night, Screenshot, "I Wish This
    Existed", One Hour, Friend, Vacation…), each PASS/FAIL, that can veto on soul even when craft passes.
- **Set the read-order** — Bible → Living World → **Soul of Nestudio** → soul & DNA docs → rest — in the
  Bible, Living World, README and CTO handoff. Cross-referenced throughout; no content duplicated.
- *No assets, no prompts, no rendering/geometry, no production code, no changes to M23–M27, no commit.*

---

## M27 — The Living World
*From governing the visual language to defining how the universe **behaves**.*

- **Created [LIVING_WORLD.md](LIVING_WORLD.md)** — the permanent philosophical foundation of the Nestudio
  universe: the invisible laws of gravity, materials (emotional), time, motion, sound, light, space,
  imperfection, emotional rules, the ≥50-rule Anti-Bible, and **the Living Test** (the Empty World Test).
  Defines how the world *behaves and feels*, not how it looks.
- **Signature laws established:** *Nothing ever slams* (gravity) · *The half-second slower* (motion) ·
  *Loved, not new* (materials) · *Light hugs, darkness tucks in* (light) · *Room to belong* (space) ·
  *One interaction, one feeling* (emotion) · *Perfect is a little wrong* (imperfection).
- **Set the read-order** — [NESTUDIO_WORLD_BIBLE.md](NESTUDIO_WORLD_BIBLE.md) → LIVING_WORLD.md → the rest of
  `docs/design/`. Cross-referenced from the World Bible (§1 philosophy + doc map); no content duplicated.
- *No assets, no prompts, no rendering/geometry, no production code, no M23–M26 decisions changed, no commit.*

---

## M26 — Founding of the Nestudio World Bible
*Transition from **discovering** the visual language to **governing** it.*

- **Created `docs/design/`** — the permanent design system, with [NESTUDIO_WORLD_BIBLE.md](NESTUDIO_WORLD_BIBLE.md)
  as the single highest visual authority, plus [VISUAL_DNA.md](VISUAL_DNA.md), [PHYSICS_DNA.md](PHYSICS_DNA.md),
  [GEOMETRIC_ALPHABET.md](GEOMETRIC_ALPHABET.md), [RENDERING_DNA.md](RENDERING_DNA.md),
  [ASSET_RULES.md](ASSET_RULES.md), [CREATOR_TRANSLATION.md](CREATOR_TRANSLATION.md),
  [ART_DIRECTION_PROCESS.md](ART_DIRECTION_PROCESS.md), and this changelog.
- **Reconciled the three-generation camera lineage:** the Animal Crossing life-sim camera lock
  (`nestudio-camera-dna-lock.md`, 10° slightly-elevated) is affirmed as the immutable top authority,
  superseding the earlier ~30° isometric and ~5–10° front-facing statements.
- **Folded in the M23–M25 discoveries** (rendering language, shape language, geometric alphabet) and
  converted their source docs to redirect stubs (no duplication).
- **Recorded open gaps** honestly (notably `furniture@6`'s eye-level + baked-shadow deviations from the
  camera lock) for reconciliation via the approval process.
- **Repointed onboarding** (README, handoff, CTO handoff, sprint checklist, the two operational bibles) to
  read the World Bible first before any visual decision.
- *No assets generated, no prompts modified, no production code changed.*

---

## Pre-Bible history (folded into the documents above)

- **M25 — Visual Alphabet.** Discovered the three primitives — **Pebble · Capsule · Arch** — from ~80 pure
  abstract forms across nine geometric languages, destroying 90%. Now [GEOMETRIC_ALPHABET.md](GEOMETRIC_ALPHABET.md).
- **M24 — Shape DNA.** Froze the silhouette family rule (pedestal foot · pebble body · negative-space
  cut-out) and the **3-second silhouette test**; shipped `furniture@6`. Now in
  [GEOMETRIC_ALPHABET.md](GEOMETRIC_ALPHABET.md) + [PHYSICS_DNA.md](PHYSICS_DNA.md).
- **M23 — Object / Rendering DNA.** Froze the matte hand-painted finish + warm key/AO rendering language;
  shipped `furniture@5`. Now [RENDERING_DNA.md](RENDERING_DNA.md).
- **M22.2 — Mug prompt lab.** Established translation-not-reproduction and object-colour fidelity;
  `furniture@4`. Now [CREATOR_TRANSLATION.md](CREATOR_TRANSLATION.md). Raw log: `../mug-prompt-log.md`.
- **Visual DNA V1.0 & Camera lock.** The world palette, warm-light/cool-plum-shadow law, and the immutable
  life-sim camera — `../nestudio-visual-dna.md`, `../nestudio-camera-dna-lock.md`. Inherited by
  [RENDERING_DNA.md](RENDERING_DNA.md) / [VISUAL_DNA.md](VISUAL_DNA.md).

> Note: the object-DNA prompt lineage (`furniture@4/5/6`) is **held / uncommitted** (preview only) pending
> the standing "hold the commit" instruction. The World Bible documents the target regardless of commit
> state.
