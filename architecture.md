# AI Bazaar — Architecture

This document is the single source of truth for continuing development. It is
written so a fresh session can be productive without reading prior conversations.
Pair it with [README.md](README.md) (run/setup) and [docs/QA.md](docs/QA.md)
(manual test checklist).

---

## 1. Project vision

AI Bazaar is a **cozy creative village**. Each member claims one little house in
one of ten villages, decorates a personal **room**, attaches links/actions, and
welcomes visitors through a memorable three-word address (e.g. `moon.blue.hour`).

The product is mobile-first and storybook-flavoured (hand-drawn SVG houses, warm
parchment palette). The **room is the main surface** — a visitor should feel "I
entered this person's room," not "I'm reading their profile." Engagement
foundations (profiles, notifications, guestbooks, collections, activity, an asset
catalog) wrap around that core.

**Explicit non-goals (do not add without being asked):** real AI/LLM calls,
payments, a marketplace, ads, chatbots, direct messaging, a native mobile app.
Mock/placeholder flows stand in for AI generation and asset images.

### Tech stack
- **Next.js 15** (App Router) · **React 19** · **TypeScript** (strict, `target: es5`)
- **Tailwind CSS 3** · **lucide-react** icons · fonts via `next/font` (Fraunces + Nunito Sans)
- **Supabase** (`@supabase/ssr`) for production; **Vitest** for unit tests
- **Node 20+ required** for tooling. The machine's default `node` is v16 — always
  prefix commands with `export PATH="/Users/hannan/.nvm/versions/node/v20.20.2/bin:$PATH"`.
- Scripts: `npm run dev | build | start | lint | typecheck | test`

### The most important architectural fact

**The running app is a client-side demo.** With blank Supabase env vars,
`lib/supabase/*` returns `null` and nothing queries a backend. Instead:
- Static seed content lives in `lib/data.ts` (10 villages, 10 sample houses).
- Mutable state lives in **`localStorage`** via small demo libs + a React context.
- The **SQL schema is a production-parity mirror** kept in sync but **not exercised
  at runtime** here. Every feature therefore has **two layers**: the demo lib
  (what renders/what you can verify) and the SQL (what production would use).

When adding a feature, build **both layers** and keep their shapes aligned.

---

## 2. Room Engine architecture (the core surface)

Flag: `ENABLE_ROOM_ENGINE` (default **on**). Off → falls back to the legacy
profile-style room (`components/shop-room.tsx`), it does **not** 404.

### Data model (`lib/types.ts`)
- **`HouseRooms`** (V4): `{ shopAddress, entryRoomId, rooms: Room[] }` — a house is a set of connected rooms; one is the entry room.
- **`Room`**: `{ id, shopAddress, name, type (RoomKind), description?, theme, background, zones[], objects[] }`
- **`RoomZoneDef`**: `{ id, type (RoomZoneType), allowedCategories[], anchors[], maxObjects? }`
- **`RoomObject`**: `{ id, assetId, zoneId, anchorId, x, y, scale, width?, height?, rotation, zIndex, label, actionType, actionData?, tags[], hidden }` — `width`/`height` (px box; `scale` multiplies) are V2 additions, optional for back-compat (pre-V2 rooms render at a base size).
- **`RoomZoneType`** (9): `back_wall, left_wall, right_wall, floor_left, floor_center, floor_right, shelf, window, door`
- **`RoomActionType`** (11): `link, video, product, booking, contact, gallery, profile, room_link, guestbook, collection, none`
- **`RoomKind`**: `studio, shop, gallery, lounge, standard` + V4 `living_room, office, bedroom, garden, custom`
- **`AssetCategory`**: `furniture, wall, floor, plant, lighting, decor, structure` + V4 `door, stairs`
- **`RoomActionData`** — optional jsonb-backed bag carrying each action's content: `url, text, title, description, images[], price, image, email, website, phone, socials[], targetRoomId` (`room_link`)
- **`AnchorPoint`**: `{ id, x, y }` — normalised **0..1 across the whole canvas**
  (not per-zone), so a stored object renders without per-zone geometry.

