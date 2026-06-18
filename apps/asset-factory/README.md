# Nestudio Asset Factory

An **internal, mobile-friendly review and export tool** for Nestudio (AI Bazaar)
assets. Hannan and trusted helpers use it to review generated/imported assets from
phone or laptop and approve only high-quality cozy **2.5D** assets into the
Nestudio catalog.

It is a **separate app** living at `apps/asset-factory/`, deployed independently to
`assets-nestudio.vercel.app`. It does **not** touch the main Nestudio app — not the
room engine, not production auth, not user-facing routes.

> **No live AI generation yet.** It focuses on import/upload → metadata →
> review → approve/reject → export. Generation fields exist on the data model but
> are inert; a future sprint will add a real provider (see below).

> **V2 — Shared review backend.** The factory now runs in one of two modes,
> auto-detected from env: **Local** (localStorage, the V1 default/fallback) or
> **Shared** (a Supabase backend so approvals, imports, and the activity log
> persist **across devices** — review on your laptop, see it on your phone). The
> shared backend is reached only through password-gated server API routes using the
> Supabase **service role**; the browser never touches the database directly. See
> "Shared backend (V2)" below.

> **V2.5 — Catalog pipeline validation.** Five tabs across the top: **Review**
> (the dashboard), **Packs** (curate first-class asset packs + export), **Generate**
> (V3, below), **Sandbox** (run the room-designer logic on approved assets to prove
> they compose into valid rooms), and **Reports** (Catalog Quality Score, coverage,
> room-readiness, and Nestudio import validation). The goal is to prove the full
> pipeline (asset → review → approve → export → import → designer → room).
> Full guide: [docs/catalog-validation.md](docs/catalog-validation.md).

> **V3 — AI generation queue.** Controlled image generation via **Replicate**,
> **OFF by default**. Dry-run (zero cost) builds prompts + placeholder candidates
> entirely client-side; real generation is hard-gated behind
> `ASSET_GENERATION_ENABLED=true` + a **server-only** `REPLICATE_API_TOKEN`, with
> per-request **batch caps** and **daily limits**. Every output lands in
> `needs_review` and is auto-validated — **never auto-approved**. The token is never
> exposed to the browser. Full guide: [docs/generation-ops.md](docs/generation-ops.md).

> **V3.1 — Premium game style + Style Lab.** The generation prompt identity is now
> **Nestudio Premium Game Style V1** (polished mobile-game collectibles: single
> isolated object, transparent PNG, no platform/props, 30° isometric) — replacing
> the storybook direction. The **Style Lab** (`/style-lab`) generates and compares
> **5 variations** for 10 golden items, with approve / reject / mark-closest scoring,
> to **choose ONE identity before scaling generation**. Full guide:
> [docs/premium-style.md](docs/premium-style.md).

> **V3.2 — Multi-style calibration.** Compare **three style families** before
> locking one: **Royal Match Inspired**, **Modern Designer**, **Clash Inspired**
> ([`lib/styles.ts`](lib/styles.ts)). A **Style** selector on `/generate` and
> `/style-lab` chooses the family (stored on each job as `styleId`); the Style Lab
> generates **5 variations per style** for each golden item side-by-side, and the new
> **Style Report** (`/style-report`) tallies approvals + closest picks per style and
> names a **winning style**. Generation stays OFF by default; no main-app changes.

> **V3.3 — Provider shootout (OpenAI).** A second image provider — **OpenAI GPT
> Image** — alongside Replicate ([`lib/providers.ts`](lib/providers.ts),
> [`lib/openai-server.ts`](lib/openai-server.ts)). A **Provider** selector on
> `/generate` and `/style-lab` chooses the engine (stored on jobs as `modelProvider`
> + on style samples as `provider`/`model`); the Style Lab has a **Shootout** button
> that generates 1 image from *each* provider for the same asset + style,
> side-by-side. OpenAI returns base64 → stored via the existing upload flow (bucket
> in shared mode, data URL locally). Keys are **server-only**; OpenAI batch is capped
> at 3; both `ASSET_GENERATION_ENABLED` and `OPENAI_GENERATION_ENABLED` gate it.
> See [docs/generation-ops.md](docs/generation-ops.md).

