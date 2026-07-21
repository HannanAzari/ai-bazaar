# 🧭 SESSION HANDOFF — read this first

> **New Claude: start here.** This is the 10-minute orientation. Then read, in order:
> [design/NESTUDIO_WORLD_BIBLE.md](design/NESTUDIO_WORLD_BIBLE.md) → [design/LIVING_WORLD.md](design/LIVING_WORLD.md)
> → [design/SOUL_OF_NESTUDIO.md](design/SOUL_OF_NESTUDIO.md), then [CEO_NOTES.md](CEO_NOTES.md) and
> [CURRENT_SPRINT.md](CURRENT_SPRINT.md). Last updated end of **M36** (2026-07). Delete nothing; extend only.

---

## 0. The one-paragraph catch-up (what the last several sprints were all about)

Every sprint since M32 has been about **one feature: turning a photo of the user's real object into a Nestudio
asset, inside the editor.** The arc: build a provider-independent generation **factory** (M32) → make the
create UX feel premium (M33) → real on-device **segmentation** to pick the object (M34) → an **Art Engine**
that measures the official style and holds output to it (M35) → an **Identity Lock** so the object stays
recognisably itself (M36). M32–M35 are **pushed** to preview. **M36 is a LOCAL-only commit that is HELD — its
mug test does not yet fully pass, so it was not pushed** (see §5, §6).

## 1. Project vision

Nestudio is **not a social network with beautiful rooms — it is a place people genuinely wish they could
visit.** Each creator owns a **Nest** (a cozy, front-facing scene that feels *like them*); visitors *arrive at
a place*, not scroll a feed. Founding filter: **if a feature makes Nestudio more useful but less desirable to
visit, it fails.** Full thesis: [design/SOUL_OF_NESTUDIO.md](design/SOUL_OF_NESTUDIO.md).

## 2. North star (the one sentence)

> **Make Hannan (the first user) feel: "That was mine in real life — now it lives in my Nest, and it still
> looks like MINE, and it belongs there."**

## 3. Current product state (what actually exists, working, on preview)

- A real mobile app shell (`/create`, `/home`, `/profile`, `/nest-editor`, `/@handle`, `/village`…). Supabase
  (LIVE) for Nest documents; demo-safe otherwise. Everything before M20 (village, discovery, social, room
  engine V1–V5, identity/auth) is in [roadmap.md](roadmap.md).
- **The asset-creation loop (editor-first, all inside `/nest-editor`):**
  `Assets tab → "+ Create" (always the first tile) → Camera / Photo Library → LARGE original photo (Continue)
  → tap the object (on-device segmentation) → Generate ONE → Use / Improve → success ✨ → the asset appears in
  My Assets and can be placed in the Nest, persisting on reopen.`
- **Library ownership tabs:** Official (read-only) · My Assets (AI-created, deletable) · Recent.
- Internal dev tools: **`/dev/asset-benchmark`** (providers side-by-side) and **`/dev/art-engine`** (measured
  DNA · style validator · family test · benchmark objects). Both noindex.

## 4. The asset pipeline architecture (the heart of recent work)

Provider-independent; the rest of the app never knows which model produced an asset. One config switch
`ACTIVE_ASSET_PROVIDER` (currently **gemini**; **gpt-image** also wired — both keys present; imagen/flux are
honest no-key stubs; local canvas is the offline fallback).

```
Stage 1  photo → CUTOUT        lib/segmentation/ (MediaPipe Interactive Segmenter + flood fallback; tap-to-select)
Stage 2  cutout → ASSET        lib/asset-pipeline/ (generateAsset — provider-independent)
                               ├─ lib/asset-dna.ts        the constant Nestudio Asset DNA (prompts assembled FROM it)
                               ├─ lib/identity/           Identity Lock: contract → gate 1 → targeted repair  [M36, HELD]
                               └─ lib/art-engine/         Style: measured official DNA → conform → gate 2      [M35]
```

