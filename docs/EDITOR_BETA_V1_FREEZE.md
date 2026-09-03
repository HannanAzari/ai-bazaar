# Editor Beta v1 — Freeze

**Tag:** `editor-beta-v1` · **Branch:** `m12-nest-platform` · **Date:** 2026-08-11

This document closes the Nestudio editor line. It records what is frozen, what the contracts
are, and what was deliberately left undone. It is written for whoever resumes this work —
possibly months from now, possibly not me.

Read it with `docs/handoff/README.md` and `docs/design/NESTUDIO_WORLD_BIBLE.md`.

---

## What "frozen" means here

Frozen means: **do not redesign these without a deliberate decision to reopen them.** They are
not perfect. They are settled, tested, and verified on device widths, and each one cost at
least one sprint to get right. Changing one usually breaks another — the list below exists
because that already happened, repeatedly.

---

## 1. The canonical 3:4 scene — FROZEN

The Nest is authored and rendered in one coordinate system: a 3:4 scene, normalised `0..1`.

- Object geometry is stored as the creator's **actual box** (`x, y, w, h`), not a scale to
  re-derive it from. `scale` is still written for backwards compatibility and is *not* what
  geometry is rebuilt from.
- The **Stage** (`NestStage` / `NestViewport`) is the app environment *around* the room. It is
  never part of the document, so it can be redesigned freely without touching a published Nest.
- The camera is a viewport transform, **not scene data**. It is never persisted.

Do not change the aspect, the normalisation, or where geometry lives.

## 2. Gesture ownership — FROZEN

There is exactly **one pointer pipeline**: `components/nest/app-shell/use-scene-camera.ts`.
Nothing else attaches a pointer listener. The runtime has zero `addEventListener("pointer…")`.

The one-owner rule:

| owner | who | when |
|---|---|---|
| camera | `use-scene-camera` | default; pinch/pan; taps that no host claimed |
| object | editor arbiter | pointer starts on a selected/selectable object in Edit |
| media | runtime arbiter | one finger, inside an aperture, on an object with ≥2 items |

Rules that must not be relitigated:

- **Two fingers are never a swipe.** A host may *hand back* the session when a second pointer
  lands (`if (hostOwns && !claimed) hostOwns = false;`) — this is what lets a pinch that starts
  on a photo frame still zoom the room.
- **`upgradeGesture` never lets OBJECT become CAMERA.** An object mid-drag cannot be stolen.
- **Taps on `[data-editor-chrome]` are ignored** by the gesture layer. This is the M26-S1 fix
  for pointer capture killing every toolbar button. A control that forgets to be inside that
  marker will be dead to a finger.
- A host claim that never became a drag is **still a tap**, or claiming would silently eat taps.

## 3. Editor stage & layout — FROZEN

- The editor Nest is the **same width as the Home feed** (M27A.1 — two stacked insets used to
  make it 30px narrower).
- **One foreground contract:** a sheet or modal owns the entire foreground. One boolean
  (`sheetOpen`), asked by every canvas control. A new sheet joins that list and every control
  obeys it without being touched.
- Selection and editing are separate: **first tap selects, second tap edits** (`onReselect`).
  This is why Text/Sticker get a selection frame, handles and a toolbar like everything else.

### Layering — one file, no exceptions

`lib/nest-layers.ts` is the only place a stacking value is decided.

```
room 0 · objects 10 · hotspots 20 · scrim 30 · chrome 40 · nav 50
drawer 60 · modal 70 · toast 80 · editor 110 · player 120
```

`toast` is the last word **inside a page**. `editor` and `player` are full-screen surfaces
that cover the app; they are above it. The player is above the editor because it must be
reachable from the editor's own Preview.

> This list gained its last two entries because the editor shell carried a bare `z-[110]`
> that the layer file had never heard of. The media player portalled to `<body>` at `modal`,
> laid out and hit-tested correctly, and was **painted underneath the editor**. Found with
> `elementsFromPoint`; reading the code would never have shown it. If something stacks, it
> goes in this file.

## 4. `contents[]` — the canonical Connected Content model — FROZEN

```ts
assetInteraction: {
  contents?: ConnectedContent[];   // the creator's list, in the creator's order
  activeIndex?: number;            // only when the creator actually chose a cover
  connection?: ConnectedContent;   // @deprecated — read for compatibility, never written
}
```