> Naming caution: there is a legacy `RoomZone` string-union (`"left-wall" | "back-wall" | "floor" | "right-wall"`) used by the old `Decoration` model. The room engine uses the distinct names above. Do not conflate them.

### Schema & helpers (`lib/room-schema.ts`)
- `ZONE_TEMPLATE` — the canonical nine zones (allowed categories, anchors, max counts). Every room clones this; zones are **app-defined**, not stored per-room.
- `createRoom(address)` · `deriveDefaultRoom(shop)` — builds a furnished room from a house's decorations + links so **every house shows a populated room** before its owner edits one.
- Validation: `validatePlacement(room, category, zoneId)`, `firstCompatibleSlot`, `isRoomActionType`.
- **Pure layout helpers** (return a new `Room`, easy to test): `addObjectFromAsset`, `updateObject`, `moveObject`, `moveObjectTo` (free drag, bounds-clamped), `resizeObject` (rejects zero/negative), `objectCenter`, `duplicateObject`, `deleteObject`, `bringToFront`/`sendToBack` and `bringForward`/`sendBackward`.
- Labels: `zoneLabels`, `actionLabels`, `ROOM_ACTION_TYPES`. Constants: `ROOM_BOUND_MARGIN`, `MIN_OBJECT_SIZE`.
- **Templates** (`lib/room-templates.ts`): `ROOM_TEMPLATES` + `applyTemplate(id, address)` — six object layouts built from existing assets; plus V4 `ROOM_PRESETS` + `buildPresetRoom(presetId, address)` that build a furnished **new room** (Gallery, Studio, Podcast Room, Shop, Office).
- **Undo/redo** (`lib/room-history.ts`): a pure generic `History<T>` stack (`createHistory`, `pushHistory`, `undo`, `redo`, `canUndo`, `canRedo`). The editor uses `History<HouseRooms>` (whole-house undo).
- **House helpers** (`lib/house.ts`): pure `HouseRooms` ops — `deriveDefaultHouse`, `addRoom`, `renameRoom`, `updateRoomMeta`, `setEntryRoom`, `deleteRoom`/`canDeleteRoom`, `withRoom`, `isValidRoomLink`, `roomLinkTargets`, `normalizeHouse`/`houseFromRoom`.

### Store (`lib/room.ts`)
- **House-level (V4):** `getHouse(shop)` → saved `HouseRooms` for `shop.address`, else `deriveDefaultHouse(shop)`; `getStoredHouse`, `saveHouse`, `resetHouse`. Persists per address on `ai-bazaar-rooms`; a pre-V4 single-`Room` save is **migrated on read** into a one-room house (entry room).
- **Back-compat single-room:** `getRoom(shop)`/`getStoredRoom(address)` return the entry room; `saveRoom(room)` upserts it into its house; `resetRoom(address)`.
- localStorage key `ai-bazaar-rooms` (`Record<address, Room>`); dispatches `ai-bazaar-rooms-changed`.