> **V3.4 — Nestudio Master Style V2 + OpenAI-first calibration.** The three style
> experiments (`royal_match` / `modern_designer` / `clash`) are **retired** for ONE
> locked identity: **`nestudio_v2`** — a premium collectible game asset, readable at
> 64/128px, slightly stylized (not toy-like/puffy/realistic/storybook). Two locked
> specs ([`lib/nestudio-spec.ts`](lib/nestudio-spec.ts)) — **Camera Spec V1** (3/4
> isometric ~30°, centered, no floor/pedestal/scene) and **Object Rules V1** (one
> isolated object, transparent PNG, no props) — are folded into the master prompt.
> The Style Lab is now a **Calibration Session**: generate the fixed **Golden
> Calibration Set** (10 items) from **OpenAI** (the calibration provider; Replicate
> is comparison-only), then approve/reject, note, and **score five dimensions**
> (consistency, readability, silhouette, style fit, production readiness → **0–100**).
> A **Style Lock** gate unlocks V4 only when **all 10 are approved AND the calibration
> score ≥ 85** (OpenAI `nestudio_v2` only); the **Calibration Report** (`/style-report`)
> summarizes it. Full guide: [docs/premium-style.md](docs/premium-style.md).

---

## How it relates to the main app

- The factory is **isolated from the root tooling**: the root `tsconfig.json`
  excludes `apps/` and the root `.eslintrc.json` ignores `apps/`, so the main app's
  `typecheck`/`lint`/`build` never see this code. The root Vitest only collects
  `test/**`, so factory tests run only here.
- It is a self-contained Next.js app with its **own** `package.json` and config.
  Locally it reuses the repo-root `node_modules` (same Next/React versions); for
  Vercel it declares its own dependencies.
- Types that must match the catalog (`NestudioCatalogAsset`, zones, actions) are
  **re-declared** in [`lib/types.ts`](lib/types.ts) to keep the apps decoupled.
  Exports are shaped to the main app's `CatalogAsset` (see `lib/assets.ts` there).

---

## Run locally

Node 20+ is required (the repo default is Node 16):

```bash
export PATH="/Users/hannan/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/asset-factory
npm run dev        # http://localhost:3100
```

Local dev resolves dependencies from the repo-root `node_modules`, so no separate
`npm install` is needed for day-to-day work. (For an isolated install, run
`npm install` inside `apps/asset-factory/`.)

Gates:

```bash
cd apps/asset-factory
npm run typecheck
npm run lint
npm run test
npm run build
```

---

## Deploy separately to assets-nestudio.vercel.app

Create a **second Vercel project** pointed at the same Git repo, with:

- **Root Directory**: `apps/asset-factory`
- **Framework preset**: Next.js
- **Build command / Install command**: defaults (`next build` / `npm install`)
- **Production domain**: `assets-nestudio.vercel.app`
- **Environment variables**: `ASSET_FACTORY_PASSWORD` (gate) and, for the shared
  backend, `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` +
  `SUPABASE_SERVICE_ROLE_KEY` (see below). Run the SQL in `supabase/` against the
  project first.

Because the root directory is `apps/asset-factory`, Vercel installs this app's own
`package.json` and ignores the main app entirely. The two deployments are
independent.

For shared review from phone + laptop, set the password **and** the three Supabase
vars, and apply `supabase/schema.sql` once. Without the Supabase vars the deploy
still works in Local (per-browser) mode.

---

## Environment variables

