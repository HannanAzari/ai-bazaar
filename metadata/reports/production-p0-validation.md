# P0 Production Generation Pilot — Validation & Scoring Report

- **Model:** `gemini-3.1-flash-image`  ·  **Candidates/asset:** 3  ·  **Written:** 2026-07-01T07:51:29.548793+00:00
- **Assets:** 9  ·  with viable candidate: 9  ·  needs regenerate: 0
- **Approval:** no asset auto-approved — each row is a RECOMMENDATION for human review.
- **Score dims (0–10 each, /50):** dnaAdherence, composition, transparency, focusReadability, editableSurfaceSuitability
- _dnaAdherence + composition are AUTOMATED PROXIES (warmth / centering / sharpness) — confirm visually._

| Asset | Kind | Cand | Selected | Score /50 | Alpha | Aspect | Recommendation |
|---|---|---|---|---|---|---|---|
| `bg-lr-warm-studio` | background | 3 | c3 | 37.59 | opaque | 4096x5461~3:4 ok | recommend c3 (37.59/50) — REVIEW (not approved) |
| `bg-so-focused-office` | background | 3 | c2 | 38.79 | opaque | 4096x5461~3:4 ok | recommend c2 (38.79/50) — REVIEW (not approved) |
| `ast-lr-media-oak-console` | object | 3 | c3 | 41.64 | yes | 1.176~16:10 OFF | recommend c3 (41.64/50) — REVISE (trimmed aspect 1.18 vs target 16:10 (1.60) beyond 15% tol) |
| `ast-lr-frame-portrait` | object | 3 | c3 | 41.83 | yes | 0.813~3:4 ok | recommend c3 (41.83/50) — REVIEW (not approved) |
| `ast-lr-sofa-boucle` | object | 3 | c2 | 46.06 | yes | 1.633~16:9 ok | recommend c2 (46.06/50) — REVIEW (not approved) |
| `ast-lr-table-oak-round` | object | 3 | c1 | 38.76 | yes | 1.706~4:3 OFF | recommend c1 (38.76/50) — REVISE (trimmed aspect 1.71 vs target 4:3 (1.33) beyond 15% tol) |
| `ast-so-desk-oak` | object | 3 | c2 | 37.94 | yes | 1.598~3:2 ok | recommend c2 (37.94/50) — REVIEW (not approved) |
| `ast-so-chair-task` | object | 3 | c2 | 44.7 | yes | 0.689~3:4 ok | recommend c2 (44.7/50) — REVIEW (not approved) |
| `ast-so-shelf-tall` | object | 3 | c3 | 38.0 | yes | 0.584~1:2 OFF | recommend c3 (38.0/50) — REVISE (trimmed aspect 0.58 vs target 1:2 (0.50) beyond 15% tol) |

## Per-asset detail

### `bg-lr-warm-studio` — background
- **Model:** gemini-3.1-flash-image · master [4096, 5461] (3:4) · transparency required: False
- **Candidates:** 3 · **selected:** c3 · **approved:** False
- **Recommendation:** recommend c3 (37.59/50) — REVIEW (not approved)
- **Candidate scores:**

  | Cand | DNA | Comp | Transp | Focus | Surface | Total | Issues |
  |---|---|---|---|---|---|---|---|
  | c1 | 10.0 | 8 | 10.0 | 2.51 | 7.0 | **37.51** | — |
  | c2 | 10.0 | 8 | 10.0 | 1.54 | 7.0 | **36.54** | — |
  | c3 ★ | 10.0 | 8 | 10.0 | 2.59 | 7.0 | **37.59** | — |