### Components (`components/room/`)
- `room-canvas.tsx` — renders the shared room shell (reuses the wallpaper/floor/window/lamp CSS from `globals.css`), applies the room's **background variant** (V5, via `roomBackground(room.background)` → `--room-wall` + a mood tint), and positions objects by anchor + offset, at `width × height × scale`. Modes: `"public"` (clickable, hides hidden objects) and `"editor"`. In editor mode the canvas owns all pointer interaction — **free drag (mouse + touch), corner resize, and a selection marquee** — driven through an `editor` callback bundle. Improved empty-room state.
- `room-object.tsx` — one object rendered as a **per-category CSS sprite** (V5: framed artwork, screen, shelf, desk, card, portrait/certificate/board, door, stairs, plant, rug, seat, generic tile) around the asset's lucide glyph, with an **engraved nameplate** label, interactive cue, hover/focus **tooltip**, selection ring, resize handles, and the `rotation` transform. Exports `objectIcon`; visual kind from `lib/room-visuals.ts`.
- `lib/room-visuals.ts` — pure `objectVisual(assetId, category)` (→ visual kind) and `ROOM_BACKGROUNDS`/`roomBackground`/`defaultBackgroundForType` (five background variants as shell palettes).
- `object-action-modal.tsx` — **real V3 interactive panels** by action type: gallery lightbox, embedded video (YouTube/Vimeo via `lib/embeds.ts`), link card (favicon), product card (redirect), booking (Calendly embed/external), unified contact modal, and a creator profile panel. Uses pure helpers in `lib/room-actions.ts`.
- `action-data-editor.tsx` — the studio inspector's per-action field editor (gallery image rows, video URL, link, product, booking, contact + socials rows).
- `room-experience.tsx` — **the full-screen public surface**. Loads `getHouse`, renders the **current room** of a multi-room house; top-left "where am I" chip + a subtle **breadcrumb** (`House › Room › Room`) with crumb jumps and a back button; top-right action cluster; bottom-left owner chip + guestbook; slide-over **drawers**; the action modal. Object activation: `room_link`→navigate to the target room (client-side, no reload), `guestbook`→drawer, `none`→noop, else → in-room panel. Tracks `object_click` + `decoration_click` + per-type `*_opened` + `room_entered`/`room_link_clicked`.
- `room-editor.tsx` — **the studio editor (Creator Studio, V2 + V4)**. A **room manager** (create blank/preset, rename, set type, set entry, delete with guards, switch active room), object templates (furnish the active room), asset palette, single-object inspector (label, action, zone, anchor, action-data editor, scale, layer, hide, duplicate, delete) and a multi-select batch panel. **Edit / Preview** toggle, whole-house **undo/redo** (`⌘Z`/`⌘⇧Z`), **autosave** (5s) plus **Save house** (`saveHouse`) / **Reset house** (`resetHouse`); deletes confirmed. Owner **room insights** panel. Tracks `room_object_*`, `room_template_applied`, `room_created`, `room_deleted`.

### Assets (`lib/assets.ts`)
Placeable assets come from the catalog. Room-ready assets carry optional
`compatibleZones`, `defaultScale`, `defaultActionType`. Helpers: `roomReadyAssets()`,
`getAsset(id)`. The 19 room-ready ids: `ast-bookshelf, ast-painting, ast-screen,
ast-desk, ast-sofa, ast-rug, ast-plant, ast-product-shelf, ast-guestbook-table,
ast-photo-wall` plus the V3 set `ast-avatar-portrait,
ast-certificate, ast-achievement-board` (action `profile`), `ast-projector` (video),
`ast-sign` (link), `ast-display-table` (product), `ast-business-card` (contact); and
the V4 connectors `ast-door` (category `door`) and `ast-stairs` (category `stairs`),
both action `room_link`.

### Wiring
- Public: `components/shop-page-client.tsx` is a thin switch — if `flags.roomEngine && !hidden` → `<RoomExperience>`, else `<LegacyHouseView>` (the old profile-style layout, which also handles the moderator "resting" state).
- Studio: `app/studio/page.tsx` has a `"room" | "exterior" | "interior"` mode; `"room"` (default when flag on) renders `<RoomEditor shop={ownedShop} />`.

---

## 3. Village architecture (map → street → house)

**Do not redesign the village map, street view, or house exteriors / visual art**
unless explicitly asked. These were built in earlier visual sprints.

- **World/district map** — `components/village-world.tsx` (rendered at `/` and `/bazaar`). A hex-grid honeycomb of **10 villages** with a frontier of empty plots. Each hex links to `/bazaar/[slug]`. Village data + axial `hex` coords in `lib/data.ts`.
- **Street view** — `components/street-walk.tsx` (at `/bazaar/[slug]`). Horizontal scroll of **24 detached houses** per village; open houses can be claimed (address picker → `/studio`).
- **House kit** — `components/scene/house/` (`house.tsx`, `spec.ts`, `index.ts`). One **seed-deterministic** SVG house used by the map, street, discover cards, and exterior preview. `deriveHouseSpec(seed)` derives roof/wall/door variation from a stable hash (SSR-safe — never `Math.random`).
- **House interior** — the Room Engine (section 2). The legacy interior `components/shop-room.tsx` renders the `Decoration[]` model and is the flag-off fallback.

