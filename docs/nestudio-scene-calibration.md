# Nestudio Scene Calibration System — V1 (DRAFT)

> **⚠️ SUPERSEDED — V2 pivot (ADR-027).** The **isometric / parallel-30° perspective contract** and
> the **perspective-warp** approach here are **deprecated**: V2 uses **front-facing cinematic Nest
> scenes** (no isometric rendering), and placement is via **Scene Slots**, not calibrated hotspot
> bounds. Preserved as **history** (it validated the camera/consistency problems that drove the
> pivot). Current architecture: [nestudio-production-pipeline.md](nestudio-production-pipeline.md).
>
> **M13 note (2026-07-02):** placement in the shipped editor is governed by slot-type
> **guardrails** ([`lib/nest-editor-policy.ts`](../lib/nest-editor-policy.ts)), not the
> calibration model here. M13 added floor-first guardrails for `seat`/`desk` (and
> `window`/`pinboard`/`product`) plus a free-placement guardrail for generic overlays. See
> [m13-mobile-stabilisation.md](m13-mobile-stabilisation.md).

> **Purpose.** Make scene generation (interior shells, exterior shells, village tiles,
> landscaping, characters) as rigorous and repeatable as the frozen **Object DNA
> V3.7.0** pipeline — so scenes can be generated, reviewed, approved, and **locked**
> without visual drift, and so generated shells automatically yield coordinates the
> existing room engine consumes.
>
> **Status: DRAFT.** This is an architecture + documentation deliverable of the Visual
> DNA Sprint. It defines the *system*; it generates nothing. It does not modify runtime
> behavior, does not redesign the village, and does not touch the frozen object DNA.
>
> **Reads / grounding (verified against source, not invented):**
> - Object camera + object rules: `apps/asset-factory/lib/nestudio-spec.ts`
>   (`NESTUDIO_CAMERA_SPEC_V1`, `NESTUDIO_OBJECT_RULES_V1`) — **the perspective anchor**.
> - Object scoring + lock: `apps/asset-factory/docs/premium-style.md` (5-dimension
>   0–100 rubric, Golden 10, Style Lock ≥85).
> - Object negative prompt + DNA: `apps/asset-factory/docs/nestudio-dna-spec.md`,
>   `apps/asset-factory/lib/prompts.ts`.
> - Template data model: `lib/types.ts` (`VisualTemplate`, `RoomShellTemplate`,
>   `ExteriorShellTemplate`, `VillageTileTemplate`, `ShellPlacementZone`,
>   `NormalizedRect`) and the live calibration `lib/templates/room-shells.ts`
>   (`nestudio-cozy-v1`: 1080×1440, floor seam y≈0.611).
> - Pilot rendering decisions: ADR-021 / ADR-022 (`docs/decision-log.md`).
> - Scene/world art direction: `docs/nestudio-visual-dna.md` (V0.1) and the Design
>   Director critique of it (perspective + shadow + calibration gaps).
>
> **Pairs with / subordinate to:** the frozen object DNA spec (objects win for objects);
> `docs/nestudio-visual-dna.md` (the *what it looks like*; this doc is the *how we make
> it repeatably*).

---

## 0. Why scenes need their own system (and can't reuse the object one verbatim)

The object pipeline assumes **one isolated subject, no environment, no floor, no
shadow, transparent PNG, one fixed camera.** A scene is the *opposite shape of
problem*: it is a **background/environment with geometry** onto which transparent
objects are composited. Three consequences drive the whole system below:

1. **The object negatives forbid exactly what a shell must have.** `NESTUDIO_CAMERA_SPEC_V1.forbidden`
   includes `floor plane`, `ground plane`, `room scene`, `environment`. A room shell
   *is* a floor + walls + room. So scenes need an **inverted, scene-specific** negative
   set (§8), not the object one.
2. **Compatibility is the deliverable, not isolation.** An object is judged alone; a
   shell is only correct **when the 28 approved furniture PNGs sit in it without looking
   tilted, floating, or mis-scaled.** That forces a Perspective Contract (§4), a Shadow
   Contract (§5), and a Composition-QA review stage that the object pipeline never needed.
3. **A shell must emit coordinates.** The room engine consumes `floorBounds`,
   `wallBounds`, `safeArea`, and `placementZones`. Calibration (§6) is a first-class
   pipeline stage with no object-pipeline equivalent.

---

## 1. Scene Calibration Architecture

The object pipeline is **Generate → Score → Approve → Persist → Export.** The scene
pipeline adds two stages object generation never had — **Calibrate** and
**Composition QA** — because a scene must yield geometry *and* prove it hosts real
furniture.

### 1.1 The eight stages

