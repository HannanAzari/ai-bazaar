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

All sprints ship green: `typecheck · lint · test · build`.

---

## In Progress

No feature sprint active. Room Engine V5 (Richer Visuals + Rotation) shipped 2026-06-18.

---

## Next Sprint

### Production backend cutover (P3) — or deep-linkable rooms

The room engine is feature-complete for the demo (V1–V5). The highest-value next
step is wiring the Supabase layer behind the demo libs, or a small spatial polish.
Explicitly **not** AI, marketplace, payments, or chat.

**Candidate goals (pick one)**
- **Backend cutover:** read/write the `rooms` / `room_objects` / `houses` shapes through Supabase behind the existing libs; verify RLS live; keep the localStorage demo as a fallback.
- **Deep-linkable rooms:** encode the current room in the URL so an inner room is shareable (today navigation is client-only and always starts at the entry room).
- **Per-asset illustration:** replace CSS-around-an-icon sprites with richer art if/when an asset-art pipeline exists.

**Success criteria**
- All gates green; new helpers covered by tests; no visual regression to village/street/exteriors.

---

## Future (prioritized backlog)

**P1**
- **AI Room Designer (mock)** — heuristic "auto-arrange" / "suggest assets" that selects from the catalog by house tags/theme. No visual generation; mirrors the existing mock-generation pattern; clearly labelled until a provider is wired.
- **Asset ecosystem expansion** — more room-ready assets, per-village themed sets, real placeholder art, asset detail surfaced in the editor.

**P2**
- **AI Room Editor (mock)** — natural-language commands mapped to deterministic asset/zone operations ("add a plant on the shelf").
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