Counts: `HOUSES_PER_VILLAGE = 24`, 10 villages → 240 houses. Address format
`village.word.word`; the village prefix is fixed, the resident picks two words
(`lib/addresses.ts`).

---

## 4. Database schema (production parity — `supabase/schema.sql`)

Postgres with Row-Level Security. Internal table names keep `shop*` for historical
reasons; the **product language is house/place/room**. `is_admin()` and
`owns_shop(shop_id)` are SECURITY DEFINER helpers used throughout RLS.

### Tables (25)
| Group | Tables |
|---|---|
| Identity | `profiles` |
| Village | `bazaars`, `shop_slots`, `shops`, `shop_rooms` (legacy), `shop_decorations`, `shop_links` |
| Social | `likes`, `follows`, `guestbook_entries`, `notifications` |
| Discovery | `tags`, `shop_tags`, `decoration_tags`, `link_tags` |
| Saving / feed | `collections`, `collection_items`, `activity_events` |
| Analytics | `events` (+ `record_event()` fn, `event_counts` view) |
| Moderation | `reports` |
| Generation | `generation_jobs` |
| Catalog | `assets` |
| **Room engine** | `rooms`, `room_objects`, `room_object_tags` |

### Enums (16)
`decoration_type, generation_status, report_target_type` (`shop|decoration|user|guestbook`),
`report_status` (`pending|reviewed|hidden|dismissed`), `event_type`, `notification_type`,
`room_zone_type`, `room_action_type`, `room_kind`, `saved_kind`, `activity_type`,
`asset_category`, `asset_placement`, `asset_rarity`, `asset_status`, `asset_owner_type`.

### Migration order (apply in filename order)
1. `20260610_village_model.sql`
2. `20260610_house_exteriors_and_room_zones.sql`
3. `20260611_01_extend_enums.sql` → `20260611_02_tags_events_reports.sql`
4. `20260612_01_extend_enums.sql` → `20260612_02_creator_engagement.sql`
5. `20260613_collections_activity_assets.sql`
6. `20260614_room_engine.sql`
7. `20260615_01_extend_enums.sql` → `20260615_02_room_studio.sql`
8. `20260616_extend_enums.sql` (`room_action_type` += `profile`; `event_type` += six `*_opened`)
9. `20260617_01_extend_enums.sql` (`asset_category` += `door`,`stairs`; `room_kind` += 5; `room_action_type` += `room_link`; `event_type` += four `room_*`) → `20260617_02_multi_room.sql` (`rooms.description`, `rooms.is_entry` + partial unique index)

`schema.sql` is the fresh-install superset. **Critical Postgres rule:** a new
enum **value** added to an existing enum must be committed before it is used, so
those changes are split into `_01_extend_enums` (add values) + `_02_*` (use them).
Brand-new `CREATE TYPE` enums can be created and used in the same migration.

> The SQL has never been run against a live Postgres in this environment — **dry-run new migrations on staging** before production.

> **Cutover audit (2026-06-19):** enum values fully reconcile (`schema.sql` is a
> correct superset; no value drift), but the migration chain is **not runnable from
> an empty DB** — the base enums and core tables exist only in `schema.sql`, and
> `20260610_village_model.sql` assumes them. **Fresh DB → apply `schema.sql`;**
> migrations are incremental patches for an already-baselined DB. Full audit +
> runbook in [docs/supabase-cutover.md](docs/supabase-cutover.md).

---

## 5. Feature flags (`lib/flags.ts`)

Read from `NEXT_PUBLIC_ENABLE_*` (inlined at build time; resolve identically on
server + client). Blank → built-in default. Access via the `flags` object
(`flags.roomEngine`, etc.).

