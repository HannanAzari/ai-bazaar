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
- **Shipped:** village map → street → house kit; **Room Engine V1** (full-screen public room + studio editor), **V2 — Creator Studio** (free drag/resize, layers, duplicate, delete-confirm, multi-select, Edit/Preview, undo/redo, autosave, six templates), **V3 — Real Interactive Objects** (real gallery/video/link/product/booking/contact/profile panels, `profile` type, tooltips, visitor analytics, owner insights, inspector editors, working presets), **V4 — Multi-Room Houses** (`HouseRooms` + entry room, `door`/`stairs` + `room_link` navigation, public breadcrumb/back, studio room manager + room presets, whole-house undo, nav analytics, legacy migrate-on-read), and **V5 — Richer Visuals + Rotation** (per-category object sprites, engraved nameplates, rotation editor, five room background variants, improved empty state); creator profiles, notifications, guestbooks, collections, activity feed, tags, discovery, analytics, reporting/moderation, asset catalog.
- **Gates (all green):** `npm run typecheck && npm run lint && npm run test && npm run build` (67 tests, ~81 pages).

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
- `lib/types.ts` — `HouseRooms` (V4: `{ shopAddress, entryRoomId, rooms[] }`), `Room` (incl. optional `width`/`height`, `description`), `RoomZoneDef`, `RoomObject`, `RoomZoneType` (9), `RoomActionType` (11, incl. `profile`, `room_link`), `RoomKind` (+ V4 types), `AssetCategory` (+ `door`/`stairs`), rich `RoomActionData` (+ `targetRoomId`). *Note: distinct from the legacy `RoomZone` string-union used by `Decoration`.*
- `lib/room-schema.ts` — `ZONE_TEMPLATE`, `createRoom` (+ `nextRoomId`), `deriveDefaultRoom`, `validatePlacement`, and pure layout helpers (`addObjectFromAsset`, `moveObject`, `moveObjectTo`, `resizeObject`, `objectCenter`, `duplicateObject`, `deleteObject`, `bringToFront`/`sendToBack`, `bringForward`/`sendBackward`).
- `lib/house.ts` — pure `HouseRooms` ops: `deriveDefaultHouse`, `addRoom`, `renameRoom`, `updateRoomMeta`, `setEntryRoom`, `deleteRoom`/`canDeleteRoom`, `withRoom`, `isValidRoomLink`, `roomLinkTargets`, `normalizeHouse`/`houseFromRoom`.
- `lib/room-actions.ts` — pure action-data helpers (`galleryImages`, `productCard`, `contactMethods`, `faviconUrl`, `hostname`, `hasActionData`). `lib/embeds.ts` — `videoEmbed` (YouTube/Vimeo). `lib/room-insights.ts` — owner `getRoomInsights`. `lib/room-visuals.ts` — `objectVisual(assetId, category)` (per-category sprite kind) + `ROOM_BACKGROUNDS`/`roomBackground`/`defaultBackgroundForType` (background variants).
- `lib/room-templates.ts` — six object templates (`ROOM_TEMPLATES`, `applyTemplate`) + V4 room presets (`ROOM_PRESETS`, `buildPresetRoom`). `lib/room-history.ts` — pure undo/redo `History<T>`.
- `lib/room.ts` — house store: `getHouse`/`getStoredHouse`/`saveHouse`/`resetHouse` (key `ai-bazaar-rooms`, legacy single-room migrate-on-read) + back-compat `getRoom`/`saveRoom`/`resetRoom` (entry room).
- `components/room/room-experience.tsx` — full-screen public surface; renders the current room of a multi-room house, breadcrumb + back, `room_link` navigation, per-type `*_opened` + `room_entered`/`room_link_clicked` analytics.
- `components/room/room-editor.tsx` — **Creator Studio** editor: room manager (create/rename/retype/set-entry/delete + presets + switch), templates, palette, drag/resize canvas, inspector with per-action `ActionDataEditor`, Edit/Preview, whole-house undo/redo, autosave, save/reset house, delete-confirm, owner insights.
- `components/room/object-action-modal.tsx` — **real V3 interactive panels** (gallery lightbox, video embed, link, product, booking, contact, profile). `action-data-editor.tsx` — inspector field editor.
- `components/room/{room-canvas,room-object}.tsx` — rendering pieces; `room-canvas` owns editor pointer interaction (drag/resize/marquee) and threads `ownerName` for tooltips.
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

