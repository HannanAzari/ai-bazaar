# AI Bazaar — QA checklist

Manual test pass for the demo build. The running app is **demo mode** (no backend):
auth, the claimed house, likes, follows, collections, notifications, guestbook
entries, reports, events, and activity all live in `localStorage`. Static content
(villages, sample houses) comes from `lib/data.ts`.

Run the gates before a QA pass:

```bash
# Node 20+ required
npm run typecheck && npm run lint && npm run test && npm run build
```

## Routes to test

| Route | Flag | Expected |
|-------|------|----------|
| `/` | — | Hex district map; 10 village hexes + frontier plots; drag to roam; tap a hex → village street |
| `/bazaar/[slug]` | — | Horizontal street of 24 houses; arrows scroll; claim flow on open houses |
| `/shop/[address]` | `ENABLE_ROOM_ENGINE` | Full-screen room; objects clickable; owner/guestbook drawers; corner actions (off → legacy room) |
| `/studio` | — | Owner editor (needs a claimed house); Room engine, exterior, tags, details |
| `/discover` | — | Trending/newest, explore-by-tag, mobile swipe deck, desktop grid/list |
| `/tags` and `/tags/[tag]` | — | Tag search + popular tags; tag detail lists houses & items |
| `/u/[handle]` | `ENABLE_CREATOR_PROFILES` | Avatar, name, handle, bio, links, houses, follower/following, activity/placeholder |
| `/notifications` | `ENABLE_NOTIFICATIONS` | Inbox with read/unread + mark-all; bell badge in header |
| `/collections` | `ENABLE_COLLECTIONS` | Default collections + saved houses; create + remove |
| `/activity` | `ENABLE_ACTIVITY_FEED` | Global activity stream |
| `/assets` | `ENABLE_ASSET_CATALOG` | Internal catalog grid; category/status filters (noindex) |
| `/moderation` | — | Admin reports queue + activity counts; status controls |

When a flag is **off**, its route returns 404 and its UI entry points (bell,
save buttons, guestbook panel, footer links, owner-profile links) disappear.

## Actions to test

| Action | Where | Expected result |
|--------|-------|-----------------|
| Claim a house | `/bazaar/[slug]` open house | Address picker → `/studio`; "My place" appears in header |
| Add a decoration | `/studio` | Item appears in the room; records an `added_decoration` activity |
| Edit place details | `/studio` → details | Saves; records an `updated_house` activity |
| Edit tags | `/studio` → Tags & discovery | Tags persist; appear on profile + tag pages |
| Like a house | card or house page | Heart fills; like count +1; `like` event + `liked_house` activity |
| Follow a creator | house page / profile | Button toggles; `follow` event + `followed_creator` activity |
| Save a house | card (quick) / house page (menu) | Bookmark fills; appears in `/collections`; `saved_to_collection` activity |
| Create a collection | save menu / `/collections` | New collection appears; can save into it |
| Sign a guestbook | house page panel | Note appears; owner gets a `guestbook_entry` notification |
| Hide/delete a note | house page (as owner) | Note hides (dimmed) or is removed |
| Report a note/house/item/owner | guestbook entry / report dialog | Report lands in `/moderation` as `pending` |
| Moderate a report | `/moderation` | Status cycles pending → reviewed → hidden → dismissed; `hidden` soft-hides the house |
| Read a notification | `/notifications` | Toggle read/unread; mark-all clears the bell badge |
| Open a room object | `/shop/[address]` | Object with an action fires it: link → new tab, guestbook → drawer, others → placeholder panel; records `object_click` |
| Edit the room | `/studio` → Room | Add from palette; select an object; change label/action/zone/anchor/scale/layer; hide/duplicate/delete |
| Save the room layout | `/studio` → Room → Save | Persists to `ai-bazaar-rooms`; the public room reflects it |
| Reset the room layout | `/studio` → Room → Reset | Reverts to the derived default room |

## Room editor flow

1. Claim a house, open `/studio`, and the **Room** tab is selected by default.
2. The canvas shows the house's current layout (a default derived from its
   decorations/links until you save your own).
3. Click a palette asset to drop it into the first compatible zone.
4. Click an object in the canvas to select it; the inspector appears on the left.
5. Adjust label, action + URL, zone, anchor spot, scale, and layer; hide,
   duplicate, or delete.
6. **Save layout** to publish; **Reset layout** to revert to the default.
7. Open the house's public page to confirm the room and clickable objects.

## Expected behaviours that look like bugs but aren't

- **Notifications and activity are pre-seeded** the first time the bell / `/activity`
  render, so the feeds are not empty in the demo. Seeding happens once per browser.
- **You can sign your own guestbook.** Single-user demo: the owner acts as the
  visitor, which is how the owner-notification wiring is demonstrated.
- **Following counts on profiles are demo-derived** (stable per handle) since the
  demo does not model who a seed creator follows. Followers come from sample data.
- **Hidden houses** still show their header to the owner; visitors see a "resting"
  notice and the house drops out of discovery and tag pages.
- **Every house already has a furnished room** even before its owner edits one —
  it's derived from the house's decorations and links. Saving in the editor
  replaces that default.
- **Room object actions are placeholders** for `video`/`product`/`booking`/
  `contact`/`gallery` — they open a simple panel, not a real experience yet.
- **`ENABLE_ROOM_ENGINE=false`** falls back to the legacy profile-style room
  (it does not 404 the house page).

## Known limitations (demo mode)

- No real authentication — "Log in" sets a local demo user.
- One claimed house per browser; clearing storage releases it.
- Notifications never arrive from other users (no backend); only seeded + your own
  guestbook signs generate them.
- Activity attributed to "A visitor / guest" when you act without a claimed house.
- Asset catalog is read-only sample data; image URLs are placeholders that do not load.
- No real AI, payments, uploads, or push notifications.

## Reset demo state

Everything is namespaced under `ai-bazaar-*` in `localStorage`. In the browser console:

```js
Object.keys(localStorage)
  .filter((k) => k.startsWith("ai-bazaar-"))
  .forEach((k) => localStorage.removeItem(k));
location.reload();
```

Keys: `ai-bazaar-user`, `ai-bazaar-shop`, `ai-bazaar-world-seen`,
`ai-bazaar-events`, `ai-bazaar-reports`, `ai-bazaar-notifications(+-seeded)`,
`ai-bazaar-guestbook`, `ai-bazaar-collections`, `ai-bazaar-activity(+-seeded)`,
`ai-bazaar-rooms`.

## Automated coverage

`npm run test` (Vitest) covers the pure/storage helpers: tag normalization,
collection save/remove, notification read/unread, report status transitions,
hidden-house filtering, relative-time formatting, and the room engine (schema
creation, zone + placement validation, action-type validation, save/reset
layout). UI flows are still manual.
