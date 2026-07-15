# AI Bazaar Roadmap

Single source of truth for product direction. Keep concise; update every sprint.
For technical detail see [architecture.md](../architecture.md); for testing see
[QA.md](QA.md).

---

## 📍 Current Status (M31 — experiential phase, 2026-07)

> **The project has left the documentation phase. The next work is experiential** — does the world
> *feel* the way the design system says it should? That is now the only question. New here? Read
> [SESSION_HANDOFF.md](SESSION_HANDOFF.md) and [CEO_NOTES.md](CEO_NOTES.md) first, then the
> [World Bible](design/NESTUDIO_WORLD_BIBLE.md).

- **M20–M31 happened after this roadmap was last rewritten.** M20–M22 built one reusable **AI engine**
  (`lib/ai`) + Creator Studio; **M23–M25** froze the visual DNA (rendering · shape · geometric alphabet);
  **M26–M30** founded the permanent `docs/design/` **World Bible** + Living World + Soul + the Icon/House
  exploration *laboratories* (no winners chosen). Full history: [design/CHANGELOG.md](design/CHANGELOG.md).
- **M31 shipped the first REAL feature (not docs): Vertical Slice 01 — "my object became part of my home."**
  `Create → Turn your object into a Nestudio asset → /creator-studio → upload a photo → 3 real Gemini
  candidates → choose one → Place in my Nest → it persists on reopen.` Proven end-to-end on mobile.
- The active object prompt is **`furniture@7`** — it **reinterprets** an uploaded belonging (rebuild from
  scratch as a Nestudio object; keep identity, discard the photo), correcting the `furniture@6` photo-cutout.
- **Principle reconciliation (honest):** old **Product Principle 4** said *"AI selects assets, never generates
  visuals."* That held for the room-designer era; it is **superseded for the personal-belonging path** —
  runtime AI now *generates* a single personal object, human-approved, one at a time. Curated composition is
  still the rule for everything else. See [nestudio-cto-handoff.md](nestudio-cto-handoff.md) §4.
- **Single priority:** get `furniture@7` in front of the founder on his phone; iterate the render by *feeling*.
- **State:** branch `m12-nest-platform`, last commit `a27fa4e`, **preview only** (no `main` merge, no prod).

---

## Vision

> **V2 architecture (ADR-027 + ADR-028): `Village → House → Nest → Objects → Content`.**
> Nestudio **composes digital homes.** Each creator's surface is a **Nest** — a **front-facing
> cinematic scene** (full front wall + side-wall slivers + floor, shallow depth; **not** isometric,
> locked by ADR-028) that feels *like them*. A Nest is **composed** from a curated **Nest Template**
> + **Scene Slots** + **Asset Library** assets + avatar + a few personal belongings — **composition
> over generation.** Visitors tap objects (**Object → Animation → Content**). North star: *"this
> place feels like me."* The user-facing **"Wall" concept is removed.** Masters:
> [nestudio-production-pipeline.md](nestudio-production-pipeline.md),
> [golden-nest-production-bible.md](golden-nest-production-bible.md),
> [nestudio-cto-handoff.md](nestudio-cto-handoff.md).
>
> **Shipped code is V1** (the cozy-village room engine below); the V2 Nest architecture is
> documentation-first and not yet implemented.

A **creator-owned virtual village** (V1 framing, carried into V2 as the discovery layer). Every
creator owns one customizable space, and visitors discover creators by **exploring spaces** —
wandering a village, entering homes — instead of scrolling a feed. The Nest is the product; the
village is the navigation; **AI helps by *selecting/composing* from a curated asset library, never
by generating visuals per creator.**

---

## Core Product Pillars

1. **Village discovery** — hex world map → village streets → houses. Explore, don't scroll.
2. **Room engine** — the room is the primary surface: zones, objects, actions.
3. **Creator identity** — profiles, follows, tags; a creator is known by their space.
4. **Asset ecosystem** — a curated catalog is the source of truth for everything placeable.
5. **AI room designer** — suggests/auto-arranges assets for a creator (selection, not generation).
6. **AI room editor** — conversational edits ("add a bookshelf by the window") that map to asset/zone operations.
7. **Social interactions** — guestbooks, likes, collections, activity, notifications.

---

## Completed

