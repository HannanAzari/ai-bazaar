# Changelog

Historical record of all completed work. **Append-only** — entries are added
newest-first and never edited or removed. Every completed sprint has an entry.
Dates follow the repository's migration timestamps. See
[roadmap.md](roadmap.md) for direction and [architecture.md](../architecture.md)
for technical detail.

---

## 2026-06-14 — Documentation & source-of-truth pass

### Documentation
- Added `architecture.md` (vision, room engine, village, schema, flags, routes, storage, completed features, limitations).
- Added `docs/roadmap.md` (vision, pillars, completed/in-progress/next sprint, backlog, not-planned, principles).
- Added `docs/changelog.md` (this file).

---

## 2026-06-14 — Room Engine V1

### Added
- Full-screen public room surface (`components/room/room-experience.tsx`): room canvas fills the viewport; owner info/stats/links and the guestbook live in slide-over drawers; like/follow/save/share/report in a corner cluster.
- Nine-zone room data model (`lib/room-schema.ts`, `lib/types.ts`): `Room`, `RoomZoneDef`, `RoomObject` with zones `back_wall, left_wall, right_wall, floor_left, floor_center, floor_right, shelf, window, door` and 9 action types (`link, video, product, booking, contact, gallery, guestbook, collection, none`).
- Room store (`lib/room.ts`, key `ai-bazaar-rooms`) with `getRoom`/`saveRoom`/`resetRoom`; houses without a saved layout render a furnished default derived from their decorations + links.
- Studio room editor (`components/room/room-editor.tsx`): asset palette, selectable canvas, inspector (label, action + URL, zone, anchor, scale, layer, hide, duplicate, delete), Save/Reset layout.
- Room canvas/object/action components (`room-canvas`, `room-object`, `object-action-modal`) reusing the existing room shell CSS.
- 12 room-ready catalog assets (`lib/assets.ts`) with `compatibleZones`/`defaultScale`/`defaultActionType`; helpers `roomReadyAssets()`, `getAsset()`.
- Analytics event type `object_click`.
- Tests `test/room.test.ts` (schema creation, zone validation, placement validation, action-type validation, save/reset) — suite now 25 tests.

### Changed
- `/shop/[address]` renders the full-screen room by default; the legacy profile-style room is the fallback.
- Studio gains a **Room** mode (default when the flag is on); the old interior tab is relabelled "Classic interior".

### Fixed
- Removed a needless id-generator indirection and a garbled class string in room components; avoided double `house_view`/`room_view` tracking by routing through a thin wrapper.

### Database
- Migration `20260614_room_engine.sql`: tables `rooms`, `room_objects`, `room_object_tags`; enums `room_zone_type`, `room_action_type`, `room_kind`; RLS. Mirrored in `schema.sql`.

### Flags
- Added `ENABLE_ROOM_ENGINE` (default **on**; off falls back to the legacy room rather than 404).

### Documentation
- README Room Engine section; `docs/QA.md` room routes + editor flow; `.env.example` flag entry.

---

## 2026-06-13 — QA & stability

### Added
- Vitest harness + unit suite (18 tests) for the demo libs (`test/setup.ts` localStorage shim, `test/{tags,utils,collections,notifications,reports}.test.ts`); `npm run test` script.
- `docs/QA.md` manual test checklist (routes, actions, demo-mode notes, reset).
- Assets catalog empty-state message.

### Changed
- Consolidated the duplicated `timeAgo` helper into `lib/utils.ts`.

### Fixed
- Simplified the `markRead` parameter that shadowed the module `read()` in `lib/notifications.ts`; merged duplicate import lines in `shop-page-client` and `creator-profile-client`.

### Database
- None.

### Documentation
- README: feature-flags table, demo/localStorage behaviour + key table, reset snippet, test command.

---

## 2026-06-13 — Sprint 2: Saving, activity & assets

### Added
- Collections (`lib/collections.ts`, `components/save-button.tsx`, `components/collections-client.tsx`, `/collections`): three default collections, quick-save on cards + full menu on house pages.
- Activity feed (`lib/activity.ts`, `components/activity-feed.tsx`, `/activity`) — global stream + per-creator feed on profiles; 7 activity types.
- Asset catalog (`lib/assets.ts`, `components/assets-client.tsx`, `/assets`) — internal, read-only, filterable.

### Changed
- Creator-profile "recent activity" placeholder replaced by the real activity feed.
- `recordActivity` wired into like / follow / guestbook / claim / update / add-decoration / save.
- Footer adds Collections and Activity links (flag-gated).

### Database
- Migration `20260613_collections_activity_assets.sql`: tables `collections`, `collection_items`, `activity_events`, `assets`; enums `saved_kind`, `activity_type`, `asset_category`, `asset_placement`, `asset_rarity`, `asset_status`, `asset_owner_type`; RLS. Mirrored in `schema.sql`.

### Flags
- Flipped `ENABLE_COLLECTIONS`, `ENABLE_ACTIVITY_FEED`, `ENABLE_ASSET_CATALOG` to default **on** (implemented).

