# Room Engine — Canonical Specification

The source of truth for all room-engine behavior. This document describes
**product and system behavior only** — not implementation. When code and this
spec disagree, this spec wins (or it must be updated in the same change).

Scope note: "V1"/"V2" mark behavior that exists today; "Future" marks intended
behavior that is reserved but not yet built. Validation and the data model below
apply to all unless stated otherwise. V2 (the Creator Studio) added free
drag/resize, multi-select, undo/redo, autosave, and starter templates **without
changing the visual language, the zone model, or the validation rules**.

---

## 1. Room philosophy

A room is a **personal space a visitor steps into**, not a profile they read. The
room is the primary product surface: it should feel inhabited, expressive of its
owner, and explorable. Interaction happens by **noticing and clicking objects in
the space**, the way you'd pick up things in someone's actual room — not by
scanning a list of links.

Principles:
- The room fills the experience; owner identity and metadata are secondary.
- Every object earns its place: it is decorative, functional, or both.
- Visual consistency comes from a **curated asset library**, never from generated
  art. The room is composed, not synthesized.
- Behavior is **deterministic and predictable** — the same room always looks and
  behaves the same way for everyone.

---

## 2. Room goals

1. A visitor immediately understands "I entered this person's room."
2. An owner can compose a room that represents them, and attach real actions
   (links, media, contact, guestbook) to objects.
3. Every house has a **furnished, interactive room by default**, before its owner
   edits anything.
4. Objects are **discoverable and actionable** — clearly interactive when they do
   something, quietly decorative when they don't.
5. The room is **accessible** (keyboard and screen-reader reachable) and works on
   mobile as an immersive space.
6. The system is **safe to change**: layouts persist, validate, and degrade
   gracefully.

---

## 3. Room object model

The room is a contract of four nested concepts: **Room → Zones → Objects → Actions**.

### Room
A Room belongs to exactly one house and carries:
- **identity** — which house it represents and a display name.
- **kind** — one of: `studio`, `shop`, `gallery`, `lounge`, `standard` (intent/flavour).
- **theme** and **background** — style selectors for the room shell (walls, floor, light).
- **zones** — the placement regions (see §4).
- **objects** — the placed items (below).

### Object
Each object placed in the room has:
- **identity** — a stable id unique within the room.
- **asset** — a reference to a catalog asset (the source of its appearance/category).
- **placement** — the zone it belongs to, an anchor point within that zone, and a
  fine offset (x, y) from the anchor. Free dragging adjusts the offset; the
  rendered centre (anchor + offset) is clamped inside the room bounds.
- **transform** — a uniform scale, an optional explicit box size (width, height),
  rotation, and layer order (z-index). When a box size is absent the object uses
  a base size; when present, scale multiplies it.
- **label** — short human title shown to visitors.
- **action** — an action type and its associated data (see §5).
- **tags** — optional discovery tags.
- **visibility** — a hidden flag (owner can suppress an object without deleting it).

An object's appearance and its base category come from its **asset**; its meaning
and behavior come from its **label + action**.

