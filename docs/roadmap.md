# AI Bazaar Roadmap

Single source of truth for product direction. Keep concise; update every sprint.
For technical detail see [architecture.md](../architecture.md); for testing see
[QA.md](QA.md).

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

All sprints ship green: `typecheck · lint · test · build`.

---

## In Progress

**M15 real app shell & Nest Home shipped 2026-07-02** on `m12-nest-platform` (preview only;
**not merged to `main`, not deployed to production**): a permanent mobile bottom nav, a real
Home, username ownership (`/@handle`), and the Create tab as the single creation entry — built
on the nest-auth identity, single editor + persistence preserved. Verified on an iPhone
viewport. See [m15-app-shell.md](m15-app-shell.md) + ADR-033. **Next:** back the identity +
`/@handle` with the Supabase backend (currently local-mode), unify the nest-auth and V1
AuthProvider sessions, and bring back Village as a real (5th) tab. Earlier, **M13 mobile
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
4. **AI selects assets, never generates visuals.**
5. **The asset library is the source of truth** for anything placeable.
6. **Mobile-first and immersive.** The room should feel entered, not browsed.
7. **Two layers, always in sync.** Every feature ships a demo (localStorage) layer and matching Supabase schema parity.
8. **Flag-gated and reversible.** New surfaces sit behind `ENABLE_*` flags with safe fallbacks.
9. **Don't redesign the village/street/house art** without an explicit visual sprint.
