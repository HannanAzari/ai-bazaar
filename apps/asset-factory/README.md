# Nestudio Asset Factory

An **internal, mobile-friendly review and export tool** for Nestudio (AI Bazaar)
assets. Hannan and trusted helpers use it to review generated/imported assets from
phone or laptop and approve only high-quality cozy **2.5D** assets into the
Nestudio catalog.

It is a **separate app** living at `apps/asset-factory/`, deployed independently to
`assets-nestudio.vercel.app`. It does **not** touch the main Nestudio app — not the
room engine, not production auth, not user-facing routes.

> **V1 has no live AI generation.** It focuses on import/upload → metadata →
> review → approve/reject → export. Generation fields exist on the data model but
> are inert; a future V2 will add a real provider (see below).

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
- **Environment variable**: `ASSET_FACTORY_PASSWORD` (see below)

Because the root directory is `apps/asset-factory`, Vercel installs this app's own
`package.json` and ignores the main app entirely. The two deployments are
independent.

---

## Environment variables

| Variable | Required | Effect |
|---|---|---|
| `ASSET_FACTORY_PASSWORD` | optional | If **set**, the whole app is gated behind a password (`/login`, cookie-checked in `middleware.ts`). If **unset**, the app runs **open** (intended for local use). |

There is **no public user auth** here — this is an internal tool. The password is
server-only and never sent to the client.

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

1. Open the dashboard (the home page). It seeds **30 sample candidates** on first
   run (stored in `localStorage`).
2. Filter by **status** or **category group**, or **search** by name/tag/category.
3. Tap a card for the large preview, **quality checks**, and editable metadata.
4. Decide: **Approve / Reject / Needs edit / Back to review**. Edit the name,
   category, tags, and review notes; **Save metadata**.
5. **Quality checks** run automatically (missing image/category/tags, non-transparent,
   too small/large, duplicate slug/image, forbidden category, missing zones).
   Warnings never block; **critical** issues block approval.
6. **Keyboard shortcuts** (desktop): `A` approve · `R` reject · `E` needs edit ·
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

V1 **never overwrites** the main app's `lib/assets.ts`. Import is **manual and
reviewed**:

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

## Future V2 — image generation plan (not built)

V2 will add, behind a disabled flag until ready:

- an **AI generation API provider** and a **batch generation queue**
- **rate limits**, **cost tracking**, and **provider comparison**
- **automatic background removal**
- **CLIP / vision tagging** and **duplicate image similarity**
- **reviewer accounts**, **asset packs**, and **scheduled overnight generation**

None of this is implemented in V1. The prompt system and data model are shaped so
V2 can consume them without a rewrite.

---

## Project structure

```
apps/asset-factory/
  app/            layout, globals.css, page (dashboard), login, api/login, api/logout
  components/     review-dashboard, asset-card, asset-detail, asset-thumb,
                  import-panel, quality-badges
  lib/            types, prompts, validation, quality, transitions, export,
                  sample-data, store, auth, slug
  docs/           asset-bible.md
  exports/        approved-assets.json, approved-assets.ts (generated examples)
  test/           prompts · validation · quality · transitions · export
  middleware.ts   password gate (active only when ASSET_FACTORY_PASSWORD is set)
```
