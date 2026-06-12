# AI Bazaar — Handoff

Read this first. It gets a new session productive in ~5 minutes. Deeper detail:
[architecture.md](../architecture.md) · direction: [roadmap.md](roadmap.md) ·
history: [changelog.md](changelog.md) · testing: [QA.md](QA.md) ·
room contract: [room-engine-spec.md](room-engine-spec.md).

**Before closing any sprint, follow [sprint-checklist.md](sprint-checklist.md)
(definition of done): update all source-of-truth docs, then pass typecheck +
lint + test + build.**

---

## Current State

AI Bazaar is a **cozy creator village**: claim a house in one of 10 villages,
decorate a **room**, and visitors discover you by exploring spaces, not a feed.

- **Stack:** Next.js 15 (App Router), React 19, strict TypeScript, Tailwind 3, lucide. **Node 20 required** (machine default is v16): `export PATH="/Users/hannan/.nvm/versions/node/v20.20.2/bin:$PATH"`.
- **Runs as a client-side demo.** Blank Supabase env → `lib/supabase/*` returns `null`; state lives in `localStorage`, seed content in `lib/data.ts`. The SQL schema is a **production-parity mirror, not run at runtime here.** Every feature has two layers: a demo lib + matching SQL.
- **Shipped:** village map → street → house kit; **Room Engine V1** (full-screen public room + studio editor); creator profiles, notifications, guestbooks, collections, activity feed, tags, discovery, analytics, reporting/moderation, asset catalog.
- **Gates (all green):** `npm run typecheck && npm run lint && npm run test && npm run build` (25 tests, ~81 pages).

---

## Active Architecture Decisions (do not break)

1. **The room is the primary UX.** The public house page is a full-screen room; profile data is secondary (drawers/panels).
2. **The village is the navigation layer.** Hex map → village street → house. Don't turn navigation into a feed.
3. **The asset library is the source of truth** for anything placeable. Room objects reference catalog assets.
4. **AI never generates graphics.** AI may only *select/arrange* existing assets. (No real AI is wired yet — mock only.)
5. **Public rooms use the full-screen experience** (`RoomExperience`); the legacy room is only the `ENABLE_ROOM_ENGINE=off` fallback.
6. **Two layers, always in sync.** New feature = demo localStorage lib (SSR-guarded, try/catch, `*-changed` event) **and** schema.sql + a dated migration.
7. **No `Math.random`/`Date.now` in render** — hydration safety. Derive variation from stable seeds.
8. **Don't redesign village/street/house-exterior art** without an explicit visual sprint.

---

## Important Files

**Room engine (the core)**
- `lib/types.ts` — `Room`, `RoomZoneDef`, `RoomObject`, `RoomZoneType` (9), `RoomActionType` (9). *Note: distinct from the legacy `RoomZone` string-union used by `Decoration`.*
- `lib/room-schema.ts` — `ZONE_TEMPLATE`, `createRoom`, `deriveDefaultRoom`, `validatePlacement`, and pure layout helpers (`addObjectFromAsset`, `moveObject`, `duplicateObject`, `deleteObject`, `bringToFront`/`sendToBack`).
- `lib/room.ts` — layout store: `getRoom`/`saveRoom`/`resetRoom` (key `ai-bazaar-rooms`).
- `components/room/room-experience.tsx` — full-screen public room + drawers + action handling.
- `components/room/room-editor.tsx` — studio editor (palette, select, inspector, save/reset).
- `components/room/{room-canvas,room-object,object-action-modal}.tsx` — rendering pieces.
- `lib/assets.ts` — asset catalog; room-ready assets carry `compatibleZones`/`defaultScale`/`defaultActionType`; `roomReadyAssets()`, `getAsset()`.

**Wiring / surfaces**
- `components/shop-page-client.tsx` — switch: `RoomExperience` (flag on) vs `LegacyHouseView` (fallback / hidden state).
- `app/studio/page.tsx` — owner editor; modes `room` (default) / `exterior` / `interior`.
- `components/providers/demo-provider.tsx` — `useDemo()`/`useAllShops()`; user, claimed shop, likes, follows.
- `lib/data.ts` — 10 villages + 10 sample houses (`HOUSES_PER_VILLAGE = 24`).
- `lib/flags.ts` — feature flags. `app/globals.css` — shared room shell CSS.

