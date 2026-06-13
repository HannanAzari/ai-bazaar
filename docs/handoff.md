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
- **Shipped:** village map → street → house kit; **Room Engine V1** (full-screen public room + studio editor), **V2 — Creator Studio** (free drag/resize, layers, duplicate, delete-confirm, multi-select, Edit/Preview, undo/redo, autosave, six templates), and **V3 — Real Interactive Objects** (real gallery/video/link/product/booking/contact/profile panels, `profile` type, tooltips, visitor analytics, owner insights, inspector editors, working presets); creator profiles, notifications, guestbooks, collections, activity feed, tags, discovery, analytics, reporting/moderation, asset catalog.
- **Gates (all green):** `npm run typecheck && npm run lint && npm run test && npm run build` (46 tests, ~81 pages).

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
- `lib/types.ts` — `Room`, `RoomZoneDef`, `RoomObject` (incl. optional `width`/`height`), `RoomZoneType` (9), `RoomActionType` (10, incl. `profile`), rich `RoomActionData`. *Note: distinct from the legacy `RoomZone` string-union used by `Decoration`.*
- `lib/room-schema.ts` — `ZONE_TEMPLATE`, `createRoom`, `deriveDefaultRoom`, `validatePlacement`, and pure layout helpers (`addObjectFromAsset`, `moveObject`, `moveObjectTo`, `resizeObject`, `objectCenter`, `duplicateObject`, `deleteObject`, `bringToFront`/`sendToBack`, `bringForward`/`sendBackward`).
- `lib/room-actions.ts` — pure action-data helpers (`galleryImages`, `productCard`, `contactMethods`, `faviconUrl`, `hostname`, `hasActionData`). `lib/embeds.ts` — `videoEmbed` (YouTube/Vimeo). `lib/room-insights.ts` — owner `getRoomInsights`.
- `lib/room-templates.ts` — six starter templates with working sample data: `ROOM_TEMPLATES`, `applyTemplate`. `lib/room-history.ts` — pure undo/redo `History<T>`.
- `lib/room.ts` — layout store: `getRoom`/`saveRoom`/`resetRoom` (key `ai-bazaar-rooms`).
- `components/room/room-experience.tsx` — full-screen public room + drawers + action handling (per-type `*_opened` analytics).
- `components/room/room-editor.tsx` — **Creator Studio** editor (templates, palette, drag/resize canvas, single + multi-select inspector with per-action `ActionDataEditor`, Edit/Preview, undo/redo, autosave, save/reset, delete-confirm, owner insights panel).
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
- Placement is **free drag + resize** (V2); rotation is in the model but has no editor UI yet. Objects can crowd on tiny viewports.
- One room per house (multi-room/stairs are placeholders); objects still render as a single icon tile.
- One room per house (multi-room/stairs are placeholders).
- **AI and image storage are mocked** (`/api/generations`, placeholder asset URLs).
- **SQL never executed against live Postgres here** — dry-run migrations + RLS on staging before production.
- Tests cover **libs, not UI** (no component/E2E).
- Demo is **single-user**: notifications/activity are seeded + self-generated; "following" counts are demo-derived.

---

## Recommended Next Sprint

**Room Engine V4 — richer object visuals & multi-room.** Objects are interactive
(V3) but still read as a single icon tile and a house has one room. Add richer
per-asset object visuals + a rotation control (model already stores `rotation`),
and multi-room houses (room switching + studio "Add room"; the `rooms` model
permits it). Explicitly **not** AI/marketplace/payments/chat. Likely files:
`components/room/*`, `lib/room-schema.ts`/`lib/room.ts`, `app/studio/page.tsx`,
`test/room.test.ts`. Success: objects read richer than an icon; a house can hold
multiple rooms a visitor moves between; all gates green; no village/street/exterior
regressions.

---

## Do Not Accidentally Change

- **Room object schema** (`RoomObject`/`Room` in `lib/types.ts` + `room_objects` columns) — public rooms and saved layouts depend on the exact shape; migrate, don't mutate. `width`/`height` are **optional** (V2); `RoomActionData` fields are **all optional** (V3) and stored in the `action_data` jsonb — grow it additively, keep fields optional so old saved rooms stay valid.
- **`RoomActionType` is a closed enum** — adding a type (like V3's `profile`) means a TS change, a `room_action_type` enum-value migration, a panel in `object-action-modal.tsx`, and a spec/ADR update.
- **Migration ordering / enum split** — new enum *values* must commit (in `_01_extend_enums`) before use (`_02_*`); never reorder or rename existing migration files.
- **localStorage keys** (`ai-bazaar-*`, e.g. `ai-bazaar-rooms`, `ai-bazaar-shop`) — renaming silently wipes demo state.
- **Public room route behavior** — `/shop/[address]` must keep the `RoomExperience` (flag on) / `LegacyHouseView` (off or hidden) switch; the hidden-by-moderator "resting" path must stay.
- **The legacy `RoomZone` string-union** — used by `Decoration`; not the room-engine `RoomZoneType`. Keep them separate.
- **The seed-deterministic house kit** (`components/scene/house/spec.ts`) — variation must derive from stable seeds (SSR/hydration), never random.
- **`lib/data.ts` village/house seed** — addresses and counts are referenced across routes and `generateStaticParams`.