```
            ┌────────────────────────────────────────────────────────────────┐
            │  SCENE DNA (frozen language)  +  FAMILY SPEC (interior/exterior/ │
            │  village) +  PERSPECTIVE CONTRACT §4 + SCENE NEGATIVE PROMPT §8  │
            └───────────────────────────────┬────────────────────────────────┘
                                             │ defines
                                             ▼
   ① DEFINE ──▶ ② GENERATE ──▶ ③ REVIEW/SCORE ──▶ ④ CALIBRATE ──▶ ⑤ COMPOSITION QA
   family +      candidate       6-dimension        extract          drop the GOLDEN
   golden        shell images    rubric §3          floorBounds/     FURNITURE set
   targets       (Asset          (objective,        wallBounds/      onto the zones;
                 Factory)        2 reviewers)       safeArea/        verify perspective,
                                                    placementZones   shadow, scale §4/§5/§6
                                                    §6                       │
                                                                            ▼
                              ⑧ VERSION+REGISTER ◀── ⑦ LOCK ◀── ⑥ APPROVE (per shell)
                              bump scene DNA semver    golden set    passes §3 thresholds
                              + template.version;      complete +    AND §5 grounding QA
                              commit to static         score ≥85     AND hard-gates §3.4
                              registry (ADR-022)        per family
```

- **① Define.** Pick the family (interior / exterior / village). State the golden
  target this generation must fill (e.g. "warm-studio interior shell"). Assemble the
  prompt = Scene DNA + family spec + Perspective Contract fragment + scene negative.
- **② Generate.** Asset Factory produces candidate shell **images only** (no
  calibration data yet, no furniture baked in). Multiple candidates per golden target.
- **③ Review / Score.** Each candidate scored on the 6 scene dimensions (§3) by two
  reviewers using the rubric anchors. Reject, or advance the best.
- **④ Calibrate.** From the chosen image, extract the geometry (§6) → `floorBounds`,
  `wallBounds`, `safeArea`, `placementZones`.
- **⑤ Composition QA.** Composite the **Golden Furniture set** (§2.4) onto the zones
  using the Shadow Contract (§5). This is the make-or-break test: do real assets sit
  grounded, level, correctly scaled, non-overlapping? If not → back to ④ (recalibrate)
  or ② (regenerate).
- **⑥ Approve.** A shell is approved when it clears the §3 thresholds **and** the §3.4
  hard-gates (perspective + furniture compatibility) **and** Composition QA.
- **⑦ Lock.** A *family* (not a single shell) locks when its **Golden Scene Set** (§2)
  is complete and every member is approved with family-average score ≥ 85.
- **⑧ Version + register.** Bump the scene DNA semver and the template `version`;
  commit the image + calibration to the static registry (`lib/templates/*`, ADR-022).
  A locked family is frozen exactly like the object DNA: change requires a version bump
  + a freeze-test update.

### 1.2 Versioning strategy

Two independent, explicitly-coupled version axes:

| Axis | Where | Bumps when | Example |
|---|---|---|---|
| **Scene DNA version** (semver) | a new `NESTUDIO_SCENE_DNA_VERSION` constant + freeze test, mirroring `NESTUDIO_DNA_VERSION="3.7.0"` | the *language* changes (perspective, lighting, material, negative set) | `scene-dna 1.0.0` |
| **Template version** (int) | `template.version` (already exists per `VisualTemplate`) | an individual shell's image or calibration changes | `nestudio-cozy-v1 v2` |

**Coupling rule.** Each template records the scene DNA version it was approved under
(add an approved-under field at lock time, documentation-level for now). When scene DNA
bumps, existing locked templates are **not auto-invalid** but are flagged for
re-validation against the new language. Object DNA and scene DNA version **independently**;
a scene DNA lock must declare which object DNA version it was calibrated against (today:
3.7.0) because the Perspective + Shadow contracts depend on it.

---

## 2. Golden Scene Set

The fixed benchmark each family must satisfy before that family can lock — the scene
equivalent of the object Golden 10. A family **cannot lock** until its golden set is
complete and all members approved.

### 2.1 Interior Shell Golden Set — **REQUIRED for Interior Shell V1 lock**

- **Purpose.** Prove the interior shell language holds across the five established room
  moods *and* that real furniture composes correctly in each — i.e. prove both the look
  and the Perspective/Shadow/Calibration contracts at once.
- **Quantity required: 5 (minimum), 6 (recommended).** One per existing background mood
  — **warm studio, gallery wall, shop floor, office, garden room** (the five locked
  `ROOM_BACKGROUNDS`) — plus a recommended 6th *neutral empty baseline* used as the
  reference render and the perspective master.
- **Review process.** Each shell: score §3 → calibrate §6 → **Composition QA with the
  Golden Furniture set (§2.4)**. The warm-studio shell is the **anchor**: it is graded
  hardest and becomes the canonical "this is a Nestudio room" reference image.
- **Approval criteria.** Every member: overall ≥ 85, perspective-conformance ≥ 8/10,
  furniture-compatibility ≥ 8/10, Composition QA pass. Family average ≥ 85.

### 2.2 Exterior Shell Golden Set — **REQUIRED for Exterior Shell V1 lock**

- **Purpose.** Prove the house-front language across the roof grammar and prove a house
  reads as the same "camera family" as furniture (so a house and a sofa feel one-world),
  and that the **door + sign affordances** land in predictable zones.
- **Quantity required: 4 (minimum), 5 (recommended).** One per locked roof type —
  **gable, hip, round (hobbit), dutch** — plus a recommended 5th with a **shop sign /
  nameplate** affordance to validate the exterior interactive layer.