**Village (don't redesign visuals)**
- `components/village-world.tsx` (hex map), `components/street-walk.tsx` (street), `components/scene/house/` (seed-deterministic SVG house kit).

**Demo libs (same pattern each):** `lib/{events,reports,notifications,guestbook,collections,activity}.ts`, plus `lib/{tags,creators,use-hidden}.ts`.

**Database:** `supabase/schema.sql` (fresh-install superset), `supabase/migrations/*` (ordered), `supabase/seed.sql`.

---

## Current Feature Flags

`NEXT_PUBLIC_ENABLE_*` (build-time inlined). Access via `flags` in `lib/flags.ts`.

| Flag | Default | Controls | Off |
|---|---|---|---|
| `ENABLE_CREATOR_PROFILES` | on | `/u/[handle]`, owner links | route 404, links plain text |
| `ENABLE_NOTIFICATIONS` | on | bell, `/notifications` | route 404, bell hidden |
| `ENABLE_GUESTBOOKS` | on | guestbook panel/drawer | hidden |
| `ENABLE_COLLECTIONS` | on | save buttons, `/collections` | route 404, buttons hidden |
| `ENABLE_ACTIVITY_FEED` | on | `/activity`, profile feed, recording | route 404, recording skipped |
| `ENABLE_ASSET_CATALOG` | on | `/assets` (internal) | route 404 |
| `ENABLE_ROOM_ENGINE` | on | full-screen room + room editor | **legacy room (no 404)** |

---

## Open Problems (known limitations)

- Room object actions `video/product/booking/contact/gallery` are **placeholder panels**, not real experiences.
- Placement is **zone + anchor-point selection, not free drag**; objects can crowd on tiny viewports.
- One room per house (multi-room/stairs are placeholders).
- **AI and image storage are mocked** (`/api/generations`, placeholder asset URLs).
- **SQL never executed against live Postgres here** — dry-run migrations + RLS on staging before production.
- Tests cover **libs, not UI** (no component/E2E).
- Demo is **single-user**: notifications/activity are seeded + self-generated; "following" counts are demo-derived.

---

## Recommended Next Sprint

**Room Engine V2 — interactions & placement polish.** Replace placeholder object
actions with real panels (gallery image grid, video player, product card); add
nudge-X/Y and rotation in the editor; richer per-asset object visuals (reusing the
room shell). Likely files: `components/room/*`, `lib/room-schema.ts`, `lib/types.ts`
(`RoomActionData`), `app/studio/page.tsx`, `test/room.test.ts`. Success: a visitor
opens a non-placeholder gallery/video/product panel; an owner can nudge + rotate
objects; all gates green; no village/street/exterior regressions.

---

## Do Not Accidentally Change

- **Room object schema** (`RoomObject`/`Room` in `lib/types.ts` + `room_objects` columns) — public rooms and saved layouts depend on the exact shape; migrate, don't mutate.
- **Migration ordering / enum split** — new enum *values* must commit (in `_01_extend_enums`) before use (`_02_*`); never reorder or rename existing migration files.
- **localStorage keys** (`ai-bazaar-*`, e.g. `ai-bazaar-rooms`, `ai-bazaar-shop`) — renaming silently wipes demo state.
- **Public room route behavior** — `/shop/[address]` must keep the `RoomExperience` (flag on) / `LegacyHouseView` (off or hidden) switch; the hidden-by-moderator "resting" path must stay.
- **The legacy `RoomZone` string-union** — used by `Decoration`; not the room-engine `RoomZoneType`. Keep them separate.
- **The seed-deterministic house kit** (`components/scene/house/spec.ts`) — variation must derive from stable seeds (SSR/hydration), never random.
- **`lib/data.ts` village/house seed** — addresses and counts are referenced across routes and `generateStaticParams`.
