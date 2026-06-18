# Handoff — Asset Factory V3.4 (Nestudio Master Style V2 + OpenAI-first calibration)

> Read first: this file, [README.md](README.md),
> [docs/premium-style.md](docs/premium-style.md),
> [docs/generation-ops.md](docs/generation-ops.md),
> [docs/catalog-validation.md](docs/catalog-validation.md),
> [docs/changelog.md](docs/changelog.md).
>
> (Note: there was no `HANDOFF_V3_3.md` in the repo — V3.3 state lived only in the
> README/docs. This is the first standalone asset-factory handoff file.)

## Current version

**V3.4 — Nestudio Master Style V2 + OpenAI-first calibration.** The visual identity
is **locked to one style** and gated behind an objective scoring + lock system before
any V4 mass generation. Main Nestudio app is untouched (asset-factory stays isolated:
root tsconfig excludes `apps/`, eslint ignores `apps/`).

## Architecture (what changed in V3.4)

- **One identity:** `nestudio_v2` replaces `royal_match` / `modern_designer` /
  `clash`. The style "family" surface in [`lib/styles.ts`](lib/styles.ts) is kept as a
  single entry so generation plumbing/jobs/UI keep working unchanged.
- **Locked specs:** [`lib/nestudio-spec.ts`](lib/nestudio-spec.ts) — **Camera Spec V1**
  + **Object Rules V1**, with rule lists, positive prompt fragments (folded into
  `MASTER_PROMPT`), and forbidden-token validators (`obeysNestudioSpecs`).
- **Prompts:** [`lib/prompts.ts`](lib/prompts.ts) — `STYLE_ID="nestudio_v2"`,
  `STYLE_NAME="Nestudio Master Style V2"`, V2 master + negative prompt.
- **Calibration:** [`lib/calibration.ts`](lib/calibration.ts) — five-dimension
  scoring (0–100), `styleLockStatus` (lock gate), `calibrationReport`. Scope is
  **OpenAI `nestudio_v2` only**; Replicate is comparison-only.
- **Golden set:** [`lib/style-lab.ts`](lib/style-lab.ts) — the permanent 10-item
  benchmark; added `scoreSample` / `noteSample`; dropped the multi-style comparison.
- **UI:** [`components/style-lab-client.tsx`](components/style-lab-client.tsx) is the
  Calibration Session (generate set, approve/reject, score sliders, notes, lock
  banner). [`components/style-report-client.tsx`](components/style-report-client.tsx)
  is the Calibration Report. Nav tab renamed "Style Report" → "Calibration".

## How to run it

```bash
export PATH="/Users/hannan/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/asset-factory
npm run dev        # http://localhost:3100  → Style Lab / Calibration tabs
```

Gates (all green as of this handoff): `npm run typecheck` · `npm run lint` ·
`npm run test` (**189 passing**) · `npm run build`.

## Current blockers / state

- **Style is NOT locked** — calibration has not been run with real OpenAI images.
  Generation is OFF by default; the UI works fully in **dry-run** (zero cost). To run
  a real Calibration Session set `ASSET_GENERATION_ENABLED=true` +
  `OPENAI_GENERATION_ENABLED=true` + `OPENAI_API_KEY` (server-only).
- **No background-removal step yet** (V4 prerequisite) — raw output is non-transparent.

## Next recommended actions (when ready for real calibration)

1. Enable OpenAI generation; in the Style Lab, click **Generate calibration set
   (10 × OpenAI)**.
2. Approve/reject, add notes, and score all 10 on the five dimensions.
3. Read the **Calibration Report**; iterate prompts in `lib/prompts.ts` /
   `lib/nestudio-spec.ts` until **all 10 approved AND score ≥ 85** → **Style Locked**.
4. Only then plan V4 (mass generation + background removal). **Do not** build batch
   generation / queues / automation / avatars / rooms until the style is locked.
