# Golden Nest Production Bible

> **The definitive art & production bible for Nestudio.** It defines what a Nest is, the locked
> visual/production language, and the system that lets Nestudio scale to **millions of creators while
> staying handcrafted and premium.** Builds on the V2 architecture
> ([nestudio-production-pipeline.md](nestudio-production-pipeline.md), ADR-027) and the locked
> [nestudio-visual-dna.md](nestudio-visual-dna.md).
>
> **Status:** art/production direction (documentation-first). No code, no Asset Factory build, no DB
> changes. Implementation recommendations are at the end.

---

## 0. The core thesis (read this first)

> **Nestudio does not generate homes. It *composes* them from a curated, style-locked kit.**
> Premium consistency at scale comes from **constrained combinatorics**: one locked DNA + one locked
> camera + a curated Asset Library (every asset built to that camera/DNA) + Scene Slots that
> guarantee placement + variants + content + avatar + a few personal belongings. Millions of unique,
> consistent Nests from a finite, hand-crafted catalog.

This is exactly how stylized hits stay coherent at scale (see §1) — and the opposite of per-creator
AI scene generation, which we proved drifts (ADR-027).

## 1. Lessons from stylized production systems (study the *system*, not the look)

We study these for **consistency, modularity, scalability** — never to copy visuals (originality §16).

| Game | The production lesson Nestudio adopts |
|---|---|
| **Animal Crossing** | A **finite, curated catalog** + **color/material variants** + **seasonal drops** → millions of unique homes, zero style drift. Items snap to a placement system. |
| **Stardew Valley** | A **fixed asset set on a strict grid** + one locked pixel bar → infinite-feeling worlds from a small, coherent kit. |
| **Unpacking** | **The emotion is arranging *your own* curated belongings** into snap zones — not novelty. Objects are multi-state and surface-aware. This is Nestudio's emotional engine. |
| **Disney Dreamlight Valley** | **Themed sets + slot/grid placement + cosmetic monetization** under one art team's locked bar → premium feel + a marketplace. |

**Synthesis → Nestudio's five production laws:**
1. **One locked bar** (DNA + camera) authored once, obeyed by every asset.
2. **Curate, don't generate** (a finite premium catalog beats infinite drift).
3. **Slots guarantee composition** (the template author already placed correctly; assets just snap).
4. **Variants create personalization cheaply** (color/material/accent, not new meshes).
5. **The emotion is arrangement of *your* things** (Unpacking), so make choosing + placing delightful.

---

## 2. What exactly is a Nest? *(Q1)*

A **Nest** is **one front-facing cinematic interior scene** that is a creator's home surface. It is:
- **The atomic creator surface** (MVP: one Nest per creator; a House may hold several later).
- **Composed, not generated:** a curated **Nest Template** (the architecture/shell) + **Assets** snapped
  into **Scene Slots** + an **Avatar** + a few **personal belongings** + an **ambience** (lighting mood).
- **A stage, viewed front-on with shallow depth:** the full **front wall**, **slivers of the left/right
  walls**, and the **floor** — depth without isometric rendering.
- **Interactive:** objects animate and open content (Object → Animation → Content).

A Nest is *someone's place*, never "a room template." The word **"Wall" does not exist** in the model.

## 3. What makes a Nest emotionally successful? *(Q2)*

North star: **"this place feels like me."** A Nest succeeds when:
- a **visitor** feels they entered a *person* (curiosity, warmth, "I want to look around"), and
- the **creator** feels **ownership + pride** ("this is mine").

The emotion comes from **arranging *your* chosen things** (Unpacking), the **handcrafted warmth** of
the kit, **personal touches** (avatar, belongings, accent color), and **lived-in detail** (a half-read
book, a warm lamp). It must feel: cozy · personal · handcrafted · warm · creative · safe · lived-in ·
expressive. Never: dashboard · portfolio site · interior-design software · furniture catalogue · empty
AI room.

## 4. Camera language

> **Locked by ADR-028 (2026-06-26):** the front-facing cinematic Nest camera below is the official
> V2 production standard; the V1 ~30° parallel-iso Perspective Contract is superseded (visual-dna §11
> / §11.1). The 28 approved iso assets are V1 reference; the V2 Asset Library is authored to this camera.

- **One locked camera for the entire product.** Every asset and template is authored to it, so any
  asset looks correct in any Nest. Changing it later invalidates the library — treat as frozen.
