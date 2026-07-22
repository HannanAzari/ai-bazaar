# 02 · PROJECT STATE

> Honest snapshot of where implementation actually is. Read after `01`.
> The headline (2026-07-22): **the Founder Edition Creation Studio is shipped, deployed, and frozen.** Asset Factory works end-to-end on a phone with real Supabase persistence; the founder now grows the library personally. Next up: Background + Avatar factories reusing the same shell (`06`). Design still leads implementation for the *world* layer (rooms/interaction/memory), but the *creation tooling* is now real.

---

## 🆕 Shipped this milestone (Founder Edition — 2026-07-22, commit `704cffd`)

- **Asset Factory / Creation Studio** at `/asset-factory` — mobile-first: describe (or upload) →
  Translator → editable spec → generate (honest path) → review → approve → **publish to Supabase**.
- **Founder gate (server-enforced, fails closed):** `lib/founder-gate.ts` — every AI + publish route
  requires `x-founder-token` vs `FOUNDER_ACCESS_TOKEN`; anonymous callers 401 **before any spend/write**.
- **Vercel-safe:** references + assets persist to **Supabase Storage** (`lib/supabase/admin.ts`), not the
  ephemeral filesystem; `maxDuration` on generation routes; image→Storage-first so no partial published asset.
- **Canonical publish route** `/api/founder/publish-asset` → `nest_assets` (idempotent, refuses to clobber a
  different title). scope=global / ownerId=null in `visual_bounds`.
- **Deployed** to Vercel via `m12-nest-platform` auto-deploy. Gates green (typecheck · lint · 581 tests · build).
- **Status: FROZEN** (D20) — founder owns testing + library growth; no Create-flow redesign without a bug report.

## ✅ Completed

**Design (frozen, documented in `03`/`04`):**
- Product philosophy, the Alphabet (~57-object vocabulary), Nest Grammar (12 laws), the Universal Object System architecture.

**Asset Factory engine (working code, `lib/asset-pipeline` + `app/api/ai/*`):**
- GPT Image (`gpt-image-1`) is the live generation provider; Gemini deprecated.
- "Honest path": one generation, no repair loops, native transparency, automatic shadow/halo cleanup.
- `furniture@8` prompt (canonical camera, identity-first, no-external-shadow, official-furniture style refs).
- Vision identity extraction (`gpt-4.1-mini`) → **objective facts only** (the fix for a style-leak regression).
- Internal bench at `/dev/gpt-image`. Gates green (typecheck · lint · 545 tests · build). Last pushed: `cd137f3`.
- **Validated at scale:** a 56-object production batch passed ~95% technically (identity, transparency, no shadows, brand/text fidelity).

**Existing app (pre-pivot, from earlier milestones):** app shell, nest editor (create-asset flow), localStorage inventory, nest documents, village/discovery scaffolding. Predates the frozen design; will be re-aligned.

## 🚧 In progress

- **Background Factory + Avatar Factory** — reuse the Asset Factory shell (this sprint, `06`).
- **Founder library growth** — the founder generates/approves assets from a phone (ongoing, owned by founder).

## ✅ Resolved since last state

- **Material-aware render** — `furniture@8` is now material-aware (metal reads as metal, not wooden); the
  "wooden antique" failure is fixed. The Laptop is the certified v1 benchmark.
- **Founder-approval gate** — superseded by real founder use (D19): calibration now happens by the founder
  using the deployed Studio, not a synthetic pre-approval.
- **localStorage-only inventory** — the Founder Edition now publishes to **Supabase** (Storage + `nest_assets`);
  local storage is only a retry mirror.

## ⛔ Not started

- The **UOS interaction layer** in code (surfaces/animation/sound) — the **Interaction Engine** (after the factories + Creator Generator, D23).
- **Creator Generator** (compose a complete starter Nest) — next after the two factories (D23).
- **AI room composer**, **memory accumulation**, **business mode** — designed on paper, postponed (D15).

## 🔴 Blocked / needs founder

- **Background + Avatar persistence** blocks on the founder provisioning `nest_backgrounds` / `nest_avatars`
  (additive migrations shown before any write — same flow as the Laptop).
- **Vercel env vars** must be set for the deployed Studio to function (`FOUNDER_ACCESS_TOKEN`, keys,
  `NEXT_PUBLIC_NEST_BACKEND=supabase`) — see `PHASE0_ASSET_FACTORY_DEPLOY.md`.
- **Clean input photos** at scale — free stock ~60% usable; founder-provided photos preferred for a real library.

## ⚠️ Known risks

- **Design-vs-code gap.** The docs describe a product the code doesn't yet implement. Risk: a new session mistakes the pre-pivot app for the current product. (This handoff exists to prevent that.)
- **Brand/legal.** The vision keeps recognisable brands (Canon, PlayStation…). Shipping trademarks is a founder/legal decision, not an engineering one. Marked throughout; unresolved.
- **OpenAI moderation** occasionally false-positives on a generation (~1/56). Batch tooling must flag, not silently skip.
- **GPT Image cost/latency**: ~$0.44 and ~45–70s per asset at high quality. At 1000 objects that's ~$440 + hours — needs a budget/plan.
- **Model dependency**: the whole engine assumes `gpt-image-1`. A deprecation would require a provider swap (the pipeline is provider-abstracted, which helps).

## 🎯 Current milestone

**Background Factory + Avatar Factory** — reuse the exact Asset Factory shell (D21); only the generation
engine + translator target change per type. Backgrounds = empty room stages (one canonical camera);
Avatars = upload-only, full-body, transparent, private-by-default. Each needs an additive Supabase
migration (`nest_backgrounds`, `nest_avatars`) shown + founder-provisioned. See `06_NEXT_SPRINT.md`.
After these: **Creator Generator** → **Interaction Engine** (D23).

## 🧾 Technical debt

- Pre-pivot app code (editor, inventory, nest engine) not yet mapped onto the UOS.
- Inventory is device-local `localStorage` only (no server/Supabase inventory store) — fine for demo, not for production.
- `furniture@8` is a single hard-coded material voice (needs the material-system rework).
- Many exploratory files from old milestones sit uncommitted in the working tree (do **not** sweep them into commits).

## 🎨 Design debt

- **The library *look* was rejected:** modern electronics rendered as wooden antiques because the engine forces one warm-wood material. The fix (material-aware + more iconic/glyph-like rendering) is specified but not built.
- Backgrounds, sound, and interaction are designed on paper only.

## 🌱 Future opportunities

- AI auto-composer that builds a grammar-valid Nest from three questions (the UOS makes this a bounded problem — see `04`/`03`).
- Business Nests as a distinct, high-value segment (products-as-identity).
- Memory accumulation as an emotional retention loop no competitor has.
- Starter Nests (13 archetypes) as an instant-onboarding growth lever.
