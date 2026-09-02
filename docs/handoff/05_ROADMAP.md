# 05 · ROADMAP

> Phased plan from here to public launch.
> The **canonical current track is the post-editor-freeze launch line below.** Follow that for
> sequencing. The Phase 0–7 plan further down is the **design-era arc**, kept for reference.
> The Founder Edition Creation Studio track (Asset → Nest → Avatar → Creator Generator →
> Interaction Engine) is **superseded** — see D44. **Avatar Golden Reference is no longer the
> current priority.**

---

## ▶ Current track — post-editor-freeze launch line (as of 2026-09-03)

The editor line closed at `editor-beta-v1` (`533c8ec`, 2026-08-11), frozen in
`docs/EDITOR_BETA_V1_FREEZE.md`. What follows is the road to launch.

### Sprint 0 · Unblock and prove media — CURRENT

1. Apply `supabase/provision/m27a_media_storage.sql` (founder) — the `nest-media` bucket has
   never existed. Gate: `node scripts/verify-nest-media.mjs`.
2. Restore the Vercel deployment (founder) — `ai-bazaar` is `402 DEPLOYMENT_DISABLED`.
3. Run the **first real photo upload** end to end: upload → connect to a frame → save →
   reopen → publish → visitor acceptance → visitor reload. This has never run.

**Exit:** a real uploaded photo renders for a signed-out visitor on a deployed build.

### Then, in order (D44)

| # | Item | What it means |
|---|---|---|
| 1 | **Create / onboarding polish** | The path from arriving to a first Nest. |
| 2 | **Profile / social acceptance** | Two real accounts: like, comment, follow, notification, views — the least-proven area. |
| 3 | **Village v1** | The spatial layer, first real version. |
| 4 | **Asset / Background / House pipeline hardening + launch content generation** | Make generation dependable, then produce the launch library. New backgrounds should come from a **wider master with a strong 3:4 safe area**, and the mix should shift toward simple **canvas rooms** (D45). |
| 5 | **Simplified Avatar v1** | Deliberately simpler than the old Golden Reference scope. Do not resurrect that track. |
| 6 | **Google / Apple auth** | Real third-party sign-in. |
| 7 | **CI/CD · observability · analytics** | Know that it built, that it is up, and what people do. |
| 8 | **Performance / PWA** | Installability and speed on a real phone. |
| 9 | **Safety / legal** | Includes the unresolved branded-asset question (RV1). |
| 10 | **Seeded world** | Launch into a populated place, not an empty one. |
| 11 | **Launch QA / release candidate** | The gate before anyone outside is invited. |

Rules carried forward: the editor freeze holds; additive migrations only, shown and
founder-provisioned; never change the canonical camera; founder-gated generation/publish;
users never generate Nests; a real-person photo is never public.

---

## Design-era phase plan (reference)

## Phase 0 · Language Lock (calibration)
- **Goal:** prove the frozen design renders as intended before scaling. Make the engine material-aware and iconic.
- **Deliverables:** founder-approved vocabulary/grammar/UOS; a material-aware `furniture@8`; a tiny **calibration batch** (one object per class + one per material type — e.g. a metal laptop, a fabric sofa, a ceramic vase, a branded Identity object, a Portal, a Memory object).
- **Exit criteria:** the calibration batch reads as *iconic, coherent, material-correct* by founder eye — modern electronics look modern, not wooden.
- **Success metrics:** ≥ 90% of the calibration set approved; zero "wooden antique" failures.

## Phase 1 · Foundation (the room)
- **Goal:** every Nest can look like a home. Build the Story core + the room/background baseline.
- **Deliverables:** the highest-coverage Story objects (sofa, desk, chair, rug, lamps, plant, shelf, window, art…); one or two starter backgrounds; the object → room placement (host-acceptance) working.
- **Exit criteria:** a hand-placed Nest looks coherent and warm with no interactions yet.
- **Success metrics:** a founder-built room passes the grammar (1 hero, ≥40% empty, one focal point) and "feels like a home."

## Phase 2 · Hero Assets (Identity)
- **Goal:** the identity vocabulary — the objects that make a Nest personal.
- **Deliverables:** the ~21 Identity objects, ordered by starter-Nest coverage (cameras, consoles, instruments, computers, fitness…), including branded variants (legal permitting).
- **Exit criteria:** each of the ~13 creator archetypes has a recognisable Hero + supporting objects.
- **Success metrics:** ≥ 95% of Identity assets approved; brand-recognisable where intended.

## Phase 3 · Golden Backgrounds
- **Goal:** the background categories (Creator Studio, Gaming, Living Room, Office, Music Studio, Photography, Fitness, Art, Café, Minimal Apartment).
- **Deliverables:** one "golden" background per category following the background grammar (`04`); time-of-day + mood variants.
- **Exit criteria:** objects composited into any background sit in the same light; backgrounds never compete with objects.
- **Success metrics:** every category background approved; consistent camera + lighting across all.

## Phase 4 · Interaction Engine (Portals + UOS)
- **Goal:** objects become interactive; the UOS + surface + animation + sound systems are live.
- **Deliverables:** the one lifecycle; the 8 patterns; the surface system (creators connect real content); the animation + sound registries; the ~8 Portal objects working end-to-end.
- **Exit criteria:** a visitor can tap a laptop → it opens → content shows → closes, with the one interaction + sound language, across all Portals.
- **Success metrics:** all portals reuse the shared framework (no bespoke code); interaction feels "one hand"; sound tiny/warm.

## Phase 5 · Starter Nests + Memory
- **Goal:** instant, beautiful Nests + the emotional layer.
- **Deliverables:** the 13 prebuilt starter Nests (users only connect content); Memory objects + accumulation/reveal; the editor-intelligence flow (answer questions → 2–3 composed variants → fine-tune with guardrails).
- **Exit criteria:** a new creator picks an archetype and has a beautiful Nest in minutes without manual placement.
- **Success metrics:** time-to-first-Nest < 5 min; ≥ 90% of auto-composed Nests accepted with light edits.

## Phase 6 · Creator Beta
- **Goal:** real creators build and share Nests.
- **Deliverables:** onboarding, publish/share, visitor experience, business-mode v1 (products-as-identity).
- **Exit criteria:** creators build coherent Nests unaided; visitors explore and "meet the person."
- **Success metrics:** invite→published-Nest conversion; visitors-per-Nest; "come visit my Nest" shares; qualitative "felt like a place."

## Phase 7 · Public Launch
- **Goal:** open Nestudio to the world.
- **Deliverables:** scale (200→1000 objects via data-only additions), performance, discovery, business tier.
- **Exit criteria:** the vocabulary covers ~95% of creators/businesses; the system stays coherent at scale.
- **Success metrics:** retention (return visits), creation rate, Nest shares, business adoption — **visitors and curiosity over vanity metrics** (see `10`).