- **Front-facing, eye-level-ish, gentle downward tilt (~5–10°)** — you feel *inside* the room facing
  the main wall. **Not** isometric, **not** top-down, **not** ~30° parallel, **not** a dramatic
  vanishing point.
- **Shallow "stage box" depth:** front wall fronto-parallel; left/right walls rake inward as **narrow
  slivers**; the floor tilts up slightly to meet the front wall. This reads as depth while keeping
  assets near-fronto-parallel (easy to author + snap).
- **Mobile-first aspect:** portrait primary (the Nest fills a phone). A landscape variant of the same
  camera may exist for desktop/share, authored to the same angles.

## 5. Perspective rules

- **Locked depth planes** (the only places assets live):
  1. **Front wall plane** (fronto-parallel) — wall-mounted assets (TV, frames, shelves, pinboard).
  2. **Left/right wall slivers** (fixed rake, e.g. ~18–22°) — accent/decor only; never primary content.
  3. **Floor plane** (gentle up-tilt) — floor furniture (sofa, desk, rug, plant, avatar).
  4. **Foreground layer** — small near objects (coffee-table items) for depth.
- **Parallel/near-orthographic** (no strong perspective convergence) so an asset authored once fits
  every Nest at its slot.
- **No perspective-warping of flat images** (rejected, ADR-027). Assets are authored *to* the camera,
  not warped into it.
- **A slot encodes the exact plane + footprint**, so the template author guarantees correctness.

## 6. Materials *(carried from Visual DNA, applied to front-facing Nests)*

- **Premium matte only** — soft matte finish, restrained sheen, subtle ambient occlusion. No gloss/
  chrome/plastic.
- **Signature wood: warm oiled oak** (walnut dark variant) across every category — the cohesion glue.
- **Textiles:** wool, bouclé, felt, soft leather, linen — soft, plump-but-tailored.
- **Plaster / stone:** warm matte walls; **ceramics:** matte glaze.
- **Metal:** sparingly, powder-coated matte (never reflective).
- **Material feel test:** every surface should look warm and touchable, not cold/slick.

## 7. Lighting

- **One locked lighting signature:** soft warm **key from upper-left**, gentle ambient fill, soft
  contact shadows, **warm light (`#fff6e0`) / cool-plum shadow (`#46365a`)** — never neutral grey,
  never dramatic.
- **Two layers:** the **Nest Template bakes** the room's architectural/ambient light; **objects carry**
  self-shading consistent with the locked key; **contact shadows** are composited under floor objects.
- **Ambience presets** (not per-asset): e.g. *warm day · golden evening · cozy night* — a global tint/
  glow over the composed Nest, a cheap, high-impact personalization + "lamp toggles ambience"
  interaction. All presets keep the warm/cool law.

## 8. Asset categories *(Q4, Q6 — what's a reusable, curated asset)*

Everything placeable is a **curated library asset** (built to the locked camera + DNA), never
per-creator generated:
- **Furniture:** sofa, armchair, coffee table, desk, bookshelf, side table, bed…
- **Electronics:** TV, speakers, laptop, microphone, console…
- **Decor:** plants, books, frames, lamps, trophies, rugs, posters…
- **Creator tools:** cameras, keyboards, drawing tablets, easels…
- **Business:** product shelves, artwork, handmade-goods displays…
- **Architecture (Nest Templates):** the curated front-facing shells that define Scene Slots (§3, §9).
- **Interactions:** the Object → Animation → Content behaviours (§11).
- **Avatars:** style-consistent characters (§13).

**Architecture is curated, never generated.** **Standard objects are curated, never generated.** Only
**personal belongings + avatars** may be generated at runtime (§12, §13).

## 9. Asset quality standards *(Q7 — quality levels)*

Every asset must pass: **DNA fit · locked-camera fit · slot-fit · transparent-PNG isolation ·
readable silhouette · approved**. Beyond that, assets carry **quality levels / states**:

- **LOD tiers (render):**
  - **Thumbnail** — for village/discovery cards (tiny, simplified).
  - **Standard** — the in-Nest render.
  - **Hero / interaction-detail** — high-detail for interactive + zoomed objects (TV, desk, avatar).
- **Interaction states:** idle · hover/active · open (e.g. book closed→open, TV off→glow) — only for
  interactive objects (§11).
- **Variant sets:** color/material/accent variants (personalization without new meshes — the AC lesson).
- **Tiers for monetization:** *free* vs *premium/marketplace* assets share the bar but differ in
  richness/theme.

