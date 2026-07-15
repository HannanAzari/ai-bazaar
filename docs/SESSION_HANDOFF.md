# 🧭 SESSION HANDOFF — read this first

> **New Claude: start here, then read [docs/design/NESTUDIO_WORLD_BIBLE.md](design/NESTUDIO_WORLD_BIBLE.md)
> → [docs/design/LIVING_WORLD.md](design/LIVING_WORLD.md) → [docs/design/SOUL_OF_NESTUDIO.md](design/SOUL_OF_NESTUDIO.md).**
> This document is the 10-minute orientation. Written at the end of M31, extended at M32 (2026-07). Delete
> nothing; extend only.

> **📍 M32 update (Asset Pipeline reset).** The generation *architecture* was replaced with a **factory**: a
> constant **Nestudio Asset DNA** ([design/NESTUDIO_ASSET_DNA.md](design/NESTUDIO_ASSET_DNA.md) +
> `lib/asset-dna.ts`) + a **provider-independent** `generateAsset()` (`lib/asset-pipeline/`, one switch
> `ACTIVE_ASSET_PROVIDER`; GPT Image + Gemini real, Imagen + Flux no-key, Local fallback). Cutout
> (`lib/cutout.ts`) is a separate Stage 1. **Create Asset now lives inside the editor** (`+ Create` is the
> first Assets tile) — verified end-to-end on mobile with real Gemini. Internal **Asset Benchmark Studio** at
> `/dev/asset-benchmark`. New permanent rule: **stop optimising prompts** — improve preprocessing · cutout ·
> provider routing · rendering pipeline · Asset DNA. **No provider winner chosen yet — run the benchmark next.**
> The single priority below (get the render in front of the founder) now means: **have the founder run the
> benchmark and pick a provider by feeling**, before investing in per-object quality.

---

## 1. Project vision

Nestudio is **not a social network with beautiful rooms — it is a place people genuinely wish they could
visit.** Each creator owns a **Nest** (a cozy, front-facing scene that feels *like them*); visitors *arrive
at a place*, not scroll a feed. The emotional north star for the world is *"this place feels like me,"* and
the founding filter for every decision is: **if a feature makes Nestudio more useful but less desirable to
visit, it fails.** Full thesis: [design/SOUL_OF_NESTUDIO.md](design/SOUL_OF_NESTUDIO.md).

## 2. Current north star (the one sentence)

> **Make Hannan (the first user) feel: "That was mine in real life — now it lives in my Nest, and when I came
> back, it was waiting for me."**

Everything right now serves that single felt moment, not more architecture or documentation.

## 3. Current product state (what actually exists, working)

- A real mobile app shell (`/create`, `/home`, `/profile`, `/nest-editor`, `/@handle`, `/village`…). Runs in
  **Supabase (LIVE)** mode for Nest documents; demo-safe otherwise.
- **Vertical Slice 01 — "my object became part of my home" (WORKS end-to-end on mobile):**
  `Create → "Turn your object into a Nestudio asset" → /creator-studio → upload photo → 3 real Gemini
  candidates → choose one → Place in my Nest → placement persists on reopen.`
- The **Nest editor** (arrange/assets/connect/focus/surface/preview) with AI assets wired into a virtual "AI"
  category in the asset tray.
- Everything before M20 (village, discovery feed, social, room engine V1–V5, identity/auth) — see
  [roadmap.md](roadmap.md).

## 4. Current design state

**LOCKED (immutable — do not reinterpret):** the whole `docs/design/` system —
[World Bible](design/NESTUDIO_WORLD_BIBLE.md), [Living World](design/LIVING_WORLD.md),
[Rendering DNA](design/RENDERING_DNA.md), [Geometric Alphabet](design/GEOMETRIC_ALPHABET.md) (Pebble ·
Capsule · Arch), [Physics DNA](design/PHYSICS_DNA.md), the immutable **Camera DNA**
([nestudio-camera-dna-lock.md](nestudio-camera-dna-lock.md): 10° life-sim, no baked shadow, isometric
forbidden), the palette ([nestudio-visual-dna.md](nestudio-visual-dna.md)), the Soul + Icon Tests, the shape
& alphabet rules.

**EXPERIMENTAL / in validation:** whether the DNA can be *felt in the product* — specifically the object
generation prompt. **`furniture@7`** (the reinterpretation direction: rebuild-from-scratch, matte, solid-bg
keyed to true alpha, no baked shadow) is the current active furniture prompt and is on preview; **A/B/C
candidate directions are not yet chosen by Hannan.** The Icon Lab / Experiment Lab tooling
([design/ICON_LAB.md](design/ICON_LAB.md), [design/EXPERIMENT_WORKFLOW.md](design/EXPERIMENT_WORKFLOW.md))
exists but the House/Icon exploration has **not been run** (begins later).

