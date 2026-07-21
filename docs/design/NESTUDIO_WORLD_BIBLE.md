# 📖 The Nestudio World Bible

> # *"Nestudio is not a social network with beautiful rooms. It is a place people genuinely wish they could visit."*
>
> **This is the founding filter for every decision, forever.** If a feature makes Nestudio more useful but
> *less desirable to visit*, it fails. If it makes people linger, wander, smile, or feel curious — even if it
> isn't strictly necessary — it deserves serious consideration. Furniture, houses, weather, motion and
> interactions all exist to serve one emotional outcome: **people wanting to spend time in the world, not
> just use the product.** That is the moat. The full thesis lives in [SOUL_OF_NESTUDIO.md](SOUL_OF_NESTUDIO.md).

---

> **This is the single highest authority for every visual decision in Nestudio.**
> Every asset, house, room, furniture item, avatar, creator object, background, animation and AI prompt
> must derive from this document and the sub-documents it governs. Nothing overrides it. If any other
> document, prompt, or piece of code disagrees with the World Bible, **the World Bible wins** — and the
> other document must be corrected.
>
> **Read this FIRST**, then [LIVING_WORLD.md](LIVING_WORLD.md), then [SOUL_OF_NESTUDIO.md](SOUL_OF_NESTUDIO.md),
> then the rest of `docs/design/`. Every other design document assumes you have read those three. If you are
> a new engineer or a new AI session about to make *any* visual or world decision, follow that order:
>
> **NESTUDIO_WORLD_BIBLE.md → LIVING_WORLD.md → SOUL_OF_NESTUDIO.md → the soul & DNA docs → remaining
> documentation.**
>
> **Test of success:** a completely different engineer or AI, one year from now, should be able to recreate
> Nestudio from these documents alone. If they produce something that doesn't look like Nestudio, the
> documentation has failed — fix the documentation, not just the asset.

Founded **M26** — the transition from *discovering* the visual language to *governing* it.

---

## 1. The emotional vision

Nestudio exists to make one feeling real. When a creator opens their Nestudio home, they should feel:

> **"I want to live here. I want to explore it. I want to show people this is mine."**

Warm belonging, instantly — *"this is mine, and it already feels like me, and I belong somewhere."*

That is the question **every** design decision must answer. Not *"do I like this illustration?"* — that is
a taste question and it is the wrong one. The only question is: **does this deepen the feeling of a warm
world you want to live in, explore, and show off as yours?** If a beautiful thing doesn't serve that
feeling, it is wrong for Nestudio.

## 2. The philosophy

**Nestudio is not a collection of assets. Nestudio is a living digital world.**

- Every object is **intentionally designed**. Nothing is generic. Nothing is accidental.
- **Everything belongs to one family** — one hand, one light, one set of forms — so a mug, a lamp, a chair,
  a house and a tree feel like siblings even though they were never designed together.
