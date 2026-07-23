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

- **Avatar Golden Reference** (D43) — the avatar art-direction brief is written; the founder-run
  generate→critique→iterate loop finds the definitive style, then it freezes. The ONE open gate.
- **Founder library growth** — the founder generates/approves assets from a phone (ongoing, owned by founder).

## ✅ Resolved since last state (D28–D43)

- **Generation Platform** (D28–D30): Asset/Nest/Avatar are thin modules on one shared `GenerationStudio`.
- **Nest Factory** shipped + provisioned (D24, `nest_backgrounds`). **Avatar Factory** shipped, founder-only
  Beta (D31/D32/D39, `user_avatars` + private `avatar-private` bucket; cross-user isolation proven).
- **Auth = one source of truth** (D35/D36/D37): `getServerUser` + `useNestIdentity`; role-gated founder
  studios; `/api/auth/whoami` diagnostic; legacy Bazaar/Village public routes redirected.
- **Reliability** (D39): segmentation is best-effort/non-blocking → the "Preparing…" stall is gone.
- **Asset classification** (D38): deterministic family defaults (guitar→Identity/PLAY, never Story/static).
- **Art Engine v1** (D40): one structured Visual DNA → compiler + validators + Golden-Reference slots.
- **Studio experience** (D41/D42): warm premium Nestudio look; Avatar Studio is a calm "digital self" flow.

## ⛔ Not started

- **Creator Generator** (compose a complete starter Nest) — after the Avatar Golden Reference (D23/D27).
- The **Interaction Engine** / memory / sound — after Creator Generator (D23). Not before.
- **furniture@8 → compiler** wiring — asset prompt stays certified; rewiring needs a Laptop re-cert (D40).

## 🔴 Blocked / needs founder

- **Avatar Golden Reference** — needs the founder to generate 3–4 avatars + judge them (Claude can't
  generate/see avatars). This gates opening avatars to users (`AVATAR_PUBLIC_ENABLED=1`) and everything after.
- **Vercel env (Preview)** must include `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`,
  `OPENAI_API_KEY`, `FOUNDER_EMAILS`/`FOUNDER_USER_IDS`, `NEXT_PUBLIC_NEST_BACKEND=supabase` + a redeploy;
  Supabase Auth redirect URLs must include the preview domain — see `AUTH_ROUTING_SPRINT.md`.

## ⚠️ Known risks

- **Design-vs-code gap.** The docs describe a product the code doesn't yet implement. Risk: a new session mistakes the pre-pivot app for the current product. (This handoff exists to prevent that.)
- **Brand/legal.** The vision keeps recognisable brands (Canon, PlayStation…). Shipping trademarks is a founder/legal decision, not an engineering one. Marked throughout; unresolved.
- **OpenAI moderation** occasionally false-positives on a generation (~1/56). Batch tooling must flag, not silently skip.
- **GPT Image cost/latency**: ~$0.44 and ~45–70s per asset at high quality. At 1000 objects that's ~$440 + hours — needs a budget/plan.
- **Model dependency**: the whole engine assumes `gpt-image-1`. A deprecation would require a provider swap (the pipeline is provider-abstracted, which helps).

## 🎯 Current milestone

**Avatar Golden Reference v1** (D43) — the definitive Nestudio avatar style. The art-direction brief
lives in `lib/art-engine/type-dna.ts` (`AVATAR_TYPE_DNA`, `avatar-art-v1-candidate`). Claude cannot
generate or judge avatars, so the loop is founder-run: generate 3–4 → say what's wrong → Claude tunes
the prompt words → "That's it" → freeze into `lib/art-engine/golden-references.ts`. Then set
`AVATAR_PUBLIC_ENABLED=1` and build **Creator Generator** → **Interaction Engine** (D23/D27). See `06_NEXT_SPRINT.md`.

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
