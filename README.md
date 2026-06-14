# AI Bazaar

AI Bazaar is a mobile-first creative village where each member can claim one little house, decorate a standard room, share links, and welcome visitors through a memorable village address.

The world map is a **hexagon district map**: ten villages laid out as a connected honeycomb, with a frontier of empty plots that signals room to grow. Each hex opens into its own ring of 24 houses around a shared green, fountain, tree, or garden — the horizontal circular street view and the per-house interior are unchanged.

## Experience

- The default route opens directly to the hexagon district map; each hex is one village.
- Ten connected villages contain 24 fixed houses each: 240 total.
- Entering a village opens a horizontal circular-street walk of detached house plots.
- Houses are drawn from one reusable, seed-deterministic house kit shared by the map, street, discovery cards, and profile.
- One authenticated user can claim one house.
- Owners can style a mocked exterior, edit the interior, and **tag** their house and items.
- Room items support left wall, back wall, floor, and right wall placement zones.
- Public houses open into the room first, with owner information kept secondary.
- Likes, follows, visitors, search, and mock generation jobs remain supported.

## Discovery, tags, analytics & moderation

- **Tags** — houses, decorations, and links carry lowercase normalized tags. Browse `/tags`, open any tag at `/tags/<tag>`, and see every house and item that shares it. Owners edit tags from the studio.
- **Discovery** (`/discover`) — trending and newest feeds, popular tags, inline explore-by-tag filtering, a mobile swipe deck, and a desktop grid/list toggle.
- **Analytics events** — `trackEvent()` records `house_view`, `room_view`, `decoration_click`, `link_click`, `share_click`, `follow`, and `like`. Basic counts surface on the moderation page.
- **Reporting & moderation** — visitors can report a house, an item, an owner, or a guestbook note. The admin page at `/moderation` lists reports with `pending → reviewed → hidden → dismissed` status control; hiding a place softly removes it from discovery while preserving ownership and history.

In the running demo these features persist to `localStorage` (no backend required). The same shapes map onto the Supabase tables below for production.

## Creator identity & engagement

These foundations are gated by feature flags in `lib/flags.ts` (read from `NEXT_PUBLIC_ENABLE_*`). Sprint 1 features default on; later-sprint flags (`ENABLE_COLLECTIONS`, `ENABLE_ACTIVITY_FEED`, `ENABLE_ASSET_CATALOG`) are scaffolded off.

- **Creator profiles** (`ENABLE_CREATOR_PROFILES`) — a public profile at `/u/<handle>` shows the maker's avatar, name, handle, bio, links, owned house(s), follower/following counts, a follow button, and a recent-activity placeholder. Owner names and handles on house pages and cards link here.
- **Notifications** (`ENABLE_NOTIFICATIONS`) — a header bell with an unread badge and a `/notifications` page. Types: `house_view`, `like`, `follow`, `guestbook_entry`, `item_click`, `report_status`. Mark individual notes read/unread or mark all read. No push delivery yet.
- **Guestbooks** (`ENABLE_GUESTBOOKS`) — each house page shows a cosy guestbook panel. Visitors leave short public notes; the owner can hide or delete them; anyone can report a note. A note on your own house raises a `guestbook_entry` notification.

## Saving, activity & assets

- **Collections** (`ENABLE_COLLECTIONS`) — save houses (and items) into collections. Three starter collections (Favorite houses, Inspiration, Want to visit) seed on first use. A bookmark button quick-saves from cards and opens a full collection picker on house pages. Browse and curate at `/collections`.
- **Activity feed** (`ENABLE_ACTIVITY_FEED`) — a tasteful public stream of `claimed_house`, `updated_house`, `added_decoration`, `liked_house`, `followed_creator`, `guestbook_entry`, and `saved_to_collection` events. Global feed at `/activity`; a profile-specific feed shows on each creator page.
- **Asset catalog** (`ENABLE_ASSET_CATALOG`) — an internal, read-only `/assets` catalog of sample asset records (id, name, category, village theme, placement, system/creator owner, rarity, tags, placeholder image URL, status) with category/status filters. No marketplace, payments, or uploads.

## Village Addresses