- **Review process.** Score §3 → calibrate the exterior zones (door zone, sign zone,
  safe area) → Composition QA = place the door/sign affordance markers and confirm
  alignment + that the accent-per-house rule reads. Cross-check all 4 side by side: do
  they read as one street?
- **Approval criteria.** Every member ≥ 85, perspective-conformance ≥ 8/10, affordance
  alignment pass; the set must pass a **"one street" cohesion check** (all four together
  read as one village).

### 2.3 Village Tile Golden Set — **DEFERRED (define now, lock later)**

- **Purpose.** Prove tessellating map/road tiles share the world camera and palette.
- **Quantity required: 4 (minimum).** A **plot tile** (hosts a house), a **path/road
  tile**, a **junction/corner tile**, and a **landscape filler tile** (greenery/water).
- **Review process.** Score §3 → confirm **tessellation** (tiles abut seamlessly in a
  2×2 grid) → confirm a house tile sits on a plot tile without camera clash.
- **Approval criteria.** As §3 + a **seam test** (no visible discontinuity when tiled).
- **Status note.** The village is an **established system that must not be redesigned
  this sprint** (ADR-022, roadmap principle 9). This golden set is specified so the
  pipeline is ready, but it is **not a prerequisite** for Interior/Exterior Shell V1 and
  must not trigger a village redraw. It locks in a later, explicitly-scoped village sprint.

### 2.4 Golden Furniture set (the composition probe)

Composition QA needs a fixed furniture probe — drawn **only from the 28 approved
assets** so the test is real:

> **1 hero sofa · 1 coffee/center table · 1 accent chair · 1 neutral chair** — one
> personality line (e.g. Reader: sofa + table) plus two neutral chairs.

These four exercise floor-center, floor-left/right, and front-most z-order. (When wall
art / plants / rugs are later approved, extend the probe to exercise wall + shelf + rug
zones — tracked as a post-furniture-broadening update to this section.)

---

## 3. Scene Style Lock

The scene equivalent of the object Style Lock (`all 10 approved + score ≥ 85`). Designed
so two independent reviewers converge — every dimension has explicit anchor descriptions.

### 3.1 Dimensions scored (6)

Objects score 5 dimensions; scenes add a 6th because **perspective and composition** are
failure modes objects don't have.

| # | Dimension | Measures | Object-pipeline parallel |
|---|---|---|---|
| 1 | **DNA Fidelity** | On-identity: rounded, soft-matte, warm, storybook-premium — *not* realism / generic-mobile-game / flat-vector / clipart | Style Fit |
| 2 | **Perspective Conformance** | Matches the Perspective Contract §4 (iso angle, parallel projection, floor seam, no tunnel) | *(new — scene only)* |
| 3 | **Lighting Consistency** | Warm key upper-left, cool-plum shadow, soft & even — matches the object light so composited furniture agrees | (part of) Consistency |
| 4 | **Composition & Negative Space** | Calm backdrop; clean, uncluttered placement zones; furniture will breathe; nothing competes with the live layer | (part of) Consistency |
| 5 | **Furniture Compatibility** | The Golden Furniture probe sits grounded, level, correctly scaled, non-overlapping (the Composition-QA result) | Production Readiness |
| 6 | **Production Readiness** | Correct aspect/resolution/export; calibratable (clear floor seam + wall plane + safe area) | Production Readiness |

### 3.2 Scoring range

Each dimension **0–10** → raw **0–60** → normalized to **0–100** (`raw / 60 × 100`),
matching the object 0–100 scale and ≥85 threshold so the two systems read alike.

### 3.3 Pass threshold

A **single shell** is approvable when normalized score **≥ 85** **and** the §3.4
hard-gates hold. A **family** locks when its golden set (§2) is complete and **every
member** is approved with **family-average ≥ 85**.

### 3.4 Hard-gates (cannot be averaged away)

A high average must never hide a fatal flaw. Independent of the 85 threshold:

- **Perspective Conformance ≥ 8/10** — a tilted/converging shell is unusable no matter
  how pretty; furniture will look wrong in it.
- **Furniture Compatibility ≥ 8/10** — if the real probe doesn't sit right, the shell
  fails by definition.

A shell failing either gate is **rejected regardless of overall score.**

### 3.5 Failure criteria (auto-reject, score not required)

- Any **scene-negative violation** (§8): photoreal, baked-in furniture/people, top-down
  or one-point tunnel interior, sunset/night/dramatic light, generic-mobile-game clone,
  visible text/watermark.
- **No identifiable floor seam / wall plane** (uncalibratable).
- **Wrong aspect ratio or resolution** (§7).
- **Camera mismatch** with the object iso beyond tolerance (§4.4).

### 3.6 Approval workflow (inter-rater objectivity)

1. **Two reviewers** score independently using the §3.7 anchors.
2. **Agreement test:** if both overall scores land in the same band (Reject <70 ·
   Revise 70–84 · Approve ≥85) **and** neither flags a hard-gate failure → the verdict
   stands.
3. **Disagreement** (different bands, or one hard-gate flag) → a third reviewer (or the
   Design Director) adjudicates; the disagreement and resolution are recorded.
