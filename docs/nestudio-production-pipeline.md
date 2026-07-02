# Nestudio Production Pipeline — Master Architecture (V2)

> **This is the master architecture document.** It supersedes the Scene-Pack / Room-Shell /
> Wall-Pack architecture (ADR-021/022/025/026) and is the source of truth for everything that
> follows. Pivot recorded in **ADR-027**. New-CTO orientation: [nestudio-cto-handoff.md](nestudio-cto-handoff.md).
>
> **M13 update (2026-07-02):** the curated **production library**
> ([`lib/fixtures/nest-production-library-v1.ts`](../lib/fixtures/nest-production-library-v1.ts))
> now includes the restored Golden Nest assets under their catalog-aligned ids (so Connect
> hotspots + editable Surfaces resolve by id), and the flawed oak TV/desk/chair are `hidden`
> (never deleted — still resolvable by id). The editor consumes the library through the
> bridge ([`lib/nest-editor-bridge.ts`](../lib/nest-editor-bridge.ts)), which now also carries
> `hotspots` + `editableSurfaces`. See [m13-mobile-stabilisation.md](m13-mobile-stabilisation.md)
> + ADR-032.
> **Status:** architecture (documentation-first). No implementation has happened against it yet.
> Earlier docs are preserved as history with "superseded" banners.

---

## 1. The product, in one line

> **Nestudio composes digital homes.** A creator's presence is a **Nest** — a cozy, front-facing
> scene that feels *like them*. The emotional goal is **"this place feels like me,"** not "this is
> a beautiful room."

## 2. The architecture (mental model)

**Deprecated** (V1):
```
Village → House → Room → Wall → Object → Content
```
**Current** (V2 — ADR-027):
```
Village → House → Nest → Objects → Content
```

- **Village** — discovery (unchanged in spirit).
- **House** — a creator's home shell / exterior; a container for one or more Nests.
- **Nest** — *the primary creator experience.* A complete **front-facing cinematic scene** (see §3).
- **Objects** — interactive items inside the Nest (TV, desk, books, plant, frames, avatar…), drawn
  from the **Asset Library** and snapped into the Nest's **Scene Slots**.
- **Content** — what an object points to (a YouTube channel, a gallery, an article, a product…).

The word **"Wall" is gone from the user-facing model.** Users visit *someone's Nest*, not a wall.

## 3. What a Nest is

A Nest is a **complete scene**, rendered **front-facing**, like standing inside a cozy room with the
camera facing the main wall:

- the **full front wall**, a **sliver of the left wall**, a **sliver of the right wall**, and the
  **floor** — depth without isometric rendering.
- It is **composed**, not generated per-creator: a **Nest Template** (a curated front-facing scene)
  + **Scene Slots** + **Assets** snapped into those slots + the creator's **avatar** and a few
  **personal belongings**.
- It must feel: cozy · personal · handcrafted · warm · creative · safe · lived-in · expressive.
  Never: dashboard · portfolio website · interior-design software · furniture catalogue · empty AI room.

**Why front-facing, not isometric (validated):** front-facing cinematic scenes create much stronger
emotional engagement; perspective-warping wall images into isometric room shells did **not** reach
premium quality; AI-generated room shells + wall packs could **not** hold perfect consistency. See
ADR-027 and [golden-room-exploration.md](golden-room-exploration.md).

## 4. The big shift: composition over generation

| | V1 (deprecated) | V2 (current) |
|---|---|---|
| Primary system | **AI generation** (room shells, wall packs per creator) | **Composition** from curated libraries |
| Consistency | fragile (gen-vs-gen drift) | guaranteed (shared Asset Library + slots) |
| AI's role | generate whole scenes | generate **concept art** (to seed the library) + **only personal belongings/avatars** at runtime |
| Cost | high (per-creator generation) | low (reuse curated assets) |
| Unit of authoring | a generated image | a **Nest Template + slot assignments** |

> **AI generation becomes minimal.** AI is excellent at *concept art* — use it to **seed the
> curated library**, reviewed and approved by humans. At runtime, only **truly personal**
> belongings (and the avatar) may be generated; everything else is **chosen** from the library.

## 5. The Asset Library (the heart of Nestudio)

Everything reusable lives here, curated and approved. Categories:

- **Furniture** — sofa, armchair, coffee table, desk, bookshelf…
- **Electronics** — TV, speakers, laptop, microphone…
- **Decor** — plants, books, frames, lamps, trophies…
- **Creator tools** — cameras, keyboards, drawing tablets…
- **Business** — products, artwork, handmade goods…
- **Nest Templates** — curated front-facing scenes with defined Scene Slots.
- **Interactions** — the animation + content-binding behaviours (§7).

Each asset is style-consistent (Nestudio DNA), front-facing-camera-consistent, and tagged for the
slots it can fill. **Only truly personal belongings require AI generation;** the rest is curated.

## 6. Scene Slots (the consistency mechanism)