| Variable | Required | Effect |
|---|---|---|
| `ASSET_FACTORY_PASSWORD` | optional | If **set**, the whole app is gated behind a password (`/login`, cookie-checked in `middleware.ts` + every API route). If **unset**, the app runs **open** (intended for local use). |
| `NEXT_PUBLIC_SUPABASE_URL` | optional | Supabase project URL. Part of the **Shared mode** signal (client-visible). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | optional | Supabase anon key. Part of the Shared-mode signal (client-visible). **Not** used for DB access. |
| `SUPABASE_SERVICE_ROLE_KEY` | optional | **Server-only.** Used by the API routes to read/write the factory tables + storage bucket. Never `NEXT_PUBLIC`, never sent to the client. |
| `ASSET_GENERATION_ENABLED` | optional | Must be `true` to allow **real** generation (V3). Default off; dry-run always works. |
| `REPLICATE_API_TOKEN` | optional | **Server-only** Replicate token. Required for real generation. Never sent to the client. |
| `GENERATION_MODEL` / `GENERATION_COST_PER_IMAGE` / `ASSET_GENERATION_MAX_BATCH` / `ASSET_GENERATION_DAILY_LIMIT` / `GENERATION_REQUEST_DELAY_MS` | optional | Replicate tuning (defaults: flux-schnell / 0.003 / 5 / 50 / 12000). |
| `GENERATION_PROVIDER` | optional | Default provider: `replicate` (default) or `openai`. The UI overrides per-generation. |
| `OPENAI_GENERATION_ENABLED` | optional | Must be `true` (with `ASSET_GENERATION_ENABLED`) to allow **real OpenAI** generation. Default off. |
| `OPENAI_API_KEY` | optional | **Server-only** OpenAI key (GPT Image). Never sent to the client. |
| `OPENAI_IMAGE_MODEL` / `OPENAI_COST_PER_IMAGE` / `OPENAI_MAX_BATCH` | optional | OpenAI tuning (defaults: `gpt-image-1` / 0.04 / 3). ⚠ confirm image pricing on your plan. |

Leave the three Supabase vars blank to run in **Local** (localStorage) mode. Set all
three to enable **Shared** mode. There is **no public user auth** — this is an
internal tool; the password is the access control and is server-only.

---

## Shared backend (V2)

When the Supabase env is set the factory runs in **Shared** mode (a "Shared" badge
shows in the header; "Local" otherwise):

- **Candidates, status, reviewer, reviewedAt, notes** persist in the
  `asset_candidates` table; the **review activity log** in `asset_review_actions`.
- **Uploaded/imported images** go to the public `asset-candidates` Storage bucket;
  the stored public URL is what the catalog export references.
- **All access is server-side** through password-gated API routes
  (`/api/candidates`, `/api/candidates/transition`, `/api/actions`, `/api/upload`)
  using the **service role**. RLS denies anon, so the public anon key cannot touch
  the tables — the password gate is the real access control.
- **Cross-device:** approve on desktop → open on phone → it shows approved, because
  both read the same backend. (Local mode is per-browser only.)
- **Reset samples** is disabled in Shared mode (avoids wiping shared data); a fresh
  empty DB is auto-seeded with the sample assets + the five starter packs on first load.

### Database setup

In your Supabase project (it can be the main app's project or a dedicated one —
the tables are independent):

1. Run [`supabase/schema.sql`](supabase/schema.sql) (fresh DB) **or** the ordered
   files in [`supabase/migrations/`](supabase/migrations/) (existing DB). This
   creates `asset_candidates`, `asset_review_actions`, `asset_packs`,
   `asset_generation_jobs` (RLS enabled, anon denied), and the public
   `asset-candidates` Storage bucket.
2. Copy the project URL + anon key + **service role** key into the env vars above.

---

## Catalog pipeline (V2.5)

The top navigation has four tabs; all read the same repository (Local or Shared).

- **Review** — the dashboard (import, quality checks, approve/reject, activity log).
- **Packs** — **asset packs** are first-class curated bundles
  (`id, slug, name, description, theme, status, assetIds, createdAt`). Create, edit,
  set status (`draft`/`validating`/`ready`), assign/unassign approved assets, delete,
  and **export** `approved-assets.json` + `asset-packs.json`. Five starter packs
  seed on first run (Cozy Creator, Photographer Studio, Podcaster, Cafe, Startup
  Workspace).