### Documentation
- README + `docs/QA.md` updated for the three features.

---

## 2026-06-12 — Sprint 1: Creator identity

### Added
- Feature-flag module `lib/flags.ts` (`NEXT_PUBLIC_ENABLE_*`, server+client safe).
- Creator profiles (`/u/[handle]`, `components/creator-profile-client.tsx`, `lib/creators.ts`): avatar, bio, links, owned houses, follower/following, follow button, activity placeholder.
- Notifications (`lib/notifications.ts`, header bell, `/notifications`): 6 types, read/unread, mark-all, demo seed.
- Guestbooks (`lib/guestbook.ts`, `components/guestbook-panel.tsx`): per-house notes, owner hide/delete, report a note, owner notification on new note.

### Changed
- Owner names/avatars on house pages and cards link to creator profiles.
- Report dialog gains a guestbook target; report target type `guestbook` added.

### Database
- Migration `20260612_01_extend_enums.sql` (`report_target_type` += `guestbook`).
- Migration `20260612_02_creator_engagement.sql` (`guestbook_entries`, `notifications` + `push_notification()` + insert trigger, `reports.guestbook_entry_id` + check). Mirrored in `schema.sql`.

### Flags
- Added `ENABLE_CREATOR_PROFILES`, `ENABLE_NOTIFICATIONS`, `ENABLE_GUESTBOOKS` (default **on**); `ENABLE_COLLECTIONS`, `ENABLE_ACTIVITY_FEED`, `ENABLE_ASSET_CATALOG` scaffolded **off**.

### Documentation
- README creator-identity section; `.env.example` flag entries.

---

## 2026-06-11 — Platform foundations

### Added
- Hexagon district map (`components/village-world.tsx`) replacing the circular-village map; villages carry axial `hex` coords.
- Tags (`lib/tags.ts`, `/tags`, `/tags/[tag]`, studio editing): lowercase-normalized tags on houses, decorations, links.
- Discovery modes (`/discover`): trending, newest, popular tags, explore-by-tag, mobile swipe deck, desktop grid/list.
- Analytics events (`lib/events.ts`, `trackEvent`) and basic counts.
- Reporting + moderation (`lib/reports.ts`, `components/report-dialog.tsx`, `/moderation`): report house/item/user; admin queue with status workflow; soft-hide.

### Changed
- World map navigation reworked to hex grid; house page leans room-first.

### Fixed
- Map hydration mismatch resolved by emitting fixed-precision coordinates.

### Database
- Migration `20260611_01_extend_enums.sql` (`report_target_type` += `user`; `report_status` `pending`/`reviewed`/`hidden`).
- Migration `20260611_02_tags_events_reports.sql` (`tags`, `shop_tags`, `decoration_tags`, `link_tags`; `events` + `record_event()` + `event_counts` view; reports user target). `seed.sql` adds a starter tag vocabulary. Mirrored in `schema.sql`.

### Documentation
- README discovery/tags/analytics/moderation section.

---

## 2026-06-10 — Visual redesign "Lantern Hollow" (Phase 0–1)

### Added
- Design-token system + shadow/light tokens (`app/globals.css`, `tailwind.config.ts`).
- Fonts via `next/font`: Fraunces (display) + Nunito Sans (UI) (`app/layout.tsx`).
- Seed-deterministic SVG house kit (`components/scene/house/`: `house.tsx`, `spec.ts`) used by street, discover cards, and exterior preview.
- Internal `/design` house-kit showcase.

### Changed
- De-SaaS chrome: buttons, header, and cards moved to a parchment/timber language.
- Display + eyebrow typography updated; weight 900 retired.
- Street view and discover cards render the shared house kit (replacing CSS-rectangle houses).

### Fixed
- Gable-roof texture overflow, dome-roof shading seam, and name-sign sizing in the house kit.

### Database
- None.

### Documentation
- `docs/visual-redesign-plan.md` (art direction + phased plan).

---

## 2026-06-10 — Visual feeling & UX polish

### Added
- Village atmosphere: chimney smoke, fireflies, swaying trees, glowing windows; per-house plots (grass, path, signage).
- Room interior redesigned as furniture-like objects in a perspective room; house page made room-first.

### Changed
- Street view: detached houses with gaps, individual front yards, varied roofs/doors/windows.
- Village map redrawn as an illustrated town (meadow, roads, central features).
- User-facing copy shifted from "shop/store" to "house/place".

### Fixed
- Owned-house badge bug (`undefined === undefined` marked every empty house as owned).
- Hydration mismatch from floating-point coordinate serialization.
- Tailwind `content` not scanning `lib/`, which dropped palette gradients.
- Street scene layers clipped to the first screen width instead of scrolling with the rail.

### Database
- None (baseline migrations `20260610_village_model.sql` and `20260610_house_exteriors_and_room_zones.sql` pre-existed).

### Documentation
- Memory note: Node 20 required for the toolchain.
