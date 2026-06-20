# Supabase persistence for approved assets (V3.7.5)

Approved real OpenAI Style Lab assets are saved to **Supabase Storage + the candidates
table** (not the local filesystem), so the main app / room engine can read them on
Vercel. Endpoint: `POST /api/style-lab/save-approved-assets`.

## Required env vars (asset-factory deploy + local)

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key (mode signal; not used for DB access) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** — the save endpoint uses it for Storage + DB |

If any are missing the endpoint returns **503** with a clear message and the UI shows
the failure ("Supabase is not configured…").

## Required storage bucket

- **Bucket name:** `asset-candidates` (public read).
- Approved PNGs are written to `asset-candidates/interior-v1/<asset-id>.png` (upsert —
  re-saving the same id overwrites that one object).
- Create it once: Supabase Dashboard → **Storage → New bucket** → name `asset-candidates`,
  **Public** on. (The same bucket the V2 import/generation flow already uses.)

## Required table / migration

The candidates table `asset_candidates` gains three provenance columns. Run on the DB:

- Fresh DB: [`supabase/schema.sql`](../supabase/schema.sql) (already includes them), **or**
- Existing DB: [`supabase/migrations/0005_candidate_provenance.sql`](../supabase/migrations/0005_candidate_provenance.sql):

```sql
alter table public.asset_candidates add column if not exists personality      text;
alter table public.asset_candidates add column if not exists source           text;
alter table public.asset_candidates add column if not exists source_sample_id text;
create index if not exists asset_candidates_source_idx on public.asset_candidates (source);
```

Run it in Supabase Dashboard → **SQL Editor**.

## What gets saved per asset

Storage: `asset-candidates/interior-v1/<id>.png`. DB row (`asset_candidates`, upsert by
`id`): id, name, slug, category, placement_type, **image_url = public Supabase URL**,
prompt (generation prompt), model_provider `openai`, model_name `gpt-image-1`,
**personality**, tags, **source `style_lab`**, status `approved`, created_at.

- `data:image/png;base64,…` → decoded + uploaded · remote URL → fetched + uploaded ·
  already a Supabase public URL → kept. Dry-run `/samples/` and non-OpenAI assets are skipped.

## How to verify in the Supabase dashboard

1. **Storage → asset-candidates → interior-v1/** — you should see `<id>.png` files.
2. **Table editor → asset_candidates** — filter `source = style_lab`, `status = approved`;
   `image_url` should be a `…/storage/v1/object/public/asset-candidates/interior-v1/…png` URL.
3. SQL check:
   ```sql
   select id, name, category, status, source, image_url
   from asset_candidates where source = 'style_lab' order by created_at desc;
   ```
4. In the factory: the **Review** tab lists them after refresh; **Style Lab → Approved
   Library** exports (`Export approved JSON`, `Download room-engine catalog`) use these
   Supabase-saved rows.