- **Generate** — the **AI generation queue** (V3 → V3.3). Choose a **provider**
  (Replicate / OpenAI), category/style/pack, type an idea, preview the prompt and
  per-provider cost, then **Dry run** (zero cost) or **Generate (real)** when enabled.
  A cost panel and job list (with cancel) track spend. Outputs enter `needs_review`
  and are auto-validated. See [docs/generation-ops.md](docs/generation-ops.md).
- **Style Lab** — the **Calibration Session** (V3.4). One locked identity
  (`nestudio_v2`). Generate the **Golden Calibration Set** (10 items) from **OpenAI**
  (the calibration provider; Replicate is comparison-only via **Shootout**),
  approve/reject, add notes, and **score five dimensions** (0–100). A live **Style
  Lock** banner shows whether V4 may proceed (all 10 approved AND score ≥ 85).
- **Calibration** (`/style-report`) — the **Calibration Report** (V3.4): approved /
  rejected assets, average + per-dimension scores, visual-consistency notes, remaining
  issues, and the style-lock status.
- **Sandbox** — the **Room Designer Sandbox** runs the same select-and-place logic
  as the main app's AI Room Designer on **approved** assets (a chosen pack or all),
  for a creator type + style. It shows placed assets (zone + action + reason),
  **unplaced** assets (the key "not room-ready" signal), zone usage vs capacity, and
  explanations. Selection only — no image generation.
- **Reports** — the **Catalog Quality Score** (0–100: metadata completeness, tag
  quality, zone coverage, category balance, approved ratio), catalog summary,
  coverage by group, room-readiness, per-pack scores, and the **Nestudio import
  validation** report (errors block; warnings inform).

The complete workflow + the **readiness criteria before V3** are in
[docs/catalog-validation.md](docs/catalog-validation.md).

> **Placeability invariant:** a category's Nestudio category must be accepted by one
> of its compatible zones under the nine-zone template (`lib/zones.ts`).
> `CATEGORY_META` encodes valid mappings and a unit test guards it; the validation
> report flags any asset that can't be placed.

---

## Asset bible usage

[`docs/asset-bible.md`](docs/asset-bible.md) is the source of truth for what a good
asset looks like (style, camera, lighting, transparency, categories, forbidden
styles, scale/naming/metadata rules, and the pre-approve checklist). The
machine-readable prompts live in [`lib/prompts.ts`](lib/prompts.ts) — master
prompt, negative prompt, per-category descriptors, style tokens, and a batch
builder.

---

## Review workflow

1. (If a password is set) sign in at `/login`, then **enter your reviewer name** —
   it's attached to your approvals in the shared activity log. Change it anytime
   via the "change" link in the header.
2. The dashboard seeds **30 sample candidates** on first run. A **Review activity**
   panel shows recent approve/reject/needs-edit decisions and who made them.
4. Filter by **status** or **category group**, or **search** by name/tag/category.
5. Tap a card for the large preview, **quality checks**, and editable metadata.
6. Decide: **Approve / Reject / Needs edit / Back to review**. Edit the name,
   category, tags, and review notes; **Save metadata**. In Shared mode each
   decision persists to the backend and appears for other reviewers.
7. **Quality checks** run automatically (missing image/category/tags, non-transparent,
   too small/large, duplicate slug/image, forbidden category, missing zones).
   Warnings never block; **critical** issues block approval.
8. **Keyboard shortcuts** (desktop): `A` approve · `R` reject · `E` needs edit ·
   `N` next · `Esc` close. Mobile uses big tap targets.

### Import / upload

The **+ Import assets** panel supports:

- **Upload** a PNG/WebP file (dimensions auto-detected).
- **Paste an image URL** (`.png`/`.webp`).
- **Paste metadata JSON** (a single object).
- **Bulk import JSON** (an array of objects).

Each item is validated (image present + PNG/WebP, dimensions, name, category;
transparency and tags are warnings).

---

## Export workflow

When candidates are **approved**, export them from the toolbar:

