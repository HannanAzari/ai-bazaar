# Changelog

Historical record of all completed work. **Append-only** — entries are added
newest-first and never edited or removed. Every completed sprint has an entry.
Dates follow the repository's migration timestamps. See
[roadmap.md](roadmap.md) for direction and [architecture.md](../architecture.md)
for technical detail.

---

## 2026-06-18 — Room Engine V5: Richer Visuals + Rotation

Makes room objects visually richer and more place-like, and lets owners rotate
them — **without** redesigning the village, houses, palette, typography, or art
direction. No AI/marketplace/payments/chat; all prior room behaviour preserved.

### Added
- **Per-category object sprites** (`lib/room-visuals.ts` + `components/room/room-object.tsx`): generic icon tiles are replaced by CSS treatments around the existing glyph — framed artwork (gallery/photo, shows the object's first image when present), TV/screen (video), shelf (bookshelf/product/display), desk (desk/guestbook table), placard/card (sign/business card), portrait/certificate/pin-board (profile), door, stairs, plant, rug, sofa, and a generic-tile fallback. `objectVisual(assetId, category)` resolves the kind (asset → category → tile).
- **Rotation editor UI** (`room-editor.tsx`): a rotation slider plus rotate-left/right (±15°) buttons; persists `rotation` and is respected in both the editor and the public room. Live-drag + commit mirrors the scale control.
- **Natural object labels**: the floating pill is replaced by an engraved museum-placard nameplate at each object's base.
- **Room background variants** (`lib/room-visuals.ts` `ROOM_BACKGROUNDS` + `room-canvas.tsx`): Warm studio, Gallery wall, Shop floor, Office, Garden room — palettes that recolour the **existing** room shell via the `--room-wall` variable + a soft mood tint. Owners pick a background in the studio room-meta panel; new/preset rooms default by room type (`defaultBackgroundForType`). Stored in `room.background`.
- **Improved empty-room state**: a warm illustrated placeholder + guidance instead of the dashed box.
- Tests (`test/room-visuals.test.ts`, suite now **67**): visual-variant selection, background-style validation, and rotation/background persistence through the store.

### Changed
- `RoomCanvas` applies the room's background palette; `RoomObjectView` renders the sprite and the engraved nameplate while keeping the selection ring, hidden state, interactive cue, hover tooltip, resize handles, rotation, and `data-object-id`/`data-resize-handle` hooks intact.
- `addObjectFromAsset`'s `action.data` param widened to the canonical `RoomActionData` (type-correctness; carried over from the V4 audit).

### Database
- **None.** `room_objects.rotation` and `rooms.background` already exist; backgrounds are app-defined style keys (no enum), so no migration was needed.

### Flags
- None (under the existing `ENABLE_ROOM_ENGINE`).

### Documentation
- README, architecture.md, roadmap.md, handoff.md, room-engine-spec.md, QA.md updated; new ADR-013 in decision-log.md.

---

## 2026-06-17 — Room Engine V4: Multi-Room Houses

Turns a house from a single room into connected spaces a visitor explores via
doors and stairs. **No visual redesign**; no AI/marketplace/payments/chat; all
prior functionality preserved.

### Added
- **Multi-room data model** (`lib/types.ts`): `HouseRooms { shopAddress, entryRoomId, rooms[] }`; `Room` gains `description`. One room is the entry room (single `entryRoomId` pointer). Room types extended (`living_room, office, bedroom, garden, custom` added to the existing kinds).
- **Door & stairs** as first-class asset categories (`door`, `stairs`) and a new **`room_link`** action type whose `actionData.targetRoomId` navigates to another room — instant, client-side, no page reload. `ast-door`/`ast-stairs` updated accordingly.
- **House helpers** (`lib/house.ts`): `deriveDefaultHouse`, `addRoom`, `renameRoom`, `updateRoomMeta`, `setEntryRoom`, `deleteRoom`/`canDeleteRoom`, `withRoom`, `isValidRoomLink`, `roomLinkTargets`, plus `normalizeHouse`/`houseFromRoom` for migrate-on-read.
- **Public navigation** (`room-experience.tsx`): renders the current room, a subtle breadcrumb (`House › Room › Room`) with crumb jumps and a back button; client-side room state (no URL change).
- **Room manager** (`room-editor.tsx`): create (blank or preset), rename, set type/description, set entry, delete (guarded), switch active room; whole-**house** undo/redo + autosave; door target picker in the inspector (`action-data-editor.tsx`).
- **Room presets** (`lib/room-templates.ts`): `ROOM_PRESETS` + `buildPresetRoom` — Gallery, Studio, Podcast Room, Shop, Office — build a furnished new room from existing assets.
- **Analytics**: `room_entered`, `room_created`, `room_deleted`, `room_link_clicked` (`lib/events.ts`), on the moderation counts grid.
- Tests (`test/house.test.ts`, suite now **60**): room creation, deletion + entry/objects guards, entry validation, door-target validation, persistence (incl. legacy single-room migration), duplicate-id guard, and analytics.

### Changed
- The room store (`lib/room.ts`) persists a `HouseRooms` per address on the **same `ai-bazaar-rooms` key**; layouts saved before V4 (a single `Room`) are **migrated on read** into a one-room house (that room becomes the entry room) — no saved layout is lost. Back-compat single-room helpers (`getRoom`/`saveRoom`/`resetRoom`) now operate on the entry room.

### Validation (no-ops that keep the house valid)
- Door/stairs with a missing or unknown `targetRoomId` are inert. Can't delete the last room, the (non-empty) room with objects, and deleting the entry room reassigns entry + clears doors that pointed at the removed room. Room ids are unique (collisions regenerated).

### Database
- Migration `20260617_01_extend_enums.sql`: `asset_category` += `door`, `stairs`; `room_kind` += `living_room`, `office`, `bedroom`, `garden`, `custom`; `room_action_type` += `room_link`; `event_type` += the four `room_*` events.
- Migration `20260617_02_multi_room.sql`: `rooms.description`, `rooms.is_entry` + a partial unique index (one entry room per shop). `room_objects.room_id` (existing) scopes objects to a room; door targets live in `action_data` jsonb. Mirrored in `schema.sql`.

### Flags
- None (under the existing `ENABLE_ROOM_ENGINE`).

### Documentation
- README, architecture.md, roadmap.md, handoff.md, room-engine-spec.md, QA.md updated; new ADR-012 in decision-log.md.

---

## 2026-06-16 — Room Engine V3: Real Interactive Objects

Turns room objects from decorative placeholders into real, useful destinations a
visitor can explore without leaving the room. **No visual redesign** — village,
houses, room shell, typography, and palette are unchanged. No AI, marketplace,
payments, or chat.

### Added
- **Real action panels** (`components/room/object-action-modal.tsx` rewrite): gallery lightbox (multi-image, next/prev, captions, dot nav, keyboard arrows, mobile full-screen), embedded video (YouTube/Vimeo, local fallback), link card (favicon + title + description → opens externally), product card (image/title/price → redirect, no payments), booking card (Calendly iframe / external), unified contact modal (email/website/phone/socials), and a **profile** panel (creator card with followers/likes/visitors + recent activity, links to the full profile/collections).
- **New `profile` action type** + 3 profile assets (`ast-avatar-portrait`, `ast-certificate`, `ast-achievement-board`) and 4 thematic assets (`ast-projector`, `ast-sign`, `ast-display-table`, `ast-business-card`).
- **Rich `RoomActionData`** (jsonb-backed): `title`, `description`, `images[]`, `price`, `image`, `email`, `website`, `phone`, `socials[]`.
- **Object tooltips** (`components/room/room-object.tsx`): hover/focus shows title + description + owner.
- **Visitor analytics**: `gallery_opened`, `video_opened`, `product_opened`, `booking_opened`, `contact_opened`, `profile_opened` (`lib/events.ts`), on the moderation counts grid.
- **Owner room insights** (`lib/room-insights.ts` + a studio panel): total object clicks, most-clicked object, popular object type — derived from existing events, no new store.
- **Inspector action-data editors** (`components/room/action-data-editor.tsx`): per-action field groups (gallery image rows, video URL, link, product, booking, contact + socials rows) so owners configure real objects.
- **Working presets**: the six templates now ship sample `actionData` (real gallery images, a video, products, contacts, a profile) so an applied preset is immediately interactive.
- Pure helpers `lib/room-actions.ts` (`galleryImages`, `productCard`, `contactMethods`, `faviconUrl`, `hostname`, `hasActionData`) and `lib/embeds.ts` (`videoEmbed`).
- Tests (`test/room-actions.test.ts`, suite now **46**): gallery/video/product/contact validation, URL helpers, `hasActionData`, and analytics tracking.

### Changed
- `room-experience.tsx` `onActivate`: gallery/video/link/product/booking/contact/profile all open their real in-room panel (the visitor stays in the room); each fires its specific `*_opened` event.
- `RoomCanvas`/`RoomObjectView` accept an `ownerName` for tooltips; `ObjectActionModal` now takes the `shop`.

### Database
- Migration `20260616_extend_enums.sql`: `room_action_type` += `profile`; `event_type` += the six `*_opened` values (enum-value additions, per ADR-009; `action_data` is already jsonb). Mirrored in `schema.sql`.

### Flags
- None (all behaviour sits under the existing `ENABLE_ROOM_ENGINE`).

### Documentation
- README, architecture.md, roadmap.md, handoff.md, room-engine-spec.md, QA.md updated; new ADR-011 in decision-log.md.

---

## 2026-06-15 — Room Engine V2: Creator Studio

Turns the V1 zone/anchor editor into a real creator tool. **No visual redesign** —
the village, houses, colours, typography, and room shell are unchanged; only
editing capability grew.

### Added
- **Free drag-and-drop placement** (`components/room/room-canvas.tsx`): objects move with the pointer (mouse + touch), clamped inside the room bounds. Anchor/zone dropdowns remain for category validation; drag adjusts the fine offset (`moveObjectTo`, `ROOM_BOUND_MARGIN`).
- **Resize** — a scale slider plus corner resize handles on the selected object; stores `scale`, `width`, `height` (`resizeObject`, rejects zero/negative; `MIN_OBJECT_SIZE`).
- **Layer management** — Bring Forward / Send Backward (`bringForward`/`sendBackward`, neighbour z-swap) alongside the existing front/back; z-index persists.
- **Duplicate** (asset, scale, action, tags, new id) and **Delete with a confirmation dialog** (single or batch).
- **Multi-select** — shift-click and a drag-selection marquee; batch move (drag), delete, and layer change.
- **Edit / Preview toggle** — Preview renders the room exactly as the public surface, with editing controls dimmed.
- **Undo / Redo** — pure history stack (`lib/room-history.ts`) over add/delete/move/resize/duplicate/layer/template; keyboard `⌘Z` / `⌘⇧Z` (`⌃` on non-mac; suppressed while typing in a field).
- **Autosave** — persists 5s after the last change, with a Saved / Saving… / Unsaved-changes status; the manual Save button remains.
- **Room templates** (`lib/room-templates.ts`): six starter layouts — Creator, Photographer, Artist, Developer, Shop, Podcast — composed only from existing room-ready assets (no generated graphics).
- **Analytics**: `room_object_added`, `room_object_deleted`, `room_object_moved`, `room_object_resized`, `room_template_applied` (`lib/events.ts`), surfaced on the moderation counts grid.
- Tests (`test/room.test.ts`, now 33): move/drag bounds, resize validation, undo/redo history, and template generation validity.

### Changed
- `RoomObject` gains optional `width`/`height` (px box; `scale` multiplies). Objects render at width × height instead of a fixed tile size; rooms saved before V2 fall back to the base size.
- `RoomCanvas` editor mode now owns pointer interaction (drag/resize/marquee) via an `editor` prop bundle; the public-mode signature is unchanged.

### Fixed
- Corrected SQL parity: `object_click` (shipped in the V1 TypeScript `EventType`) was never mirrored into the `event_type` enum — added in this sprint's enum migration.

### Database
- Migration `20260615_01_extend_enums.sql`: `event_type` += `object_click`, `room_object_added`, `room_object_deleted`, `room_object_moved`, `room_object_resized`, `room_template_applied` (values only, per the enum-split rule).
- Migration `20260615_02_room_studio.sql`: `room_objects.width` / `.height` (nullable, `> 0` checks). Both mirrored in `schema.sql`.

### Flags
- None (all behaviour sits under the existing `ENABLE_ROOM_ENGINE`).

### Documentation
- `architecture.md`, `docs/roadmap.md`, `docs/handoff.md`, `docs/room-engine-spec.md`, `docs/QA.md`, README updated; new ADR-010 in `docs/decision-log.md`.

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
