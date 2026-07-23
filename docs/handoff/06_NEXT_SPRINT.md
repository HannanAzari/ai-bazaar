# 06 · NEXT SPRINT

> **Start here after `01`.** Working document for the next session. Update every sprint.
> Track: **Founder Edition Creation Studio.** Current gate: **Avatar Golden Reference** (D43).
> The ONE thing blocking progress is founder-run avatar generation — everything buildable is built.

---

## Where we are (2026-07-23)

The three creation engines + the Art Engine are all built and deployed to the
`m12-nest-platform` Preview. Remaining work is founder-run (generation + eye), not engineering.

- **Generation Platform** (D28–D30): one shared `GenerationStudio` + `lib/generation-platform`;
  Asset/Nest/Avatar are thin modules. See `GENERATION_PLATFORM.md`.
- **Asset Factory** — shipped, **FROZEN** (D19/D20). `/asset-factory` → `nest_assets`. Family
  defaults fixed classification (D38). furniture@8 stays certified (not compiler-driven yet, D40).
- **Nest Factory** — shipped (D24). `/nest-factory` → `nest_backgrounds` (provisioned). Empty-room
  architecture only; selectable in Create → Build My Own.
- **Avatar Studio** — shipped, **founder-only Beta** (D31/D32/D39). `/profile/avatar` → `user_avatars`
  + private `avatar-private` bucket (provisioned; cross-user isolation proven, `SPRINT4_AVATAR_FACTORY.md`).
  UX is premium (D42). **Opens to users only when `AVATAR_PUBLIC_ENABLED=1` after the style is approved.**
- **Auth** — ONE source of truth: `getServerUser` (server) + `useNestIdentity` (client); role-gated
  founder studios (D35/D36). `/api/auth/whoami` is the diagnostic (D37). See `AUTH_ROUTING_SPRINT.md`.
- **Art Engine v1** (D40): `lib/visual-dna` (structured Visual DNA) + `lib/art-engine` (compiler,
  validators, 5 Golden-Reference slots). Studios are polished + warm (D41/D42).

## The immediate gate — Avatar Golden Reference (founder-run loop, D43)

The avatar **art-direction brief** is written (`lib/art-engine/type-dna.ts AVATAR_TYPE_DNA`,
`avatar-art-v1-candidate`). Claude cannot generate or judge avatars (no session/photo/spend), so:

1. **Founder** generates 3–4 avatars (well under the 10–15 cap) from their account.
2. **Founder** says, per image, what improved / got worse / still feels wrong.
3. **Claude** tunes the words in `AVATAR_TYPE_DNA`; repeat.
4. On **"That's it"** → freeze the avatar slot in `lib/art-engine/golden-references.ts`
   (`approved` + prompt + versions + output URL) = **Avatar Golden Reference v1**, then STOP.

## After the Golden Reference (do NOT start before it)

- Set `AVATAR_PUBLIC_ENABLED=1` (open avatars to users).
- **Then: Creator Generator → Interaction Engine** (D23, D27) — not before.

## Guardrails carried forward

- Asset Factory + Nest Factory Create flows are **frozen** — no redesign without a founder bug report.
- Founder-gated generation/publish (D22); users never generate Nests (D26).
- Additive migrations only, shown + founder-provisioned. Never change the canonical camera.
- Do **not** build AI room decoration / auto-placement / the Interaction Engine yet (D27).

---

## (Archived) prior sprint brief — Background + Avatar factories

> Superseded by the Sprint 3 framing above: "Background Factory" became the **Nest Factory** (D24),
> and Avatar Factory is deferred behind Creator Generator + Interaction Engine (D27). Original
> detail retained below for reference.

## Current objective

Build **Background Factory** and **Avatar Factory** by **reusing the exact Asset Factory shell**
(D21): same UX, same translator→spec→review→approve→publish flow, same DB/persistence model, same
founder gate, same mobile ergonomics. **Only the generation engine + the translator's target schema
change per type.** No "Unified Studio" milestone (D21) — reuse, don't rebuild.

## Exact deliverables

1. **Background Factory** (`/background-factory`, mirrors `app/asset-factory`):
   - Background Translator (intent → background spec: category, mood, architecture, walls, floor,
     palette, lighting, window config, asset-safe zones, canonical camera, cost, safety).
   - Generation engine tuned for **empty room stages** (no movable furniture; one frozen canonical
     camera; identical room-stage geometry across all backgrounds).
   - Same review/approve screen + the extra final gate: *"Could I build ≥3 different Nests in this room?"* (Yes enables publish).
   - Persistence to **`nest_backgrounds`** — **prepare the additive migration, show it, wait for
     founder provisioning** (never a parallel/legacy fallback). Same safety as the Laptop write.
   - **Prove 3 first:** Minimal Flexible Room · Creator Studio · Music Studio — same camera/geometry,
     distinct identity. Stop and compare before generating more.

2. **Avatar Factory** (`/avatar-factory`, mirrors the shell; **upload-required**):
   - Avatar Translator (privacy-conscious: presentation, outfit category, palette, hair, accessories,
     full-body, canonical front pose, expression, transparency, privacy scope, cost, safety). **Never
     classify ethnicity/religion/health/sexuality/politics; never exaggerate features.**
   - Generation engine for **full-body, transparent-bg, idle-standing** Nestudio-style avatars
     (respectful likeness, not photoreal; clean hands/anatomy; reliable foot anchor).
   - Same review/approve screen + the two final gates: *"Does this respectfully resemble the person?"*
     and *"Would I proudly represent this person in a Nest?"* (both Yes to approve).
   - **Privacy from day one:** real-person avatars are **private by default** (`scope: private-user`,
     `ownerId` = founder/test user), a **Delete Reference and Result** action, reference images never
     public. Persistence to **`nest_avatars`** — **audit first**, then additive migration shown +
     founder-provisioned before any write.
   - **Prove 1 first:** one founder-uploaded photo → idle standing → save privately → place → reload →
     still present → delete → removed from library + storage.

## Definition of done

- Both factories run the **identical shell/flow** as Asset Factory (only engine + translator target differ).
- Mobile-first: works from the founder's phone (uploads from photo library, safe-area, no overflow,
  double-tap guard, recoverable errors).
- Migrations for `nest_backgrounds` / `nest_avatars` are **additive, shown, and provisioned by the
  founder** — no destructive DDL, no silent fallback table.
- The 3-background and 1-avatar proofs pass (founder-run generations; I build + wire dry).
- Gates green (typecheck · lint · tests · build). Deployed to the Vercel preview.

## Guardrails (do not violate)

- **Asset Factory is frozen** (D20) — no Create-flow redesign.
- Reuse the shell (D21) — do **not** build three separate apps or a unified-studio abstraction.
- Founder gate on every generation/publish route (D22). Global publish is founder-only; anonymous never publishes.
- A generated background must **never change the canonical camera**. A real-person photo must **never** become public.
- Additive migrations only; show SQL and wait for founder provisioning. No spend by me — the founder runs generations.
- Do **not** start the Creator Generator or Interaction Engine this sprint (D23).

## After this sprint (D23)

**Creator Generator** (compose a complete starter Nest) → then the **Interaction Engine** (UOS
surfaces, animation, sound). Not before.