- **`resolveContents()` is THE boundary.** It normalises the legacy single `connection` into
  `contents[0]`. Nothing downstream ever learns which shape a stored document used.
- Unusable items are **dropped, not kept as holes** — a hole leaves an index pointing at nothing.
- `providerId` (e.g. the YouTube id) is **resolved once, here**, and re-derived on every read.
  Nothing downstream parses a URL, and a hand-edited stored value cannot reach an `<iframe>`.
- `activeIndex` is never invented. Adding or reordering items must not silently pin a cover the
  creator did not choose — position 0 stays authoritative until they do.

Persisted in the existing `nest_objects.interaction` jsonb bag under `interaction.asset`.
No migration was ever needed for any of it.

## 5. The shared display resolver — FROZEN

`lib/nest-object-display.ts` — `placementDisplayContent(placement, state, mode, contentIndex?)`
is the **one** function that decides what is drawn on an object's screen, for every surface:
editor, Preview, Home card, and the published visitor Nest.

There is no per-surface display logic. If a surface looks different, the bug is in the input,
not in a second renderer — because there isn't one.

## 6. Frame multi-photo behaviour — FROZEN

- A Framed Photo shows `contents[0]` **immediately, with no tap**. Its catalogue state is
  `shown`; it has no `toggleTo` and therefore no on/off machine.
- **Swipe** inside the aperture changes the photo. Left = next. Wraps both ways.
- Threshold `SWIPE_THRESHOLD_PX = 24`, and the drag must be **dominantly horizontal**
  (`|dx| > |dy|`) — inside an aperture a few dozen pixels tall, a diagonal is far more likely
  to be a page scroll, and stealing it would break the visitor's scroll.
- The visual state and the content index are **different ideas** and must stay apart. The
  content index is session-only and universal; the visual state is per-asset and owned by the
  catalogue.
- A stale index **clamps**; it never blanks the frame.

> **Extended by M28.1** — a frame photo may now carry an optional per-item `crop`
> (`{x, y, zoom}`), and a tap on a frame opens the photo gallery. Neither changes anything
> above. See §11.

## 7. TV behaviour — FROZEN

```
OFF  --tap-->  ON (thumbnail)  --tap-->  playback requested
                 \--swipe--> next item, screen stays on
```

- The **runtime owns this progression**, not the catalogue's `toggleTo`. `toggleTo` still
  describes the asset (a TV has two looks); it no longer decides what a tap means.
- The first tap opens **nothing** — no modal, no navigation. Turning something on and starting
  it are different intentions.
- Gated on `screenSurfaceId && toggleTo && contents.length`, so anything without a state
  machine (a photo frame) falls through untouched.

## 8. Media player behaviour — FROZEN

`lib/nest-player.ts` (pure) + `components/nest/app-shell/nest-media-player.tsx`.

- **ONE INDEX.** The player holds no cursor. It renders the runtime's `contentIndex` — the same
  map the television reads and a swipe writes. Next in the player and a swipe on the TV are the
  same write, so they cannot drift. A second index would be a bug waiting for a sprint.
- **ONE ELEMENT.** The mini bar and the expanded surface are one tree with two sets of classes.
  React keeps the `<iframe>` mounted across the change, so expanding does not restart the video.
  Two components — or the same component behind a ternary — would remount it.
- **Mini bar:** 60px, safe-area aware, clears the app's bottom nav by *measuring*
  `nav[aria-label="Primary"]` rather than taking a prop each surface could forget.
- **Closing rule, in one place:** *collapse ≠ stop.* Leaving the expanded player returns to the
  mini bar and keeps playing; only the mini bar's × ends playback.
- **The room is not touched.** Nothing in the player path reads, writes or restores the camera,
  and nothing writes object state. Open/close preserves zoom, pan, ON state and current item
  *by construction* — there is no code there able to break it.
- Playback stays inside Nestudio (`youtube-nocookie`, `playsinline=1`, `enablejsapi=1`).
  External "Open in YouTube" is secondary and **never** automatic — an autoplay a browser
  blocked must not become a redirect.

The legacy `MediaOverlay` still exists for `open-url` on pre-M25 Nests. The TV never reaches it.

## 9. Storage bucket / path contract — FROZEN (⚠️ not yet provisioned)

Bucket **`nest-media`**, defined by `supabase/provision/m27a_media_storage.sql`:
public read, 25 MB limit, `image/jpeg · image/png · image/webp · video/mp4 · video/webm`.