**Which assets deserve multiple quality levels:** **hero + interactive** objects (TV, desk, bookshelf,
frames, avatar) get full LOD + states + variants; **filler decor** (small plants, stacked books) gets
standard + a couple of variants; everything gets a thumbnail. Don't over-invest in filler.

## 10. Scene Slot philosophy *(Q9 — how slots work conceptually)*

A **Nest Template defines named Scene Slots**; assets **snap into** them. A slot encodes everything
needed for guaranteed, consistent composition:
- **Plane + footprint:** which depth plane (front-wall / side-sliver / floor / foreground) and mount
  type (wall-mounted · floor-standing · surface-top · hanging).
- **Position / scale / anchor** within the template (authored to the locked camera).
- **Accepted categories** (e.g. a "Media Slot" accepts TV/screen; a "Plant Slot" accepts plants).
- **Default interaction** (e.g. Media Slot → video).
- **Importance tier:** **primary** (hero, expected to be filled, drives identity) vs **optional**
  (ambient/filler).
- **z-layer** for correct paint order.

**Composition = deterministically matching assets to compatible slots.** The template author already
solved placement/perspective, so **any compatible asset looks right** — this is the consistency
guarantee. Personalization is *which* asset + *which* variant fills each slot. **No free-form pixel
placement, ever.** Example slots: Media · Desk · Shelf · Books · Plant · Window · Avatar · Frame · Lamp
· Product.

## 11. Which objects become interactive? *(Q8)*

Interactive = maps to creator **content/identity**; everything else is **ambient decor**.

| Object | Animation | Content |
|---|---|---|
| TV / screen | glow | video (YouTube…) |
| Laptop | screen-on | code / website (GitHub…) |
| Bookshelf / book | open | writing / article / blog |
| Frame / photo | zoom | gallery / images |
| Speaker / record player | pulse | music (Spotify…) |
| Microphone | glow | podcast |
| Product shelf | highlight | shop / products |
| Trophy / board | shine | achievements |
| Avatar | wave / idle | intro / bio |
| Lamp | light | toggle ambience (no external content) |
| Plant | leaf sway | ambient only |

Behaviours live in a reusable **Interaction Library** keyed by object type (any asset of that type
inherits it). Animations are **lightweight** (transform/opacity, reduced-motion-safe). **No complex
avatar navigation in MVP.**

## 12. Personal object philosophy *(Q5 — the only runtime generation)*

**Personal belongings are the one place runtime AI generation is allowed** — a creator's *truly
unique* items (a specific product, a custom poster, a signature artwork). Rules:
- They occupy normal Scene Slots and **must conform to the locked camera + DNA** (generate within
  constraints; auto-reject off-DNA outputs).
- They are the *exception*, not the rule — most of a Nest is curated assets.
- They are what make a Nest unmistakably *this creator's*. Keep them few and meaningful.
- Pipeline: **Personal-Object Generator** → DNA/camera conformance check → slot placement.

## 13. Avatar philosophy

The avatar is **just another asset in an Avatar Slot** — not the center of the architecture. It is
**generated** (style-consistent, to the locked camera/DNA) from creator input, carries idle + simple
states (MVP: idle or a small wave), and expresses identity (one accent, personal touches). Future:
richer interactions/poses. It must read as part of the same handcrafted world as the furniture.

## 14. AI generation strategy *(synthesis of Q5/Q6)*

- **AI seeds the library (internal):** concept art for candidate assets/templates → **human approval**
  → curated library. **Never ship raw AI to users.**
- **AI at runtime (exception only):** avatar + personal belongings, generated **within DNA/camera
  constraints** and conformance-checked.
- **AI is never used** to generate architecture, standard objects, or whole scenes per creator
  (rejected, ADR-027 — drift).
- **3D generation:** a promising **future internal production** tool (to author/animate library assets
  faster); **not** an MVP dependency and **not** a runtime feature.

## 15. Production workflow

```
AI Concept Art ─▶ Asset Approval (DNA + camera + slot-fit) ─▶ Variants + Interaction States
   ─▶ Asset Library ─▶ Nest Template authoring (define Scene Slots) ─▶ Interaction Library
   ─▶ Avatar Generator ─▶ Personal-Object Generator ─▶ Nest Composer ─▶ Supabase ─▶ Mobile App ─▶ (future) Marketplace
```
The Asset Factory evolves into the **library + approval + template-authoring** tooling. The
deterministic composer (evolving today's room designer) turns *creator choices* into a composed Nest.
Curation/approval is the **quality gate that never lowers**.

## 16. Originality defense

We study production **systems**, not visuals. Nestudio's look is its **own locked DNA** (warm-light/
cool-plum, oak/plaster/matte, rounded, one-accent, front-facing cozy). Do **not** imitate Animal
Crossing / Stardew / Dreamlight / Unpacking palettes, props, or character styles. The originality test:
a cold viewer should say *"this is Nestudio,"* not *"this looks like Game X."*

