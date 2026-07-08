# Beta Polish 1 — Fullscreen Experience (branch `m12-nest-platform`)

> **Preview only.** Shipped on `m12-nest-platform`. **No merge to `main`, no production deploy.**
> **Pure UX/layout polish — no new features.** Goal: Nestudio should feel like a native mobile app,
> not a scrolling website — every Nest surface is **one phone screen** with no page scroll, and
> furniture can never overlap the UI. No changes to village / editor / publishing / auth / discovery
> logic. Canonical record; see [changelog.md](changelog.md).

## What changed (layout only)

### 1. Home feed — true vertical paging
`DiscoveryFeed` (`components/nest/app-shell/discovery.tsx`) is now **snap-mandatory one-Nest-per-
viewport paging**: the scroller is `snap-y snap-mandatory` and each `FeedCard` / `CreateCard` is
`h-full w-full snap-start snap-always` with **no `space-y` gap** and full-bleed (no rounding/border).
Exactly one Nest fills the screen; **no part of the next card is visible** (TikTok/Reels). The room
stays static — only the page changes. Home header compacted to one line; the feed is edge-to-edge.

### 2. Visitor Nest — single screen
`NestVisitorClient` (`app/nest/[slug]/visitor-client.tsx`) is a fixed `h-[100dvh]` **flex column,
`overflow-hidden`** — no page scroll:
- **Top:** creator identity (badge → `/@handle`) + Exit.
- **Center (`flex-1`):** the composed room fills the space; title + tags overlay its base.
- **Bottom:** like · comment · share + Follow, then Create your own / Wander Nests.

### 3. Owner Nest — single screen
Same fixed layout; the bottom is the owner console — **Views · Likes · Comments · Followers** (4-up)
+ **Edit Nest** — all on one screen, no scroll.

### 4. Asset safe zones (no overlap)
`NestPreview` gains an optional **`safe={{ top?, bottom? }}`** inset. When set, the whole room *stage*
(background **and** furniture together, so nothing detaches from the floor) is confined to a band via
an inset, absolutely-positioned, `overflow-hidden` inner container — the reserved top/bottom bands
become UI zones that **furniture can never enter** (anything that would spill is clipped). Applied to
the feed (`safe={{ bottom: 0.3 }}`) and the visitor room (`safe={{ bottom: 0.12 }}`); the visitor/
owner flex layouts additionally reserve their action zones **by construction** (the room is a bounded
middle region, the buttons are separate flex rows).

## Fixed

- The feed caption gradient used **invalid Tailwind opacity steps** (`/92`, `/45` are not multiples of
  5 → the stops rendered transparent), leaving white overlay text on a light background. Restored to
  valid steps (`/95`, `/60`) so captions stay legible over the room + safe zone.

## Verification (browser, mobile 375×812)

- **Home feed:** paging snaps to exactly one Nest per screen (published + curated), **no peek** of the
  adjacent card; the composed room fills the page and furniture stays clear of the caption/action
  zone; captions legible on the warm dark gradient.
- **Visitor Nest:** `scrollHeight == innerHeight` (812) — **no scroll**; identity/room/actions all fit.
- **Owner Nest:** `scrollHeight == 812` — **no scroll**; the 4 stats + Edit Nest fit one screen.
- **No console errors.** `typecheck · lint · test (402) · build` all green (Node 20).

## Not changed (as required)

- **Village**, **editor**, **publishing**, **authentication**, and **discovery logic** are untouched —
  this sprint only re-flows layout. `NestPreview` without `safe` (Explore grid, profile "Rooms", cards)
  renders exactly as before (the prop is optional + defaults to the old full-bleed behaviour).

## Known limitations / notes

- On the feed, furniture is confined to the room band; if a creator placed objects extremely low, the
  bottom of those objects is clipped by the safe zone rather than shown behind the buttons (intended).
- Owner/visitor footers are sized for phone viewports; very short viewports (< ~600px) rely on the
  compact spacing — still no scroll, but content is dense.

## Do not accidentally change

- **Tailwind opacity steps must be multiples of 5** for arbitrary colors (`from-[#..]/95`), or the
  gradient stop silently renders transparent (this bug shipped and was caught in verification).
- **`NestPreview safe` insets the whole stage** (bg + furniture together) — never inset furniture
  alone, or objects detach from the floor.
- Keep each Nest surface a **fixed `h-[100dvh]` non-scrolling** container; don't reintroduce
  `min-h-[100dvh]` + document flow (that brings back page scroll).