**Object key — this shape is load-bearing:**

```
<ownerId>/<nestId>/<objectId>/<mediaId>.<ext>
```

The **first segment must be the owner's uid**, because every RLS policy keys ownership off
`(storage.foldername(name))[1] = auth.uid()::text`. Change the shape and the policies silently
stop matching — a data-access bug, not a naming preference. Segments are sanitised so no
separator can be introduced.

Rules: a document holds a **reference, never the media**. `storagePath` travels with the
reference so removal can clean up the object. `assertNoInlineMedia` fails loudly rather than
letting a `data:` URL be written. **There is no base64 fallback anywhere, on purpose.**

### ⚠️ Status at freeze

**The migration has NOT been applied.** Verified three ways against the live project on
2026-08-11: bucket list `200 []`, `GET /storage/v1/bucket/nest-media` → `NoSuchBucket`, public
object read → `NoSuchKey`.

Consequently **no real upload has ever been exercised, on any device, in the history of this
project.** Everything media-related has been verified with URL-connected content. Run:

```bash
node scripts/verify-nest-media.mjs
```

It exits non-zero with the reason until the SQL is applied, then checks the bucket shape,
anonymous read, and that anonymous write is refused.

## 10. Video: the iPhone reality — guarded, not solved

Two failure shapes, and only one is visible to a MIME check:

1. A camera-roll **.MOV** arrives as `video/quicktime` → rejected before any bytes leave the
   phone.
2. A "compatible" iPhone recording arrives as **`video/mp4` but may be HEVC/H.265 inside**. The
   MIME check passes it. It would upload, store, and then fail to decode in Chrome and Firefox —
   the creator's Nest broken for everyone but them, with nothing ever saying so.

The container does not name the codec, so no string check finds case 2. The browser already
knows: `videoPlaybackRejection()` hands the file to a `<video>` element and waits. Metadata with
real dimensions ⇒ playable; error ⇒ rejected **before** the upload. One element, no library, no
server, no conversion. It fails *open* without a DOM so nothing server-side is affected.

Message: `This video format isn't supported yet. Use MP4 or connect a YouTube video.`

Measured in Chromium: `canPlayType('video/mp4; codecs="hvc1"')` → `""`,
`canPlayType('video/quicktime')` → `""`. **Transcoding is post-beta.** This guard is what makes
not having it honest.


## 11. M28.1 — per-photo crop, and the gallery (added after the freeze)

Two additions to the frame, made under the freeze rather than around it.

**Crop.** Each image item may carry `crop: { x, y, zoom }` — a normalised focal point with
CSS `object-position` semantics, and a zoom that is never below 1. Absent ⇒ nothing is
written to the DOM at all, so every photo published before M28.1 renders byte-identically.
`lib/nest-media-crop.ts` owns the whole model; `mediaCropStyle()` is the ONLY producer of
the style, and the editor canvas and the runtime both call it with the value the shared
display resolver carried. There is still no per-surface display logic (§5).

The covering invariant: for `x, y ∈ [0,1]` and `zoom ≥ 1` the aperture is always fully
covered, because the content's offset is exactly `-x · (zoom · coverWidth − apertureWidth)`
on each axis. Clamping in `normaliseCrop` is therefore the entire safety argument — there is
no separate validity check, and a corrupt stored value cannot open a gutter in a mount.

The stored file is **never** re-encoded or replaced. Adjust is presentation, and reversible
forever; Reset deletes the field rather than storing the default.

**Gallery.** `components/nest/app-shell/nest-photo-gallery.tsx`. A tap on a frame — which
previously did nothing, because `contentInteraction` correctly returns null for an image on
an object that has a screen — opens the photograph full-size, `contain`, over a dimmed and
blurred room. It inherits the player's three rules verbatim: **no index of its own** (it
renders and writes the runtime's `contentIndex`, so the frame beneath it cannot drift), **the
room is not touched** (nothing there reads, writes or restores the camera), and it portals to
`<body>` at `LAYER.player`.

> That last one bit again, exactly as §3 warns. The gallery first imported `z` — the map of
> Tailwind CLASS strings — and used it as `style.zIndex`. The computed value came back
> `auto`, which would have stacked the gallery by DOM order and painted it **under the editor
> shell** in Preview. Invisible in review; found by reading `getComputedStyle` in a browser.
> Use `LAYER` for a number and `z` for a class, and measure.

