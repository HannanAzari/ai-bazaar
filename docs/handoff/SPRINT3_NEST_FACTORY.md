# Sprint 3 — Nest Factory (Founder Edition)

Status: **engineering complete, gates green, needs `nest_backgrounds` provisioning + a founder phone test.**

The Nest Factory is Asset Factory's twin — same architecture, same UX, same review/approval/
publish flow, same founder gate, same Supabase safety. **Only the generation engine changed:**
empty rooms are **text-to-image (architecture only)** instead of the object cutout→edit pipeline.

## What shipped

- **`/nest-factory`** (mobile-first, founder-gated): describe an empty room → **Nest Translator**
  → editable **Nest DNA** spec → generate → review → **"Would I proudly let creators build inside
  this Nest?"** → Approve → publish.
- **Nest Translator** (`/api/ai/nest/translate`) → a `NestSpec` (category, mood, style, walls,
  floor, ceiling, windows, palette, lighting, architectural details, recommended asset tags).
- **Nest Generator** (`/api/ai/nest/generate`) — `gpt-image-1` text-to-image at the canonical
  portrait size (`1024x1536`, cover-fit into the editor's `3:4` stage), warm/minimal/matte DNA
  prompt with a hard negative list (no furniture / props / people / text / logos / clutter). Raw
  output persists to Supabase Storage (Vercel-safe).
- **Dedicated Nest Library** — publishes to **`nest_backgrounds`** (NOT `nest_assets`) via the
  founder-gated **`/api/founder/publish-nest`** (image→Storage first, idempotent, refuses to
  clobber a different title). scope/versioning + DNA metadata travel in `metadata`.
- **Selectable automatically:** a published Nest (`status='approved'`) appears in
  `getBackgrounds()` → **Create → Build My Own → Choose Empty Nest** → `createFromBackground` →
  the editor, ready to decorate. **No editor-UX change** (per the sprint's STOP conditions).

Gates: typecheck · lint · **589 tests** (8 new) · production build all green. Server-side gate
proven: `/api/ai/nest/translate`, `/api/ai/nest/generate`, `/api/founder/publish-nest` all return
**401 before any spend/write** without a valid `x-founder-token`.

## ⛔ Before it works — provision the Nest Library

`nest_backgrounds` is **not yet in the live DB** (only `nest_assets` was provisioned). Run this
**additive, non-destructive** migration in the Supabase SQL editor, then tell me "provisioned":

- `supabase/provision/nest_backgrounds_provision.sql` (create table if not exists + `metadata`
  column + world-readable SELECT policy + `notify pgrst`). Rollback: `..._rollback.sql`.

No new Vercel env vars — the Nest Factory reuses the Asset Factory's server env
(`FOUNDER_ACCESS_TOKEN`, `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_NEST_BACKEND=supabase`).

## Founder phone-test workflow (acceptance)

Sit down at lunch and, on the deployed preview:

1. Open `/nest-factory` → describe an empty room (e.g. "warm music studio, big back wall, wooden
   floor, evening light") → **Interpret**.
2. Review the Nest DNA spec (edit the room description if you like) → **Generate** (~$0.19).
3. Review the room + DNA score → answer **Yes** → **Approve & Publish**.
4. Open **Create → Build My Own** → your Nest is there → select it → the editor opens on it →
   place a couple of assets → **reload** → room + placements persist.

Prove the three first (compare before scaling): **Minimal Flexible Room · Creator Studio ·
Music Studio** — same camera + geometry, distinct identity.

## Known limitations

- **DNA score is spec-level**, not pixel-level — an honest pre-generation signal that the request
  stays inside the Nest language; the image itself is the founder's eye (the review question).
- **Portrait `1024x1536` cover-fits** the `3:4` stage (slight crop). If a room needs the full frame,
  that's the signal to add an exact-aspect export step.
- **No generation-job queue** (synchronous, like Asset Factory) — fine for single rooms on a
  Pro/Fluid Vercel plan.
- **Users never generate Nests** (product decision) — `/nest-factory` is founder-gated only.
