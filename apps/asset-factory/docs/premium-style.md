# Nestudio Premium Game Style V1 (V3.1)

The visual identity for **AI-generated** Nestudio assets. It replaces the earlier
storybook generation direction, whose outputs read as dioramas / scenes / cozy
illustrations with platforms and extra props. The new target is **polished mobile
game collectibles**.

> **Quality references (do NOT mimic the art):** Clash of Clans asset quality,
> Royal Match readability, Hay Day object presentation. We borrow their *bar for
> craft and clarity* — never their copyrighted designs.

This is the source of truth for the generation prompt system
([`../lib/prompts.ts`](../lib/prompts.ts)). The cozy storybook direction still
governs the village/room art in the main app; this document governs **what we
generate into the catalog**.

> **V3.2 — Multi-style calibration.** Before locking ONE identity we now compare
> **three style families** ([`../lib/styles.ts`](../lib/styles.ts)), all sharing
> the hard rules below (single object, transparent PNG, 30° isometric, no props)
> and the same universal negative prompt — differing only in rendering:
> - **Royal Match Inspired** (`royal_match`) — glossy, colorful, rounded, playful (premium casual).
> - **Modern Designer** (`modern_designer`) — Apple-like, minimalist, clean materials (furniture catalog).
> - **Clash Inspired** (`clash`) — chunky, toy-like, bold silhouettes, highly readable (collectible).
>
> The chosen style is selectable on **/generate** and **/style-lab**, stored on each
> generation job (`styleId`). The Style Lab generates **5 variations per style** for
> each golden item (side-by-side), and the **Style Report** (`/style-report`) tallies
> approvals + closest picks per style and names a **winning style**. The references
> above remain quality references only — never mimic copyrighted art.

---

## Core principles

**Object only.** Generate exactly ONE asset. Never rooms, corners, scenes,
environments, backgrounds, furniture sets, platforms, pedestals, floors, rugs, or
extra props. A chair is *just the chair* — not chair + lamp + book + plant.

**Rendering.** Polished mobile-game rendering: soft glossy materials, rounded
edges, toy-like appeal, premium collectible feel. Avoid photorealism, painterly
illustration, storybook rendering, and flat vector.

**Camera.** Always a consistent **30° isometric**, centered, full object visible,
consistent orientation. Never perspective / front / side / random angles.

**Background.** **Transparent PNG only.** Never a white background, scene, floor
plane, platform, pedestal, or shadow catcher.

**Lighting.** Soft studio lighting, subtle ambient occlusion, controlled
highlights. Avoid dramatic shadows, sunset / golden-hour, cinematic lighting.

**Readability.** Must stay readable at **64×64, 96×96, 128×128**. If detail
disappears at those sizes, simplify the design.

---

## Master prompt

```
Premium mobile game asset. Single isolated object. High readability. Soft glossy
materials. Rounded shapes. Clean silhouette. Consistent 30-degree isometric camera.
Transparent PNG background. No platform. No pedestal. No floor. No environment.
No extra props. Mobile game collectible quality. Optimized for game inventory and
room decoration systems.
```

## Negative prompt

```
room scene, furniture set, multiple objects, base, platform, pedestal, floor plane,
rug, books, lamp, plant, extra decorations, text, watermark, logo, signature,
photorealism, realistic photography, painterly illustration, storybook rendering,
flat vector, random perspective, front view, side view, cropped object,
dramatic shadows, sunset lighting, golden hour, white background, scene background
```

Per-category descriptors are all single-object (`"a single accent chair"`,
`"a single floor lamp"`, …) so the object-only rule holds across the catalog.

---

## Golden Style Pack (calibration)

Before scaling generation we must pick ONE identity. The **Style Lab** (`/style-lab`)
generates and compares **5 variations** for each of ten golden items —
chair, sofa, desk, lamp, bookshelf, plant, microphone, monitor, coffee table, rug —
shown side-by-side. For each variation you can **approve / reject** and **mark the
one closest to Nestudio**. A golden item is **calibrated** once it has at least one
approved variation and a chosen "closest" pick; the page scores
**calibrated items / 10 → 0–100**.

Dry-run (placeholders) runs at zero cost for workflow testing; real variations come
from Replicate when generation is enabled (`/api/generate/style`, which produces
images for comparison only and **never** creates catalog candidates).

## Success criteria (optimize for these, not quantity)

- **Consistency** across variations and categories.
- **Readability** at 64/96/128px.
- **Premium game feel** (collectible, glossy, clean silhouette).
- **Catalog scalability** (one prompt spine generalizes).
- **Cross-category visual coherence**.

**Only after the Golden Style Pack is approved (10/10 calibrated, a chosen golden
pick per item) should mass generation proceed.** Until then, keep generation tiny
and the flag off between runs.