- **Selected c3 outputs:**
  - master: `public/nests/production-v1/candidates/backgrounds/bg-lr-warm-studio/c3/bg-lr-warm-studio-master.png`
  - focus: `public/nests/production-v1/candidates/backgrounds/bg-lr-warm-studio/c3/variants/focus/bg-lr-warm-studio.webp` (325.9 KB)
  - standard: `public/nests/production-v1/candidates/backgrounds/bg-lr-warm-studio/c3/variants/standard/bg-lr-warm-studio.webp` (72.6 KB)
  - mobile: `public/nests/production-v1/candidates/backgrounds/bg-lr-warm-studio/c3/variants/mobile/bg-lr-warm-studio.webp` (29.6 KB)
  - transparency: {'expectedOpaque': True, 'hasAlpha': False}
  - aspect: {'target': '3:4', 'actual': '4096x5461', 'ok': True}
  - notes:
    - MANUAL: confirm EMPTY stage (no baked furniture) + floor seam in band 0.58–0.64.
- **Prompt used:** Cozy handcrafted stylized 3D illustration in the "Nestudio" style: warm, premium-matte, rounded, soft-edged forms with thick readable silhouettes. Warm earthy palette — oiled oak, warm plaster, parchment, oatmeal — with restrained soft form-shading and subtle ambient occlusion. Soft warm key light from the upper-left, gentle ambient fill, cool-plum shadow (#46365a), never grey. Front-facing cinematic camera, eye-level to slightly elevated, gentle ~5-10 degree downward tilt. Parallel / near-ortho…

### `bg-so-focused-office` — background
- **Model:** gemini-3.1-flash-image · master [4096, 5461] (3:4) · transparency required: False
- **Candidates:** 3 · **selected:** c2 · **approved:** False
- **Recommendation:** recommend c2 (38.79/50) — REVIEW (not approved)
- **Candidate scores:**

  | Cand | DNA | Comp | Transp | Focus | Surface | Total | Issues |
  |---|---|---|---|---|---|---|---|
  | c1 | 10.0 | 8 | 10.0 | 2.72 | 7.0 | **37.72** | — |
  | c2 ★ | 10.0 | 8 | 10.0 | 3.79 | 7.0 | **38.79** | — |
  | c3 | 10.0 | 8 | 10.0 | 2.53 | 7.0 | **37.53** | — |

- **Selected c2 outputs:**
  - master: `public/nests/production-v1/candidates/backgrounds/bg-so-focused-office/c2/bg-so-focused-office-master.png`
  - focus: `public/nests/production-v1/candidates/backgrounds/bg-so-focused-office/c2/variants/focus/bg-so-focused-office.webp` (653.1 KB)
  - standard: `public/nests/production-v1/candidates/backgrounds/bg-so-focused-office/c2/variants/standard/bg-so-focused-office.webp` (143.8 KB)
  - mobile: `public/nests/production-v1/candidates/backgrounds/bg-so-focused-office/c2/variants/mobile/bg-so-focused-office.webp` (47.9 KB)
  - transparency: {'expectedOpaque': True, 'hasAlpha': False}
  - aspect: {'target': '3:4', 'actual': '4096x5461', 'ok': True}
  - notes:
    - MANUAL: confirm EMPTY stage (no baked furniture) + floor seam in band 0.58–0.64.
- **Prompt used:** Cozy handcrafted stylized 3D illustration in the "Nestudio" style: warm, premium-matte, rounded, soft-edged forms with thick readable silhouettes. Warm earthy palette — oiled oak, warm plaster, parchment, oatmeal — with restrained soft form-shading and subtle ambient occlusion. Soft warm key light from the upper-left, gentle ambient fill, cool-plum shadow (#46365a), never grey. Front-facing cinematic camera, eye-level to slightly elevated, gentle ~5-10 degree downward tilt. Parallel / near-ortho…

### `ast-lr-media-oak-console` — object · hero
- **Model:** gemini-3.1-flash-image · master [2048, 2048] (1:1) · transparency required: True
- **Candidates:** 3 · **selected:** c3 · **approved:** False
- **Recommendation:** recommend c3 (41.64/50) — REVISE (trimmed aspect 1.18 vs target 16:10 (1.60) beyond 15% tol)
- **Editable surface spec:** {'kind': 'screen', 'bounds': {'x': 0.18, 'y': 0.05, 'width': 0.64, 'height': 0.5}, 'contentType': 'video'}
- **Candidate scores:**

  | Cand | DNA | Comp | Transp | Focus | Surface | Total | Issues |
  |---|---|---|---|---|---|---|---|
  | c1 | 10.0 | 7.92 | 9.5 | 4.84 | 8.07 | **40.33** | trimmed aspect 1.05 vs target 16:10 (1.60) beyond 15% tol |
  | c2 | 10.0 | 7.88 | 9.5 | 5.2 | 8.75 | **41.33** | trimmed aspect 1.27 vs target 16:10 (1.60) beyond 15% tol |
  | c3 ★ | 10.0 | 7.85 | 9.5 | 5.46 | 8.83 | **41.64** | trimmed aspect 1.18 vs target 16:10 (1.60) beyond 15% tol |

- **Selected c3 outputs:**
  - master: `public/nests/production-v1/candidates/objects/ast-lr-media-oak-console/c3/ast-lr-media-oak-console-master.png`
  - cutout (alpha): `public/nests/production-v1/candidates/objects/ast-lr-media-oak-console/c3/ast-lr-media-oak-console-cutout.png`
  - focus: `public/nests/production-v1/candidates/objects/ast-lr-media-oak-console/c3/variants/focus/ast-lr-media-oak-console.webp` (187.3 KB)
  - standard: `public/nests/production-v1/candidates/objects/ast-lr-media-oak-console/c3/variants/standard/ast-lr-media-oak-console.webp` (63.1 KB)
  - mobile: `public/nests/production-v1/candidates/objects/ast-lr-media-oak-console/c3/variants/mobile/ast-lr-media-oak-console.webp` (25.9 KB)
  - transparency: {'hasAlpha': True, 'transparentFraction': 0.567, 'cornersClear': True, 'cutoutReliable': True}
  - aspect: {'target': '16:10', 'actual': 1.176, 'ok': False}
  - editable-surface check: {'region': (307, 72, 1400, 798), 'stddev': 14.0, 'emptyEnough': True}
- **Prompt used:** Cozy handcrafted stylized 3D illustration in the "Nestudio" style: warm, premium-matte, rounded, soft-edged forms with thick readable silhouettes. Warm earthy palette — oiled oak, warm plaster, parchment, oatmeal — with restrained soft form-shading and subtle ambient occlusion. Soft warm key light from the upper-left, gentle ambient fill, cool-plum shadow (#46365a), never grey. Front-facing cinematic camera, eye-level to slightly elevated, gentle ~5-10 degree downward tilt. Parallel / near-ortho…

### `ast-lr-frame-portrait` — object · medium
- **Model:** gemini-3.1-flash-image · master [1536, 1536] (1:1) · transparency required: True
- **Candidates:** 3 · **selected:** c3 · **approved:** False
- **Recommendation:** recommend c3 (41.83/50) — REVIEW (not approved)
- **Editable surface spec:** {'kind': 'photo', 'bounds': {'x': 0.12, 'y': 0.1, 'width': 0.76, 'height': 0.7}, 'contentType': 'gallery'}
- **Candidate scores:**

  | Cand | DNA | Comp | Transp | Focus | Surface | Total | Issues |
  |---|---|---|---|---|---|---|---|
  | c1 | 10.0 | 9.3 | 9.5 | 6.29 | 6.03 | **41.12** | — |
  | c2 | 10.0 | 7.93 | 9.5 | 4.97 | 7.1 | **39.5** | trimmed aspect 0.87 vs target 3:4 (0.75) beyond 15% tol |
  | c3 ★ | 10.0 | 9.6 | 9.5 | 4.96 | 7.77 | **41.83** | — |

- **Selected c3 outputs:**
  - master: `public/nests/production-v1/candidates/objects/ast-lr-frame-portrait/c3/ast-lr-frame-portrait-master.png`
  - cutout (alpha): `public/nests/production-v1/candidates/objects/ast-lr-frame-portrait/c3/ast-lr-frame-portrait-cutout.png`
  - focus: `public/nests/production-v1/candidates/objects/ast-lr-frame-portrait/c3/variants/focus/ast-lr-frame-portrait.webp` (141.6 KB)
  - standard: `public/nests/production-v1/candidates/objects/ast-lr-frame-portrait/c3/variants/standard/ast-lr-frame-portrait.webp` (71.3 KB)
  - mobile: `public/nests/production-v1/candidates/objects/ast-lr-frame-portrait/c3/variants/mobile/ast-lr-frame-portrait.webp` (23.9 KB)
  - transparency: {'hasAlpha': True, 'transparentFraction': 0.494, 'cornersClear': True, 'cutoutReliable': True}
  - aspect: {'target': '3:4', 'actual': 0.813, 'ok': True}
  - editable-surface check: {'region': (160, 164, 1173, 1312), 'stddev': 26.7, 'emptyEnough': True}
- **Prompt used:** Cozy handcrafted stylized 3D illustration in the "Nestudio" style: warm, premium-matte, rounded, soft-edged forms with thick readable silhouettes. Warm earthy palette — oiled oak, warm plaster, parchment, oatmeal — with restrained soft form-shading and subtle ambient occlusion. Soft warm key light from the upper-left, gentle ambient fill, cool-plum shadow (#46365a), never grey. Front-facing cinematic camera, eye-level to slightly elevated, gentle ~5-10 degree downward tilt. Parallel / near-ortho…

### `ast-lr-sofa-boucle` — object · hero
- **Model:** gemini-3.1-flash-image · master [2048, 2048] (1:1) · transparency required: True
- **Candidates:** 3 · **selected:** c2 · **approved:** False
- **Recommendation:** recommend c2 (46.06/50) — REVIEW (not approved)
- **Candidate scores:**

  | Cand | DNA | Comp | Transp | Focus | Surface | Total | Issues |
  |---|---|---|---|---|---|---|---|
  | c1 | 10.0 | 9.55 | 9.5 | 10.0 | 7.0 | **46.05** | — |
  | c2 ★ | 10.0 | 9.56 | 9.5 | 10.0 | 7.0 | **46.06** | — |
  | c3 | 10.0 | 7.71 | 9.5 | 10.0 | 7.0 | **44.21** | trimmed aspect 2.20 vs target 16:9 (1.78) beyond 15% tol |

- **Selected c2 outputs:**
  - master: `public/nests/production-v1/candidates/objects/ast-lr-sofa-boucle/c2/ast-lr-sofa-boucle-master.png`
  - cutout (alpha): `public/nests/production-v1/candidates/objects/ast-lr-sofa-boucle/c2/ast-lr-sofa-boucle-cutout.png`
  - focus: `public/nests/production-v1/candidates/objects/ast-lr-sofa-boucle/c2/variants/focus/ast-lr-sofa-boucle.webp` (829.6 KB)
  - standard: `public/nests/production-v1/candidates/objects/ast-lr-sofa-boucle/c2/variants/standard/ast-lr-sofa-boucle.webp` (232.9 KB)
  - mobile: `public/nests/production-v1/candidates/objects/ast-lr-sofa-boucle/c2/variants/mobile/ast-lr-sofa-boucle.webp` (52.1 KB)
  - transparency: {'hasAlpha': True, 'transparentFraction': 0.658, 'cornersClear': True, 'cutoutReliable': True}
  - aspect: {'target': '16:9', 'actual': 1.633, 'ok': True}
- **Prompt used:** Cozy handcrafted stylized 3D illustration in the "Nestudio" style: warm, premium-matte, rounded, soft-edged forms with thick readable silhouettes. Warm earthy palette — oiled oak, warm plaster, parchment, oatmeal — with restrained soft form-shading and subtle ambient occlusion. Soft warm key light from the upper-left, gentle ambient fill, cool-plum shadow (#46365a), never grey. Front-facing cinematic camera, eye-level to slightly elevated, gentle ~5-10 degree downward tilt. Parallel / near-ortho…

### `ast-lr-table-oak-round` — object · medium
- **Model:** gemini-3.1-flash-image · master [1536, 1536] (1:1) · transparency required: True
- **Candidates:** 3 · **selected:** c1 · **approved:** False
- **Recommendation:** recommend c1 (38.76/50) — REVISE (trimmed aspect 1.71 vs target 4:3 (1.33) beyond 15% tol)
- **Editable surface spec:** {'kind': 'surface-projection', 'bounds': {'x': 0.1, 'y': 0, 'width': 0.8, 'height': 0.35}, 'contentType': 'none'}
- **Candidate scores:**

  | Cand | DNA | Comp | Transp | Focus | Surface | Total | Issues |
  |---|---|---|---|---|---|---|---|
  | c1 ★ | 8.54 | 7.64 | 9.5 | 5.7 | 7.38 | **38.76** | trimmed aspect 1.71 vs target 4:3 (1.33) beyond 15% tol |
  | c2 | 5.98 | 6.56 | 9.5 | 6.0 | 4.03 | **32.07** | trimmed aspect 1.82 vs target 4:3 (1.33) beyond 15% tol |
  | c3 | 8.74 | 7.5 | 9.5 | 5.46 | 6.47 | **37.67** | trimmed aspect 1.71 vs target 4:3 (1.33) beyond 15% tol |

- **Selected c1 outputs:**
  - master: `public/nests/production-v1/candidates/objects/ast-lr-table-oak-round/c1/ast-lr-table-oak-round-master.png`
  - cutout (alpha): `public/nests/production-v1/candidates/objects/ast-lr-table-oak-round/c1/ast-lr-table-oak-round-cutout.png`
  - focus: `public/nests/production-v1/candidates/objects/ast-lr-table-oak-round/c1/variants/focus/ast-lr-table-oak-round.webp` (84.4 KB)
  - standard: `public/nests/production-v1/candidates/objects/ast-lr-table-oak-round/c1/variants/standard/ast-lr-table-oak-round.webp` (50.0 KB)
  - mobile: `public/nests/production-v1/candidates/objects/ast-lr-table-oak-round/c1/variants/mobile/ast-lr-table-oak-round.webp` (21.7 KB)
  - transparency: {'hasAlpha': True, 'transparentFraction': 0.814, 'cornersClear': True, 'cutoutReliable': True}
  - aspect: {'target': '4:3', 'actual': 1.706, 'ok': False}
  - editable-surface check: {'region': (159, 0, 1433, 326), 'stddev': 31.5, 'emptyEnough': True}
- **Prompt used:** Cozy handcrafted stylized 3D illustration in the "Nestudio" style: warm, premium-matte, rounded, soft-edged forms with thick readable silhouettes. Warm earthy palette — oiled oak, warm plaster, parchment, oatmeal — with restrained soft form-shading and subtle ambient occlusion. Soft warm key light from the upper-left, gentle ambient fill, cool-plum shadow (#46365a), never grey. Front-facing cinematic camera, eye-level to slightly elevated, gentle ~5-10 degree downward tilt. Parallel / near-ortho…

### `ast-so-desk-oak` — object · hero
- **Model:** gemini-3.1-flash-image · master [2048, 2048] (1:1) · transparency required: True
- **Candidates:** 3 · **selected:** c2 · **approved:** False
- **Recommendation:** recommend c2 (37.94/50) — REVIEW (not approved)
- **Editable surface spec:** {'kind': 'surface-projection', 'bounds': {'x': 0.08, 'y': 0, 'width': 0.84, 'height': 0.3}, 'contentType': 'none'}
- **Candidate scores:**

  | Cand | DNA | Comp | Transp | Focus | Surface | Total | Issues |
  |---|---|---|---|---|---|---|---|
  | c1 | 7.25 | 9.29 | 9.5 | 4.79 | 6.84 | **37.67** | — |
  | c2 ★ | 7.04 | 9.25 | 9.5 | 4.94 | 7.21 | **37.94** | — |
  | c3 | 7.72 | 9.27 | 9.5 | 4.88 | 5.85 | **37.22** | — |

- **Selected c2 outputs:**
  - master: `public/nests/production-v1/candidates/objects/ast-so-desk-oak/c2/ast-so-desk-oak-master.png`
  - cutout (alpha): `public/nests/production-v1/candidates/objects/ast-so-desk-oak/c2/ast-so-desk-oak-cutout.png`
  - focus: `public/nests/production-v1/candidates/objects/ast-so-desk-oak/c2/variants/focus/ast-so-desk-oak.webp` (101.6 KB)
  - standard: `public/nests/production-v1/candidates/objects/ast-so-desk-oak/c2/variants/standard/ast-so-desk-oak.webp` (38.0 KB)
  - mobile: `public/nests/production-v1/candidates/objects/ast-so-desk-oak/c2/variants/mobile/ast-so-desk-oak.webp` (16.1 KB)
  - transparency: {'hasAlpha': True, 'transparentFraction': 0.899, 'cornersClear': True, 'cutoutReliable': True}
  - aspect: {'target': '3:2', 'actual': 1.598, 'ok': True}
  - editable-surface check: {'region': (100, 0, 1150, 234), 'stddev': 33.5, 'emptyEnough': True}
- **Prompt used:** Cozy handcrafted stylized 3D illustration in the "Nestudio" style: warm, premium-matte, rounded, soft-edged forms with thick readable silhouettes. Warm earthy palette — oiled oak, warm plaster, parchment, oatmeal — with restrained soft form-shading and subtle ambient occlusion. Soft warm key light from the upper-left, gentle ambient fill, cool-plum shadow (#46365a), never grey. Front-facing cinematic camera, eye-level to slightly elevated, gentle ~5-10 degree downward tilt. Parallel / near-ortho…

### `ast-so-chair-task` — object · medium
- **Model:** gemini-3.1-flash-image · master [1536, 1536] (1:1) · transparency required: True
- **Candidates:** 3 · **selected:** c2 · **approved:** False
- **Recommendation:** recommend c2 (44.7/50) — REVIEW (not approved)
- **Candidate scores:**

  | Cand | DNA | Comp | Transp | Focus | Surface | Total | Issues |
  |---|---|---|---|---|---|---|---|
  | c1 | 9.1 | 9.51 | 9.5 | 6.29 | 7.0 | **41.4** | — |
  | c2 ★ | 9.57 | 9.41 | 9.5 | 9.22 | 7.0 | **44.7** | — |
  | c3 | 6.16 | 7.33 | 9.5 | 5.95 | 7.0 | **35.94** | trimmed aspect 0.90 vs target 3:4 (0.75) beyond 15% tol |

- **Selected c2 outputs:**
  - master: `public/nests/production-v1/candidates/objects/ast-so-chair-task/c2/ast-so-chair-task-master.png`
  - cutout (alpha): `public/nests/production-v1/candidates/objects/ast-so-chair-task/c2/ast-so-chair-task-cutout.png`
  - focus: `public/nests/production-v1/candidates/objects/ast-so-chair-task/c2/variants/focus/ast-so-chair-task.webp` (297.8 KB)
  - standard: `public/nests/production-v1/candidates/objects/ast-so-chair-task/c2/variants/standard/ast-so-chair-task.webp` (152.1 KB)
  - mobile: `public/nests/production-v1/candidates/objects/ast-so-chair-task/c2/variants/mobile/ast-so-chair-task.webp` (45.1 KB)
  - transparency: {'hasAlpha': True, 'transparentFraction': 0.738, 'cornersClear': True, 'cutoutReliable': True}
  - aspect: {'target': '3:4', 'actual': 0.689, 'ok': True}
- **Prompt used:** Cozy handcrafted stylized 3D illustration in the "Nestudio" style: warm, premium-matte, rounded, soft-edged forms with thick readable silhouettes. Warm earthy palette — oiled oak, warm plaster, parchment, oatmeal — with restrained soft form-shading and subtle ambient occlusion. Soft warm key light from the upper-left, gentle ambient fill, cool-plum shadow (#46365a), never grey. Front-facing cinematic camera, eye-level to slightly elevated, gentle ~5-10 degree downward tilt. Parallel / near-ortho…

### `ast-so-shelf-tall` — object · hero
- **Model:** gemini-3.1-flash-image · master [2048, 2048] (1:1) · transparency required: True
- **Candidates:** 3 · **selected:** c3 · **approved:** False
- **Recommendation:** recommend c3 (38.0/50) — REVISE (trimmed aspect 0.58 vs target 1:2 (0.50) beyond 15% tol)
- **Editable surface spec:** {'kind': 'surface-projection', 'bounds': {'x': 0.08, 'y': 0.06, 'width': 0.84, 'height': 0.8}, 'contentType': 'article'}
- **Candidate scores:**

  | Cand | DNA | Comp | Transp | Focus | Surface | Total | Issues |
  |---|---|---|---|---|---|---|---|
  | c1 | 10.0 | 7.92 | 9.5 | 4.27 | 6.11 | **37.8** | trimmed aspect 0.59 vs target 1:2 (0.50) beyond 15% tol |
  | c2 | 8.91 | 7.91 | 9.5 | 5.58 | 3.29 | **35.19** | trimmed aspect 0.60 vs target 1:2 (0.50) beyond 15% tol |
  | c3 ★ | 10.0 | 7.9 | 9.5 | 4.33 | 6.27 | **38.0** | trimmed aspect 0.58 vs target 1:2 (0.50) beyond 15% tol |

- **Selected c3 outputs:**
  - master: `public/nests/production-v1/candidates/objects/ast-so-shelf-tall/c3/ast-so-shelf-tall-master.png`
  - cutout (alpha): `public/nests/production-v1/candidates/objects/ast-so-shelf-tall/c3/ast-so-shelf-tall-cutout.png`
  - focus: `public/nests/production-v1/candidates/objects/ast-so-shelf-tall/c3/variants/focus/ast-so-shelf-tall.webp` (113.7 KB)
  - standard: `public/nests/production-v1/candidates/objects/ast-so-shelf-tall/c3/variants/standard/ast-so-shelf-tall.webp` (37.2 KB)
  - mobile: `public/nests/production-v1/candidates/objects/ast-so-shelf-tall/c3/variants/mobile/ast-so-shelf-tall.webp` (14.2 KB)
  - transparency: {'hasAlpha': True, 'transparentFraction': 0.619, 'cornersClear': True, 'cutoutReliable': True}
  - aspect: {'target': '1:2', 'actual': 0.584, 'ok': False}
  - editable-surface check: {'region': (77, 99, 893, 1429), 'stddev': 44.7, 'emptyEnough': True}
- **Prompt used:** Cozy handcrafted stylized 3D illustration in the "Nestudio" style: warm, premium-matte, rounded, soft-edged forms with thick readable silhouettes. Warm earthy palette — oiled oak, warm plaster, parchment, oatmeal — with restrained soft form-shading and subtle ambient occlusion. Soft warm key light from the upper-left, gentle ambient fill, cool-plum shadow (#46365a), never grey. Front-facing cinematic camera, eye-level to slightly elevated, gentle ~5-10 degree downward tilt. Parallel / near-ortho…