- **Export JSON** → downloads `approved-assets.json`
- **Export .ts** → downloads `approved-assets.ts` (a ready-to-import module)

Example outputs generated from the sample data are committed at
[`exports/approved-assets.json`](exports/approved-assets.json) and
[`exports/approved-assets.ts`](exports/approved-assets.ts). The export format
matches the main app's `CatalogAsset` shape.

### How approved assets enter Nestudio

The factory **never overwrites** the main app's `lib/assets.ts`. Import is
**manual and reviewed**:

1. Export the approved assets (above).
2. In the main repo, copy the records into `lib/assets.ts`'s `catalogAssets`
   array (or import the generated module and spread it), keeping ids unique.
3. Drop the asset images into the main app's `public/` and update `imageUrl`
   accordingly.
4. Run the main app's gates (`typecheck · lint · test · build`) and review the diff
   before committing.

This keeps the catalog change auditable and avoids any automated write into the
production app.

---

## Future — image generation plan (not built)

A later sprint will add, behind a disabled flag until ready:

- an **AI generation API provider** and a **batch generation queue**
- **rate limits**, **cost tracking**, and **provider comparison**
- **automatic background removal**
- **CLIP / vision tagging** and **duplicate image similarity**
- **reviewer accounts**, **asset packs**, and **scheduled overnight generation**

None of this is implemented yet. The prompt system and data model are shaped so it
can be consumed without a rewrite.

## Limitations

- **Live Supabase persistence is unverified in this environment** (no project
  provisioned here). The shared-backend path is covered by unit tests (mappers,
  repository, mode detection) and a green build; demo/Local mode is verified
  end-to-end in the browser. Apply `supabase/schema.sql` and set the env to use it.
- The **anon key is a mode signal only** — DB access is service-role + server-side,
  gated by the password. The password is therefore the real access control; treat
  it as a shared secret among trusted reviewers.
- **Reset samples** and the auto-seed exist for convenience; in a real shared
  environment, seed once and then manage real assets.
- Storage bucket is **public-read** (asset art is non-sensitive) for simple image
  URLs; switch to signed URLs if that changes.

---

## Project structure

```
apps/asset-factory/
  app/            layout, globals.css, page (gate→dashboard), login, packs, generate, style-lab,
                  style-report, sandbox, reports,
                  api/{login,logout,candidates,candidates/transition,actions,upload,packs,jobs,
                       generate,generate/config,generate/style}
  components/     review-dashboard, reviewer-gate, activity-panel, asset-card, asset-detail,
                  asset-thumb, import-panel, quality-badges, factory-nav,
                  packs-client, sandbox-client, reports-client, generate-client,
                  style-lab-client, style-report-client
  lib/            types, prompts, nestudio-spec, styles, providers, validation, quality, transitions,
                  export, activity, sample-data, sample-packs, store, auth, slug, reviewer, runtime-mode,
                  zones, import-validation, quality-score, reports, sandbox,
                  generation-config, generation-job, generation-validate, style-generate-runner,
                  image-provider, replicate-server, openai-server, server-generate, style-lab,
                  calibration, style-lab-store, api-auth, supabase-server, server-candidates,
                  server-storage, mappers, repo/{types,local,remote,index}
  docs/           asset-bible.md, catalog-validation.md, generation-ops.md, premium-style.md,
                  changelog.md   (HANDOFF_V3_4.md lives at the app root)
  exports/        approved-assets.json, approved-assets.ts, asset-packs.json (generated examples)
  supabase/       schema.sql, migrations/{0001_asset_factory,0002_asset_packs,0003_generation_jobs,
                  0004_job_style}.sql
  test/           prompts · nestudio-spec · styles · providers · validation · quality · transitions ·
                  export · repo-local · mappers · mode · activity · packs · import-validation ·
                  quality-score · reports · sandbox · generation-config · generation-job ·
                  generation-validate · style-generate-runner · replicate-server · openai-server ·
                  server-generate · style-lab · calibration
  middleware.ts   password gate (pages); API routes self-guard
```
