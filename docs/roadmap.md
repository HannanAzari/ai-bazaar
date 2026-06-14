# AI Bazaar Roadmap

Single source of truth for product direction. Keep concise; update every sprint.
For technical detail see [architecture.md](../architecture.md); for testing see
[QA.md](QA.md).

---

## Vision

A **creator-owned virtual village**. Every creator owns one customizable **room**,
and visitors discover creators by **exploring spaces** — wandering a village,
stepping through doors, entering rooms — instead of scrolling a feed. The room is
the product; the village is the navigation; AI helps creators arrange their space
by **selecting from a curated asset library**, never by generating visuals.

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

All sprints ship green: `typecheck · lint · test · build`.

---

## In Progress

No feature sprint active. AI Room Designer V3 shipped 2026-06-22 (Creator Auto
Build from social profiles). Backend Cutover Prep shipped 2026-06-19 (seams +
runbook; Supabase repos are stubs).

---

## Next Sprint

### Production backend cutover (execute)

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
