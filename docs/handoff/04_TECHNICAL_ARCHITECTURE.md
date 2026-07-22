# 04 · TECHNICAL ARCHITECTURE

> Architecture only — no implementation detail. Two layers: the **target architecture** (frozen design, mostly unbuilt) and the **current codebase** (pre-pivot, partially built). Read after `03`.

---

## Target architecture (the frozen design)

### Universal Object System (UOS) — the spine

Every object is **data that plugs in**; the engine ships code, objects do not. The whole model in one line:

> **An object = its own identity + geometry, plus *references* into four registries — Patterns, Animation, Sound, Surfaces.** Build the engine + registries once; every new object (the 61st or the 1000th) is a data record.

- **Object model** — ~30 fields (identity · spatial · placement · assets · interaction · content · semantics · extensibility). Objects store *references* (pattern id, animation package, sound profile, surface list), not behaviours. Machine-readable schema: `uos-spec.json`.
- **One lifecycle**, every object: `Load → Idle → Hover → Focus → Interact → Content → Close → Idle`. No per-object state machines; patterns parameterise the Interact/Content phases.

### Objects & interaction engine

- **8 reusable interaction patterns**: SCREEN · OPEN · BOOK · DRAWER · DISPLAY · PLAY · EXAMINE · TOGGLE. An object picks one. New behaviour = a new pattern (rare), never new object code. ~25% of objects are interactive; the rest are static/ambient.
- Patterns compose (a laptop is OPEN + SCREEN, declared once and reused by every clamshell).

### Animation system

- Objects hold **parameters, not animations**. The engine has a library of **primitives** (MOVE, SCALE, ROTATE, FADE, GLOW, PARTICLES) and named **composites** (LID-OPEN, BOOK-OPEN, DRAWER-SLIDE, SCREEN-WAKE, LENS-EXTEND, PLATTER-SPIN). Each module = `{type, target, duration, easing, delay}`. Constraints per the interaction philosophy (`03.IV`): no skeletal, no Blender-level rigs.

### Surface system

- A **surface** is a content channel an object exposes, **decoupled** from the object — any object can host any compatible surface. Types (one consistent viewer each): `link-grid · gallery · video · feed · player · product · story · profile`.
- Creators configure a surface by connecting a **source** (URL / upload / OAuth to YouTube, GitHub, Instagram, Spotify, Shopify). Visitors get the same grammar everywhere. Multi-surface objects show tabs.

### Sound system

- Objects reference a **sound profile by material**; sound is **inherited** (object → material profile → global defaults), with per-event overrides only where identity demands (a metal camera overrides to a shutter). Adding a wooden object = free sound.

### Room system & backgrounds

- A **Room/Nest** is a composition: a background + a placed set of objects following the grammar (`03.III`). Objects sit on **hosts** (floor/desk/shelf/wall/ceiling/hanging) via a **host-acceptance matrix** (pure data — prohibitions are absence from a list).
- **Backgrounds** (postponed — categories only): one soft warm key light, desaturated warm-neutral palette, the **one canonical camera** (front-facing, ~10° elevated, ~35mm — shared by backgrounds *and* objects so they align), shallow diorama depth, matte materials, soft warm shadows. The background is a whisper; objects speak.

### Memory system

- Memory objects have an **accumulation** model (grow with the creator's history) and an **internal reveal** (tap → photo/note/story via the `story` surface — never links out).

### Future AI generation / composition pipeline

- The UOS turns "AI builds a room" into **bounded constraint-satisfaction over a typed object graph**: relationship matrix = constraints, grammar (recipe, negative space, focal points) = objective, tags + role-hints = selection. It **cannot place randomly**. AI is a *reader* of the UOS, never a special mode.

---

## Current codebase (pre-pivot — what actually exists)

- **Stack**: Next.js 15 (`ai-bazaar`), React, TypeScript, Tailwind, Supabase (auth/storage), MediaPipe (on-device segmentation). **Node 20** for tooling. Branch **`m12-nest-platform`** (preview only; never `main`/prod).

### Asset Factory (working — the one substantial built system)

Turns a real photo into a stylised Nestudio 3D asset via **GPT Image (`gpt-image-1`)**. Provider-abstracted (Gemini deprecated).
- `lib/asset-pipeline/` — `honest.ts` (one-generation orchestrator, no repair loops), `furniture-8.ts` (the `furniture@8` prompt), `cleanup.ts` (shadow/halo alpha cleanup), `camera.ts` (canonical camera clause), `router.ts` (provider switch).
- `app/api/ai/generate/route.ts` — GPT Image edit (server-side key, native transparency, style refs, cost/usage).
- `app/api/ai/identity/route.ts` — vision identity (`gpt-4.1-mini`), **objective facts only**.
- `app/dev/gpt-image/` — internal review bench. Segmentation: `lib/segmentation/` (MediaPipe + flood fallback).
- **Status**: technically strong (~95% at scale), but the *library look was rejected* (wooden-everything) — `furniture@8` needs a **material-aware** rework before it produces the real vocabulary. Not wired to the UOS yet.

### Nest app (pre-pivot scaffolding)

Editor (`components/nest/editor/`), device-local inventory (`lib/ai-inventory/`, `localStorage`), nest documents, village/discovery. Predates the frozen design; to be re-aligned to the UOS + grammar.

### Storage (verified state)

Supabase is configured (bucket `room-images`, tables `nest_assets`/`nest_objects`/…) and only written by the **editor/studio UI** — the Asset Factory batches wrote **nothing** to it. Generated assets from validation live only in a scratchpad; none were promoted.

## Folder structure (current, relevant)

```
app/                 routes (incl. app/api/ai/*, app/dev/gpt-image)
components/nest/      editor + nest UI
lib/asset-pipeline/   the Asset Factory (GPT Image honest path)
lib/segmentation/     on-device cutout
lib/ai-inventory/     localStorage asset store
lib/storage/          Supabase/local image storage abstraction
docs/                 documentation (see 09 for the target structure)
docs/handoff/         THIS onboarding package
```

## Future scalability

Adding an object at any scale = **a data record referencing existing registries** (see UOS). Objects grow linearly; engine code grows logarithmically (a new pattern only for a genuinely new behaviour). The 1000th object is as coherent as the 1st. The Asset Factory is the *content* pipeline that produces the object art; the UOS is the *runtime* that gives it behaviour. The two meet when a generated asset becomes a UOS record.