| Flag | `flags` key | Default | Controls | Off behaviour |
|---|---|---|---|---|
| `ENABLE_CREATOR_PROFILES` | `creatorProfiles` | on | `/u/[handle]`, owner links | route 404, links become plain text |
| `ENABLE_NOTIFICATIONS` | `notifications` | on | header bell, `/notifications` | route 404, bell hidden |
| `ENABLE_GUESTBOOKS` | `guestbooks` | on | guestbook panel/drawer | hidden |
| `ENABLE_COLLECTIONS` | `collections` | on | save buttons, `/collections` | route 404, buttons hidden |
| `ENABLE_ACTIVITY_FEED` | `activityFeed` | on | `/activity`, profile feed, activity recording | route 404, recording skipped |
| `ENABLE_ASSET_CATALOG` | `assetCatalog` | on | `/assets` (internal) | route 404 |
| `ENABLE_ROOM_ENGINE` | `roomEngine` | on | full-screen room + room editor | **falls back to legacy room** (no 404) |

Pattern: gate the route (`if (!flags.x) notFound()`), the nav/UI entry points,
and any data recording. All six listed routes are 404-gated; only the room engine
has a graceful fallback.

---

## 6. Route map

| Route | Type | Notes |
|---|---|---|
| `/` | static | Hex district map (`VillageWorld`) + onboarding overlay |
| `/bazaar` | static | Alias of the map |
| `/bazaar/[slug]` | SSG (10) | Village street (`StreetWalk`); claim flow |
| `/shop/[address]` | SSG (10) + dynamic | Public room (`ShopPageClient` → `RoomExperience` or legacy). Resolves owner-claimed addresses client-side via `useAllShops` |
| `/studio` | client | Owner editor (room / exterior / classic interior + details + tags). Requires demo user + claimed house |
| `/discover` | static | Trending/newest, tags, swipe/grid/list |
| `/tags`, `/tags/[tag]` | static + SSG | Tag index + detail |
| `/u/[handle]` | SSG | Creator profile (flag) |
| `/notifications` | static | Inbox (flag) |
| `/collections` | static | Saved houses/items (flag) |
| `/activity` | static | Global activity feed (flag) |
| `/assets` | static | Internal catalog, noindex (flag) |
| `/moderation` | static | Admin reports + event counts |
| `/auth/login`, `/auth/sign-up` | static | Demo auth entry |
| `/design` | static | Internal house-kit showcase (unlinked) |
| `/api/generations` | route | Mock generation endpoint (no real AI) |

---

## 7. Storage model

### Demo layer (runtime)
React context **`DemoProvider`** (`components/providers/demo-provider.tsx`) holds
session state and exposes `useDemo()` and `useAllShops()`:
`user, ownedShop, likedShops:Set, followedOwners:Set, jobs`, plus actions
`login, logout, claimShop, toggleLike, toggleFollow, addDecoration, updateShop,
addShopLink, setShopTags, setDecorationTags, setLinkTags, createGeneration`.

Feature data lives in **small localStorage libs**, each following the same shape:
`read()`/`write()` guarded by `typeof window`, wrapped in `try/catch`, and a
`window.dispatchEvent(new Event("ai-bazaar-<x>-changed"))` that components
subscribe to for reactivity. Some seed demo data once (`*-seeded` guard key).

| Lib | localStorage key | Purpose |
|---|---|---|
| `lib/events.ts` | `ai-bazaar-events` | analytics `trackEvent()` + counts |
| `lib/reports.ts` | `ai-bazaar-reports` | moderation reports + status, `hiddenRefs()` |
| `lib/notifications.ts` | `ai-bazaar-notifications` (+`-seeded`) | inbox + bell |
| `lib/guestbook.ts` | `ai-bazaar-guestbook` | per-house notes |
| `lib/collections.ts` | `ai-bazaar-collections` | collections + saved items |
| `lib/activity.ts` | `ai-bazaar-activity` (+`-seeded`) | activity feed |
| `lib/room.ts` | `ai-bazaar-rooms` | saved room layouts |
| DemoProvider | `ai-bazaar-user`, `ai-bazaar-shop` | demo user + claimed house |
| Onboarding | `ai-bazaar-world-seen` | overlay dismissed |