Every address has three words:

```text
village.custom.word
```

The first word is fixed by the village. The resident chooses the second and third words while claiming:

- `moon.blue.hour`
- `saffron.tiny.lantern`
- `blue.hannan.lab`

The database trigger verifies that the address prefix matches the village containing the selected house.

## Run Locally

Requires Node.js 18.17 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint, zero warnings
npm run test        # vitest unit tests for the demo libs
npm run build       # production build
```

> Closing a sprint? Follow [docs/sprint-checklist.md](docs/sprint-checklist.md)
> (definition of done): update the source-of-truth docs, then pass all four gates.

## Demo mode & localStorage

With blank Supabase variables the app runs in **demo mode**: no real backend, no
real auth. State persists in `localStorage` under the `ai-bazaar-*` namespace, and
seed content (villages, sample houses) comes from `lib/data.ts`. Each demo store
guards on `typeof window` (SSR-safe) and reads through a `try/catch`, and components
initialise to empty/zero on the server to avoid hydration mismatches.

| Key | Holds |
|-----|-------|
| `ai-bazaar-user`, `ai-bazaar-shop` | demo user and claimed house |
| `ai-bazaar-events`, `ai-bazaar-reports` | analytics events, moderation reports |
| `ai-bazaar-notifications`, `…-seeded` | notification inbox (seeded once) |
| `ai-bazaar-guestbook` | guestbook notes per house |
| `ai-bazaar-collections` | collections and saved items |
| `ai-bazaar-activity`, `…-seeded` | activity feed (seeded once) |
| `ai-bazaar-rooms` | saved room-engine layouts per house |
| `ai-bazaar-world-seen` | onboarding dismissed flag |

**Reset demo state** from the browser console:

```js
Object.keys(localStorage).filter((k) => k.startsWith("ai-bazaar-")).forEach((k) => localStorage.removeItem(k));
location.reload();
```

See [docs/QA.md](docs/QA.md) for the full manual test checklist.

## Feature flags

Toggle features via `NEXT_PUBLIC_ENABLE_*` (see `lib/flags.ts` and `.env.example`).
Flags resolve identically on server and client; blank uses the built-in default.

| Flag | Default | Controls |
|------|---------|----------|
| `ENABLE_CREATOR_PROFILES` | on | `/u/[handle]`, owner links from houses/cards |
| `ENABLE_NOTIFICATIONS` | on | header bell, `/notifications` |
| `ENABLE_GUESTBOOKS` | on | per-house guestbook panel |
| `ENABLE_COLLECTIONS` | on | save buttons, `/collections` |
| `ENABLE_ACTIVITY_FEED` | on | `/activity`, profile feed, activity recording |
| `ENABLE_ASSET_CATALOG` | on | `/assets` (internal) |
| `ENABLE_ROOM_ENGINE` | on | full-screen public room + studio room editor (off = legacy room) |
| `ENABLE_AI_DESIGNER` | on | studio **Design** mode (AI room designer) — needs `ENABLE_ROOM_ENGINE` |

When a flag is off, its route returns 404 and its UI entry points are hidden.
The exception is `ENABLE_ROOM_ENGINE`: off it falls back to the legacy
profile-style room rendering instead of hiding anything.

## Room Engine

The public house page is a full-screen personal room rather than a profile.

- **Public room** — the room canvas fills the viewport; owner bio, stats, links,
  and the guestbook live in slide-over drawers, and like/follow/save/share/report
  sit in a compact corner cluster. Hovering an object shows a tooltip (title,
  description, owner). Clicks record `object_click` and a per-type `*_opened`
  event.
- **Interactive objects (V3)** — activating an object opens a real, in-room panel:
  - **Gallery** — a lightbox with multiple images, next/prev, captions, mobile-friendly.
  - **Video** — an embedded YouTube/Vimeo player (other URLs fall back to a placeholder).
  - **Link** — a card with favicon, title, and description that opens externally.
  - **Product** — image, title, and price that redirect to the seller (no payments).
  - **Booking** — a Calendly embed or an external scheduling link.
  - **Contact** — a unified modal of email, website, phone, and socials.
  - **Profile** — the owner's creator card (followers, recent activity, link to the full profile).
  - **Door / Stairs (V4)** — `room_link` objects that move the visitor to another room in the house.
  - `guestbook` opens the guestbook drawer; `none` is decorative.
- **Multi-room houses (V4)** — a house is a set of connected rooms with one **entry
  room** where visitors land. Doors and stairs (`room_link` objects, with a
  `targetRoomId`) navigate between rooms **instantly, client-side, with no page
  reload or URL change**; a subtle breadcrumb (`House › Room › Room`) with a back
  button shows the path. In the studio, a **room manager** lets owners create
  (blank or from a preset: Gallery, Studio, Podcast Room, Shop, Office), rename,
  retype, set the entry room, and delete rooms (a house keeps ≥1 room; a room must
  be emptied before deletion; deleting the entry room reassigns it). Records
  `room_entered` / `room_created` / `room_deleted` / `room_link_clicked`.
- **Room model** (`lib/room-schema.ts`, `lib/types.ts`) — a `Room` has nine
  zones (`back_wall`, `left_wall`, `right_wall`, `floor_left`, `floor_center`,
  `floor_right`, `shelf`, `window`, `door`), each with allowed asset categories,
  anchor points, and a max-object count. A `RoomObject` carries asset id, zone,
  anchor, x/y, scale, optional width/height, rotation, z-index, label, action
  type, action data (jsonb: url/title/description/images/price/image/email/
  website/phone/socials/targetRoomId), tags, and a hidden flag. A **house**
  (`HouseRooms`) groups one or more rooms with an `entryRoomId`. Houses without a
  saved layout render a populated default derived from their decorations and links.
- **Creator Studio editor (V2)** — the studio's "Room" mode is a real editing
  tool:
  - **Templates** — one-click starter layouts (Creator, Photographer, Artist,
    Developer, Shop, Podcast), composed from existing assets.
  - **Drag & drop** — move objects freely with mouse or touch; they stay inside
    the room bounds.
  - **Resize** — a scale slider plus corner handles (stores scale + width/height;
    zero/negative sizes are rejected).
  - **Rotate (V5)** — a rotation slider plus rotate-left/right (±15°) buttons;
    rotation persists and is respected in the public room.
  - **Layers** — Bring Forward / Send Backward; z-index persists.
  - **Duplicate** and **delete** (delete asks for confirmation).
  - **Multi-select** — shift-click or drag a selection box, then batch move,
    delete, or change layers.
  - **Edit / Preview** — Preview shows the room exactly as visitors see it.
  - **Undo / redo** — `⌘Z` / `⌘⇧Z` (or buttons) across add/delete/move/resize/
    duplicate/layer/template.
  - **Autosave** — persists ~5s after changes, with a saved / saving / unsaved
    status; the manual **Save layout** and **Reset layout** remain.
  - Edits record `room_object_added/deleted/moved/resized` and
    `room_template_applied` analytics.
  - **Object content (V3)** — selecting an object reveals a per-action editor
    (gallery image rows, video URL, link, product, booking, contact + socials);
    presets now populate working sample content.
  - **Room insights (V3)** — an owner-only panel: total object clicks, most-clicked
    object, and most popular object type (from analytics events).
  - **Background (V5)** — pick a room background variant (warm studio, gallery
    wall, shop floor, office, garden room); new/preset rooms default by room type.
- **Richer object visuals (V5)** — objects render as per-category CSS treatments
  (framed artwork that shows its first image, TV/screen, shelf, desk, placard,
  portrait/certificate/board, door, stairs, plant, rug, sofa) around the asset
  icon, with engraved nameplate labels — no new art, palette unchanged. Background
  variants recolour the existing room shell.
- **Assets** — placeable assets come from the catalog (`lib/assets.ts`); the
  room-ready ones carry `compatibleZones`, `defaultScale`, and `defaultActionType`.
  V3 adds profile objects (avatar portrait, certificate, achievement board) and a
  few thematic objects (projector, sign, display table, business card); V4 adds
  the `door` and `stairs` categories (navigation objects).

Demo houses persist in `localStorage` under `ai-bazaar-rooms` (a `HouseRooms` per
address; layouts saved before V4 are migrated on read into a one-room house);
production writes the same shape to the `rooms` / `room_objects` tables (one
`rooms` row per room, with an `is_entry` flag).

## AI Room Designer

A creator can describe a room in plain language and the app composes a layout
from existing catalog assets — **no image generation, no external APIs**. It is a
deterministic, rules-based recommender (ADR-006, room-engine-spec §11), gated by
`ENABLE_AI_DESIGNER` and surfaced as the studio's **Design** mode.

- **Design brief** — type something like "Create a cozy reading room", "a
  photography studio", "a gaming room", or "a minimalist office", and pick a
  **style preset** (Cozy · Minimal · Modern · Creative · Professional · Playful)
  and an optional room type.
- **Deterministic generation** (`lib/ai-room-designer.ts`) — the brief is matched
  to a design *intent* by keyword scoring; room-ready assets are ranked by tag /
  category / action / style affinity; the top picks are placed through the same
  `addObjectFromAsset` rules as every other edit, so the result is always a valid
  `Room`. Identical input always yields the identical room; **Regenerate** bumps a
  `variant` that deterministically reshuffles near-ties for a fresh-but-reproducible
  layout.
- **Preview before apply** — the proposed room renders next to the current room;
  nothing changes until **Apply**, which replaces the selected room's contents via
  `saveHouse` (the room's id/identity is preserved).
- **Design explanations** — a "Why this layout" panel lists the matched theme, the
  chosen background, the style, and a one-line reason per placed object.
- **Analytics** — records `room_design_generated`, `room_design_applied`, and
  `room_design_regenerated`.

### V2 — Smarter briefs, constraints, drafts

- **Advanced brief parser** (`parseBrief`) — extracts a **creator type**
  (photographer, artist, developer, podcaster, shop owner, writer, musician,
  designer, coach, small business), a **mood** (cozy, luxury, dark, playful,
  professional, warm, minimal, elegant), a **purpose** (portfolio, booking,
  selling, storytelling, community, personal profile, gallery), and
  **constraints** (no plants / no video / no products, a max object count,
  "minimal / clean", show social links / booking / gallery).
- **Constraints engine** — the generated room respects constraints: excluded
  categories/actions are dropped, "minimal" and "max N" cap the object count, and
  "I sell products" / "I take bookings" prioritise the product shelf / booking
  desk.
- **Creator presets** — eight one-click buttons (Photographer Portfolio, Artist
  Gallery, Developer Studio, Podcast Room, Online Shop, Writer's Room, Coach /
  Consultant, Personal Bio Room) that fill the brief + style and generate.
- **Drafts** — save a generated design as a draft, view your drafts, apply one
  later, or delete it. Demo drafts persist under `ai-bazaar-design-drafts`;
  production writes the `room_design_drafts` table (owner-private).
- **Designer history** — a session "recent designs" list (brief · style · intent ·
  constraints) you can click to revisit; "last applied" is surfaced too.
- **Richer explanation panel** — shows the detected creator type, mood, purpose,
  the constraints applied, and a reason per placed object.
- **Analytics (V2)** — `room_design_draft_saved`, `room_design_draft_applied`,
  `room_design_constraint_detected`, `room_design_preset_used`.

## Supabase

For a fresh project:

1. Run `supabase/schema.sql`.
2. Run `supabase/seed.sql`.
3. Add the Supabase URL and anon key to `.env.local`.

For an existing project, run migrations in filename order:

1. Move any claimed slots numbered 25-50.
2. `supabase/migrations/20260610_village_model.sql`
3. `supabase/migrations/20260610_house_exteriors_and_room_zones.sql`
4. `supabase/migrations/20260611_01_extend_enums.sql` — adds the `user` report target and `pending`/`reviewed`/`hidden` statuses. Must commit before step 5.
5. `supabase/migrations/20260611_02_tags_events_reports.sql` — tags tables, the `events` table with `record_event()` and the `event_counts` view, and the extended `reports` model.
6. `supabase/migrations/20260612_01_extend_enums.sql` — adds the `guestbook` report target. Must commit before step 7.
7. `supabase/migrations/20260612_02_creator_engagement.sql` — `guestbook_entries`, `notifications` (+ `push_notification()` helper and the guestbook-entry trigger), and the guestbook branch of the `reports` check.
8. `supabase/migrations/20260613_collections_activity_assets.sql` — `collections`, `collection_items`, `activity_events`, and `assets` (all new types and tables; no enum-split needed).
9. `supabase/migrations/20260614_room_engine.sql` — `rooms`, `room_objects`, `room_object_tags` and the room enums (all new types; no enum-split needed).
10. `supabase/migrations/20260615_01_extend_enums.sql` — adds the room-studio `event_type` values (`object_click`, `room_object_added/deleted/moved/resized`, `room_template_applied`). Must commit before step 11.
11. `supabase/migrations/20260615_02_room_studio.sql` — `room_objects.width` / `.height` (nullable, `> 0`) for resize.
12. `supabase/migrations/20260616_extend_enums.sql` — `room_action_type` += `profile`; `event_type` += the six `*_opened` events. (Enum-value additions only; `action_data` is already jsonb, so no table change.)
13. `supabase/migrations/20260617_01_extend_enums.sql` — `asset_category` += `door`, `stairs`; `room_kind` += `living_room`, `office`, `bedroom`, `garden`, `custom`; `room_action_type` += `room_link`; `event_type` += the four `room_*` events. Must commit before step 14.
14. `supabase/migrations/20260617_02_multi_room.sql` — `rooms.description`, `rooms.is_entry` + a partial unique index (one entry room per shop). Multi-room reuses the existing `rooms` / `room_objects.room_id`; door targets live in `action_data`.
15. `supabase/migrations/20260620_extend_enums.sql` — adds the AI-designer `event_type` values (`room_design_generated`, `room_design_applied`, `room_design_regenerated`). Enum-value additions only; stands alone (no table change — the designer composes existing Room/room_objects shapes).
16. `supabase/migrations/20260621_01_extend_enums.sql` — AI Room Designer V2 `event_type` values (`room_design_draft_saved`, `room_design_draft_applied`, `room_design_constraint_detected`, `room_design_preset_used`). Must commit before step 17.
17. `supabase/migrations/20260621_02_design_drafts.sql` — the `room_design_drafts` table (owner-private designer drafts) + RLS.
18. Run the updated `supabase/seed.sql` (adds a starter tag vocabulary).

The two-step enum split (in `20260611_*`, `20260612_*`, `20260615_*`, and `20260617_*`) is required: PostgreSQL will not let a single transaction add an enum value and then use it, so new enum values are committed in `_01` before `_02` references them. Migrations that only add enum values (e.g. `20260616_extend_enums.sql`) stand alone.

Internal table names such as `shops`, `shop_slots`, and `shop_decorations` remain unchanged to avoid an unnecessary data migration. The visible product consistently uses village, house, place, room, item, and decoration language.

### New tables

- `tags`, `shop_tags`, `decoration_tags`, `link_tags` — normalized tags and their joins.
- `events` (+ `record_event()` helper, `event_counts` view) — append-only analytics; anyone records, only admins read.
- `guestbook_entries` — public notes per house; visitors insert, owners moderate. An insert trigger notifies the house owner.
- `notifications` (+ `push_notification()` helper) — per-recipient bell items; recipients read and mark their own.
- `reports` — extended with `user` and `guestbook` target types (`reported_user_id`, `guestbook_entry_id`) and the `pending`/`reviewed`/`hidden`/`dismissed` status set.
- Creator profiles add no tables — they read existing `profiles`, `shops`, `shop_links`, and `follows`.
- `collections`, `collection_items` — private per-owner saves (RLS scopes them to the owner).
- `activity_events` — public, append-only activity stream powering the global and profile feeds.
- `assets` — the asset-metadata catalog; published rows are public, admins manage the rest.
- `rooms`, `room_objects`, `room_object_tags` — the Room Engine layout; rooms of visible houses are public, owners manage their own. Zones are an app-defined template (an enum column on each object), not a table.
- `room_design_drafts` — AI Room Designer V2 drafts (the generated room as jsonb + brief/style/intent/constraints). Owner-private (RLS scopes to the house owner).

## Runtime mode & backend cutover

The app auto-detects its backend: **demo** (localStorage) when the Supabase env
vars are blank, **production** when `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` are both set (`lib/runtime-mode.ts`). A dev-only
badge (bottom-left) shows the current mode; it never renders in production builds.

A **repository layer** (`lib/repos/`) is the cutover seam — async interfaces for
houses/rooms/room objects/profiles/events/reports, with localStorage
implementations (delegating to the demo libs) and Supabase **stubs** selected by
runtime mode via `getRepositories()`, mirroring `getImageStorage()`. The Supabase
implementations are not written yet; the app still calls the demo libs directly, so
demo mode is unchanged. The full audit + migration order + env vars + local/staging
setup + RLS smoke tests + rollback plan live in
[docs/supabase-cutover.md](docs/supabase-cutover.md).

> **Migrations note:** `supabase/schema.sql` is the canonical fresh-install superset
> — apply it for a new database. The `supabase/migrations/*` files are incremental
> patches on an existing baseline and don't build from an empty DB on their own.

## Mock Generation

The room editor still uses the mock generation flow:

1. A prompt creates a `building` job.
2. The job completes after a short delay.
3. A placeholder decoration appears in the selected room zone.

No real AI provider is called.

## Storage

The editor depends on the `ImageStorage` interface in `lib/storage/types.ts`. `LocalMockStorage` is active now; a Cloudflare R2 implementation can replace it without changing the editor.

## Key Structure

```text
app/
  bazaar/[slug]/         Horizontal village street
  discover/              Discovery: trending, newest, tags, swipe/grid/list
  tags/                  Tag index (/tags) and tag detail (/tags/[tag])
  shop/[address]/        Public full-screen room (Room Engine) + guestbook
  studio/                Resident editor (room engine, exterior, tags)
  u/[handle]/            Public creator profile + activity feed
  notifications/         Notification inbox
  collections/           Saved houses and items
  activity/              Global activity feed
  assets/                Internal asset catalog
  moderation/            Admin reports queue + basic activity counts
components/
  village-world.tsx      Hexagon district map
  street-walk.tsx        24-house circular street
  shop-room.tsx          Standard editable interior
  scene/house/           Seed-deterministic reusable house kit
  tags-ui.tsx            Tag chips (display) and tag input (editing)
  report-dialog.tsx      House / item / owner report dialog
  moderation-client.tsx  Reports queue and activity counts
  creator-profile-client.tsx  Creator profile view
  notification-bell.tsx  Header bell + unread badge
  notifications-client.tsx    Notification inbox list
  guestbook-panel.tsx    Cosy per-house guestbook
  save-button.tsx        Save-to-collection button (quick + menu)
  collections-client.tsx Collections page
  activity-feed.tsx      Global + profile activity feed
  assets-client.tsx      Internal asset catalog grid
  room/                  Room Engine: canvas, object, action modal, experience, editor, designer
lib/
  data.ts                Villages (with hex coords), sample residents, tags
  flags.ts               Feature flags (NEXT_PUBLIC_ENABLE_*)
  addresses.ts           Village-prefixed address generation
  tags.ts                Tag normalization and aggregation
  events.ts              trackEvent() and local count readers
  reports.ts             Report store and status workflow
  creators.ts            Derive a creator from owned houses
  notifications.ts       Local notification store + demo seed
  guestbook.ts           Per-house guestbook store
  collections.ts         Collections store + default seed
  activity.ts            Activity store, record() + demo seed
  assets.ts              Sample asset catalog (+ room-ready assets)
  room-schema.ts         Zone template, derive/validate, pure layout helpers
  room.ts                Room layout store (get/save/reset)
  ai-room-designer.ts    Deterministic brief→room designer + V2 parser/constraints/presets
  room-design-drafts.ts  Owner-private designer drafts store (save/list/apply/delete)
supabase/
  schema.sql             Tables, policies, triggers, and constraints
  seed.sql               Ten villages, 240 houses, starter tags
  migrations/            Ordered, idempotent project migrations
```