### Anchors
Anchor points are **normalized positions across the whole room canvas** (not
relative to a zone's box). An object renders at its anchor, adjusted by its fine
offset and transform. This keeps a saved layout stable regardless of how the room
shell is sized.

---

## 4. Room zones

A room has a **fixed template of nine zones**. Zones are semantic regions: they
declare what may go where and how much fits. Each zone defines its allowed asset
categories, its anchor points, and a maximum object count.

| Zone | Purpose | Allowed asset categories | Max objects |
|---|---|---|---|
| `back_wall` | Central wall feature area | decor, wall | 3 |
| `left_wall` | Left wall | decor, wall | 2 |
| `right_wall` | Right wall | decor, wall | 2 |
| `shelf` | Mid-wall shelf line | decor, plant | 3 |
| `window` | Around the window | decor | 1 |
| `floor_left` | Left floor | furniture, plant, structure, floor, stairs, door | 2 |
| `floor_center` | Centre floor (rug area) | furniture, plant, structure, floor, stairs, door | 2 |
| `floor_right` | Right floor | furniture, plant, structure, floor, stairs, door | 2 |
| `door` | Doorway / connectors | structure, door, stairs | 2 |

Rules:
- The nine zones and their constraints are **canonical and shared by every room**.
  Owners place objects into zones; they do not create, delete, or redefine zones.
- Asset categories are: `furniture, wall, floor, plant, lighting, decor, structure,
  door, stairs` (the last two are V4 navigation objects).
- A zone's max-object count is a soft capacity guard, not a layout guarantee.

---

## 5. Action types

An object's **action** defines what happens when a visitor activates it. There are
**eleven** action types. `none` means the object is decorative.

| Action | Visitor outcome | Status |
|---|---|---|
| `link` | Opens a link card (favicon + title + description) then the URL externally | V3 |
| `gallery` | Opens an image-gallery lightbox (multiple images, next/prev, captions) | V3 |
| `video` | Plays an embedded YouTube/Vimeo video (local URL → placeholder) | V3 |
| `product` | Shows a product card (image, title, price) that redirects to the seller — no payments | V3 |
| `booking` | Opens a booking card (Calendly embed or external scheduling link) | V3 |
| `contact` | Opens a unified contact modal (email, website, phone, socials) | V3 |
| `profile` | Opens the house owner's creator profile card (followers, activity, link to full profile) | V3 |
| `room_link` | Moves the visitor to another room in the house (door/stairs); `targetRoomId` names the destination | V4 |
| `guestbook` | Opens the house's guestbook | V1 |
| `collection` | Saves the house/object to the visitor's collection | V1 intent (placeholder panel today) |
| `none` | No action — purely decorative | V1 |

Rules:
- Every interactive activation is **analytics-tracked**: a generic `object_click`
  plus a per-type event (`gallery_opened`, `video_opened`, `product_opened`,
  `booking_opened`, `contact_opened`, `profile_opened`; `link` also records
  `link_click`; `room_link` records `room_link_clicked` and a `room_entered` for
  the destination).
- Actions requiring data (link/video/booking need a URL; gallery needs images;
  product/contact need fields) treat **missing data as inert** — no error, no
  broken click. `guestbook`/`collection`/`profile` need no stored data.
- A visitor experiences these **inside the room** (a modal/lightbox over the room),
  not by being navigated away — except an explicit external "Open"/"View" button.
- Action types are an **enumerated, closed set**. New action types are a spec change.

---

## 6. Placement rules

1. An object may occupy a zone **only if the object's asset category is allowed in
   that zone** and the zone is not at its max object count.
2. Each asset declares the **set of zones it is compatible with**; the editor and
   the system never place an asset outside its compatible zones.
3. When an asset is first placed, it goes to its **first compatible zone with a free
   anchor**, at the asset's default scale and suggested action.
4. Moving an object to a new zone/anchor is allowed **only if the destination
   accepts it** (rule 1); otherwise the move is rejected and the object stays put.
5. Multiple objects may share a zone up to its capacity; anchors disambiguate their
   positions.
6. **Default rooms:** a house with no saved layout shows a furnished room derived
   from the house's existing decorations and links, following the same placement
   rules. Saving a layout replaces the default.
7. **Free positioning (V2):** within its zone an object may be dragged to any fine
   offset from its anchor. The object's centre is always **kept inside the room
   bounds** (it can never be dragged off the canvas). Dragging changes position
   only — it does not change an object's zone, so category/capacity validity is
   preserved.
8. **Templates (V2):** an owner may apply a starter template, which composes a
   furnished room from existing catalog assets under these same rules. Applying a
   template is a normal, undoable edit.

---

## 7. Rendering rules

1. The room renders as a **single composed scene** using the shared room shell
   (walls, floor, window, light). The shell is consistent across all rooms; only
   objects and theme vary.
2. **Public view:** hidden objects are omitted; remaining objects render in
   ascending layer (z-index) order; an object's position, scale, and rotation come
   from its placement and transform.
3. An object is **visibly interactive** when its action is not `none` (an affordance
   cue) and **inert/decorative** otherwise.
4. Objects are **keyboard-focusable and screen-reader labelled** with their label
   and, when actionable, their action.
5. An **empty room** shows a gentle "nothing here yet" state rather than a blank
   canvas.
6. A room belonging to a **moderator-hidden house** is not shown to visitors; a
   neutral "resting" notice is shown instead (ownership and history are preserved).
7. Rendering is **deterministic** — no randomness; the same Room data always
   produces the same scene.

---

## 8. Editor rules

The editor is the owner's tool to compose their room. It is **owner-only** (a
visitor never edits).

1. The owner can **add** an object by choosing an asset from the asset palette; it
   is placed per the placement rules (§6). They may also **apply a starter
   template** (Creator, Photographer, Artist, Developer, Shop, Podcast) that
   furnishes the room from existing catalog assets.
2. The owner can **select** an object in the canvas to edit it, **shift-click** to
   add to a selection, or drag a **selection marquee** over several objects.
3. For a selected object the owner can edit: **label**, **action type and its data**,
   **zone**, **anchor point**, **scale**, **size**, and **layer order**; and can
   **hide**, **duplicate**, or **delete** it. A multi-selection supports batch
   **move**, **delete**, and **layer change**.