## 17. Scalability strategy *(Q10 — DNA + infinite personalization)*

**Constrained combinatorics** is the answer:
- **Locked DNA + locked camera** → every asset is mutually compatible.
- **Curated Asset Library** (built to that bar) → no drift, ever.
- **Scene Slots** → guaranteed placement for any asset.
- **Personalization vectors** (all consistent): template choice · asset per slot · **variant/color/
  accent** · content binding · avatar · personal belongings · **ambience preset**.
- The math: `templates × (assets+variants per slot)^slots × content × avatar × ambience` → an
  effectively **infinite, always-consistent** space from a finite catalog.
- **Engineering scale:** thumbnail/standard/hero LOD + WebP/AVIF + CDN; composed Nests stored as
  lightweight **slot→asset+variant manifests** (not baked megapixel scenes); render on device.

This delivers "millions of unique creators, one handcrafted world."

## 18. Marketplace strategy

The curation gate is the **moat and the business**:
- **Creators + 3rd-party artists** submit assets / themed sets / templates / interactions; all pass the
  **same approval bar** (DNA + camera + slot-fit) before entering the library.
- **Monetization:** premium themed sets, seasonal drops, creator cosmetics; revenue share with artists.
- **Network effect:** more curated supply → richer personalization → more creators (Dreamlight/AC model).
- Out of MVP scope; the data model + approval flow should be **designed so the marketplace is a later
  switch, not a rebuild.**

## 19. Future roadmap

1. **MVP:** 1 Nest Template (front-facing, ~6–8 slots) + ~15–25 curated assets + Interaction Library
   MVP + Composer → Supabase → mobile render. Prove **compose→render** + the emotional bar.
2. **Personalization:** variants/colors/accents + ambience presets + more templates.
3. **Identity:** Avatar Generator + Personal-Object Generator (within constraints).
4. **Scale:** LOD/CDN, more themed sets, Village discovery on V2.
5. **Ecosystem:** Marketplace (submissions + approval + revenue share).
6. **Future production:** 3D-assisted internal asset authoring/animation.

---

## First implementation sprint — recommendations (after this bible is approved)

Documentation/spec only until approved; then the **first build sprint** should be the smallest slice
that proves the system:

1. **Lock the constants** (doc): the single **camera spec** (angle, depth planes, aspect) + the
   **Nest scene-box geometry** + the **slot taxonomy** (Media/Desk/Shelf/Books/Plant/Window/Avatar/
   Frame/Lamp/Product). This is the contract everything else obeys.
2. **Define the data model** (spec, not DB yet): `Asset` (category, slot-fit, variants, LOD, states,
   DNA version), `NestTemplate` (image + **Scene Slots**), `SceneSlot` (plane/footprint/anchor/
   accepted-categories/default-interaction/tier/z), `Interaction` (type→animation+content),
   `ComposedNest` (template + slot→asset+variant + avatar + belongings + ambience).
3. **Author ONE Golden Nest end-to-end** (the new "golden" target replacing the isometric Golden
   Room): 1 front-facing template + ~15 curated assets + the Interaction Library MVP, composed via a
   minimal **Nest Composer**, rendered on mobile. Prove "this feels like me."
4. **Evolve the Asset Factory** into **library + approval + template authoring** (don't rebuild from
   scratch — its generate→review→approve discipline + Supabase persistence carry over).
5. **Defer** avatar, personal-object generation, variants-at-scale, and marketplace until the
   compose→render loop + emotional bar are validated on the one Golden Nest.

**Definition of done for sprint 1:** one composed Golden Nest, rendered front-facing on a phone, with
3–5 working Object→Animation→Content interactions, assembled entirely from curated library assets
snapped into Scene Slots — no per-scene generation, no perspective warping.

---

*Production bible — documentation only. No code, Asset Factory build, DB changes, or asset/scene
generation. Subordinate to the locked Visual DNA; supersedes the isometric room/wall direction (ADR-027).*