4. Approved shells + their scores + calibration are committed with the template.

### 3.7 Rubric anchors (the objectivity layer — abbreviated)

To make scores converge, each dimension defines what 0 / 5 / 8 / 10 looks like. Example
for the two hard-gate dimensions (full anchor table authored at lock time):

- **Perspective Conformance** — *10:* floor recedes at ~30° iso with parallel
  projection, horizontal floor seam, back wall fronto-parallel; a placed iso object
  reads perfectly grounded. *8:* minor seam slope or slight convergence, furniture still
  grounded. *5:* noticeable convergence/tunnel or seam tilt; furniture looks slightly
  off. *0:* one-point perspective, top-down, or fisheye — furniture floats/tilts.
- **Furniture Compatibility** — *10:* all four probe pieces sit flat, correctly scaled,
  cleanly spaced, with believable contact shadow. *8:* one piece needs a minor zone
  nudge. *5:* a piece floats or is mis-scaled and needs regeneration of the zone. *0:*
  furniture cannot be made to sit correctly in this shell.

---

## 4. Perspective Contract  *(highest priority)*

This is the contract that makes the 28 approved furniture PNGs and every future shell
share one camera. It is derived directly from the **frozen** object camera, so it cannot
drift without a freeze-test failure.

### 4.1 What the approved furniture actually assumes (from `NESTUDIO_CAMERA_SPEC_V1`)

| Property | Frozen value | Implication for shells |
|---|---|---|
| **Projection** | "3/4 isometric view" | **Parallel / orthographic-style** — *no* vanishing-point convergence. (The CSS "tunnel/box" room failed in ADR-022 precisely because it used converging one-point perspective.) |
| **Camera tilt** | "approximately **30°** downward angle" | The viewer looks *down* at 30°. Shells' floors must recede **upward** at this same 30°. |
| **Framing** | "object centered, fills most of frame, fully visible, no cropping" | Shell safe-area and zones must keep furniture uncropped and centered-ish. |
| **Floor** | "**no floor**, no ground plane, no pedestal" | Objects carry **no floor of their own** — the shell *is* the floor. The object's lowest pixel is its ground-contact point (= `baseY` anchor). |
| **Shadow** | "**no shadow** platform / catcher" | Objects carry **no shadow** — grounding shadow is composited by the engine (§5). |
| **Consistency** | "identical camera, scale, framing for every asset" | One camera across the *whole world* — shells inherit the object camera, they do not invent one. |

**Horizon assumption.** A 30°-downward iso view places the implied horizon **high, above
the subject**; the ground plane fills the lower frame and recedes up toward it. For a
room shell this means the **floor-to-back-wall seam is the visual "horizon" of the
stage** — and it sits in the lower-middle of the frame (the live `nestudio-cozy-v1` puts
it at y≈0.611, i.e. floor = lower ~39%). That value is the empirical confirmation of the
contract and the recommended seam band.

### 4.2 Room-shell perspective contract

A room shell is an **iso dollhouse stage** — the only geometry that hosts ~30° iso
objects without re-projection:

```
   ┌───────────────────────────────────────────┐  ← frame top (safe-area inset)
   │              BACK WALL                      │   • back wall = FRONTO-PARALLEL
   │        (fronto-parallel plane)              │     (faces camera flat — no skew)
   │                                             │   • side walls (optional) cant
   │  \                                       /  │     inward consistent with iso
   │   \ left wall                 right wall/   │   • single soft warm light, UL
   │    \                                   /    │
   ├─────────────────────────────────────────── │  ← FLOOR SEAM  (the "horizon")
   │   ╱            FLOOR PLANE             ╲    │     y ≈ 0.58–0.64  (cozy-v1: 0.611)
   │  ╱   recedes UPWARD at ~30° iso,        ╲   │   • floor recedes up at ~30°
   │ ╱    PARALLEL projection (no converge)   ╲  │   • PARALLEL lines — NOT a tunnel
   │╱   [obj]      [obj]          [obj]        ╲ │   • objects stand here at baseY
   └───────────────────────────────────────────┘  ← frame bottom
        an iso object (also ~30°) rests on the floor and reads grounded
        because object-ground-angle == floor-recession-angle
```

Rules:
1. **Projection: parallel ~30° iso. No one-point/converging perspective.** This is the
   single most important rule — it is what makes objects grounded and what ADR-022's
   failed CSS room violated.
2. **Back wall fronto-parallel** (faces the camera flat); side walls, if shown, cant
   inward consistent with the 30° iso. A pure "back wall only" cutaway is acceptable and
   simplest to calibrate.
3. **Floor seam horizontal**, in band **y ≈ 0.58–0.64** (recommended 0.611 to match the
   calibrated baseline and let existing zones port).
4. **One scale.** Objects place at one in-room scale. A **gentle depth-scale** (objects
   higher on the floor / further back rendered slightly smaller, ~0.85–1.0×) is *allowed
   for readability* but must stay subtle — parallel projection means no strong size
   falloff.
5. **No baked furniture, no baked shadows** in the shell (those are the live layer §5).
6. **Light upper-left**, matching the object key, so composited furniture's implied
   light agrees with the room's.