| Sprint | Date | Outcome |
|---|---|---|
| Visual feeling & UX polish | 2026-06-10 | Magical-village street/interior pass; removed dashboard feel |
| Visual redesign "Lantern Hollow" (Phase 0–1) | 2026-06-10 | Design tokens, Fraunces/Nunito fonts, seed-deterministic SVG house kit |
| Platform foundations | 2026-06-11 | Hexagon district map, tags, discovery modes, analytics events, reporting + moderation (`20260611_*`) |
| Sprint 1 — Creator identity | 2026-06-12 | Creator profiles `/u/[handle]`, notifications + bell, guestbooks (`20260612_*`) |
| Sprint 2 — Saving, activity, assets | 2026-06-13 | Collections, activity feed, internal asset catalog (`20260613_*`) |
| QA & stability | 2026-06-13 | Audit + small fixes, Vitest suite, QA checklist, DX docs |
| Room Engine V1 | 2026-06-14 | Full-screen public room, 9-zone schema, room objects + actions, studio room editor, room-ready assets (`20260614_*`) |
| Room Engine V2 — Creator Studio | 2026-06-15 | Free drag/resize, layers, duplicate, delete-confirm, multi-select, Edit/Preview, undo/redo, autosave, six templates, editing analytics (`20260615_*`) |
| Room Engine V3 — Real Interactive Objects | 2026-06-16 | Real panels (gallery/video/link/product/booking/contact/profile), `profile` type + 7 assets, rich action data, tooltips, visitor analytics, owner insights, inspector editors, working presets (`20260616_*`) |
| Room Engine V4 — Multi-Room Houses | 2026-06-17 | `HouseRooms` + entry room, `door`/`stairs` categories + `room_link` navigation, public breadcrumb/back, studio room manager + room presets, whole-house undo, nav analytics, legacy migrate-on-read (`20260617_*`) |
| Room Engine V5 — Richer Visuals + Rotation | 2026-06-18 | Per-category object sprites (frames show real images), engraved nameplates, rotation editor (slider + ±15°), five room background variants, improved empty state (no schema change) |
| Production Backend Cutover Prep | 2026-06-19 | Migration/schema drift audit, `docs/supabase-cutover.md` runbook, env-derived runtime mode + dev-only badge, repository layer (local impls + Supabase stubs + factory), tests; demo unchanged |
| AI Room Designer V1 | 2026-06-20 | Deterministic, selection-only room designer (`lib/ai-room-designer.ts`): brief→intent keyword matching, asset ranking, six style presets, valid-room composition, preview-before-apply (studio Design mode), design explanations, `room_design_*` analytics (`20260620_*`); no image generation |
| AI Room Designer V2 — Smarter Briefs, Constraints, Drafts | 2026-06-21 | Advanced brief parser (creator type · mood · purpose · constraints), constraints engine, 8 creator presets, owner-private drafts (`room_design_drafts` + `20260621_*`), session history, richer explanation panel, 4 V2 analytics events; still deterministic + selection-only |
| AI Room Designer V3 — Creator Auto Build | 2026-06-22 | Deterministic profile analyzer (`lib/creator-analyzer.ts`, no scraping/APIs): IG/TikTok/YouTube/Website + bio → creator type (12) / mood / purpose / keywords / confidence; auto room via `generateRoomDesign`, auto social objects + about-me profile object, deterministic welcome message, analyzer insights, 4 `creator_*` analytics (`20260622_*`) |
| Production Cutover V1 | 2026-06-23 | Real Supabase auth (unified `useSession()`), profiles wiring, real `profiles`/`houses`/`rooms` repos (anon+RLS), jsonb room persistence (`20260623_*`), `SupabaseStorage`, onboarding (`/onboarding`), subdomain prep + middleware, staging checklist; demo unchanged. Full authenticated flow verified live on staging (incl. production shop-claiming) |
| Pilot Hardening V1 | 2026-06-24 | Reliability/safety/polish for friends & family pilot (no new features): shared validation, centralized friendly errors (no raw Supabase leaks), loading/double-submit guards, internal funnel events (`20260624_*`), draft legal pages (`/privacy`,`/terms`,`/safety`,`/contact`), pilot-readiness/ops/analytics docs; demo + production unchanged; 200 tests |
| Analytics + Discovery V1 | 2026-06-25 | Mode-aware **durable analytics** (`SupabaseEventsRepository` implemented; `trackEvent` writes Supabase in production, local fallback), **anonymous visitor sessions** (first/returning, duration), **creator insights dashboard** (visits, unique visitors, room entries, avg session, top objects/room/day), per-object + **visitor funnel** analytics, **Featured Nests** discovery (Trending/New/Recently active) on `/discover`; `visitor_sessions` table + owner-read events RLS (`20260625_*`); demo unchanged; 236 tests |