4. **Placement is direct manipulation (V2):** objects are **dragged freely** with
   mouse or touch and **resized** with a scale slider or corner handles; the
   zone/anchor selectors remain available as an alternative. Positions are kept
   inside the room bounds (§6.7).
5. **Delete is confirmed** (single or batch) before it removes anything.
6. **Undo / redo** covers add, delete, move, resize, duplicate, layer change, and
   template application, via keyboard (`⌘Z` / `⌘⇧Z`) and on-screen controls.
7. **Save layout** publishes the current composition; an **autosave** also persists
   shortly after edits, with a clear saved / saving / unsaved status.
8. **Reset layout** discards the saved layout and returns the room to its derived
   default.
9. A **Preview mode** shows the room exactly as a visitor would see it, with no
   editing controls.
10. The editor reflects validation immediately: disallowed placements are not
    offered, capacity limits are surfaced rather than silently failing, and an
    out-of-bounds drag or a zero/negative resize is prevented rather than saved.

---

## 9. Validation rules

These hold in both the editor and the system, for both V1 and Future work.

1. **Category–zone compatibility:** an object's asset category must be in the
   destination zone's allowed categories.
2. **Zone capacity:** a zone may not exceed its maximum object count.
3. **Asset–zone compatibility:** an object may only live in a zone listed in its
   asset's compatible zones.
4. **Action validity:** an object's action must be one of the enumerated action
   types; unknown actions are invalid.
5. **Action data:** url-style actions should carry a destination; absent data makes
   the action inert (never an error).
6. **Bounds:** label length, scale, rotation, and box size stay within sane limits;
   an object always references a real anchor in its zone, and its position is kept
   inside the room (a drag can never move it off the canvas).
7. **Size:** an object's width, height, and scale are always positive — a resize to
   zero or a negative value is rejected (no-op), never persisted.
8. **Graceful failure:** any invalid operation is a no-op that leaves the room in a
   valid state — the engine never persists or renders an invalid Room.
9. **Determinism & stability:** validation is pure and side-effect free; identical
   input always yields the identical verdict.

---

## 10. Multi-room houses (V4)

A house is a set of **connected rooms**. Behavior:
- A house owns one or more named rooms, each with its own type, description, and
  object set. The per-room object model, zones, placement, and validation rules
  (§3–§9) apply unchanged to every room.
- Exactly **one room is the entry room** — where a visitor lands. (Modelled as a
  single `entryRoomId` on the house; the entry room can be reassigned but never
  absent.)
- Visitors **move between rooms** by activating connector objects — **doors**
  (`door` category) and **stairs** (`stairs` category) — whose `room_link` action
  carries the `targetRoomId`. Navigation is **immediate and client-side** (no page
  reload, no URL change); the visitor always starts in the entry room.
- A **breadcrumb** shows the path taken (`House › Room › Room`) with a back step;
  it stays subtle so the room remains the focus.
- **Owner room management:** an owner can create (blank or from a room preset),
  rename, retype, set the entry room, and delete rooms. Guards: a house keeps at
  least one room; a room must be emptied of objects before deletion; deleting the
  entry room reassigns entry to another room; deleting a room clears any door
  links that pointed at it; room ids are unique.
- **Validation:** a `room_link` with a missing or unknown `targetRoomId` is inert
  (no navigation, no error).
- **Back-compat:** a house saved before V4 (a single room) is read as a one-room
  house whose only room is the entry room.

---

## 11. Future — AI room designer support

An assistant that helps an owner **compose** a room. Hard rule: it **selects and
arranges existing catalog assets — it never generates visuals**.

Reserved behavior:
- Given a house's tags, theme, and existing content, it **proposes a layout**:
  which assets, in which zones, with which suggested labels/actions.
- All proposals obey the placement and validation rules; the designer cannot create
  an invalid room.
- The owner **reviews and approves** changes; nothing publishes without consent.
- It is deterministic/explainable enough to be testable, and may run as a heuristic
  recommender before any model is involved.

---

## 12. Future — AI room editor support

A conversational way to edit a room ("add a bookshelf by the window", "make the
sofa bigger", "link the TV to my channel").

Reserved behavior:
- Natural-language requests map to the **same bounded set of object operations**
  available in the manual editor (add, move, relabel, set action, scale, layer,
  hide, duplicate, delete).
- Every resulting operation passes the validation rules; impossible requests are
  declined with a clear reason rather than producing an invalid room.
- Like the designer, it **only manipulates catalog assets and existing rooms** — it
  never generates graphics and never bypasses zone/placement/capacity rules.
- Changes are previewable and owner-approved before publishing.

---

## Change control

This spec is canonical. Changing room behavior — new zones, new action types,
new placement/validation rules, or multi-room/AI behavior — means **updating this
document in the same change**, and recording the rationale in
[decision-log.md](decision-log.md).