### 4.3 Exterior-shell perspective contract

A house is treated as a **large object**, so it shares the furniture camera:

- **Same 3/4 iso, ~30° downward, parallel projection**, house **centered, fully in
  frame, uncropped** — so a house and a sofa are visibly the same camera family.
- **Front-dominant three-quarter:** the front facade reads clearly with a slight iso
  turn revealing one side and the roof — *not* a flat elevation, *not* a dramatic
  vanishing-point angle.
- **Door zone bottom-center-ish, sign zone upper/beside door** (calibrated §6), grounded
  so the door reads at the house's base.
- **No baked ground/lawn beyond a minimal contact base** — the village tile provides the
  ground (so a house composites onto a plot tile cleanly).

### 4.4 Village-tile perspective contract + the one open decision

- Tiles share the **~30° iso, parallel projection** so houses sit on them without camera
  clash, and tiles **tessellate** (edges align in a repeating grid).
- **Open decision (flag, don't silently pick):** classic iso tilemaps use **2:1 dimetric
  (~26.57°)** for clean pixel tessellation, but the Nestudio object/shell camera is
  **~30°**. These are close but not identical. **Recommendation: align tiles to ~30° for
  one-world camera unity**, accept slightly non-integer tessellation math, and validate
  with the §2.3 seam test. If the seam test fails at 30°, fall back to 26.57° tiles and
  accept a tiny house-vs-ground camera delta (objects/houses stay 30°). This is a
  **village-sprint decision**, recorded here so it isn't rediscovered later.

### 4.5 Tolerance

"~30°" means **28–32°** acceptable; outside that band → Perspective Conformance < 8 →
hard-gate fail. Parallel projection is **mandatory** (any visible vanishing-point
convergence in the floor = hard-gate fail).

---

## 5. Shadow & Grounding Contract

Objects are **frozen transparent with no shadow** (§4.1). Therefore **grounding shadow
is composited by the engine/stage at render time — never baked into the asset and never
baked into the shell.** This keeps objects reusable across every shell and lighting, and
keeps shells reusable across every furniture set. (ADR-021's `interior-stage.tsx` already
demonstrates "soft lighting + contact shadows" — this contract formalizes it.)

### 5.1 Three shadow layers, three owners

| Layer | Owner | What | Why |
|---|---|---|---|
| **Ambient room light/shade** | **the shell** (baked) | the soft warm light + cool wall/floor shading of the empty room | it's intrinsic to the room and never changes |
| **Contact shadow** | **the engine** (composited) | a soft ellipse under each object at its `baseY` | grounds the object; depends on the object's size + position, which the shell can't know |
| **Object self-shadow / form shading** | **the object** (baked, frozen) | the object's own matte shading from the UL key | already in the asset; must agree with the shell's UL light |

### 5.2 Contact shadow spec (the engine's job)

- **Shape:** soft horizontal ellipse, anchored at the object's `baseY` (its ground point),
  centered on `cx`, width ≈ **0.8–1.0× the object's rendered width**, height ≈ **0.18–0.25×
  its width** (squashed — it's on a receding floor).
- **Color:** the signature **cool-plum shadow `#46365a`**, *not* black — at low alpha
  **~0.18–0.28**, with a soft blur (≈ 4–8% of object width). Warm-light/cool-shadow law.
- **Offset:** very slightly **down and to the right** of base center (light is upper-left).
- **Falloff:** larger/heavier objects → marginally larger, softer, slightly darker
  shadow; small objects → tighter, lighter. Keep subtle.
- **Floor only:** floor objects get the ellipse on the floor plane. **Wall objects**
  (art, shelves) instead get a small soft **drop shadow on the wall plane** (offset
  down-right, tighter), never a floor ellipse.

### 5.3 Grounding strategy (object-to-floor relationship)

1. An object's **`baseY` is its contact line** — the renderer aligns the object's lowest
   pixel to the floor depth implied by `baseY`, so it stands *on* the floor, not over it.
2. The **contact shadow is drawn first** (under the object) at `baseY`, then the object
   on top → the eye reads "resting on the floor."
3. **z-order = floor depth:** higher-on-floor (further back) = lower z, drawn first;
   nearer = higher z (matches the live `placementZones` z field).
4. **No furniture overlaps the floor seam upward into the wall** unless it's a tall piece
   intended to overlap (bookshelf) — calibration (§6) prevents accidental float.

### 5.4 What the shell must guarantee for shadows to read

- The floor near the placement band must have **enough value range and low busy-ness**
  that a soft plum contact shadow is visible but not muddy.
- The shell's baked light must be **UL-consistent** so the composited shadow's
  down-right offset looks correct.
- The shell must **not** bake its own object shadows (there are no objects yet).

---

## 6. Placement Zone Calibration System

A repeatable SOP that turns a generated shell image into the exact registry fields the
room engine already consumes — `floorBounds`, `wallBounds`, `safeArea` (`NormalizedRect`
= `{x,y,width,height}` in 0..1) and `placementZones` (`ShellPlacementZone` =
`{id,label,cx,baseY,width,z}`). All coordinates are **normalized 0..1** so they're
resolution-independent.

### 6.1 The SOP (manual now, tool-assisted later)

```
 generated shell image (fixed resolution, §7)
        │
   1. FIND THE SEAM   → scan for the floor↔back-wall boundary y.  floorBounds.y = seam
        │                floorBounds = { x:0, y:seam, width:1, height:1-seam }
   2. FIND THE WALL   → the usable back-wall rectangle (inside trim/edges).
        │                wallBounds = { x, y, width, height }   (e.g. cozy-v1 0.139,0.083,0.722,0.528)
   3. SET SAFE AREA   → inset where nothing important is cropped on any device.
        │                safeArea ≈ { 0.06, 0.08, 0.88, 0.86 } (port the baseline, adjust)
   4. LAY SLOTS       → for each intended furniture role, record:
        │                cx (base-centre x), baseY (contact y on floor), width (frac), z (back→front)
   5. APPLY DEPTH RULE→ further back (higher on floor, lower baseY toward seam) = smaller width,
        │                lower z; nearer (higher baseY) = larger width, higher z.
   6. COMPOSITION QA  → drop the Golden Furniture probe (§2.4) on the slots + contact shadows (§5);
        │                check grounded / level / scaled / non-overlapping. Adjust 4–5 and repeat.
   7. EMIT            → a typed registry entry (RoomShellTemplate) — coordinates only,
                         the layout never invents positions at runtime (per cozy-v1 today).
```

### 6.2 Calibration conventions (so multiple calibrators converge)

- **Seam band:** y ∈ [0.58, 0.64]; aim 0.611 to reuse the baseline.
- **Slot count per interior shell:** 4–6 (cozy-v1 has 5: sofa, desk, chair-left,
  coffee-table, chair-right). More than ~6 clutters; fewer than 3 looks bare.
- **z spacing:** integer, strictly increasing front-ward; leave gaps (2,3,4,5,6) for
  later inserts (matches cozy-v1).
- **Width sanity:** hero sofa ≈ 0.40–0.50; chairs ≈ 0.22–0.26; tables ≈ 0.28–0.34
  (cozy-v1 values are the reference).
- **Min horizontal spacing:** adjacent slot centers ≥ ~0.18 apart unless intentionally
  layered by z.

### 6.3 Exterior calibration

Exterior shells emit `safeArea` + a **door zone** and **sign zone** (modeled as
`placementZones` entries, e.g. `{id:"door",...}`, `{id:"sign",...}`) plus the house's
ground-contact line for compositing onto a plot tile. Same normalized convention.

### 6.4 Toward automation (recommended, out of scope to build here)

The manual SOP is the lockable process **now**. The scale fix (§9) is a **calibration
overlay tool**: load a shell, click the seam, drag slot handles, auto-emit the typed
entry + run Composition QA inline. Specified as the next-sprint tooling, not built here.

---

## 7. Technical Specification

| Property | Interior shell | Exterior shell | Village tile |
|---|---|---|---|
| **Aspect ratio** | **3:4 portrait** (mobile-first; matches live) | **1:1 square** (one-world camera w/ objects; tessellation-friendly) | **1:1 square** (tessellation) |
| **Master resolution** | **1080×1440** (current baseline) — master 1440×1920 acceptable | **1024×1024** (matches object render canvas) | **1024×1024** master |
| **Delivered resolution** | 1080×1440 | 1024×1024 (+ 512² for map LOD) | 512×512 (+256² map LOD) |
| **Format** | **WebP** delivered (+ PNG master). Shells are full-bleed/opaque → no transparency needed | WebP delivered; **PNG if transparency** around the house silhouette is needed for compositing onto tiles | WebP; PNG if edge transparency needed |
| **Color** | sRGB, 8-bit | sRGB, 8-bit | sRGB, 8-bit |
| **File-size budget (delivered)** | **≤ 350 KB** | **≤ 250 KB** | **≤ 120 KB** |
| **Transparency** | none (background) | house edge may be transparent | edges may be transparent |

Notes:
- **Objects stay transparent PNG, 1024×1024** (frozen, unchanged). The current
  **1.0–1.5 MB** object PNGs are a flagged budget risk (§9) — recommend a WebP delivery
  variant for objects too (master PNG retained), target ≤ 400 KB. *(Recommendation only;
  object DNA is frozen — this is a delivery/encoding change, not a language change.)*
- **Interior 3:4 is deliberate** — it matches `nestudio-cozy-v1` (1080×1440) so existing
  calibration ports; do not switch interiors to landscape without re-deriving the seam band.
- **Versioning rules:** image or calibration change → bump `template.version`; language
  change → bump `NESTUDIO_SCENE_DNA_VERSION` (§1.2). Never edit a locked template
  in-place without a version bump.

---

## 8. Scene Negative Prompt System

The scene negative is **not** the object negative — it inverts the parts that forbid
environments (a shell *must* have a floor/room) while keeping the identity guards.
Structure: a **shared scene base** + **per-family deltas**.

### 8.1 Shared scene-negative base (all families)

```
photorealism, realistic photography, photoreal render, 3d photoscan, hyperrealistic,
generic mobile game art, royal-match style, clash-style, candy-crush style, casino style,
gacha art, anime, manga, painterly illustration, flat vector, corporate illustration,
clipart, sticker, icon pack, app icon, cartoon outline, cel shading,
excessive detail, busy composition, cluttered, noisy, ornate, baroque, intricate filigree,
text, words, letters, watermark, logo, signature, ui, hud, labels,
neon, glow overload, lens flare, bloom, dramatic lighting, hard shadows, cast shadows,
sunset, golden hour, night, moonlight, color grading, teal-and-orange,
fisheye, wide-angle distortion, vanishing point, one-point perspective, two-point perspective,
converging lines, tilted horizon, dutch angle, random perspective,
people, characters, animals, humans, hands,
inconsistent style, mismatched lighting, gradient background, white background, gray studio
```

Rationale tie-back to the brief's targets: *realism/photoreal* (line 1), *generic
mobile-game art* (line 2), *excessive detail/clutter* (line 5), *perspective drift*
(lines 9–10), *inconsistent lighting* (lines 7–8), *visual clutter* (line 5),
*asset-family mismatch* ("inconsistent style, mismatched lighting").

### 8.2 Per-family deltas

- **Interior shell — add:** `furniture, sofa, chair, table, rug, plants, lamp, books,
  decorations, props, top-down view, floor plan, isometric tunnel, narrow box room,
  ceiling-dominant, fully furnished room` — **the shell is an EMPTY stage**; baked
  furniture/props collide with the live layer (the inverse-but-same-spirit of Object
  Rules V1).
- **Exterior shell — add:** `interior, room cutaway, floor plan, multiple houses, street
  scene, dense city, skyscraper, modern glass building, commercial storefront, mansion,
  ruins, fully landscaped lawn` — the **village tile** provides ground; the exterior is
  **one** house.
- **Village tile — add:** `houses baked in, buildings, large objects, perspective
  buildings, non-tiling edges, seams, vignette, isolated illustration` — tiles are
  **ground/road/landscape only**, edge-tessellating.

### 8.3 Enforcement (mirroring the object freeze test)

Like `specViolations()` proves the object positive prompt never contains a forbidden
token, the scene system should ship a **scene freeze test** asserting (a) each family's
positive prompt contains zero of its negative tokens, and (b) the scene negative is
present on every generation. *(Spec only — no code in this sprint.)*

---

## 9. Scale Risk Assessment

Where the **curated-template + 28-furniture** strategy breaks as users grow. (10M
deliberately out of scope.)

| Users | What works | Where it breaks | Mitigation |
|---|---|---|---|
| **1,000** | A handful of shells + 28 furniture is charming; repetition reads as "house style," not sameness. | **Furniture-only sparseness** (no wall art/plants/rugs) → rooms feel bare; only ~10 personalities. | Ship the **interior golden set (5–6 shells)** + begin **broadening asset categories** (the next pack). Nothing structural needed. |
| **10,000** | Shell golden sets locked; image-first rooms look premium. | **Visible repetition** — many creators land on the same 5–6 shells; personality saturation begins. | Grow to **~15–25 shells** across moods; add **palette/accent recoloring** of shells (one shell → N accent variants via the warm-light/cool-shadow recolor, cheap); broaden assets to wall/plant/rug/lighting. |
| **100,000** | Recolor variants + broader assets give real variety. | **Manual calibration is the bottleneck** (every shell hand-tuned per §6); repetition still perceptible; 10-personality taxonomy too coarse. | Build the **calibration overlay tool** (§6.4) so calibration isn't manual; introduce **combinatorial theming** (shell × accent × asset-pack); **expand the personality/accent taxonomy** beyond 10; consider **on-approval generation** to keep filling the kit. |
| **1,000,000** | Tooling + combinatorics keep the kit large and on-brand. | **Template farm feeling** — finite curated shells can't express 1M unique homes; pipeline throughput + **asset weight/CDN** (1–1.5 MB object PNGs × millions of loads); calibration even with tooling lags demand. | **Procedural recombination of curated parts** (modular wall/floor/window kit re-composed within the locked DNA, still curated not free-synth); **automated calibration** from generation metadata; **WebP/AVIF + CDN + LOD** delivery; **expanded personality system** + creator-driven palette within DNA guardrails. **Do not** open runtime free generation (violates ADR-006). |

**Headline risk, all tiers:** the thing that is a *strength at 1k* — a small deterministic
curated kit — is the thing that *breaks at 100k+*. The mitigation arc is **tooling →
recoloring → combinatorics → procedural-recombination-within-DNA**, never abandoning
curation. The Scene Calibration System is what makes each of those steps safe, because
every new shell/variant must still pass the same Lock.

---

## 10. Lock Recommendation

### Scores

| Score | Value | Basis |
|---|---:|---|
| **Scene Calibration readiness** | **8 / 10** | Architecture, golden sets, lock rubric, perspective contract, shadow contract, calibration SOP, tech spec, and negatives are all defined and grounded in the frozen camera + real template types. Not 10 because: rubric anchors are abbreviated (full table owed), the calibration tool is spec-only, and zero reference renders exist yet (they can only come from generation). |
| **Confidence** | **High (8/10)** | The perspective + shadow contracts are derived from frozen, test-guarded values (`NESTUDIO_CAMERA_SPEC_V1`) and confirmed by the live `nestudio-cozy-v1` calibration (seam 0.611), so they're unlikely to be wrong. The residual uncertainty is empirical: whether generation actually hits the 30° parallel iso reliably — only candidates will tell. |

### Remaining blockers

- **B1 (pre-generation, required):** lock `docs/nestudio-visual-dna.md` to **V1.0** —
  generation prompts pull their *look* language from it; today it's DRAFT V0.1 with the
  Design Director's must-fix items open (perspective/material/typography). The
  **perspective and shadow** pieces are now resolved *here*; the **material vocabulary,
  village-conflict, and typography** fixes still need folding into the DNA doc.
- **B2 (full objectivity):** complete the **§3.7 rubric anchor table** for all 6
  dimensions (0/5/8/10) before multi-reviewer scoring begins.
- **B3 (lock-time only, not generation-time):** the **interior golden set** must be
  generated, scored, calibrated, and Composition-QA'd before the *interior family* can
  **lock**. This is downstream of generation, not a blocker to starting it.
- **B4 (scale, deferrable):** the calibration overlay tool — needed at 100k, not for V1.

### Can Interior Shell V1 generation begin now?

**YES — candidate generation may begin now**, with two conditions. The system needed to
**produce, judge, and lock** interior shells is defined: a perspective contract pinned to
the frozen object camera, a shadow/grounding contract, a calibration SOP that emits the
exact registry types, a 6-dimension lock with hard-gates, and a scene negative prompt.
You **cannot** lock before generating (the golden set is *made of* generations — same
chicken-and-egg the object pipeline had), so the correct move is to **generate candidates
toward the golden set now** and run them through stages ③–⑥.

**Conditions before pressing generate:**
1. **Resolve B1's perspective/shadow language into the prompt** (done below — the prompt
   embeds the §4/§5/§8 contracts even while the broader DNA doc finishes locking).
2. Treat outputs as **calibration candidates, not production** — nothing ships to the
   live shell until the interior family clears the §3 Lock (B3).

### Exact prompt for the Interior Shell V1 sprint

Generate the **warm-studio anchor shell** first (the hardest-graded golden member and the
canonical reference). Positive prompt + scene negative below; obey the Perspective
Contract (§4.2) and Technical Spec (§7).

**Positive prompt**
```
A cozy Nestudio living-room shell — an EMPTY three-wall dollhouse room interior, no
furniture and no people, presented as a clean stage to place furniture into. Warm
storybook-premium style: soft rounded architecture, gently chamfered edges, premium
matte surfaces, warm oiled-oak wood floor, warm plaster back wall in a soft warm-studio
tone, one window letting in soft daylight. Consistent 3/4 isometric camera at roughly a
30-degree downward angle with PARALLEL projection (no vanishing point): the back wall is
flat and faces the camera, the wood floor recedes gently upward, and the floor-to-wall
seam is a level horizontal line in the lower-middle of the frame. Soft, even, warm key
light from the upper-left with gentle cool-toned ambient shadow; calm, inviting, lived-in
warmth. Generous empty floor and wall space, uncluttered, with clear flat areas to place
furniture. Portrait composition, the whole room visible and centered, mobile-first.
Cohesive Nestudio world — the same warm matte storybook language as the Nestudio furniture.
```

**Scene negative prompt** (= §8.1 base + §8.2 interior delta)
```
photorealism, realistic photography, photoreal render, hyperrealistic, generic mobile
game art, royal-match style, clash-style, gacha art, anime, painterly illustration, flat
vector, corporate illustration, clipart, sticker, icon pack, cel shading, excessive
detail, busy composition, cluttered, noisy, ornate, baroque, text, words, letters,
watermark, logo, signature, ui, neon, lens flare, bloom, dramatic lighting, hard shadows,
cast shadows, sunset, golden hour, night, fisheye, wide-angle distortion, vanishing point,
one-point perspective, two-point perspective, converging lines, tilted horizon, dutch
angle, people, characters, animals, inconsistent style, mismatched lighting, white
background, gray studio, furniture, sofa, chair, table, rug, plants, lamp, books,
decorations, props, top-down view, floor plan, isometric tunnel, narrow box room,
ceiling-dominant, fully furnished room
```

**Generation parameters**
- Aspect **3:4 portrait**, master **1440×1920** → deliver **1080×1440 WebP** (§7).
- Generate **4–6 candidates**; carry the best 1–2 into Review (§3) → Calibrate (§6) →
  Composition QA with the Golden Furniture probe (§2.4).
- Target floor seam **y ≈ 0.611**; reuse `nestudio-cozy-v1` zones as the calibration
  starting point, then refine.
- After the warm-studio anchor passes, repeat for the remaining four moods (gallery,
  shop, office, garden) to complete the **Interior Shell Golden Set**, then run the §3
  family **Lock**.

---

*Documentation only. No images, assets, code, runtime changes, village redesign, or
commits were produced. The frozen object DNA V3.7.0 is untouched; this system is
subordinate to it and pinned to its camera.*