| M13 — Mobile Stabilisation | 2026-07-02 | Reunited the single Nest editor with the restored Golden Nest assets after the M12 library cutover: catalog-aligned asset ids (Connect + Surfaces work), `seat`/`desk` floor guardrails, generic text/image overlays, mobile UX (Done→/studio, scroll-lock, 16px inputs, safe-area), null-safe `slotTypeForAsset` (focus-scene crash fix), `/nest-admin` redirect, flawed oak assets hidden + templates repointed. Preview only (`m12-nest-platform`); 319 tests. See [m13-mobile-stabilisation.md](m13-mobile-stabilisation.md) + ADR-032. |
| M15 — Real App Shell & Nest Home | 2026-07-02 | Nestudio becomes a real app: permanent mobile bottom nav (`Home · Explore · Create · Updates`), real **Home** (profile summary · drafts · published), **username ownership** + `/@<handle>` public profile, Create tab as the single creation entry, Explore + Updates placeholders. Built on the **nest-auth identity** (no auth rewrite); single editor + persistence preserved. `/studio`,`/`,`/design/nest-onboarding` redirect into the shell; editor/publish return to `/home` (login wall removed). Preview only (`m12-nest-platform`); 335 tests. See [m15-app-shell.md](m15-app-shell.md) + ADR-033. |
| M15.1 — Navigation Meaning Correction | 2026-07-03 | Fix the app's IA before preview testing: **5 icon-only tabs** (`Home · Explore · Create · Notifications · Profile`); **Home = discovery feed**, **Profile = the private dashboard** (was `/home`); Explore gains search + trending chips; `/updates`→`/notifications`; editor/publish/`/studio` return to `/profile`. Correction sprint (no new features). Preview only (`m12-nest-platform`); 335 tests. See [m15-app-shell.md](m15-app-shell.md) + ADR-034. |
| M16 — Real Identity & Authentication | 2026-07-03 | Replace the temporary browser-local identity with a **real account system**: email sign-up/sign-in/sign-out + session restore (Nest account facade — local multi-account demo \| Supabase Auth), **unique/immutable usernames**, profile completion (bio/avatar/socials), **ownership enforcement** (only owners edit/republish/delete; editor denies others; Supabase RLS server-side), **local-work migration** on sign-in (no Nest loss), and public `/@username` profiles. Infrastructure only. Preview runs the local backend; Supabase goes live via cutover. Preview only (`m12-nest-platform`); 344 tests. See [m16-identity-auth.md](m16-identity-auth.md) + ADR-035. |
| M17 — Discovery Feed | 2026-07-03 | The first real discovery experience: a shared `DiscoveryItem` model over **published + curated** Nests (`lib/nest-discovery.ts`); **Home = immersive vertical snap feed** leading with creator identity, title, tags, Visit/Create CTAs; **Explore** search (title/creator/tags) + category/trending chips + grid/list toggle; **visitor page** with real creator badge + tags + "wander more" CTA; empty states everywhere. Published Nests borrow tags/persona from their source template. No follows/comments/real likes/villages/marketplace/AI. Preview only (`m12-nest-platform`); 356 tests. See [m17-discovery-feed.md](m17-discovery-feed.md) + ADR-036. |
| M17.1 — Discovery Polish & Identity | 2026-07-03 | UX/identity polish (no backend): **composed Nest thumbnails** (`NestPreview` — real furniture, launch-critical) everywhere; immersive Home feed with creator row + engagement bar (❤/💬 disabled · ↗ Share); **owner vs visitor view** on `/nest/[slug]` (owner: stats + Edit + Share; visitor: Follow + Create + More); **Nest naming** at publish + **same-tab** open; Create tab **active state**; profile **Followers/Following/Nests** placeholders; **app-screen layouts** (fixed-height, internal scroll). Deterministic placeholder engagement (`lib/nest-engagement.ts`). Preview only (`m12-nest-platform`); 360 tests. See [m17.1-discovery-polish.md](m17.1-discovery-polish.md) + ADR-037. |
| Beta Polish Final — Mobile Layout & Village Globe | 2026-07-09 | Visual/mobile polish (no features; no backend/auth/publishing/social/editor logic): the **village becomes a curved little world** — living sky (sun/moon/birds/weather) fills the upper half, a **soft globe-limb ground** fills the lower half with curved lanes you orbit left↔right (2.5D CSS/SVG, no 3D/Three.js/libs); **bottom cream gaps removed** on Home/Village/arrival (full-bleed under the translucent nav); **Home feed card cleanup** (soft gradient over a room-first card, Reels-style right action rail, one CTA = Visit House, minimised title/tags); **editor Done button always visible** (removed the width-shifting Saved label). Preview only (`m12-nest-platform`); 402 tests. See [beta-polish-final-mobile-village.md](beta-polish-final-mobile-village.md). |
| Beta Polish 5 — Micro-Animations | 2026-07-03 | Calm, cozy, premium micro-animations (CSS-only, 60fps, reduced-motion respected; no features/libraries): soft-spring buttons, softer heart-pop, Follow morph, softer comment-sheet slide + backdrop fade, barely-there village house float (shadows stay grounded), terrain tree sway, smoother clouds + more natural snow, and a subtle room ambient light pulse. No tables/migrations/flags. Preview only (`m12-nest-platform`); 402 tests. See [beta-polish-5-micro-animations.md](beta-polish-5-micro-animations.md). |
| Beta Polish 4 — Discovery Feed | 2026-07-03 | Pure visual polish (no discovery-logic/backend change) so every Nest card feels premium: serif title + tighter typography, **CTA hierarchy** (dominant Visit House/Nest + quiet secondary), ringed avatar, top scrim + deeper gradient + **vignette**, `rounded-3xl` grid cards, deepened safe zone so **furniture never covers buttons**, smoother swipe (`scroll-smooth` + iOS momentum), and better **loading** (image fade-in + shimmer skeleton). No tables/migrations/flags. Preview only (`m12-nest-platform`); 402 tests. See [beta-polish-4-discovery-feed.md](beta-polish-4-discovery-feed.md). |
| Beta Polish 3 — Arrival Experience | 2026-07-03 | Pure polish on the Nest arrival (no functionality change): decluttered `HouseFront` to **Creator · Followers · Nest count · Enter** (removed Home/Online/Now-showing/duplicate-time), **Instagram-Stories swipe** (arrows still work), a house that **feels alive** (idle float, softer pooled light, grounded shadow, larger scale), and a **smoother door**. Also **fixed a hydration mismatch** from Beta Polish 2 (`Math.sin` scatter PRNG → integer hash). No tables/migrations/flags. Preview only (`m12-nest-platform`); 402 tests. See [beta-polish-3-arrival-experience.md](beta-polish-3-arrival-experience.md). |
| Beta Polish 2 — Village Realism | 2026-07-03 | Pure visual polish (no features, no nav change) so the village feels like a believable town, not floating stickers: a **`VillageTerrain`** ground layer (rolling grass valley, elevation contours, winding dirt road + walking paths, neighbourhood greens, scattered trees/bushes/flowers/rocks — organic, seeded), **perspective** (lower=closer/bigger, upper=further/smaller/hazier) + **contact shadows**, and more seed-derived **house variety** (fences, porches). Re-lights with time of day + weather. No tables/migrations/flags. Preview only (`m12-nest-platform`); 402 tests. See [beta-polish-2-village-realism.md](beta-polish-2-village-realism.md). |
| Beta Polish 1 — Fullscreen Experience | 2026-07-03 | Pure UX/layout polish (no features) so Nestudio feels like a native app, not a scrolling website: **Home feed** = true snap **one-Nest-per-viewport** paging (no peek); **Visitor + Owner Nest** = fixed one-screen flex (identity · room · actions), **no page scroll**; **asset safe zones** (`NestPreview safe={{top?,bottom?}}`) so furniture never overlaps the identity/action UI. Layout-only — no tables/migrations/flags; village/editor/publishing/auth/discovery untouched. Preview only (`m12-nest-platform`); 402 tests. See [beta-polish-1-fullscreen.md](beta-polish-1-fullscreen.md). |
| M19.1 — Arrival Magic & Atmosphere | 2026-07-03 | Pure polish/atmosphere so opening a Nest feels *magical*: **time of day** (morning/afternoon/evening/night — sky, light, window glow re-colour; `lib/nest-atmosphere.ts`), deterministic **daily weather** (sunny/cloudy/rain/snow), **house life** (smoke/glow/sway/birds), **cinematic camera** (tap zooms toward the house, neighborhood softens), **arrival polish** (avatar/bio/followers/nests/online + live time·weather chip), a **round-trip door** (Enter pushes forward · Exit closes back), deeper seed-derived **house identity** (roof/window/door/garden/mailbox), and an **ambient-audio architecture** behind `ENABLE_NEST_AUDIO` (off; no files). No deps/tables/migrations. Preview only (`m12-nest-platform`); 402 tests. See [m19.1-arrival-magic.md](m19.1-arrival-magic.md) + ADR-040. |
| M19 — Villages, Houses & Arrival | 2026-07-03 | The first **spatial** layer: `Village → House → Nest` made real so *"I visit a place, not a profile."* Deterministic **House** model derived from persona/identity (`lib/nest-house.ts`, no editor/no storage); **Village** hex layout with generated neighbors (`lib/nest-village.ts`); a pannable **`/village`** of storybook SVG cottages; an **arrival** panel (`HouseFront`) + **Enter Nest door transition**; **`/@handle` re-framed as a house arrival** (hero + Enter + "Rooms in this house") preserving M16 identity + M18 social; discovery **Visit House** entry point. Pure presentation layer (no tables/migrations/flags). Preview only (`m12-nest-platform`); 389 tests. See [m19-villages-houses-arrival.md](m19-villages-houses-arrival.md) + ADR-039. |
| M18 — Social Foundation | 2026-07-03 | The first **real** social layer so a creator feels visited: **real likes** (`LikeButton`), **real follows** (`FollowButton`, real follower/following counts), **Comments V1** (`CommentSheet` — slide-up, add/delete-own/newest-first/creator badge), **Notifications V1** (real inbox + nav unread badge), owner **"Today" activity**, and owner **Views/Likes/Comments/Followers** analytics. Local store (`lib/nest-social.ts` + `lib/nest-notifications-store.ts`) that emits notifications; guests gated in place with a sign-in sheet. Supabase schema authored (`20260703_01_nest_social.sql`) for the cutover. No algorithms/villages/marketplace/DMs/AI. Preview only (`m12-nest-platform`); 365 tests. See [m18-social-foundation.md](m18-social-foundation.md) + ADR-038. |
| M19 — Villages, Houses & Chunk World | 2026-07-09 | The spatial layer `Village → House → Nest` + a **designed (not random) chunk-based village world engine** (`lib/village-chunks.ts` — templates + deterministic sequencer). Houses derived from persona; pannable village; door arrival. Preview only (`m12-nest-platform`). See [m19-villages-houses-arrival.md](m19-villages-houses-arrival.md). |
| M20 — AI Creator Studio foundation | 2026-07-11 | **One reusable AI engine** (`lib/ai`): versioned prompt registry, `StudioConfig` reuse seam, provider abstraction (Canvas stub), modular asset pipeline, local inventory store, `/creator-studio` (upload→generate→approve→save→history), inventory surfaced in the editor asset tray. Furniture-only enabled; other studios registered but disabled — extend, don't fork. Preview only (`m12-nest-platform`). See [m20-ai-engine.md](../memory/m20-ai-engine.md). |
| M21 — AI asset quality engine | 2026-07-12 | Production pipeline: premium canvas ops (palette-lock, unified matte/light/shadow, feather/despeckle/trim/pad), quality gates + iterative refine, style presets + versioned prompt library, metadata inference (category/tags/colours/material/room), **real Gemini provider** + env-gated `/api/ai/generate`, honest provider/fallback labelling. Preview only (`m12-nest-platform`). |
| M22 — Lock the Nestudio visual language | 2026-07-13 | "One artist": art levers (palette-lock + unified light/matte/shadow), the master furniture prompt iterated to the DNA lock, a 12-object in-DNA consistency test, and Creator Studio stripped so the *output* is the hero. Established translation-not-reproduction + object-colour fidelity (`furniture@4`). Preview only. |
| M23–M25 — Object · Shape · Alphabet DNA | 2026-07-13 | Froze the **rendering language** (matte hand-painted + warm key/AO; `furniture@5`), the **silhouette family rule** (pedestal · pebble · negative-space cut-out + 3-second test; `furniture@6`), and the **geometric alphabet** (Pebble · Capsule · Arch). Documentation + prompt lineage; no product feature. Now governed by [design/](design/NESTUDIO_WORLD_BIBLE.md). |
| M26–M30 — World Bible, Living World, Soul, Icon/House Labs | 2026-07-14 | Founded the permanent `docs/design/` system: the **World Bible** (top authority), **Living World** (invisible laws), the **Soul** docs + founding filter, and the **Icon/House exploration laboratories** (frameworks + empty boards + `scripts/icon-lab.mjs` harness, generation hard-gated OFF — **no winners chosen**). Method principle: *documentation records discoveries, never predicts them; GPT creates · Human judges · Claude records.* Docs only, no code. See [design/CHANGELOG.md](design/CHANGELOG.md). |
| M32 — Asset Pipeline (Architecture Reset) | 2026-07-15 | Froze the workflow, **replaced the generation architecture** with a **factory**: a constant **Nestudio Asset DNA** (spec [design/NESTUDIO_ASSET_DNA.md](design/NESTUDIO_ASSET_DNA.md) + code `lib/asset-dna.ts`; prompts assembled *from* it) + a **provider-independent** `generateAsset()` (`lib/asset-pipeline/`, one switch `ACTIVE_ASSET_PROVIDER`; adapters GPT Image + Gemini real, Imagen + Flux no-key, Local fallback). Cutout (`lib/cutout.ts`) split from generation. **Editor-first**: `+ Create` is the first Assets tile; the whole flow stays in the editor (verified end-to-end on mobile with real Gemini). **Asset Benchmark Studio** (`/dev/asset-benchmark`, internal) scores every provider against the DNA. New rule: *stop optimising prompts.* Preview only (`m12-nest-platform`); gates green (517 tests). See [SESSION_HANDOFF.md](SESSION_HANDOFF.md) + [design/CHANGELOG.md](design/CHANGELOG.md). |
| M31 — Vertical Slice 01 + furniture@7 | 2026-07-15 | The first **real feature** (not docs): **"my object became part of my home"** — `Create → Turn your object into a Nestudio asset → /creator-studio → upload → 3 Gemini candidates (A Faithful · B Designed · C Characterful) → choose one → Place in my Nest → persists on reopen`, mobile-first, real hosted Gemini, true transparent PNG behind a hard alpha gate. **`furniture@7`** reinterprets (rebuild-from-scratch, matte, no baked shadow, solid bg keyed to true alpha), correcting the `furniture@6` photo-cutout; now `ACTIVE_PROMPT_VERSION.furniture`. Human approval mandatory; only the chosen candidate is saved. Commits `1bf506b` + `a27fa4e`. Preview only (`m12-nest-platform`); gates green. See [SESSION_HANDOFF.md](SESSION_HANDOFF.md) + [design/CHANGELOG.md](design/CHANGELOG.md). |