Home is unchanged and stays non-interactive (`interactive={false}` ⇒ `mode="card"`), and Edit
is unchanged: a tap still selects the object, and crop is authored through Connect → Adjust.

---

## Verified at freeze

Driven through the real UI at 375×812, 390×844 and 430×932 — real Assets tray, real Connect
panel, real publish, real visitor Nest (`/nest/m27c-frame-proof-irof36`).

- Published Nest with **TV + Framed Photo + 3 frame images** contains **both objects** after a
  visitor reload, frame showing photo 1 of 3.
- Frame: swipe **A → B → C**; pinch starting on the frame still zooms the camera; photo
  unchanged by the pinch.
- TV: OFF → tap → ON thumbnail → swipe playlist → second tap → mini player (`z=120`) → expand →
  Next (player **and** TV move together) → collapse → stop → **TV still ON showing the item the
  player ended on**, camera byte-identical to before opening.
- Reload: frame returns to the creator's item 1, TV returns to OFF — **the visitor's position is
  never persisted**.
- Persistence: Save draft → leave the editor → reopen ⇒ geometry and `contents[]`
  **byte-identical**.
- Editor: one-finger move, two-finger resize/rotate with live degree readout, Mirror, Lock,
  Connect, camera pinch/pan, Edit↔Preview transform parity (rotation + mirror, computed styles).
- Gates: typecheck ✓ · lint **0 errors** ✓ · **1516 tests / 115 files** ✓ · production build ✓.

---

## Deferred — explicitly NOT blockers

- Permanent / baked asset locking
- Speakers and music
- Laptop, book and console behaviours
- Universal video transcoding (see §10 — guarded instead)
- A richer photo gallery
- Home-feed direct interactivity (see below)
- Further editor redesign

### Home is intentionally not interactive

The feed passes `interactive={false}` → `mode="card"`. Measured: **zero tap targets**,
`touch-action: auto`, and the room wrapped in a `<Link>` to the visitor Nest. On Home a Nest is
a poster you tap to enter, not a runtime you drive. This is a product decision, not an
oversight; whether the feed should become interactive is a future call.

### Known rough edges, recorded rather than fixed

Real, reproduced, and deliberately left alone under the freeze:

1. **Every newly added asset lands at the same default position.** Add three assets and you get
   a concentric pile that must be dragged apart one at a time. This is authoring friction, and
   it is also what made two of my own test fixtures invalid — including the "the published
   Framed Photo disappeared" report in M27B-3B, which was never a product defect (see below).
2. **A selected object's floating toolbar can cover a smaller object behind it.** Its buttons
   live in `[data-editor-chrome]`, which the gesture layer ignores by design, so a tap there
   does nothing for the object underneath. Tapping a part of the object not under the toolbar
   selects it normally. Arguably correct (a visible toolbar is there), but worth revisiting.
3. **A decorative asset painted over an interactive one blocks its gestures.** The media arbiter
   needs `closest('[data-object-id]')`, and non-interactive assets carry no such marker in the
   runtime, so a large sofa in front of a photo frame silently makes the frame unswipeable.

### Corrections to earlier reports

- **M27B-3B: "the published Framed Photo did not survive publish" — WRONG.** Publish, persist
  and the visitor read are all lossless; the mandatory acceptance passes. The fixture was
  malformed (§1 above, plus a Connect sheet that had never closed, so every "connect the frame"
  wrote to the television).
- **M27B-3B: "`/create` template cards silently fail" — WRONG.** The card is a *selector*;
  creation is the explicit "Start building →" action, which only renders once a template is
  chosen ("Tap a room to choose it." otherwise). Verified: it opens the correct draft, and three
  taps in 120ms create exactly one Nest.

---

## Resuming

1. Apply `supabase/provision/m27a_media_storage.sql`, then `node scripts/verify-nest-media.mjs`.
2. Only then is the real photo-upload path (P1 of M27C) testable. It has never run.
3. Clear the Vercel billing block on `ai-bazaar` (`402 DEPLOYMENT_DISABLED`) before claiming
   anything is deployed.
4. Then follow `docs/handoff/06_NEXT_SPRINT.md` — Sprint 0 is exactly steps 1–3 above plus the
   first real upload→publish→visitor acceptance run; the launch line after it is D44.
   (The Avatar Golden Reference track is closed — do not resume it.)
