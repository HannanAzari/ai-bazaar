# Nestudio Camera DNA — LOCKED (immutable)

> **Status: LOCKED / immutable project DNA.** The finalized camera language for every Nestudio
> background and asset — an **Animal Crossing–inspired life-simulation camera**. It must never
> change again. **The root cause of poor asset consistency was perspective mismatch, not object
> quality** — so perspective conformance is now the top gate: *if an asset is beautiful but the
> perspective is wrong, REJECT IT.*
>
> **Relationship to prior docs.** Supersedes the camera tolerance in
> [`nestudio-visual-dna.md`](nestudio-visual-dna.md) §11 / ADR-028 and the earlier 55/45 draft of
> this file. Identity goals (cozy · premium · explorable · mobile-first) carry forward; the look is
> **stylized life-sim game** (Animal Crossing / The Sims), **not** interior/architectural/catalogue
> photography. Material diversity replaces "oak everywhere."

---

## 1. Camera DNA (immutable)

| Parameter | Locked value |
|---|---|
| Camera height | ~**180 cm** (standing human viewpoint) |
| Downward tilt | **8–12°**, **target 10°** |
| Perspective | **slightly elevated, front-facing**, subtle natural convergence |
| Focal length (equiv.) | ~35–40 mm (no wide-angle distortion) |
| Horizontal position | centered |
| Aspect | portrait **3:4**, mobile-first |

**Slightly-elevated viewpoint means visible top surfaces:** tops of desks/tables fully visible ·
rugs seen from above (with visible thickness) · tops of sofa cushions partially visible · shelves
seen slightly from above.

**Forbidden (reject on sight):** catalogue/ecommerce photography · straight front orthographic
views · eye-level furniture photos · dramatic architectural photography · wide-angle lens
distortion · strong cinematic perspective · isometric.

**The validation question for every asset:** *"Would this look natural inside Animal Crossing?"* If
no → **reject and regenerate.** Perspective consistency outranks object quality.

---

## 2. Backgrounds = game environment stages (not interior renders)

Backgrounds are **game environment stages**, not interior-design renders. Personality is expressed
through **architecture** (materials, lighting, windows, trim, feature walls, arches, integrated
shelving) — **not** through large furniture.

**Structure:** back wall ~**70%** of the frame width · **~15%** each visible side wall · a clear
**usable placement zone in the centre** for furniture assets · furniture kept **minimal** (ideally
none baked in). Avoid: large furniture pieces, objects blocking the placement space, decorative
clutter.

---

## 3. Assets = game objects in the Nestudio world (not ecommerce products)

Every asset is a **life-sim game object** placed into the world, sharing the **same camera height,
same 10° downward tilt, same horizon, same light direction** as the backgrounds. Isolated
transparent PNG, centered, mobile-readable silhouette, **no baked shadow**.

**Top-surface requirements:** Desk → visible top. Chair → seat surface visible. Rug → rendered from
above with visible thickness. Bookshelf → slight top visibility. Plant → slight top visibility. TV
unit → top surface visible. Table/coffee table → visible top.

---

## 4. Diversity requirements (stop over-using timber)

- **Flooring:** timber · polished concrete · carpet · stone · ceramic · terrazzo · outdoor decking ·
  gym rubber · tatami · industrial epoxy.
- **Walls:** plaster · exposed brick · acoustic panels · slatted timber · wallpaper · concrete ·
  stone · painted drywall · fabric walls · gaming RGB panels.
- **Lighting:** daylight · warm lamps · studio · RGB gaming · sunset · fireplace · moonlight ·
  pendant · candles.
- **Environments:** Interior (loft · studio · gamer room · office · zen room · creator room ·
  reading room · luxury apartment · industrial workshop · podcast room) · Semi-outdoor (balcony ·
  rooftop · patio · courtyard) · Outdoor (garden · poolside · beach deck · mountain-cabin deck).

---

## 5. Exact Gemini prompt suffixes (append verbatim)

**Backgrounds — append exactly:**

```
Nintendo Animal Crossing camera language, cozy life simulation game environment, slightly elevated viewpoint, 10 degree downward camera tilt, visible top surfaces, mobile game readability, consistent game world perspective, environment stage for object placement, not architectural photography, not catalogue photography.
```

**Assets — append exactly:**

```
Render as a life simulation game asset using the exact same camera height and downward tilt as the environment backgrounds. Slightly visible top surfaces required. Must feel like an object naturally existing inside Animal Crossing or The Sims rather than an ecommerce product listing.
```

---

## 6. This lock's validation pack (P0)

- **Backgrounds (5):** Creator Loft · Writer Nook · Gamer Cave · Minimal Zen · Outdoor Balcony
  (deliberate material/environment diversity).
- **Objects (10):** TV media console · bouclé sofa · coffee table · desk · office chair · bookshelf ·
  picture frame · floor plant · rug · table lamp.
- **3 candidates each** (15 assets → 45). Do not approve automatically; reject any perspective miss.

Pipeline: `scripts/generate-camera-validation.mjs` → `scripts/process-validate-camera.py`.
Candidates under `public/nests/camera-dna-v1/candidates/`. Report:
`metadata/reports/camera-dna-p0-validation.{md,json}`.