All sprints ship green: `typecheck · lint · test · build`.

---

## In Progress

**Beta Polish phase (from 2026-07-03)** on `m12-nest-platform` (preview only; **not merged to `main`,
not deployed to production**). Focus: UX polish · bugs · mobile feel · assets · backgrounds ·
animations. **Not** marketplace, **not** new major product features. **Beta Polish 5 —
micro-animations (shipped 2026-07-03):** calm CSS-only micro-animations (soft-spring buttons, heart
pop, Follow morph, softer sheet slide, subtle village float + tree sway, smoother clouds/snow, room
ambient pulse); 60fps, reduced-motion respected, no libraries. See
[beta-polish-5-micro-animations.md](beta-polish-5-micro-animations.md). **Beta Polish 4 — discovery
feed (shipped 2026-07-03):** every Nest card feels premium — serif title, CTA hierarchy, ringed
avatar, richer gradients + vignette, furniture kept clear of buttons, smoother swipe, and graceful
loading (image fade-in + shimmer skeleton); visual-only, no discovery-logic change. See
[beta-polish-4-discovery-feed.md](beta-polish-4-discovery-feed.md). **Beta Polish 3 — arrival
experience (shipped 2026-07-03):** the Nest arrival decluttered to Creator · Followers · Nest count ·
Enter, Instagram-Stories swipe (arrows too), a house that feels alive (idle float, softer light,
grounded shadow, better scale), a smoother door — plus a hydration-mismatch fix from Beta Polish 2
(`Math.sin` → integer PRNG). See [beta-polish-3-arrival-experience.md](beta-polish-3-arrival-experience.md).
**Beta Polish 2 — village realism (shipped 2026-07-03):** the village stops looking like floating stickers — a `VillageTerrain`
ground layer (rolling grass valley, winding road, walking paths, scattered greenery), depth
perspective + contact shadows, and more seed-derived house variety (fences/porches); visual-only, no
nav change. See [beta-polish-2-village-realism.md](beta-polish-2-village-realism.md). **Beta Polish 1
— fullscreen experience (shipped 2026-07-03):** every Nest surface is now **one phone screen, no page
scroll** — true one-Nest-per-viewport paging on Home, single-screen visitor/owner Nests, and asset
safe zones so furniture never overlaps the UI. Layout-only; no features. See
[beta-polish-1-fullscreen.md](beta-polish-1-fullscreen.md). This follows **M19.1 arrival magic &
atmosphere shipped 2026-07-03**: pure polish so opening a Nest feels *magical* — the
village + arrival gained a **time of day** (sky/light/window-glow change morning→night), deterministic
**daily weather**, **house life** (smoke/glow/sway/birds), a **cinematic camera** (tap zooms toward
the house), **arrival polish** (avatar/bio/followers/nests/online + time·weather chip), and a
**round-trip door** (Enter pushes forward · Exit closes back). Deterministic, dependency-free (CSS
only — no motion lib), no tables/migrations; ambient audio is architecture-only behind
`ENABLE_NEST_AUDIO` (off). See [m19.1-arrival-magic.md](m19.1-arrival-magic.md) + ADR-040. This
polishes **M19 villages, houses & arrival shipped 2026-07-03**: the first **spatial** layer that turns
"visiting a profile" into "arriving at a place." Every creator now owns a **House** (derived deterministically
from persona/identity — no editor, nothing stored), Houses gather into a pannable hex **Village**
(`/village`, real creators centered + generated neighbors), and entering a Nest means stepping
through a **door** (`DoorTransition`). **`/@handle` is re-framed as a house arrival** (hero + Enter +
"Rooms in this house") over the preserved M16 identity + M18 social; discovery leads with **Visit
House**. A pure presentation layer built on top of M15–M18 — no tables/migrations/flags; identity,
editor, discovery, and social untouched. See [m19-villages-houses-arrival.md](m19-villages-houses-arrival.md)
+ ADR-039. **Next:** a custom-house editor + a global/server-side village (currently derived + local
per browser). This builds on **M18 social foundation shipped 2026-07-03**: the first **real** social layer — real **likes**, **follows**
(with real follower/following counts), **Comments V1** in a slide-up sheet, **Notifications V1**
(real inbox + nav unread badge), owner **"Today" activity**, and owner **Views/Likes/Comments/
Followers** analytics — so a creator opens the app and immediately knows someone interacted. Local
social store that emits notifications; guests gated in place with a sign-in sheet; Supabase schema
authored for the cutover. No algorithms/villages/marketplace/DMs/AI. See
[m18-social-foundation.md](m18-social-foundation.md) + ADR-038. This builds on **M17.1 discovery
polish & identity shipped 2026-07-03** (composed thumbnails, immersive feed, owner-vs-visitor view,
naming, same-tab publish, app-screen layouts). See [m17.1-discovery-polish.md](m17.1-discovery-polish.md)
+ ADR-037.

