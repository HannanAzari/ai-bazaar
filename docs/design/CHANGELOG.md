<!-- Governed by docs/design/NESTUDIO_WORLD_BIBLE.md — read that first. -->
# Design System Changelog

The governed history of the Nestudio visual language. Append-only; newest first. Every entry follows the
experiment discipline in [ART_DIRECTION_PROCESS.md](ART_DIRECTION_PROCESS.md) (hypothesis · variable ·
constants · result · decision · lesson). No design rule changes without an entry here.

---

## M35 — The Nestudio Art Engine · One artistic language
*(the founder's "M33" brief.) Generation quality: make AI assets indistinguishable from official ones — by
MEASURING the official style and holding generated output to it. No prompts / Gemini / generation logic changed.*

- **Phase 1 — measured DNA.** [`lib/art-engine/fingerprint.ts`](../../lib/art-engine/fingerprint.ts) +
  [`official.ts`](../../lib/art-engine/official.ts) fingerprint the real golden-nest library (palette,
  saturation, warmth, value, matte, edge softness, coverage, purity) → a mean+variance **StyleProfile**.
  Measuring corrected wrong assumptions (officials are **crisp-edged**, **tightly cropped**, matte ≈ 0.60 not
  0.97). Full findings: [NESTUDIO_DNA_MEASURED.md](NESTUDIO_DNA_MEASURED.md).
- **Phase 2/4 — Style Validator (the gate).** [`validator.ts`](../../lib/art-engine/validator.ts) scores a
  candidate against the profile; tolerances come from the library's own variance so **~7/8 officials belong**
  and neon/gloss fails. **Palette discipline is the one hard veto**; matte/purity are weighted, not vetoes
  (even the official lamp glows). The art-director critic, but measurable = cheap.
- **Phase 3/4/7 — conform + gated retry.** [`conform.ts`](../../lib/art-engine/conform.ts) pulls any provider's
  output into one material language, **identity-preserving** (hue untouched — M22 rule): matte-grade + tame
  blown highlights/pure-whites → warm matte cream (measured to lift matte 0.51→1.00). Wired into
  `generateAsset`: finish → conform → validate → **regenerate only on failure** (cost-aware).
- **Phase 5/6 — family test + benchmark.** `/dev/art-engine` (internal): a generated asset **beside the
  official sofa/bookshelf/lamp/table/plant**, and the 9 benchmark objects each scored by the gate.
- Verified: officials calibrate high, a real generated **coffee mug** clears the gate at **~63% ("belongs")**
  after conforming, and the gate rejects neon/gloss. Gates green (typecheck · lint · **533 tests** · build).
  Preview only — **no prompt/model/generation changes, no `main` merge, no production deploy.** The Definition
  of Done (a human blind test) remains the final word — this ships the machinery to reach it.

---

## M34 — Premium Segmentation Experience · Nestudio understood what you meant
*(the founder's "M32.5" brief.) Replaces the manual cutout editor with real on-device object selection —
Telegram / Apple Photos feel. **No AI/prompt/Gemini/style/generation changes** — only Stage-1 cutout UX.*

- **Real on-device segmentation, not an AI prompt.** New [`lib/segmentation/`](../../lib/segmentation): a
  provider-abstracted `Segmenter` — **MediaPipe Interactive Segmenter** (the `magic_touch` model, bundled at
  `public/models/`, WASM streamed once from CDN) runs **entirely in the browser** (no server roundtrip, not
  Gemini). A classical **flood/region-grow** fallback (fully local) means it can **never fail**.
- **Manual-first → segmentation-first.** On open the subject is auto-detected and highlighted; the user
  **taps the object they want** and the background disappears. The erase/restore brush is now a *fallback*
  ("Fix edges"), never step one.
- **Tap-to-select, verified <300ms.** Re-segmenting on tap measured **~237 ms** on the on-device model
  (target: under 300 ms); editing is local and 60fps.
- **Premium presentation.** The object floats on a **warm Nestudio paper card** with a soft shadow — **no
  giant checkerboard**. Selected object: soft glow outline, gentle scale-pop; background **fades + desaturates**;
  tap-hint dots on other detected objects; a subtle shimmer instead of a spinner.
- **Premium floating modal.** Stronger backdrop blur + dim + desaturate + darken; large, centered, glass card.
- **Focused editing tools.** Fix-edges shows only **Erase · Restore · Undo · Redo · brush-size · Done**; the
  brush is for edges only, with soft edges and live preview.
- **Never fails.** Low-confidence / model-miss → tap again, manual brush, or the local flood fallback.
- Verified functionally end-to-end on mobile (auto-detect → tap-reselect 237ms → Fix-edges tools → Generate).
  Gates green (typecheck · lint · **523 tests** · build). Preview only — **no generation changes, no `main`
  merge, no production deploy.**

---

## M33 — Asset Creation Experience Polish · Forget you're using AI
*(the founder's "M31 polish" brief.) No AI/prompt/model/pipeline/style changes — only UX, interaction and
motion. The metric: "Would someone happily create five objects in a row?"*

- **Original photo first.** After Camera/Library the flow shows the **large original photo** ("Continue")
  before any cutout — the user's anchor of trust. The tiny checkerboard never appears before they approve.
- **Auto-cutout first.** The editor no longer opens first: auto-cutout runs, then *"Looks good? [Generate] /
  [Edit cutout]"*. The erase/restore brush is a **fallback**, not step one.
- **Single generation, not three.** Generate **one** asset (`variants: 1`). Removed the A/B/C pick.
- **Refinement loop.** After a result: *"Looks good? [Use] / [Improve]"*. Improve → *"What would you like to
  change?"* + example chips (rounder / remove the text / more wooden…) → regenerate **one**, reusing the
  previous result as the reference (via the existing pipeline `notes` — **no prompt/model change**).
- **Premium glass modal.** Floating glass card, strong backdrop blur + dim + desaturate + darken, soft
  shadow, ~220ms scale/fade entrance. A focused creative workspace.
- **Crafted loading.** Replaced the spinner with staged messages (Studying → Sketching → Painting → Matching
  the Nestudio style → Finishing) and a soft conic "craft orb" — no %, no jargon.
- **Success moment.** After Use: ✓ *"Added to My Assets"* with a bounce + sparkle, then it auto-returns to the
  editor and **reveals the new asset in My Assets** (switch category → scroll → pulse) so the user never asks
  *"where did it go?"*.
- **Library ownership.** New tabs **Official** (read-only) · **My Assets** (editable/deletable) · **Recent**.
  Polished Create tile (glow + spring), warm empty states ("Every home starts with one favourite object.").
- **Motion everywhere.** Buttons spring, cards elevate, tiles pop-in, dialogs scale+fade; reduced-motion
  respected. Nothing appears instantly.
- Verified functionally end-to-end on mobile viewport with real Gemini (original → cutout → single generate →
  result → Use → success → revealed in My Assets). Gates green (typecheck · lint · 517 tests · build).
  Preview only — **no AI changes, no `main` merge, no production deploy.**

---

## M32 — Asset Pipeline (Architecture Reset) · The factory, not the mug
*Freeze the workflow, replace the generation architecture. Stop optimising prompts; build a pipeline where the
provider is interchangeable and the Asset DNA is constant.*

- **The lesson that created it:** the M31 mug failed because we were asking a foundation model to *invent an
  art style that doesn't exist*. Changing prompts / providers is not a strategy — Nestudio needs its own
  visual language expressed as **a specification every provider must satisfy.**
- **Nestudio Asset DNA** — a formal, provider-agnostic spec: [NESTUDIO_ASSET_DNA.md](NESTUDIO_ASSET_DNA.md)
  (17 fields — camera · lens · perspective · scale · padding · lighting · material · texture · edge · AO ·
  shadow · colour · silhouette · shape · rendering · transparency · export) + a **code mirror**
  [`lib/asset-dna.ts`](../../lib/asset-dna.ts). It **references** [RENDERING_DNA.md](RENDERING_DNA.md) / the
  camera lock (no duplicated rules) and adds the provider-contract + the benchmark scorecard. **Prompts are
  assembled FROM the DNA, never hand-written.**
- **Two separate concerns.** Stage 1 **Cutout** (photo → cutout; Telegram-fast, forgiving, manual
  erase/restore — [`lib/cutout.ts`](../../lib/cutout.ts)) is deliberately split from Stage 2 **Generation**
  (cutout → reinterpreted Nestudio object). Never output a photo cutout.
- **Provider-independent `generateAsset()`** — [`lib/asset-pipeline/`](../../lib/asset-pipeline): a thin
  `AssetGenerationProvider` interface + a router with **one config switch** (`ACTIVE_ASSET_PROVIDER`).
  Adapters: **GPT Image** + **Gemini** (real, keys present) · **Imagen** + **Flux** (honest *no-key* stubs) ·
  **Local** (offline fallback). Uniform finishing (key-out → true alpha → trim → pad) for every provider, so
  outputs are comparable. Nestudio never knows which provider produced an asset.
- **Editor-first UX.** `+ Create Asset` is the **always-first tile** in the editor's Assets library; the whole
  flow (Camera / Photo Library → AI Cutout → Quick Cleanup → Generate → Choose → appears in library) runs
  **inside the editor** — the user never leaves. Telegram-inspired *interaction*, not Telegram output.
- **Asset Benchmark Studio** (`/dev/asset-benchmark`, internal) — one source, every provider, side by side,
  scored against the DNA by a **human**. See [ASSET_BENCHMARK.md](ASSET_BENCHMARK.md). **No winner chosen —
  the factory is judged before the products.**
- **New permanent rule:** *Stop optimising prompts.* Improve, in order, **preprocessing · cutout · provider
  routing · rendering pipeline · Asset DNA.*
- Verified end-to-end on mobile with real Gemini (upload → cutout → 3 true-alpha candidates → choose → library)
  and both hosted providers reporting available in the benchmark. Gates green (typecheck · lint · 517 tests ·
  build). Preview only — **no `main` merge, no production deploy.**

---

## M31 — Vertical Slice 01 + furniture@7 · The language enters the product
*Documentation stops; the first real feature ships to preview. The judge becomes the render on screen.*

- **First real feature (not docs): "my object became part of my home."** `Create → Turn your object into a
  Nestudio asset → /creator-studio → upload photo → 3 Gemini candidates → choose one → Place in my Nest →
  persists on reopen.` Proven end-to-end on mobile with the real hosted provider. (Committed `1bf506b`.)
- **`furniture@7` — the reinterpretation prompt.** Corrects `furniture@6`, which shipped a *photo-cutout* mug
  (photographic lighting, baked shadow, painted checker fringe) because it was a *fidelity* prompt. `@7`
  rebuilds the belonging **from scratch as an original Nestudio object** — keep the identity, discard the
  photograph: matte hand-painted, single soft warm key, ~10° life-sim camera, **no baked shadow**, plain
  **solid** studio background **keyed out to true alpha** (never a painted checker). Now
  `ACTIVE_PROMPT_VERSION.furniture`. (Committed `a27fa4e`; extends
  [RENDERING_DNA.md](RENDERING_DNA.md) + the `furniture@N` lineage in [ART_DIRECTION_PROCESS.md](ART_DIRECTION_PROCESS.md).)
- **The candidate-comparison workflow.** The studio generates **3 genuinely different candidates** —
  **A Faithful · B Designed · C Characterful** — behind a **hard alpha-rejection gate** (opaque / checker /
  clipped / solid-rect → reject + regenerate, ≤3 tries). The **human chooses one**; **only the chosen
  candidate is saved**. Human approval is mandatory; nothing auto-selects.
- **Principles that became true *in product* (added to the World Bible, not predicted):** *Reality wins* (the
  rendered result is the only judge) · *Reinterpret, don't reproduce* · *Build memories, not assets* · *Design
  by taste, not text.* Named founder directions for the experiential phase are recorded as **intent, not law**
  until felt in a shipped moment.
- **Pipeline change:** postProcess now cuts the *generated* background to true alpha when Gemini returns an
  opaque/checker image, then trims + pads; contact-shadow disabled for furniture (Camera DNA).
- Gates green at each commit (typecheck · lint · full test suite · build). Preview only — **no `main` merge,
  no production deploy.** Old `furniture@6` mug removed from inventory/canvas/samples.

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
