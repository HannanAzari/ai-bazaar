# Nestudio — CTO Handoff (V2, House → Nest architecture)

> Self-contained orientation for a new CTO. You should be able to continue without re-reading prior
> decisions. Master architecture: [nestudio-production-pipeline.md](nestudio-production-pipeline.md).
> Pivot rationale: **ADR-027**; **camera lock: ADR-028** in [decision-log.md](decision-log.md).
>
> **Camera decision (ADR-028, locked 2026-06-26):** V2 uses **front-facing cinematic Nests, not
> isometric rooms.** The Nest camera is front-facing, eye-level/slightly-elevated (~5–10° tilt):
> full front wall + slivers of the left/right walls + floor, shallow depth, mobile-first — **not**
> isometric, **not** ~30° parallel, **not** top-down, **no** perspective-warping. The 28 approved
> ~30° iso assets are **V1 reference only**; the V2 Asset Library is authored to the front-facing
> camera.
>
> **Status:** architecture established (documentation-first). The app still contains V1 prototypes
> (isometric Golden Room + wall packs at `/design/golden-room`) which are now **reference history**,
> not the target.
>
> **Update (2026-06-30):** the front-facing **Nest editor foundation is now built** —
> M7A (mobile editor) → M7B (hotspots) → M7B.1 (calibration) → M7B.2 (selection + asset library +
> bottom sheet) — and **M7C** adds structured in-Nest navigation
> (**Main Nest → Focus Area → Detail Scene**, [ADR-029](decision-log.md);
> [nest-focus-detail-scenes-v1.md](nest-focus-detail-scenes-v1.md)) at `/design/nest-editor`
> (authoring) and `/design/nest-focus` (visitor). M7C follows and reuses the completed
> M7A–M7B.2 foundation; still no Supabase persistence and no generated artwork.

---

## 1. Product vision