## 5. Current engineering state

- **Branch:** `m12-nest-platform` (never merge to `main`; never deploy production).
- **Last commit:** `a27fa4e` — *furniture@7 reinterpretation* (committed + pushed).
- **Prior commit:** `1bf506b` — *Vertical Slice 01*.
- **`furniture@7`:** committed and **active** (`ACTIVE_PROMPT_VERSION.furniture = "furniture@7"`).
- **Preview:** pushed to `m12-nest-platform` → Vercel auto-builds a **branch preview** (URL lives in the
  Vercel dashboard → Deployments; I cannot mint the exact string). Not production.
- **Provider:** **Gemini** (`gemini-3.1-flash-image`) via `POST /api/ai/generate` (`GEMINI_API_KEY`,
  `NEXT_PUBLIC_AI_PROVIDER=gemini`). Local canvas **stub** is the fallback, always **honestly labeled**
  (`usedFallback` / `provider`).
- **Generation pipeline:** upload → client resize (`lib/image-downscale.ts`) → validate → resize →
  removeBackground(source) → Gemini image-edit with `furniture@7` → **postProcess cuts the generated
  background to TRUE alpha** (skips if already transparent) → **no baked shadow** → `lib/ai/engine.ts`
  metadata → localStorage inventory. The studio generates **3 candidates** (A Faithful / B Designed / C
  Characterful) behind a **hard alpha-rejection gate** (opaque / checker / clipped / solid-rect → reject +
  regenerate, ≤3 tries); **only the chosen candidate is saved**, at "Place in my Nest".
- **Persistence:** AI inventory (`nestudio-ai-inventory`) + editor draft (`nestudio:nest-editor:v1:<id>`) are
  **localStorage — device-local, NOT cross-device.** Nest docs use Supabase.
- **Known bugs / limitations:**
  1. **Device-local only.** A published Nest (or a second device) resolves asset ids against the *production
     library*, which has no AI-inventory assets → AI placements render missing off-device. No
     `SupabaseInventoryStore` yet.
  2. Gemini is an **image-edit** model, so it can still keep too much of the photo; `furniture@7` mitigates
     but is not perfect. Alpha-gate retries add latency (a batch can take ~45–90s).
  3. Candidate A/B/C labels can mis-index if a whole variant fails all 3 gate tries (cosmetic).
  4. The exact model id is returned by the route but not stored on the asset (only `provider`).
  5. `furniture@7` fixed the eye-level / baked-shadow deviations **for furniture only**; other categories are
     not wired.
- **63 uncommitted files** in the working tree = the **M22–M30 exploration body** (design docs already
  committed separately; plus `app/design/*` prototypes, `apps/asset-factory/*`, `components/magic/*`, various
  old docs). **Deliberately held** — not part of the working slice. Do not commit them casually.

## 6. Current priority (single highest)

**Get `furniture@7` in front of Hannan on his phone, collect his screenshots/feeling, and iterate the object
render until it feels like *"my real thing, rebuilt by Nestudio's artists."*** Nothing else.

## 7. DO NOT WORK ON (every temptation)

- ❌ Do **not** invent more philosophy or write more design documents.
- ❌ Do **not** redesign or re-explore the furniture/visual/shape/alphabet DNA (it is locked).
- ❌ Do **not** add new features (village, marketplace, avatars, backgrounds, house generation, social).
- ❌ Do **not** run the House Lab / Icon Lab exploration yet.
- ❌ Do **not** build cross-device inventory / Supabase asset store unless Hannan asks.
- ❌ Do **not** commit the 63 held exploration files, or mix them into a slice commit.
- ❌ Do **not** optimize prematurely, refactor the editor, or expand scope.
- ❌ Do **not** merge to `main` or deploy production.

## 8. The next sprint (concrete, nothing else)

1. **Finish `furniture@7`** — respond to Hannan's phone feedback; iterate the render (still one object: the
   mug) until it feels right. Human approval is mandatory; nothing auto-selects.
2. **Push the preview** (`m12-nest-platform` only) and give Hannan the flow: `Create → Turn your object into a
   Nestudio asset → /creator-studio`.
3. **Hannan tests on his phone**, sends screenshots, judges by *feeling*.
4. **Review the screenshots**, decide the A/B/C direction (or iterate the prompt one variable at a time).
5. **Iterate.** Stop there.

> The project is **leaving the documentation phase. The next work is experiential** — does the world *feel*
> the way the Bible says it should? That is now the only question.