Earlier, **M17.1 discovery polish & identity shipped 2026-07-03** on `m12-nest-platform` (preview only;
**not merged to `main`, not deployed to production**): **composed Nest thumbnails** (`NestPreview` —
real furniture) everywhere, an immersive Home feed with a creator row + engagement bar, the
mandatory **owner-vs-visitor view** on `/nest/[slug]`, **Nest naming** at publish + **same-tab**
open, the Create tab **active state**, profile **Followers/Following/Nests** placeholders, and
**app-screen layouts**. Deterministic placeholder engagement, UI-only (no social backend). See
[m17.1-discovery-polish.md](m17.1-discovery-polish.md) + ADR-037. This polishes **M17 discovery feed
shipped 2026-07-03**: a shared discovery model over published + curated Nests, an immersive **Home
swipe feed**, an upgraded **Explore**, and a richer **visitor page**. See
[m17-discovery-feed.md](m17-discovery-feed.md) + ADR-036. This builds on **M16 real identity &
authentication shipped 2026-07-03**: a **real Nest account system** (email sign-up/sign-in/sign-out
+ session restore), **unique/immutable usernames**, profile completion, **ownership enforcement**,
**local-work migration** on sign-in (no Nest loss), and public `/@username` profiles — a backend
facade with real **Supabase Auth** + RLS ownership behind the documented cutover. See
[m16-identity-auth.md](m16-identity-auth.md) + ADR-035. **Next (cutover):** apply the `nest_*`
migrations, enable Supabase email auth, set `NEXT_PUBLIC_NEST_BACKEND=supabase`; add server-side
social columns + `/@handle` resolution + a real `nest_tags` column. Earlier, **M15 / M15.1** built the app shell + corrected
its IA (5 icon-only tabs; Home = discovery, Profile = dashboard); see
[m15-app-shell.md](m15-app-shell.md) + ADR-033/ADR-034. Earlier still, **M13 mobile
stabilisation shipped 2026-07-02** (single editor reunited with the Golden Nest assets); see
[m13-mobile-stabilisation.md](m13-mobile-stabilisation.md) and
[m12-preview-mobile-test-checklist.md](m12-preview-mobile-test-checklist.md). Earlier still,
**Analytics + Discovery V1 shipped 2026-06-25** —
durable mode-aware analytics, anonymous visitor sessions, a creator insights
dashboard, per-object + funnel analytics, and Featured Nests discovery; demo
unchanged, 236 tests. The app remains **safe for a friends & family pilot** (not
public launch); see [pilot-readiness.md](pilot-readiness.md). **Next (post-pilot):**
apply the schema to live Supabase to verify durable analytics end-to-end; a public
per-shop aggregate view so production discovery trending is global (not seed/local);
production-grade email (custom SMTP); the `reports` Supabase repo; `/u/[handle]`
production aggregate; richer mobile pass.

