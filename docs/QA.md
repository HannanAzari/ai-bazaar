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
| Open a room object | `/shop/[address]` | Object fires its real panel: gallery → lightbox, video → embedded player, link → favicon card → external, product → redirect card, booking → Calendly/external, contact → email/website/phone/socials, profile → creator card, guestbook → drawer; records `object_click` + a `*_opened` event |
| Hover/focus an object | `/shop/[address]` | Tooltip shows the object's title, description, and owner |
| See room insights | `/studio` → Room | Owner panel shows total object clicks, most-clicked object, popular object type |
| Apply a room template | `/studio` → Room → a template | Room fills with that template's objects; records `room_template_applied`; undoable |
| Edit the room | `/studio` → Room | Add from palette; select an object; change label/action/zone/anchor/scale/layer; hide/duplicate/delete |
| Drag an object | `/studio` → Room (Edit) | Object follows the pointer (mouse or touch), stays inside the room; records `room_object_moved` |
| Resize an object | `/studio` → Room (Edit) | Scale slider or corner handles change its size; records `room_object_resized` |
| Multi-select | `/studio` → Room (Edit) | Shift-click or drag a box over objects; batch move/delete/layer in the panel |
| Delete an object | `/studio` → Room (Edit) | Confirmation dialog appears; confirming removes it; records `room_object_deleted` |
| Undo / redo | `/studio` → Room (Edit) | `⌘Z` / `⌘⇧Z` or the toolbar buttons step through edits |
| Preview the room | `/studio` → Room → Preview | Shows the room as visitors see it; editing controls are disabled |
| Autosave | `/studio` → Room | Status shows Saved → Unsaved → Saving → Saved ~5s after edits, without pressing Save |
| Create a room | `/studio` → Room manager → Blank room / preset | Adds a room (preset rooms come furnished); becomes active; records `room_created` |
| Set entry room / rename / retype | `/studio` → Room manager | Entry star moves; name/type update; one entry room always |
| Delete a room | `/studio` → Room manager → trash | Blocked for the last room or a room with objects (reason shown); else confirm → removed (`room_deleted`); doors that pointed at it are cleared |
| Add a door / stairs | `/studio` → palette → Door/Stairs → pick target room | Object placed; inspector "Go to room" sets `targetRoomId` |
| Walk through rooms | `/shop/[address]` | Clicking a door/stairs switches rooms instantly (no reload); breadcrumb + back update; records `room_link_clicked` + `room_entered` |
| Save the house | `/studio` → Room → Save house | Persists all rooms to `ai-bazaar-rooms`; the public house reflects it |
| Reset the house | `/studio` → Room → Reset house | Reverts to the derived single-room default |

## Room editor flow (Creator Studio)

1. Claim a house, open `/studio`, and the **Room** tab is selected by default.
2. The canvas shows the house's current layout (a default derived from its
   decorations/links until you save your own).
3. Optionally **apply a template** (Creator / Photographer / Artist / Developer /
   Shop / Podcast) to furnish the room from existing assets.
4. Click a palette asset to drop it into the first compatible zone.
5. **Drag** an object to reposition it (it stays inside the room); **resize** it
   with the scale slider or the corner handles when selected.
6. Click an object to select it (inspector on the left); **shift-click** or drag a
   **selection box** to select several and batch move / delete / change layers.
7. Adjust label, action + URL, zone, anchor spot, scale, and layer (Forward /
   Backward); hide, duplicate, or delete (delete is confirmed).
8. **Undo / redo** with `⌘Z` / `⌘⇧Z` or the toolbar buttons.
9. **Multi-room (V4):** use the **Room manager** to add rooms (blank or a preset),
   rename/retype them, set the entry room, switch the active room, or delete one
   (guarded). Add a **Door** or **Stairs** object and pick its target room so
   visitors can move between rooms.
10. **Undo / redo** with `⌘Z` / `⌘⇧Z` works across the whole house (object edits
    and room create/delete).
11. **Autosave** persists ~5s after changes (watch the status); or press
    **Save house** to publish immediately; **Reset house** reverts to the default.
12. Toggle **Preview** to see the room as visitors do (doors navigate), then open
    the house's public page to confirm the rooms, breadcrumb, and clickable objects.

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
- **Room object panels load third-party content** (V3): YouTube/Vimeo embeds,
  Calendly, favicons, and sample preset images come from external services, so
  they need a network connection and won't render offline. An object with missing
  data shows a gentle empty state rather than erroring.
- **Applying a preset populates working sample content** (real gallery images, a
  video, a product, a contact, a profile) — owners replace it with their own.
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

`npm run test` (Vitest, 60 tests) covers the pure/storage helpers: tag
normalization, collection save/remove, notification read/unread, report status
transitions, hidden-house filtering, relative-time formatting, the room engine
(schema creation, zone + placement validation, action-type validation, save/reset
layout, free-drag bounds, resize validation, undo/redo history, template
generation), the **V3 interactive objects** (gallery/video/product/contact
validation, URL/favicon helpers, `hasActionData`, and analytics tracking), and the
**V4 multi-room houses** (`test/house.test.ts`: room create/delete with entry +
object guards, entry validation, door-target validation, persistence incl. legacy
single-room migration, duplicate-id guard, and navigation analytics). UI flows are
still manual.
