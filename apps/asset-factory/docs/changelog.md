# Asset Factory changelog

Newest first. Versions before V3.4 are summarized from the README/commit history.

## V3.4 — Nestudio Master Style V2 + OpenAI-first calibration

- **Retired** the three style experiments (`royal_match` / `modern_designer` /
  `clash`) and the V3.1 "Premium Game Style V1" spine for ONE locked identity:
  **`nestudio_v2`** (premium collectible game asset, readable at 64/128px, slightly
  stylized — not toy-like/puffy/realistic/storybook).
- **Locked specs** ([`lib/nestudio-spec.ts`](../lib/nestudio-spec.ts)): **Nestudio
  Camera Spec V1** (3/4 isometric ~30°, centered, no floor/pedestal/scene) and
  **Nestudio Object Rules V1** (one isolated object, transparent PNG, no props),
  folded into the master prompt with forbidden-token validation.
- **Golden Calibration Set** (permanent benchmark, 10 items): Accent Chair, Sofa,
  Desk, Bookshelf, TV, Plant, Floor Lamp, Coffee Table, Guitar, Computer.
- **Calibration Session** in the Style Lab: OpenAI-first generation, approve/reject,
  notes, and a **five-dimension scoring system** (consistency, readability,
  silhouette, style fit, production readiness → **0–100**).
- **Style Lock** gate ([`lib/calibration.ts`](../lib/calibration.ts)): unlocks V4
  only when all 10 golden assets are approved **and** the calibration score ≥ 85
  (OpenAI `nestudio_v2` only).
- **Calibration Report** (`/style-report`, the "Calibration" tab): approved/rejected
  assets, average + per-dimension scores, consistency notes, remaining issues, lock
  status.
- Tests: **189 passing** (added `nestudio-spec` + `calibration` suites; rewrote
  `styles` + `style-lab`). Typecheck · lint · build green.

## V3.3 — Provider shootout (OpenAI)

- Added OpenAI GPT Image as a second provider alongside Replicate; per-provider
  selector + Shootout button; server-only keys.

## V3.2 — Multi-style calibration

- Compared three style families (Royal Match / Modern Designer / Clash) with a Style
  Report and a "winning style". (Superseded by V3.4.)

## V3.1 — Premium game style + Style Lab

- Replaced the storybook direction with "Premium Game Style V1"; added the Style Lab.

## V3 / V2.5 / V2 / V1

- V3 AI generation queue (Replicate, off by default); V2.5 catalog pipeline
  validation (Packs, Sandbox, Reports); V2 shared Supabase backend; V1 review/export.