- **`generateAsset()` flow (current, M36):** extract identity **contract** → single generation (cutout +
  original + mask + identity-constrained prompt) → **identity validator (Gate 1, hard pass/fail)** → **targeted
  repair** (re-apply the source's own critical regions; never rebuild) → **style validator (Gate 2, report)**.
  One generation + one optional repair — **no regenerate-until-acceptable loop.**
- **Priority order is IDENTITY > FUNCTION > Nestudio DNA.** Style may only change finish/edges/lighting/polish.
- **Permanent rules:** *stop optimising prompts* (improve preprocessing · cutout · provider routing · rendering
  · DNA instead); *measure, don't guess* (the official style is fingerprinted from real assets); *human
  approval is mandatory* (nothing auto-selects/ships).

## 5. Current engineering state (accurate)

- **Branch:** `m12-nest-platform`. **Preview only — never merge to `main`, never deploy production.**
- **Pushed HEAD:** `02e75e2` — **M35 Art Engine** (the latest thing on the Vercel branch preview).
- **Local-only, NOT pushed:** `4682bcb` — **M36 Identity Lock (HELD).** `git status` shows *ahead 1*. It is a
  checkpoint; the **mug test does not yet fully pass** so it was deliberately not pushed.
- **Node 20** for tooling (`/Users/hannan/.nvm/versions/node/v20.20.2/bin`). Gates at every sprint:
  `typecheck · lint (0 warnings) · vitest (538 tests) · build` — all green.
- **Providers/keys:** `GEMINI_API_KEY` + `OPENAI_API_KEY` in `.env.local`. `NEXT_PUBLIC_ASSET_PROVIDER`
  overrides the active provider. Segmentation model bundled at `public/models/magic_touch.tflite`; MediaPipe
  WASM streams once from jsdelivr (falls back to the local flood segmenter offline).
- **Known issues / gotchas:**
  1. **M36 mug test not passing yet.** Black handle is preserved (~13%); cream/lettering/"belongs" style are
     not cleanly passing. See [design/IDENTITY_LOCK.md](design/IDENTITY_LOCK.md) §"Honest status".
  2. **The editor navigates to Home mid-generation in the headless browser** — this blocked clean end-to-end
     verification of the mug test. The faithful test is the editor on a real phone (clean segmentation).
  3. `/dev/art-engine` uses `autoCutout`, which keeps the **hand** in the mug photo → it is a *confounded*
     identity harness. Verify identity on a **clean segmented** cutout (the editor path).
  4. **Device-local inventory.** AI assets live in `localStorage` (`nestudio-ai-inventory`); a published Nest /
     second device can't resolve them (no `SupabaseInventoryStore` yet).
  5. **No provider winner chosen.** `/dev/asset-benchmark` exists to compare gemini vs gpt-image objectively —
     it hasn't been run to a decision. See [design/IDENTITY_MODEL_BENCHMARK.md](design/IDENTITY_MODEL_BENCHMARK.md).
  6. **Held exploration files.** ~60+ uncommitted files (M22–M30 prototypes, `app/design/*`,
     `apps/asset-factory/*`, `components/magic/*`, old docs). Deliberately held — never sweep them into a commit.
  7. **Don't run `next build` while `next dev` is live** — it corrupts the dev `.next` and breaks HMR/hydration
     (clean-restart with `rm -rf .next` if it happens).
- **Older asset engine still present:** `lib/ai/` (the M20–M31 `furniture@7` stylize-based engine) is superseded
  by `lib/asset-pipeline/` for the create path but still provides canvas ops (`lib/ai/canvas.ts`) reused
  everywhere. Don't confuse the two.

## 6. Current priority (single highest)

**Get the M36 Identity Lock mug test to PASS, then push it.** The mug test passes ONLY if, with ≤1 generation
+ 1 optional repair: black B-handle stays black · B silhouette intact · lettering preserved (Preserve Details)
· cream body cream · asset belongs beside official assets. Verify on the **editor path with a clean segmented
mug** (a phone, or fix the editor-navigates-to-Home issue). If the re-applied identity layers misalign, tune
the bbox alignment in [`lib/identity/repair.ts`](../lib/identity/repair.ts). **Only then push `4682bcb`.**

## 7. DO NOT (carry these constraints forward)

- ❌ Do **not** merge to `main` or deploy production.
- ❌ Do **not** push M36 (`4682bcb`) until the mug test passes.
- ❌ Do **not** redesign the Create Asset UI / flow, or the visual/shape/alphabet DNA (locked).
- ❌ Do **not** "optimise prompts" by adding descriptive words — solve architecturally.
- ❌ Do **not** commit the held exploration files, or mix them into a sprint commit.
- ❌ Do **not** assume Gemini is the best model — the benchmark is there to decide.

## 8. The next sprint (concrete)

1. **Finish M36:** make the mug test pass on a clean segmented cutout (editor/phone). Tune
   `lib/identity/repair.ts` alignment if needed. Then **push** `4682bcb`.
2. Optionally run the **model benchmark** (gemini vs gpt-image vs hybrid) per
   [design/IDENTITY_MODEL_BENCHMARK.md](design/IDENTITY_MODEL_BENCHMARK.md) — no production change until it has
   real numbers.
3. Then get the whole loop in front of Hannan on his phone; iterate by *feeling* and by the identity/style
   gates. Human approval mandatory.

> The design/philosophy phase is complete. The work is **experiential + architectural**: does the created
> object *feel like the user's real thing* while *belonging beside the official assets*? That is the question.
