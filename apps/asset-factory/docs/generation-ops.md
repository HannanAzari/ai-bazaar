# Generation Ops (V3)

How to run the **AI generation queue** safely. Generation is **OFF by default**;
dry-run (zero cost) is the everyday path. Real generation requires an explicit flag
**and** a Replicate token, and is hard-capped by batch + daily limits. Nothing is
ever auto-approved — every output lands in `needs_review`.

---

## Replicate setup

1. Create a Replicate account and an API token.
2. Set the token as a **server-only** env var (`REPLICATE_API_TOKEN`). It is never
   sent to the browser — the client only ever sees a `tokenConfigured` boolean.
3. The default model is `black-forest-labs/flux-schnell` (fast, cheap). Override
   with `GENERATION_MODEL` if needed.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `ASSET_GENERATION_ENABLED` | `false` | Must be exactly `true` to allow REAL generation. |
| `REPLICATE_API_TOKEN` | — | **Server-only** Replicate token. Real generation needs it. |
| `GENERATION_MODEL` | `black-forest-labs/flux-schnell` | Replicate model id. |
| `GENERATION_COST_PER_IMAGE` | `0.003` | Estimated USD/image (for the cost panel). |
| `ASSET_GENERATION_MAX_BATCH` | `5` | Hard per-request image cap (always enforced). |
| `ASSET_GENERATION_DAILY_LIMIT` | `50` | Daily image cap. |
| `GENERATION_TIMEOUT_MS` | `60000` | Per-call timeout. |
| `GENERATION_RETRY_LIMIT` | `1` | Retries on a transport error. |

Generation also requires the factory's **password gate** (`ASSET_FACTORY_PASSWORD`)
and, for server-side persistence of real outputs, the Supabase env (shared mode).

## Cost controls

- **Disabled by default** — no flag, no spend.
- **Batch cap** (`maxBatchSize`, default 5) is enforced **server-side on every
  request** and again when building candidates — the primary runaway-spend guard.
- **Daily cap** (`maxDailyGenerations`, default 50) — computed from the job log
  (the DB in shared mode; client-reported + clamped in local mode).
- **Cost panel** on `/generate` shows generated-today, estimated spend today, and
  generated-this-month (real jobs only; dry-runs are free and excluded).
- **Cancel** a job; **retries** are bounded by `retryLimit`.

## Safe testing process (do this first)

1. Leave `ASSET_GENERATION_ENABLED` unset/false.
2. Open **Generate**, pick a category, type an idea, set count 1–2.
3. Click **Dry run (no cost)** — it builds prompts + placeholder candidates and
   runs full validation, with **no provider call and no cost**.
4. Click **Send N to review queue** — the placeholders enter `needs_review`.
5. Go to **Review** and confirm they appear, then approve/reject as usual.

This exercises the entire workflow for free before any money is spent.

## Dry-run workflow (zero cost)

`/generate` → fill the form → **Dry run**. Entirely client-side: `createGenerationJob`
+ `dryRunCandidates` + `validateGenerated` (pure functions, no network). Placeholder
candidates are marked clean (transparent) and carry the real prompt for the record.

## Real-generation workflow

1. Set `ASSET_GENERATION_ENABLED=true` and `REPLICATE_API_TOKEN=...` in the server
   env, and (for persistence) the Supabase env.
2. On `/generate`, the **Generate (real)** button enables. Use **count 1–2** for a
   first run.
3. `POST /api/generate` (password-gated) checks the flag, token, batch + daily caps,
   calls Replicate **server-side**, re-hosts each image into the `asset-candidates`
   bucket (shared mode), creates `needs_review` candidates, and runs
   quality + Nestudio import + pack-compatibility validation.
4. Raw AI output is **not transparent**, so each candidate shows a `non_transparent`
   warning — review and run a background-removal pass before approving (V4).
5. Review → approve the good ones → **Export** as usual. Approved AI assets flow
   into Nestudio through the same manual, reviewed import path.

## How to stop generation

- **Fastest:** set `ASSET_GENERATION_ENABLED=false` (or unset it) and redeploy /
  restart. The API returns `403` immediately; the UI button disables.
- **Or** remove `REPLICATE_API_TOKEN` (real calls return `500 not configured`).
- In-flight: **Cancel** the job on `/generate`. Batch + daily caps bound the blast
  radius regardless.

## How to review generated assets

They are ordinary candidates with `status: needs_review`, `modelProvider: replicate`.
Filter Review by **needs review**, open each, check the quality + validation
warnings (especially transparency), edit metadata/tags, then approve or reject.
**No AI output is auto-approved.**

## How to decide if V4 (batch scaling) is ready

Only scale up once a small real run clears all of these:

0. **Golden Style Pack approved (V3.1):** the **Style Lab** reaches **10/10
   calibrated** under *Nestudio Premium Game Style V1* — each golden item has an
   approved variation and a chosen "closest" pick. Do not mass-generate before the
   visual identity is locked. See [premium-style.md](premium-style.md).
1. A **count 1–2 real batch** completes, images saved, candidates created in
   `needs_review`, approve/reject + export all work.
2. **Validation after generation** is clean apart from the expected
   `non_transparent` warning (i.e. no `invalid_*` Nestudio errors on outputs).
3. A repeatable **background-removal** step exists (the V4 prerequisite) so outputs
   can reach the asset-bible's transparency bar.
4. **Cost per accepted asset** is understood (track estimated vs. actual on the cost
   panel + the Replicate dashboard).
5. Caps + cancel behave as expected; disabling the flag reliably stops generation.

Until those hold, keep batches tiny and the flag off between runs.