- The world is **composed**, not randomly generated. AI seeds a curated library; humans approve; nothing
  raw ships to users. (Architecture: `Village → House → Nest → Objects → Content`; north star *"this place
  feels like me."* See [`../nestudio-production-pipeline.md`](../nestudio-production-pipeline.md).)
- The moat is **recognition**: a shared silhouette and finish so distinctive that people know it's Nestudio
  the way they know Apple, LEGO or Nintendo — from an outline, instantly. That is far more valuable, and far
  harder to copy, than any single beautiful image.

The **behaviour** of this world — how it weighs, moves, ages, sounds, catches light, and makes a person feel —
is the philosophical foundation beneath every visual rule, and lives in **[LIVING_WORLD.md](LIVING_WORLD.md)**.
Nestudio would still stop being Nestudio if those invisible laws vanished, even with the art unchanged. Read
it immediately after this document.

## 3. The Nestudio Laws (immutable)

Memorize these. A future designer should be able to recall them without reopening the document.

1. **Nothing should look generic.**
2. **Nothing should look AI-generated.**
3. **Every object should feel designed.**
4. **Silhouette before detail.**
5. **Identity before realism.**
6. **Emotion before accuracy.**
7. **Family before individuality.**
8. **Remove noise. Simplify. Never decorate.**
9. **Never chase trends. The world should age gracefully.**
10. **One family: one hand, one light, one set of forms.**

When two decisions conflict, the earlier law wins. When you are unsure, choose the option that a warm,
careful human artist would choose over the option a machine would.

> **The Method Principle (M30, permanent):** *"Documentation records discoveries. Documentation never predicts
> discoveries."* From M31 onward Nestudio is designed by **taste, not text** — the identity emerges from many
> prototypes judged with ruthless consistency, and the docs follow the experiments, never the reverse.
> Division of labour: **GPT creates · Human judges · Claude records.** Every session ends with one question:
> *"Did we create something people will remember, or just something that looks nice?"* (See the Icon Lab:
> [ICON_EXPERIMENTS](ICON_EXPERIMENTS.md) · [EXPERIMENT_WORKFLOW](EXPERIMENT_WORKFLOW.md) ·
> [REVIEW_PROCESS](REVIEW_PROCESS.md) · [EXPERIMENT_HISTORY](EXPERIMENT_HISTORY.md).)

> **What became true in M31 (proven in the product, not on paper).** These extend — do not replace — the
> Laws and the Method Principle above:
> - **Reality wins.** The judge is the *rendered result on screen*, never the workflow, the prompt, or the
>   docs. A slice that "technically works" but *feels* like a photo cutout is a failure (this is why
>   `furniture@6` was rejected and `furniture@7` written).
> - **Reinterpret, don't reproduce (`furniture@7`).** An uploaded belonging must be **rebuilt from scratch as
>   a Nestudio object** — keep the identity, discard the photograph. See [RENDERING_DNA.md](RENDERING_DNA.md)
>   and the `furniture@N` history in [ART_DIRECTION_PROCESS.md](ART_DIRECTION_PROCESS.md).
> - **The candidate-comparison workflow.** Generate a few *genuinely different* candidates (A Faithful /
>   B Designed / C Characterful), let the **human choose one**, and save **only the chosen one**. Human
>   approval is **mandatory**; nothing auto-selects.
> - **Build memories, not assets.** The felt win is not "a processed PNG" but *"my real thing became part of
>   my home, and it was waiting for me when I came back."* (Deepens [SOUL_OF_NESTUDIO.md](SOUL_OF_NESTUDIO.md).)
> - **Design by taste, not text.** The identity now advances by *felt* prototypes judged with ruthless
>   consistency — the documentation phase is complete; the work is experiential from here.
>
> *(Named directions the founder is steering toward for the experiential phase — Hospitality over Engagement,
> Places accumulate shared life, Evidence not content, the Good Host — are **not yet validated in product**
> and are recorded as intent, not law. They graduate into the Laws only once felt in a shipped moment.)*

> **What became true in M32 (the Asset Pipeline reset).** The generation *architecture* is now the strategy,
> not any single prompt:
> - **The DNA is the source; prompts are derived.** Style lives in [NESTUDIO_ASSET_DNA.md](NESTUDIO_ASSET_DNA.md)
>   + `lib/asset-dna.ts`, not inside a prompt. Every provider gets the same DNA and must satisfy it.
> - **The provider is interchangeable; the DNA is constant.** Switching model is one config change; nothing
>   downstream knows which provider produced an asset. Providers are chosen by *consistency against the DNA*
>   ([ASSET_BENCHMARK.md](ASSET_BENCHMARK.md)), never by prompt cleverness.
> - **Cutout ≠ generation.** Two separate concerns; never ship a photo cutout as an asset.
> - **Stop optimising prompts (permanent rule).** Improve, in order: *preprocessing · cutout · provider
>   routing · rendering pipeline · Asset DNA.* A prompt is one component, not the strategy.
> - **Build the factory before judging the products.** A better factory produces better assets for years.

## 4. How the World Bible is organized

The Bible is one authority split across focused documents so nothing is duplicated. **Never copy a rule
between documents — reference it.** Each concern lives in exactly one place:

| Document | Owns |
|---|---|
| **NESTUDIO_WORLD_BIBLE.md** *(this)* | vision · philosophy · the Laws · authority · read-order · open gaps |
| [LIVING_WORLD.md](LIVING_WORLD.md) *(read 2nd)* | the **philosophical foundation** — how the universe *behaves*: gravity, materials, time, motion, sound, light, space, imperfection, emotional rules, anti-rules, the Living Test |
| [SOUL_OF_NESTUDIO.md](SOUL_OF_NESTUDIO.md) *(read 3rd)* | the **emotional thesis** — why people fall for places; the "I wish this were real" outcome; the emotional arc (3s / 30s / 10min / 1yr) |
| [HOUSE_DNA.md](HOUSE_DNA.md) | the **brand icon** — the Nestudio house as Apple's logo: the unchanging proportions/shapes, the Warm Window, aging, night glow, weather, every part, what to never add |
| [WORLD_ATMOSPHERE.md](WORLD_ATMOSPHERE.md) | the **invisible living layer** — clouds, wind, leaves, fireflies, rain, snow, golden hour, dust; alive without distracting |
| [THE_CREATOR_SPIRIT.md](THE_CREATOR_SPIRIT.md) | **the Glow** — the invisible soul in every Nest (not a pet/avatar/assistant); felt always, seen rarely, remembers you |
| [HOUSE_EXPLORATION.md](HOUSE_EXPLORATION.md) | the **arrival journey** — approach → path → threshold → first 5s/30s → leaving → wanting to return |
| [ICON_TESTS.md](ICON_TESTS.md) | the **soul evaluation battery** — Empty World, Child Drawing, Winter Night, Rain, Returning Home, Screenshot, "I Wish This Existed", One Hour, Friend, Vacation (each PASS/FAIL) |
| [FURNITURE_LIBRARY.md](FURNITURE_LIBRARY.md) | the **production catalog** — Craft Cycle 01 furniture, status workflow, accepted/rejected |
| [ICON_LAB.md](ICON_LAB.md) | the **identity-search framework** — how the *face* of Nestudio is discovered (house, window, roof, glow, or something unimagined): 30 icon directions at every scale, the 30→1 emotional tournament, the icon-test battery, "How We Know We Have Found It" |
| [HOUSE_LAB.md](HOUSE_LAB.md) | the **house sub-tournament** (invoked by Icon Lab if the face is a whole house): 30 house directions, 7 hypotheses, the 30→1 emotional tournament, generation roadmap |
| [ICON_EXPERIMENTS.md](ICON_EXPERIMENTS.md) | the **pipeline & experiment database** — engines (gpt-image→gemini), candidate lifecycle, versioning, status workflow, archive |
| [EXPERIMENT_WORKFLOW.md](EXPERIMENT_WORKFLOW.md) | the **run loop** — Hypothesis → Generate 5 → Review → Destroy 4 → Improve 1 → Repeat; the GPT/Human/Claude division |
| [REVIEW_PROCESS.md](REVIEW_PROCESS.md) | the **review UI & board generators** — five HTML instruments; pure review, no creative decisions |
| [EXPERIMENT_HISTORY.md](EXPERIMENT_HISTORY.md) | the **permanent learning log** — why each candidate survived/died; "no learning may disappear"; the closing-question ledger |
| [VISUAL_DNA.md](VISUAL_DNA.md) | the permanent visual *qualities* (softness, warmth, premium, playful, craft, proportions, silhouette, calm, negative space) — WHAT + WHY |
| [PHYSICS_DNA.md](PHYSICS_DNA.md) | the invisible *behaviour* rules (soft gravity, inflation, living asymmetry, calm exaggeration, impossible stability, breathing negative space) |
| [GEOMETRIC_ALPHABET.md](GEOMETRIC_ALPHABET.md) | the primitives (Pebble · Capsule · Arch), how they combine, how to add more |
| [RENDERING_DNA.md](RENDERING_DNA.md) | palette hex · lighting · material · AO · shadow · transparency · **the immutable camera** · composition · allowed/forbidden styles |
| [NESTUDIO_ASSET_DNA.md](NESTUDIO_ASSET_DNA.md) | the **provider contract** (M32) — the 17 asset fields as a machine spec every provider must satisfy; prompts assembled from it; the benchmark scorecard; code mirror `lib/asset-dna.ts` |
| [ASSET_BENCHMARK.md](ASSET_BENCHMARK.md) | how a **provider is chosen** (M32) — one source · every provider · scored against the Asset DNA by a human; judged by consistency, not prompts |
| [NESTUDIO_DNA_MEASURED.md](NESTUDIO_DNA_MEASURED.md) | the **Art Engine** (M35) — the official style MEASURED from real assets; the Style Validator gate; the conform pass; the family/benchmark tooling (`/dev/art-engine`) |
| [IDENTITY_LOCK.md](IDENTITY_LOCK.md) | the **Identity Lock** pipeline (M36) — IDENTITY > FUNCTION > DNA; contract → hard gate 1 → targeted repair; `lib/identity/`. **Status: HELD, mug test not yet passing** |
| [IDENTITY_MODEL_BENCHMARK.md](IDENTITY_MODEL_BENCHMARK.md) | **investigation only** (M36) — how to benchmark Gemini vs GPT Image vs hybrid for identity preservation; no production model change |
| [ASSET_RULES.md](ASSET_RULES.md) | how each category (furniture, plants, houses, avatars, backgrounds, tools, interactive…) interprets the one DNA |
| [CREATOR_TRANSLATION.md](CREATOR_TRANSLATION.md) | how a real object becomes a Nestudio object (the 6-stage pipeline) |
| [ART_DIRECTION_PROCESS.md](ART_DIRECTION_PROCESS.md) | approval process · prompt architecture & version history · evaluation scorecards |
| [CHANGELOG.md](CHANGELOG.md) | the governed history of the design system |

## 5. Authority & lineage (which older docs still rule)

Nestudio's visual language was discovered across three generations; some older docs conflict. This is the
**canonical resolution** — cite these, in this order of authority:

- **Camera / perspective — IMMUTABLE:** [`../nestudio-camera-dna-lock.md`](../nestudio-camera-dna-lock.md)
  (Animal Crossing life-sim: ~180 cm height, **8–12°/target 10°** tilt, ~35–40 mm, portrait 3:4, visible
  top surfaces, **isometric forbidden**). This **supersedes** every earlier camera statement (the ~30°
  isometric of `nestudio-scene-calibration.md`, and the ~5–10° of ADR-028 / the CTO handoff / visual-dna
  §11). Mirrored in [RENDERING_DNA.md §6](RENDERING_DNA.md).
- **Palette · lighting · material · world philosophy:** [`../nestudio-visual-dna.md`](../nestudio-visual-dna.md)
  (Visual DNA V1.0 — still authoritative for the *world*; its **camera section is overridden** by the
  camera lock). Its palette + warm-light/cool-plum-shadow law are inherited by
  [RENDERING_DNA.md](RENDERING_DNA.md) and [VISUAL_DNA.md](VISUAL_DNA.md).
- **Architecture / product model:** [`../nestudio-production-pipeline.md`](../nestudio-production-pipeline.md)
  (V2 master — `Village → House → Nest`; "Wall" removed; composition over generation) and
  [`../nestudio-cto-handoff.md`](../nestudio-cto-handoff.md).
- **Object rendering / shape / alphabet (M23–M25):** folded into [RENDERING_DNA.md](RENDERING_DNA.md),
  [GEOMETRIC_ALPHABET.md](GEOMETRIC_ALPHABET.md), [PHYSICS_DNA.md](PHYSICS_DNA.md). The source docs
  `nestudio-object-dna.md`, `nestudio-shape-dna.md`, `nestudio-alphabet.md` are now **redirect stubs**.
- **Superseded / history (do not cite as current):** `nestudio-scene-calibration.md` (30° iso),
  `visual-kit.md` (dollhouse room shells), `project-handoff-2026.md` (pre-pivot baseline).

## 6. Open gaps (honest — resolve via the approval process, not silently)

The Bible records where the system is not yet self-consistent, so a future session fixes rather than repeats:

1. **`furniture@6` says "eye-level"** but the immutable camera requires slightly-elevated 10° with visible
   top surfaces (eye-level is *forbidden*). → reconcile in `furniture@7`.
2. **`furniture@6` bakes a grounded contact shadow**; the rule is engine-composited cool-plum shadow, never
   baked. → reconcile in `furniture@7`.
3. **Only furniture is an active prompt.** Plants, houses, avatars, backgrounds, tools have DNA rules
   ([ASSET_RULES.md](ASSET_RULES.md)) but no versioned prompts yet.
4. **The 3-second silhouette test is manual** (a flood-key HTML tool). It is not yet an automated gate.
5. **Two operational bibles** ([`../golden-nest-production-bible.md`](../golden-nest-production-bible.md),
   [`../asset-generation-prompt-bible.md`](../asset-generation-prompt-bible.md)) overlap this system and now
   point here for visual authority; a future pass should merge their non-duplicated operational content
   under the World Bible umbrella.

See [ART_DIRECTION_PROCESS.md](ART_DIRECTION_PROCESS.md) for how a change is proposed, run and approved.
**No visual rule changes without that process.**
