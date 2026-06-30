# Nest Editor — Calibration & Polish (M7B.1)

> A refinement pass over the M7A/M7B editor: precise hotspot calibration, visual-content
> bounds, soft/hard placement, smart alignment, refined rotation/flip policy, a
> creator/template-author/internal role model, and a cleaner product-grade UI. Route:
> `/design/nest-editor` (noindex).
>
> **M7B.1 improves precision and authoring quality. It does not introduce nested scenes
> or visitor camera zoom.**

## Visual-content bounds (`lib/nest-visual-bounds.ts`)

Three distinct concepts: **image bounds** (the full PNG box), **visual-content bounds**
(the visible art inside the ~7% transparent padding), and **interaction hotspot bounds**
(asset-local regions). Selection frames, movement clamping, alignment and warnings use
the *visible* bounds where known (authored from each cut-out's measured alpha box), so a
padded PNG (avatar, thin floor lamp) no longer has an oversized selection/collision
region. Absent metadata falls back to full image bounds (backward-compatible). No
computer vision, no cropping — the art is untouched.

## Hotspot recalibration (pixel-measured, PNG-local)

| Asset | Region | Calibrated shape |
|---|---|---|
| TV | screen (excl. console/wall) | rect `0.2, 0.11, 0.6, 0.48` |
| Frame | inner photo (excl. wood border) | rect `0.18, 0.18, 0.64, 0.64` |
| Lamp | shade only (excl. pole) | ellipse `0.27, 0.12, 0.46, 0.16` |
| Plant | leaves only (excl. pot) | ellipse `0.15, 0.11, 0.66, 0.57` |
| Avatar | visible body | rect `0.2, 0.1, 0.6, 0.82` |
| Desk | laptop / notebook / desk-lamp | (matches visible art; mic/speaker reserved) |

The TV `statePack.screenRect` was matched to the screen hotspot so the glow stays on the
screen. **A scene-aspect fix was essential:** the editor canvas was rendering at the
wrong aspect (height-driven sizing fought `aspect-ratio`), letterboxing the art and
offsetting every hotspot. The canvas now uses an aspect-locked fit (oversized base
clamped by both max-dimensions) so the scene is a true 3:4 — boxes match their art's
aspect, the art fills its box, and hotspots land exactly on the visible art.

## Bookshelf hotspots (`lib/nest-hotspot-catalog.ts`)

The bookshelf now ships **Upper / Middle / Lower shelf** regions (the art is too
low-res for per-book taps). Assets with no predefined hotspots show **No interaction
regions yet** with **+ Add interaction region** (creators may add a basic region;
template authors get full authoring).

## Placement semantics & support (`lib/nest-placement.ts`)

`AssetPlacementMode` (wall/floor/surface/foreground/architecture) and `AssetSupportRule`
(e.g. books `requiresSurface`). `placementWarnings` advise (never block) when loose books
float without a surface or an object overlaps an **occupied zone**.

## Occupied zones

Templates may declare baked architecture (`NestOccupiedZone`: window, built-in storage,
…). The Golden Living Nest declares its **window** and **built-in niche**; covering them
warns advisorily. Advanced authors are never blocked.

## Soft vs hard boundaries (`lib/nest-editor-policy.ts`)

Clamping uses **visible-content** bounds, so a padded PNG can push its transparent
padding off-canvas and the lamp/bookshelf/avatar reach the corners. The **hard** boundary
only prevents the *visible art* from leaving the canvas (margin `0.05`); plane bands were
widened so floor objects approach the room edges. A **soft** boundary warning appears as
the art nears the edge, without blocking borderline placement.

## Smart alignment guides (`lib/nest-align.ts`)

The permanent grid is removed from normal mode (kept in internal). While moving, transient
**saffron** guides appear near canvas centre/thirds, the floor seam, and other objects'
edges/centres (computed on the moving object's visible rect), with a deterministic snap.
Guides vanish the instant the gesture ends; one gesture = one history entry.

## Rotation & flip policy

Frames, rugs, loose books and small decor rotate **fully (±180°)** with snapping near
0/±5/±15/±30/45/90/180 and a transient degree label; upright furniture (sofa, desk, TV,
bookshelf, lamp, avatar) stays unrotatable. **Avatar flip is policy-driven:**
`flipStatus` returns `unavailable` for creators and `warning` under an Advanced override
(clothing text/asymmetry/light direction reverse) — the real-person avatar stays
un-flippable by default.

## Roles & capabilities (`lib/nest-editor-roles.ts`)

A central capability policy (no scattered conditionals), switched locally in the
prototype (More → Mode):

- **Creator** — arrange approved assets, connect predefined hotspots, add a basic region,
  preview, save. No raw ids, precision forms, grid, zoom pill, debug or production
  warnings.
- **Template author** — + edit visual bounds, occupied zones, author hotspots, tune
  rotation/flip policy, precision controls, the View/zoom controls.
- **Internal** — + raw ids, debug overlays, full production-readiness warnings, metadata
  validation.

## Compact Connect drawer + layer model

The binding sheet is capped (`max-h-[50vh]`) so it never covers half the room, scrolls
internally, and has a clear close. Layer ownership (z within the editor surface):
`background → assets → hotspots(5..520) → selection chrome(500) → align guides(450)` are
all **isolated** inside the scene (`isolation: isolate`), so they sit **below** the
binding sheet (`30`) and More/Advanced sheets (`50`) — hotspot overlays never draw over
the drawer. The whole editor is `z-110` (above the dev badge).

## Hotspot visual states

Subtle when unselected (faint dashed teal / meadow for connected), clear teal when
selected, dotted grey when disabled — using Nestudio colours, not giant debug blocks.
Connect chips show clear status (Linked / Not set / Action / Off) without exposing
interaction ids.

## Production-readiness warnings

Placeholder assets (sofa/coffee-table/rug) show a small **placeholder** chip on the
selected asset for everyone; full production warnings appear only in internal mode. They
remain clearly tracked — never presented as production-ready.

## Editor zoom vs future Focus-Area zoom

The View controls (template-author/internal) only scale the **authoring viewport** — they
never change manifest coordinates. **Fit** shows the complete 3:4 room including the side
walls. This is unrelated to the future visitor **Focus Area / detail-scene** zoom.

## Intentionally deferred

- **Art replacement** — sofa/coffee-table/rug stay placeholders (tracked, not faked).
- **Focus Areas / Detail Scenes** and visitor camera zoom — not built.
- **Provider API integrations** and **polygon hotspots** — still deferred (M7B).

## Honest remaining weaknesses

- On a tall phone the fitted 3:4 room leaves parchment margins above/below (correct
  aspect over filling the height).
- Advanced hotspot drag math assumes an un-rotated asset.
- The desk Microphone/Speaker regions are intentionally absent (not in the current art).