- Room object actions are **real** (V3); their panels load **third-party embeds/images** (YouTube, Vimeo, Calendly, favicons, sample preset images) — external requests that won't render offline.
- Placement is **free drag + resize + rotate** (V2/V5). Objects render as **CSS sprites around an icon** (V5) — richer than a tile but not per-asset illustration; resize-handle math is axis-aligned, so resizing a heavily rotated object is approximate. Objects can crowd on tiny viewports.
- **Multi-room ships in V4**, but navigation is **client-only**: a visitor always lands in the entry room and a URL can't deep-link to a specific inner room yet.
- **AI and image storage are mocked** (`/api/generations`, placeholder asset URLs).
- **SQL never executed against live Postgres here** — dry-run migrations + RLS on staging before production.
- Tests cover **libs, not UI** (no component/E2E).
- Demo is **single-user**: notifications/activity are seeded + self-generated; "following" counts are demo-derived.

---

## Recommended Next Sprint

The room engine is feature-complete for the demo (V1–V5). Highest-value next step
is the **production backend cutover** — wire the Supabase `rooms`/`room_objects`
shapes behind the existing demo libs and verify RLS live, keeping localStorage as a
fallback. Smaller alternatives: **deep-linkable rooms** (encode the current room in
the URL; today navigation is client-only and always starts at the entry room), or
**per-asset illustration** if an asset-art pipeline appears. Explicitly **not**
AI/marketplace/payments/chat.

---

## Do Not Accidentally Change

- **Room object schema** (`RoomObject`/`Room` in `lib/types.ts` + `room_objects` columns) — public rooms and saved layouts depend on the exact shape; migrate, don't mutate. `width`/`height` are **optional** (V2); `RoomActionData` fields are **all optional** (V3) and stored in the `action_data` jsonb — grow it additively, keep fields optional so old saved rooms stay valid.
- **`RoomActionType` is a closed enum** — adding a type (like V3's `profile`) means a TS change, a `room_action_type` enum-value migration, a panel in `object-action-modal.tsx`, and a spec/ADR update.
- **`HouseRooms` shape + entry invariant** (V4) — a house has ≥1 room and exactly one `entryRoomId` that references a real room; `lib/room.ts` migrates a legacy single-`Room` save on read. Don't change the `ai-bazaar-rooms` key or break migrate-on-read, or pre-V4 layouts vanish. Door/stairs targets (`actionData.targetRoomId`) must be validated against existing rooms.
- **Migration ordering / enum split** — new enum *values* must commit (in `_01_extend_enums`) before use (`_02_*`); never reorder or rename existing migration files.
- **localStorage keys** (`ai-bazaar-*`, e.g. `ai-bazaar-rooms`, `ai-bazaar-shop`) — renaming silently wipes demo state.
- **Public room route behavior** — `/shop/[address]` must keep the `RoomExperience` (flag on) / `LegacyHouseView` (off or hidden) switch; the hidden-by-moderator "resting" path must stay.
- **The legacy `RoomZone` string-union** — used by `Decoration`; not the room-engine `RoomZoneType`. Keep them separate.
- **The seed-deterministic house kit** (`components/scene/house/spec.ts`) — variation must derive from stable seeds (SSR/hydration), never random.
- **`lib/data.ts` village/house seed** — addresses and counts are referenced across routes and `generateStaticParams`.