Other client helpers: `lib/use-hidden.ts` (`useHiddenRefs()` reactive set of
moderator-hidden addresses), `lib/creators.ts` (`getCreator`, `normalizeHandle`),
`lib/tags.ts` (`normalizeTag`, `parseTags`, aggregation).

**Reset demo state** (console):
```js
Object.keys(localStorage).filter(k => k.startsWith("ai-bazaar-")).forEach(k => localStorage.removeItem(k));
location.reload();
```

### Image storage abstraction (`lib/storage/`)
`getImageStorage()` returns an `ImageStorage` (`upload`/`remove`). `LocalMockStorage`
is active; an R2 implementation can replace it without touching the editor. No
real uploads yet.

### Runtime mode + repository layer (Supabase cutover seam)
- **Runtime mode** (`lib/runtime-mode.ts`): `getRuntimeMode()` → `"demo"` |
  `"production"` from the presence of `NEXT_PUBLIC_SUPABASE_URL` +
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (same signal as the null-returning Supabase
  clients). A **dev-only badge** (`components/dev-mode-badge.tsx`, in `app/layout.tsx`)
  shows DEMO/LIVE; it renders nothing in production builds.
- **Repository layer** (`lib/repos/`): async interfaces (`types.ts`) for houses,
  rooms, room objects, profiles, events, reports; `local.ts` delegates to the demo
  libs; `supabase.ts` are typed stubs (`NotImplementedError`); `getRepositories(mode?)`
  (`index.ts`) selects by runtime mode, mirroring `getImageStorage()`. **Not yet
  consumed by components** — it is the cutover seam, so demo behaviour is unchanged.
- See [docs/supabase-cutover.md](docs/supabase-cutover.md) for the audit + runbook.

### Hydration discipline
Demo state loads in `useEffect`, never during render; components initialise to
empty/zero so the server and first client render match. Any deterministic
variation (house specs, hex positions) derives from stable seeds — **never
`Math.random()` / `Date.now()` in render**.

---

## 8. Current completed features

- **Village**: hex district map (10 villages), horizontal street (24 houses each), seed-deterministic SVG house kit, claim-a-house flow.
- **Room Engine V1**: full-screen public room, nine-zone schema, room objects with 9 action types, studio room editor (palette/select/inspector/save/reset), 12 room-ready assets, default room derived per house.
- **Room Engine V2 — Creator Studio**: free drag-and-drop (mouse + touch, bounds-clamped), resize (scale slider + corner handles, `width`/`height`), Bring Forward / Send Backward, duplicate, delete-with-confirmation, multi-select (shift-click + marquee) with batch move/delete/layer, Edit/Preview toggle, undo/redo (`⌘Z`/`⌘⇧Z`), 5s autosave with status, six starter templates, and editing analytics.
- **Room Engine V3 — Real Interactive Objects**: real in-room panels (gallery lightbox, embedded video, link card, product card, booking, unified contact, creator profile), a `profile` action type + 7 new assets, rich `RoomActionData`, object tooltips, per-type visitor analytics, owner room insights, inspector action-data editors, and working presets.
- **Room Engine V4 — Multi-Room Houses**: a house is a set of connected rooms (`HouseRooms` with one entry room); `door`/`stairs` asset categories + a `room_link` action navigate between rooms client-side; public breadcrumb + back; studio room manager (create/rename/retype/set-entry/delete with guards) + room presets; whole-house undo/redo; multi-room navigation analytics; legacy single-room saves migrated on read.
- **Room Engine V5 — Richer Visuals + Rotation**: per-category object sprites (CSS treatments around the icon, frames show real images) replacing generic tiles; engraved nameplate labels; rotation editor (slider + ±15° buttons), respected in public + editor; five room **background variants** (warm studio, gallery wall, shop floor, office, garden room) recolouring the existing shell; improved empty-room state. No new art, no schema change.
- **Creator profiles** (`/u/[handle]`): avatar/bio/links/houses/follower counts, follow, profile activity feed.
- **Notifications**: header bell + `/notifications`, 6 types, read/unread, demo seed.
- **Guestbooks**: per-house notes, owner hide/delete, report a note, owner notification on new note.
- **Collections**: 3 default collections, quick-save on cards + menu on house page, `/collections`.
- **Activity feed**: global `/activity` + profile feed, 7 event types recorded on real actions.
- **Tags**: normalized tags on houses/decorations/links, `/tags` + `/tags/[tag]`, studio editing.
- **Discovery**: trending/newest, explore-by-tag, mobile swipe + desktop grid/list.
- **Analytics**: `trackEvent` (8 types incl. `object_click`), counts on moderation page.
- **Reporting/moderation**: report house/item/user/guestbook, `/moderation` queue with `pending→reviewed→hidden→dismissed`; `hidden` soft-hides from discovery/tags.
- **Asset catalog**: internal `/assets` grid with filters.
- **Backend cutover prep**: env-derived runtime mode + dev-only badge, a repository layer (local impls + Supabase stubs + factory), and `docs/supabase-cutover.md` (drift audit + runbook). Demo stays the default; no app rewiring.
- **Quality**: Vitest suite (75 tests) for the demo libs incl. room move/resize/undo-redo/templates, V3 gallery/video/product/contact validation + analytics, V4 multi-room (create/delete/entry/door-target/persistence/analytics), V5 (visual-variant selection, background validation, rotation/background persistence), and cutover-prep (mode detection, repository selection, migration/schema file presence); QA checklist; flags + demo behaviour documented.

