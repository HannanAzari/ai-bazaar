# M21 — AI Asset Quality Engine (2026-07-14)

Branch `m12-nest-platform`, **preview only — no merge to `main`, no production deploy**. Built ON the M20
architecture ([m20-ai-creator-studio.md](m20-ai-creator-studio.md)) — not a redesign. The goal was
**output quality**: turn a real object photo into a premium, consistent, transparent Nestudio asset, and
make the system feel like an **asset production pipeline**, not an image generator. Object generation
only; no avatars/backgrounds/houses/marketplace/animation.

## One honest constraint

A *truly generative* photo → new-3D-geometry leap needs a hosted diffusion model + an API key, which
isn't provisioned in this environment. So M21 does both halves properly:
1. **The real hosted provider is implemented and wired** (env-gated) — it activates the moment
   `GEMINI_API_KEY` is set, with no other change.
2. **The local pipeline was dramatically upgraded** so quality visibly jumps *today* with no key, and all
   the production-pipeline architecture (refine loop, quality gates, presets, metadata, comparison,
   versioned prompts, review panel) is real and verifiable now.

## Phase 1 — real provider (interface unchanged)
- **[app/api/ai/generate/route.ts](../app/api/ai/generate/route.ts)** — server-only Gemini call
  (`GEMINI_API_KEY` via `x-goog-api-key`, model `gemini-3.1-flash-image`, img2img), matching the repo's
  existing script pattern. Returns 501 when unconfigured.
- **[lib/ai/providers/gemini.ts](../lib/ai/providers/gemini.ts)** — implements the SAME `AIImageProvider`;
  `stylize` posts to the route (key never reaches the browser), cutout/upscale stay local. Registered but
  not default; flip the default to `gemini` once a key exists — no studio/UI change.
- **[lib/ai/providers/stub.ts](../lib/ai/providers/stub.ts)** — the local default, upgraded from a toy to
  a genuine chain (below). Ships as default so the Studio works with no key.

## Phase 2 — iterative generation
- **[lib/ai/refine.ts](../lib/ai/refine.ts)** — `improvePrompt(report)` turns quality failures into
  corrective directives; `generateWithRefinement` runs generate → score → improve → regenerate, keeps the
  best, stops early once one passes. Generic + injected fns → unit-tested without canvas. The engine runs
  1 pass by default, designed for N.

## Phase 3 — style consistency
Encoded into the versioned prompt (`furniture@2`) + the local processing: warm upper-left key, grounded
contact shadow, matte finish, rounded proportions, front-facing/centered, no distortion/floating
shadow/background/text.

## Phase 4 — quality gates
- **[lib/ai/quality.ts](../lib/ai/quality.ts)** — `validateAsset(stats)` (pure): transparent background,
  centered, correct padding, minimum resolution, no clipped edges, fills the expected area → an ok/score
  report. Failures drive the refine retry. `alphaStats` (canvas) measures the inputs.

## Phase 5 — style presets
- **[lib/ai/presets.ts](../lib/ai/presets.ts)** — `Nestudio Classic` (enabled) + `Clay` / `Soft` /
  `Illustration` (defined, disabled). A preset = token overrides + params; the Studio picks one.

## Phase 6 — metadata
- **[lib/ai/metadata.ts](../lib/ai/metadata.ts)** — `inferInsights` derives category, tags, dominant
  colours (from pixels), material, rarity, recommended room, surface type, scale hint and anchor point.
  Stamped onto every asset for future search + placement.

## Phase 7 — comparison view
The Studio shows **Original → Generated → Alpha (transparency) → In room** four-up, plus the quality
score, insight chips + colour swatches, and (dev) the prompt version / preset / refine passes.

## Phase 8 — prompt library (versioned)
- **[lib/ai/prompts.ts](../lib/ai/prompts.ts)** — `PROMPT_REGISTRY` (`"kind@version"`) + `ACTIVE_PROMPT_VERSION`.
  A new prompt is a new version entry + a bump — the engine never changes, and each asset records its
  `promptVersion`.

## Phase 9 — admin review (dev-mode)
- **[/creator-studio/review](../app/creator-studio/review)** (gated by
  [lib/dev-mode.ts](../lib/dev-mode.ts)) — Approve / Reject / Regenerate / Duplicate / Export over the
  inventory. The seed of the Admin Asset Factory: same engine + inventory; it will differ only by
  publishing approved assets to `globalLibrary` instead of a user's inventory.

## The upgraded local pipeline (the 90%)
[lib/ai/canvas.ts](../lib/ai/canvas.ts): **flood-fill** background removal (connected-from-edge, so a
white mug interior survives) → **edge feather** (anti-halo) → **despeckle** → **relight** (warm key +
ambient occlusion) → **matte grade** → gentle posterize → trim/center/pad → **grounded contact shadow**.
Verified in-browser: a coffee-mug sample scores **Quality 100% ✓**, cleanly transparent, warmly lit,
matte, grounded — a clear jump over M20's flat cut-out.

## Tests
`test/ai-quality.test.ts` (validation gates, refine loop keep-best/early-stop, presets, metadata
inference, versioned prompts) — 17, plus the M20 suites still green.

## Gates
typecheck ✓ · lint ✓ · test **497** ✓ · build ✓.

## Reuse (unchanged from M20's promise)
Every piece added here is provider-, kind- and studio-agnostic: Avatar/Background/House studios and the
Admin Factory get the refine loop, quality gates, presets, metadata and review panel for free.