---

## Next Sprint

### V2 Nest architecture (ADR-027 + ADR-028) — documentation-first, building toward the Nest Composer

**Direction (current).** `Village → House → Nest → Objects → Content`. A **Nest** is a
**front-facing cinematic scene** (ADR-028 camera lock) **composed** from a curated **Nest
Template** + **Scene Slots** + **Asset Library** assets + avatar + a few personal belongings —
**composition over generation.** Masters:
[nestudio-production-pipeline.md](nestudio-production-pipeline.md),
[golden-nest-production-bible.md](golden-nest-production-bible.md),
[nestudio-cto-handoff.md](nestudio-cto-handoff.md).

**M0 (this sprint, done): camera decision + source-of-truth cleanup** — front-facing camera
locked (ADR-028); the 30° iso Perspective Contract superseded; the wall-first/Room→Wall docs
demoted to history. **No code.**

**Next milestones (toward a production-ready Nest Composer; documentation/spec before build):**
1. **Lock the constants** — the single front-facing camera spec + Nest scene-box geometry + slot
   taxonomy (Media/Desk/Shelf/Books/Plant/Window/Avatar/Frame/Lamp/Product).
2. **Define the V2 data model** (spec, then types; SQL parity later): `Asset`, `NestTemplate`,
   `SceneSlot`, `Interaction`, `ComposedNest`.