Scene Slots **replace** perspective wall regions / hotspot bounds as the primary abstraction. A
**Nest Template defines slots**; assets **snap into** them. This guarantees visual + perspective
consistency (the template author placed the slot correctly for that scene's camera).

Examples: **TV Slot · Desk Slot · Shelf Slot · Books Slot · Plant Slot · Window Slot · Avatar Slot
· Frame Slot · Lamp Slot.**

A slot declares: position/scale/anchor within the template, the **asset categories** it accepts, and
its default interaction. An asset declares which slot types it fits. Composition = matching assets to
slots — deterministic, never free-form pixel placement.

## 7. Interaction Library

Objects don't merely open links. Every interactive object is **Object → Animation → Content**:

| Object | Animation | Content |
|---|---|---|
| TV | glow | open YouTube |
| Book | open | show article |
| Lamp | light | toggle ambience |
| Photo frame | zoom | open gallery |
| Plant | leaf movement | ambient interaction |

Animations are **lightweight** (CSS/transform/opacity, reduced-motion-safe). **No complex avatar
navigation for MVP.** Interactions are a reusable library keyed by object type, so any asset of that
type inherits the behaviour.

## 8. Avatar

The avatar is **just another asset** occupying an **Avatar Slot** — no longer the center of the
architecture. MVP: idle or a very simple animation. The **Avatar Generator** (§10) produces a
style-consistent avatar from creator input. Future: richer interactions.

## 9. Nestudio DNA (design philosophy)

Every Nest must feel **cozy, personal, handcrafted, warm, creative, safe, lived-in, expressive** —
and never dashboard / portfolio-site / interior-design-software / furniture-catalogue / empty-AI-room.
The locked visual language (palette, warm light/cool shadow, rounded matte forms, one accent) carries
forward from [nestudio-visual-dna.md](nestudio-visual-dna.md), now applied to **front-facing Nest
scenes + library assets** rather than isometric shells. North star: **"this place feels like me."**

## 10. The production pipeline

```
AI Concept Art ─▶ Asset Approval ─▶ Asset Library ─▶ Nest Templates ─▶ Scene Slots
      │                                                                      │
      └──────────────── (humans curate; AI seeds, never ships raw) ─────────┘
                                                                             ▼
Interaction Library ─▶ Avatar Generator ─▶ Personal-Object Generator ─▶ Nest Composer ─▶ Supabase ─▶ Mobile App
                                                                             │
                                                                  (future) Marketplace
```

Stage by stage:

1. **AI Concept Art** — generate concept art for candidate assets / Nest templates (internal, batch).
2. **Asset Approval** — humans review for DNA fit, camera/style consistency, slot-readiness; reject or
   approve. (The current Asset Factory's Style Lab + approval flow evolves into this.)
3. **Asset Library** — approved assets stored with metadata (category, slot-fit, tags, DNA version).
4. **Nest Templates** — curated front-facing scenes; each defines its **Scene Slots**.
5. **Scene Slots** — the placement contract assets snap into.
6. **Interaction Library** — reusable Object→Animation→Content behaviours by type.
7. **Avatar Generator** — style-consistent avatar from creator input → Avatar Slot.
8. **Personal-Object Generator** — the *only* runtime generation: a creator's truly personal items.
9. **Nest Composer** — the deterministic engine: creator profile → House template → Nest template →
   assets-into-slots → avatar → personal belongings → composed Nest. (Evolves the existing
   deterministic AI Room Designer / composition logic.)
10. **Supabase** — durable storage for assets, templates, composed Nests, creator data.
11. **Mobile App** — renders the composed Nest (front-facing, lightweight, mobile-first).
12. **Future Marketplace** — creators/3rd parties publish assets, templates, interactions into the
    library (revenue + ecosystem). Out of MVP scope; designed-for, not built.

## 11. Creator flow (new)

```
Understand creator → Choose House template → Choose Nest template → Choose assets (into slots)
→ Generate avatar → Generate personal belongings → Compose Nest
```
Minimal AI, maximal curation. The creator *chooses and connects*; the Composer assembles.

## 12. Mobile rendering

Front-facing scenes are **mobile-native** (no isometric gymnastics). The Nest fills the viewport;
objects are tap targets with lightweight animations; content opens in-place or as a focused view.
Reduced-motion + accessible/quick-links fallback remain requirements (carry forward from prior UX
work). Heavy 3D is **not** in MVP (3D asset generation is a promising *future internal production*
tool, not an MVP dependency).

## 13. What this preserves vs replaces

- **Preserves:** Nestudio Visual DNA (palette/light/shape), the Asset Factory's generate→review→
  approve discipline, Supabase storage, the deterministic composer concept, mobile-first + a11y.
- **Replaces:** isometric room shells, "Wall" packs, perspective-warp wall projection, per-creator
  scene generation, hotspot-bound wall regions → now **Nest Templates + Scene Slots + Asset Library**.

---

*Documentation only. Implementation begins in a later sprint (see the CTO handoff's "next sprint").*
