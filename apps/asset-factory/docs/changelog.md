# Asset Factory changelog

Newest first. Versions before V3.4 are summarized from the README/commit history.

## V3.7.1 — Style Lab persistence fix + asset library (no style change)

- **Generation now APPENDS** (was: overwrote). Real renders are added to existing
  samples; nothing is silently dropped ([`lib/style-lab.ts`](../lib/style-lab.ts)
  `appendSamples`, de-duped by id).
- **Dry-run can only replace other dry-run placeholders** for the same item —
  `replaceDryRunSamples` preserves every real sample (and other items' samples).
- **Real vs dry-run tagging** on `StyleSample` (`kind: "real" | "dry_run"`, derived for
  legacy samples); shown as a pill on each card. Approval / reject / star / score /
  notes persist across reloads (localStorage round-trip; preserved through append).
- **Explicit delete only:** per-sample 🗑 Remove + a "Clear dry-run" button (drops 404
  `/samples/*.png` placeholders, keeps real). "Reset all" now warns it deletes reals.
- **⭐ Approved for library** section: all approved/starred **real** samples, plus
  **Export approved JSON** (`exportApprovedSamples` → imageUrl, name, category,
  placement, personality, prompt, model, provider, score, notes; dry-runs excluded,
  real only).
- Tests: **219 passing** (+10 persistence: append doesn't overwrite, dry-run doesn't
  replace real, approval/star/score/notes preserved, export excludes dry-run, export
  includes approved real only). Typecheck · lint · build green. DNA/prompts unchanged.

## V3.7 LOCK — DNA freeze + production plan (no style change)

- **Style frozen.** V3.7 is the locked production baseline: `NESTUDIO_DNA_VERSION =
  "3.7.0"`, `STYLE_FROZEN = true` ([`lib/prompts.ts`](../lib/prompts.ts)), guarded by a
  freeze test ([`test/dna-freeze.test.ts`](../test/dna-freeze.test.ts)) that fails the
  build if the ten DNA principles drift. No redesign, no new style/personality system.
- **Formal spec:** [docs/nestudio-dna-spec.md](nestudio-dna-spec.md) — shape language,
  proportions, materials, color philosophy, wood/metal/fabric treatment, silhouette /
  readability / scaling rules, asset / room / character compatibility.
- **Production + batch plan:** [docs/production-asset-plan.md](production-asset-plan.md)
  + [`lib/production-plan.ts`](../lib/production-plan.ts): Tier 1 (10) + Tier 2 (5)
  categories, hero-per-personality + shared-pool minimization → **58 unique assets**
  covering **20 rooms × 10 personalities**; ~116 images / **~$4.64** at 2 candidates/
  asset (~$2.32 minimal). Batch order: hero seating → shared Tier 1 → Tier 2.
- Tests: **209 passing** (added freeze guard + production-plan suites). Typecheck ·
  lint · build green.

## V3.7 — Nestudio DNA Final Refinement (manufacturer collection)

- **Signature Design Language** ([`lib/prompts.ts`](../lib/prompts.ts)
  `NESTUDIO_SIGNATURE`, folded into the shared DNA): the manufacturer-consistency
  layer applied to every category — gentle rounded corners + softened edges, soft
  geometric forms, elegant curves, thick readable silhouettes, slightly exaggerated
  friendly-premium proportions, consistent warm-oak wood detailing, consistent edge
  treatment, consistent material transitions, consistent soft matte render finish.
  Recognizable even with colour/material stripped. Camera, transparency, isolation,
  lighting signature, and the safe/bold personality system are all unchanged.
- **Manufacturer collection** ([`lib/sofa-dna.ts`](../lib/sofa-dna.ts)): the sofa
  experiment generalized across **sofa + chair + coffee table**. The ten lifestyle
  personalities (5 safe + 5 bold) are now a shared **line** — each keeps the **same
  accent + character + tier across every category**, expressed as a category-
  appropriate form. Samples land under each category's golden itemKey and feed
  calibration. The Style Lab panel is now "🧬 Manufacturer Collection" with a
  category selector. OpenAI-only; no new pages.
- **Negative prompt** also pushes away from the generic-catalog / marketplace look
  (stock furniture photo, marketplace listing, interior design render, catalogue spread).
- Tests: **200 passing** (sofa-dna suite rewritten for the multi-category collection +
  cross-category line-consistency checks). Typecheck · lint · build green.

## V3.6 — Nestudio DNA Strengthening (sofa experiment)

- **Signature shape language** added to the shared DNA ([`lib/prompts.ts`](../lib/prompts.ts)
  `NESTUDIO_DNA`): gentle rounded corners, soft geometric forms, elegant curves,
  confident silhouettes, slightly exaggerated characterful proportions. Identity only —
  camera, transparency, isolation, and the lighting signature are unchanged.
- **Personality DNA**: ten lifestyle groups (Creator, Musician, Gamer, Artist, Explorer,
  Reader, Minimalist, Collector, Dreamer, Adventurer) that influence shape language,
  materials, accent colours, and details — never props, scenes, or extra objects.
- **Silhouette diversity** sharply increased ([`lib/sofa-dna.ts`](../lib/sofa-dna.ts)):
  the ten sofas now have meaningfully different forms — low-profile lounge, wrapped
  cocoon, cloud, retro loft, chunky camp, floating modular, asymmetrical gallery,
  S-curve conversation, reclined gamer pod, organic pebble — readable from silhouette
  alone before colour/material.
- **DNA stress test**: 5 safe + 5 bold personalities; bold pieces push uniqueness while
  staying recognizably Nestudio. The Sofa DNA panel now groups Safe vs Bold; sample
  labels carry name · personality · tier.
- Tests: **200 passing** (sofa-dna suite updated for personality groups + tiers +
  silhouette/accent distinctness; DNA shape-language assertions). Typecheck · lint ·
  build green. OpenAI-only; no new pages.

## V3.5 — Nestudio DNA Discovery (sofa experiment)

- **Diagnosis:** the V3.4 prompt defined identity by *negation* and used a generic
  style layer ("neutral premium palette", "game inventory item") → outputs read as
  generic furniture icons that don't belong to one world.
- **Nestudio Visual DNA** ([`lib/prompts.ts`](../lib/prompts.ts) `NESTUDIO_DNA`): the
  positive identity signature — modern Scandinavian influence, soft rounded geometry,
  tactile natural materials, a warm cohesive palette with one confident accent, and a
  single locked warm lighting/rendering signature. Wired into the `nestudio_v2` style
  descriptors. **Style language only** — camera, transparency, and object isolation
  untouched.
- **Negative prompt** now bans the generic-identity failure modes (generic furniture
  catalog, icon pack, clipart, realistic furniture photography, luxury mansion,
  children's furniture).
- **Sofa DNA Discovery** ([`lib/sofa-dna.ts`](../lib/sofa-dna.ts)): ten sofa
  personalities (Scandi Oak … Accent Mustard) that share the DNA but differ in
  silhouette / material / colour / character — *same world, different personality*.
  Runs through the existing calibration workflow (OpenAI only, itemKey `sofa`); new
  "🧬 Sofa DNA Discovery" panel in the Style Lab.
- Tests: **198 passing** (added the `sofa-dna` suite; updated `styles` / `prompts` /
  `generation-job` for the DNA layer). Typecheck · lint · build green.

## V3.4 — Nestudio Master Style V2 + OpenAI-first calibration

- **Retired** the three style experiments (`royal_match` / `modern_designer` /
  `clash`) and the V3.1 "Premium Game Style V1" spine for ONE locked identity:
  **`nestudio_v2`** (premium collectible game asset, readable at 64/128px, slightly
  stylized — not toy-like/puffy/realistic/storybook).
- **Locked specs** ([`lib/nestudio-spec.ts`](../lib/nestudio-spec.ts)): **Nestudio
  Camera Spec V1** (3/4 isometric ~30°, centered, no floor/pedestal/scene) and
  **Nestudio Object Rules V1** (one isolated object, transparent PNG, no props),
  folded into the master prompt with forbidden-token validation.
- **Golden Calibration Set** (permanent benchmark, 10 items): Accent Chair, Sofa,
  Desk, Bookshelf, TV, Plant, Floor Lamp, Coffee Table, Guitar, Computer.
- **Calibration Session** in the Style Lab: OpenAI-first generation, approve/reject,
  notes, and a **five-dimension scoring system** (consistency, readability,
  silhouette, style fit, production readiness → **0–100**).
- **Style Lock** gate ([`lib/calibration.ts`](../lib/calibration.ts)): unlocks V4
  only when all 10 golden assets are approved **and** the calibration score ≥ 85
  (OpenAI `nestudio_v2` only).
- **Calibration Report** (`/style-report`, the "Calibration" tab): approved/rejected
  assets, average + per-dimension scores, consistency notes, remaining issues, lock
  status.
- Tests: **189 passing** (added `nestudio-spec` + `calibration` suites; rewrote
  `styles` + `style-lab`). Typecheck · lint · build green.

## V3.3 — Provider shootout (OpenAI)

- Added OpenAI GPT Image as a second provider alongside Replicate; per-provider
  selector + Shootout button; server-only keys.

## V3.2 — Multi-style calibration

- Compared three style families (Royal Match / Modern Designer / Clash) with a Style
  Report and a "winning style". (Superseded by V3.4.)

## V3.1 — Premium game style + Style Lab

- Replaced the storybook direction with "Premium Game Style V1"; added the Style Lab.

## V3 / V2.5 / V2 / V1

- V3 AI generation queue (Replicate, off by default); V2.5 catalog pipeline
  validation (Packs, Sandbox, Reports); V2 shared Supabase backend; V1 review/export.