Verification gates (all green): `npm run typecheck && npm run lint && npm run test && npm run build` (75 tests, build emits ~81 pages).

---

## 9. Known limitations

- **Demo, single-user.** No real auth; one claimed house per browser. Notifications/activity are seeded + self-generated (no other users). "Following" counts on profiles are demo-derived per handle.
- **Room object actions are real** as of V3 (gallery/video/link/product/booking/contact/profile). Their panels load **third-party embeds/images** (YouTube, Vimeo, Calendly, favicons, sample preset images) — external requests outside the app's control; offline these degrade to placeholders/broken images. Placement is free drag + resize + rotate. Objects can crowd on very small viewports.
- **Object visuals are CSS treatments around an icon** (V5), not per-asset illustration; richness is bounded by what CSS can express. Resize-handle math is axis-aligned, so resizing a heavily rotated object is approximate.
- **Multi-room houses ship in V4**, but room navigation state is **client-only**: a visitor always lands in the entry room, and a URL can't deep-link to a specific inner room yet.
- **AI/storage are mocked**: `/api/generations` and `createGeneration` are fake; image URLs are placeholders that don't load.
- **SQL is unverified at runtime** — schema/migrations mirror the demo but have never been executed against Postgres here. Dry-run before production; RLS in particular needs live testing.
- **Tests cover libs, not UI** — no component/E2E tests.
- **Node 16 is the machine default** but the toolchain needs Node 20 (eslint `structuredClone`, `next dev`). Always set the PATH as noted in section 1.

---

## 10. How to extend (conventions)

1. **Two layers per feature**: a localStorage demo lib (mirroring `lib/events.ts`'s shape: SSR guard, try/catch, change event) **and** matching SQL (schema.sql + a dated migration; split enum-value additions).
2. **Flag new surfaces** with a `NEXT_PUBLIC_ENABLE_*` entry in `lib/flags.ts` and `.env.example`; gate route + UI + recording.
3. **Keep it modular**: new feature → its own `lib/<feature>.ts`, `components/<feature>*` (or a folder), and a route under `app/`.
4. **Strict TS, zero lint warnings.** Avoid `Math.random`/`Date.now` in render (hydration). Reuse existing components/CSS rather than redesigning visuals.
5. **Add a Vitest** for pure/storage helpers (`test/<feature>.test.ts`; the harness mocks `localStorage` via `test/setup.ts`).
6. **Verify**: run the four gates, then screenshot key pages via the preview tools (clear `ai-bazaar-*` keys between runs).
7. **Update docs**: this file, `README.md`, and `docs/QA.md`.
