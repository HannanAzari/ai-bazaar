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

When a flag is off, its route returns 404 and its UI entry points are hidden.

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
9. Run the updated `supabase/seed.sql` (adds a starter tag vocabulary).

The two-step enum split (in both `20260611_*` and `20260612_*`) is required: PostgreSQL will not let a single transaction add an enum value and then use it, so new enum values are committed in `_01` before `_02` references them.

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
  shop/[address]/        Public house interior (room + guestbook)
  studio/                Resident room editor (interior, exterior, tags)
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
  assets.ts              Sample asset catalog data
supabase/
  schema.sql             Tables, policies, triggers, and constraints
  seed.sql               Ten villages, 240 houses, starter tags
  migrations/            Ordered, idempotent project migrations
```
