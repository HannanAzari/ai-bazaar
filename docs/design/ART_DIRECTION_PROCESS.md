<!-- Governed by docs/design/NESTUDIO_WORLD_BIBLE.md — read that first. -->
# Art Direction Process — approval, prompts, evaluation

> **Authority:** subordinate to [NESTUDIO_WORLD_BIBLE.md](NESTUDIO_WORLD_BIBLE.md).
> **Companion to:** [CREATOR_TRANSLATION.md](CREATOR_TRANSLATION.md), [RENDERING_DNA.md](RENDERING_DNA.md),
> and the operational [`../asset-generation-prompt-bible.md`](../asset-generation-prompt-bible.md) /
> [`../golden-nest-production-bible.md`](../golden-nest-production-bible.md).

How the DNA is *governed over time*: how experiments are run, how prompts evolve, and how every asset is
scored. The DNA is stable; this is the only sanctioned way to change or extend it.

---

## 1. Governing rule

**No design rule changes, and no prompt becomes active, automatically.** Every change is an experiment with
a written record and an explicit human decision. The World Bible is the source of truth; a change is not
real until the Bible (and the relevant sub-doc) is updated in the same step.

## 2. Experiment record (required for every change)

Every experiment — a new prompt version, a palette tweak, a new primitive, a new category — is logged with
these fields (this is the format used across M22–M25; keep it):

| Field | Meaning |
|---|---|
| **Hypothesis** | what we believe will improve, stated as a testable claim |
| **Variable** | the single thing being changed |
| **Constants** | everything held fixed (so the result is attributable) |
| **Result** | what actually happened (with the candidate images / evidence) |
| **Decision** | KEEP / REJECT / ITERATE — and why |
| **Lesson** | what this teaches about the DNA |
| **Next experiment** | what to try next |

**One variable at a time.** The M23–M25 discoveries only held up because each round changed exactly one
thing (material, then lighting; then shape; then primitive). Multi-variable changes are unattributable and
are rejected on process grounds regardless of how good they look.

## 3. Prompt architecture

Prompts are **versioned, never edited in place.** A prompt ships by registering a new version and bumping
the active pointer — the engine never changes. (Implementation: `lib/ai/prompts.ts` — `PROMPT_REGISTRY`
maps `"<kind>@<n>"` → builder; `ACTIVE_PROMPT_VERSION` selects the live one; every asset records the exact
`promptVersion` that made it.)

### Naming
`"<kind>@<n>"` — e.g. `furniture@6`. `kind` = the category; `n` = an incrementing integer. Old versions stay
registered and pinnable forever (reproducibility).

### Locked vs experimental variables
- **Locked** (never move without a full experiment + Bible update): the matte finish, warm-key/cool-plum
  lighting, palette, the immutable camera, the Alphabet, the six Physics laws, transparency.
- **Experimental** (what a new version is allowed to tune): identity-preservation phrasing, framing
  tolerances, shape-language emphasis, tonal params for the local fallback.

### Furniture version history (why each exists)
| Version | Change | Why |
|---|---|---|
| `furniture@1` | baseline "clean placeable asset" | read generic / inconsistent |
| `furniture@2` | explicit framing + lighting + shadow directives | better, still drifted on saturation/material |
| `furniture@3` | locked palette + saturation ceiling + "matching set" framing | cohesion, but the palette clause **repainted** real objects |
| `furniture@4` | preserve TRUE colours + markings; warm the *light* not the object; no floating decoration; centered ~70% | fixed the mug fidelity failures (M22.2) |
| `furniture@5` | + the M23 **rendering language** (matte hand-painted finish, warm key + AO) | froze *how it's rendered* |
| `furniture@6` | + the M24 **shape language** (pedestal · pebble · negative-space cut-out) | froze *how it's shaped*; embodies the M25 Alphabet |

**Inheritance:** each version keeps the prior version's hard-won rules and adds one layer. Never drop a
locked rule silently.

### Open prompt gaps (to reconcile in `furniture@7`, via §2 — NOT done in M26)
1. `furniture@6` says **"eye-level"**; the immutable camera requires **slightly-elevated 10° with visible
   top surfaces** and forbids eye-level furniture photos.
2. `furniture@6` bakes **"one soft grounded contact shadow"**; the rule is **engine-composited cool-plum
   shadow, never baked**.
3. `furniture@6` warms AO warmly; the world shadow tone is **cool-plum `#46365a`** — confirm the object
   grounded shadow matches the world two-tone.

## 4. Evaluation — the permanent scorecard {#evaluation}

Every generated asset is reviewed against these ten criteria before approval. Score each **0–2**
(0 fail · 1 weak · 2 strong). **Hard gates** (must be 2, else auto-reject regardless of total):
**Silhouette**, **Family resemblance**, **Identity preservation**.

| # | Criterion | 2 = strong | 0 = reject |
|---|---|---|---|
| 1 | **Silhouette** ⛔ | reads as this object *and* as Nestudio in filled black | generic / unreadable outline |
| 2 | **Family resemblance** ⛔ | clearly one hand with the rest of the library | off-family finish/shape/light |
| 3 | **Identity preservation** ⛔ | the object's essential identity is intact | lost identity, or literal reproduction |
| 4 | **Warmth** | warm light, cool-plum shadow, inviting | cold / neutral-grey shadow |
| 5 | **Lovability** | you want to keep/show it | inert, clinical |
| 6 | **Premium feeling** | matte, calm, restrained | glossy / busy / cheap |
| 7 | **Craft** | living asymmetry, hand-painted, no AI tells | CAD-perfect or sloppy |
| 8 | **Thumbnail readability** | clear at 64 px | mush when small |
| 9 | **Background compatibility** | clean transparent cut-out, sits in a scene | fringe / halo / wrong camera |
| 10 | **Cross-object consistency** | coheres beside 11 other objects as a set | breaks the set |

**Perspective is a super-gate:** an asset that violates the immutable camera is rejected *before* scoring —
"beautiful but wrong perspective → REJECT" ([RENDERING_DNA.md](RENDERING_DNA.md#6-camera--perspective--immutable-inherits-the-camera-dna-lock)).

**AI never ships raw to users.** Every asset passes a human review against this scorecard (avatars and
personal belongings, the only runtime-generated categories, included).

## 5. Consistency test (the set-level gate)
Beyond single assets, periodically generate a full reference set (≥12 objects) and judge them **as a group**
— every asset should feel like one artist. A set that fails cross-object consistency (#10) fails even if each
asset passes alone. Tooling: the dev review panel + `public/test-photos/*` boards.