Nestudio **composes digital homes**. Each creator has a **Nest** — a cozy, front-facing scene that
feels *like them*. Visitors explore a creator's Nest and tap objects (TV, books, frames, desk…) that
animate and open content. The emotional north star: **"this place feels like me"** (not "this is a
beautiful room"). Mobile-first, warm, handcrafted, safe, expressive.

## 2. Architecture

```
Village → House → Nest → Objects → Content
```
- **Nest** = the primary creator surface: a **front-facing cinematic scene** (full front wall + slivers
  of left/right walls + floor → depth without isometric rendering).
- A Nest is **composed**: a curated **Nest Template** + **Scene Slots** + **Assets** (from the Asset
  Library) + **Avatar** + a few **personal belongings**.
- **"Wall" is removed** from the user-facing model. Users visit a *Nest*.

Full detail + the production pipeline: [nestudio-production-pipeline.md](nestudio-production-pipeline.md).

## 3. Production pipeline (summary)

```
AI Concept Art → Asset Approval → Asset Library → Nest Templates → Scene Slots →
Interaction Library → Avatar Generator → Personal-Object Generator → Nest Composer → Supabase → Mobile App → (future) Marketplace
```
Composition is the primary system; AI generation is minimal (concept art to seed the curated library;
runtime generation only for avatars + truly personal belongings).

## 4. AI strategy

- **AI is excellent at concept art** → use it to **seed the Asset Library**, human-approved. Never ship
  raw AI output to users.
- **AI is unreliable for whole-scene consistency** → do **not** generate room shells + wall packs per
  creator. Curate instead.
- **Runtime AI is the exception:** avatar + personal belongings only.
- **3D asset generation:** promising **future internal production** tool; **not** an MVP dependency.

## 5. Asset Library philosophy

The library is the **heart** of Nestudio. Everything reusable lives there (furniture, electronics,
decor, creator tools, business goods, Nest Templates, Interactions), curated for one DNA + one camera
so any combination stays consistent. **Only truly personal belongings require generation.** Assets are
tagged by the **Scene Slots** they fit, enabling deterministic composition. This is what makes Nestudio
scalable and premium where per-creator generation could not.

## 6. Interaction philosophy

Every interactive object is **Object → Animation → Content** (e.g. TV → glow → YouTube; book → open →
article; lamp → light → ambience). Animations are **lightweight** and reduced-motion-safe; behaviours
live in a reusable **Interaction Library** keyed by object type. **No complex avatar navigation in MVP.**

## 7. Visual DNA (philosophy unchanged; camera updated)

Warm, rounded, matte, one-accent, warm-light/cool-shadow, cozy/handcrafted — see
[nestudio-visual-dna.md](nestudio-visual-dna.md). Applied to **front-facing Nest scenes + a
camera-matched Asset Library** rather than isometric shells. **The camera is locked to front-facing
by ADR-028** (the DNA's old ~30° iso Perspective Contract is superseded, preserved as history in
visual-dna §11.1).

## 8. What has been VALIDATED (keep)

- AI-generated **concept art** quality is excellent.
- **Front-facing cinematic scenes** beat isometric rooms on emotional engagement.
- **Supabase storage** + the **generate→review→approve** discipline (Asset Factory) work well.
- **Composition from a curated library** is the right path to consistency + low cost.
- The **Visual DNA** (palette/light/shape) is sound.
- The Golden Room exercise validated the *emotional bar* and the front-facing direction (see
  [golden-room-exploration.md](golden-room-exploration.md)).

## 9. What has been REJECTED (do not revisit without strong reason)

- **Isometric room shells** as the primary surface (front-facing wins).
- **Perspective-warping wall images** into room shells (not premium quality).
- **Per-creator AI generation of room shells + wall packs** (consistency drift).
- The **"Wall"** abstraction and **hotspot-bound wall regions** (replaced by Nest Templates + Scene Slots).
- **Heavy 3D / avatar navigation** for MVP.

## 10. Current code state (honest)

- **Main app** (`/`): the cozy-village product; demo-by-default; room engine V1–V5; production cutover
  V1; analytics/discovery. Prototypes under `/design/*` including `/design/golden-room` (V1 isometric
  Golden Room shell + media/work wall packs, Supabase-backed). These are **reference history** for V2.
- **Asset Factory** (`apps/asset-factory`): isolated app with the Style Lab (object concept-art
  generation, OpenAI), approval flow, Supabase persistence, and the Golden Room console. This is the
  seed of the V2 **Asset Library + Approval** pipeline.
- **Storage:** Supabase bucket `nestudio-assets` holds the validated Golden Room shell + wall PNGs.
- Everything compiles; gates (typecheck/lint/test/build) are green in both apps.
- **Uncommitted:** a large body of V1 prototype + doc work sits uncommitted on `main` (the user has
  been committing selectively). Coordinate before committing.

## 11. Roadmap

- **Now (this sprint):** documentation pivot (done) — establish V2 architecture. No implementation.
- **Next:** rebuild the Asset Factory around the Nest architecture — Asset Library schema + Nest
  Template + Scene Slot data model + approval flow (see §recommendations in the sprint summary).
- **Then:** Interaction Library; Nest Composer (evolve the deterministic designer); one production Nest
  Template end-to-end (compose → Supabase → mobile render).
- **Later:** Avatar Generator; Personal-Object Generator; multi-Nest houses; Village discovery on V2.
- **Future:** Marketplace (creators/3rd parties publish assets/templates/interactions).

## 12. Operating constraints (carry forward)

- **Node 20** for tooling. **Demo-by-default** main app (no Supabase env → pure demo). Asset Factory is
  **isolated** (root tsconfig excludes `apps/`). **Two layers in sync** (demo lib + SQL parity) for app
  features. Mobile-first + accessibility (reduced-motion, quick-links fallback). **AI never ships raw to
  users; humans approve.** Don't reopen rejected directions (§9) without a new ADR.

---

*Handoff for the V2 (House → Nest) architecture. Documentation-first; implementation is the next sprint.*