3. **One Nest Template + Scene Slots** (static registry, reusing the `lib/templates/` pattern).
4. **Minimal Nest Composer** — re-point the deterministic `lib/ai-room-designer.ts` from
   zone-placement to slot-snapping; emit a `ComposedNest` manifest.
5. **Mobile front-facing renderer + 3–5 Object→Animation→Content interactions** → one **Golden
   Nest** end-to-end (the bible's Definition of Done for sprint 1).

**Asset Library V2 (ADR-028 consequence):** the 28 approved ~30° iso assets are **V1 reference
only**; V2 assets must be authored/re-authored to the front-facing camera (a later sprint).

> **Superseded (do not reopen):** wall-first creator homes (ADR-023/024), Room → Wall → Object
> (ADR-025), and the Scene-Pack/room-shell/wall-pack path (ADR-021/022/026) — all superseded by
> ADR-027; their docs are reference history.

### Production backend cutover (still owed; sequence alongside/after)

The seams exist (repository layer + runtime mode + runbook). This sprint does the
real wiring. Explicitly **not** AI, marketplace, payments, or chat.

**Goals**
- Implement the Supabase repositories in `lib/repos/supabase.ts` (houses, rooms, room objects, profiles, events, reports), replacing the `NotImplementedError` stubs.
- Adopt `getRepositories()` in the components/libs that currently call the demo libs directly, keeping the local impls as the demo fallback.
- Stand up local + staging Supabase per `docs/supabase-cutover.md`; run all RLS smoke tests; dry-run migrations.
- (If a from-zero migration build is required) author a `20260610_00_baseline.sql` for the base types/tables so migrations run on an empty DB.

**Success criteria**
- With Supabase env set, core surfaces read/write the live DB; with it unset, the app is byte-for-byte the demo. RLS smoke tests pass. All gates green; no visual regression.

---

## Future (prioritized backlog)

**P1**
- ~~**AI Room Designer (mock)**~~ — ✅ shipped 2026-06-20 (AI Room Designer V1).
- **Asset ecosystem expansion** — more room-ready assets, per-village themed sets, real placeholder art, asset detail surfaced in the editor. (Directly lifts the designer's ceiling — its room richness is bounded by catalog breadth.)

**P2**
- **AI Room Editor (mock)** — natural-language commands mapped to deterministic asset/zone operations ("add a plant on the shelf"). Builds on the V1 designer's intent/keyword + placement machinery (spec §12).
- **Multi-room houses** — `rooms` already supports it; add room switching + the studio "Add room" flow (currently a placeholder).
- **Room theming** — wall/floor/lighting variants driven by `Room.theme`/`background`.

**P3**
- **Richer discovery** — explore-by-room-type, "rooms like this", featured villages.
- **Production backend cutover** — wire Supabase reads/writes behind the demo libs; verify RLS live.
- **Lightweight component/E2E tests** for core room flows.

---

## Explicitly Not Planned

- **AI that generates visuals/images.** AI only *selects* from the asset library.
- **Infinite scrolling feeds.** Discovery is spatial and curated.
- **Traditional profile-first layouts.** The room is the surface; profile data is secondary (drawers/panels).
- **Payments, marketplace, ads.** No monetization surfaces.
- **Real-time chat / direct messaging.** Asynchronous social only (guestbooks, activity).
- **Native mobile app.** Mobile-first web only.
- **Real auth/AI provider integration** in demo mode (kept mockable behind interfaces).

---

## Product Principles

1. **The room is always the primary surface.** Everything else is navigation or secondary chrome.
2. **No infinite feed.** Discovery means exploring spaces.
3. **No traditional profile-first layout.** Owner info lives in drawers/panels around the room.
4. **AI selects assets, never generates visuals.** *(Amended M31: still true for room/scene composition, but **superseded for the personal-belonging path** — runtime AI now generates one personal object at a time, human-approved. See the Current Status block above.)*
5. **The asset library is the source of truth** for anything placeable.
6. **Mobile-first and immersive.** The room should feel entered, not browsed.
7. **Two layers, always in sync.** Every feature ships a demo (localStorage) layer and matching Supabase schema parity.
8. **Flag-gated and reversible.** New surfaces sit behind `ENABLE_*` flags with safe fallbacks.
9. **Don't redesign the village/street/house art** without an explicit visual sprint.
