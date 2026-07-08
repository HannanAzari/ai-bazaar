# Beta Polish 4 — Discovery Feed (branch `m12-nest-platform`)

> **Preview only.** Shipped on `m12-nest-platform`. **No merge to `main`, no production deploy.**
> **Pure visual polish — no discovery-logic or backend changes.** Goal: make every Nest card feel
> premium. Canonical record; see [changelog.md](changelog.md).

## What changed (`components/nest/app-shell/discovery.tsx` + `nest-preview.tsx`)

- **Typography** — the feed title uses the brand `display` serif at a larger size with tighter leading
  and a soft text-shadow; the creator name is bolder with a shadow; tags are uppercase + tracked. Grid
  card titles enlarged for hierarchy.
- **Spacing** — the feed's bottom stack uses a calmer rhythm (`space-y-3`, `p-5 pb-6`); grid cards get
  `p-3` + `space-y-1.5`.
- **CTA hierarchy** — one **dominant** primary (Visit House / Visit Nest — `flex-1`, larger,
  `shadow-lift`) beside a **quiet** glassy secondary (Peek in / Create — bordered, translucent,
  backdrop-blur). Consistent `rounded-2xl` sizing + tactile `active:scale`.
- **Avatar positioning** — the light-tone creator avatar gains a white **ring + soft shadow** so it
  reads crisply over the room image (feed + grid).
- **Button sizing** — uniform `rounded-2xl`, `py-3`, and clear primary/secondary weights.
- **Lighting / gradient overlays** — a **top scrim** for the source badge, a **deeper multi-stop
  bottom gradient** for legible text, and a soft **vignette** for premium depth (feed); a subtle
  bottom scrim on grid images.
- **Image framing** — grid cards go `rounded-3xl`; the feed stays full-bleed with the room framed
  above the controls.
- **Asset placement (never covers buttons)** — the feed's `NestPreview` safe zone is deepened to
  `safe={{ bottom: 0.34 }}`, so the composed room + furniture stay confined above the action zone and
  **no asset can sit under the CTAs** (`overflow-hidden` clips the stage).
- **Swipe smoothness** — the feed scroller adds `scroll-smooth`, iOS momentum
  (`-webkit-overflow-scrolling: touch`), and `overscroll-y-contain` on top of the existing
  snap-mandatory paging.
- **Loading** — two graceful states: `NestPreview` now **fades its background image in** on load
  (with a `nest-shimmer` placeholder underneath, so no blank pop), and `DiscoveryFeed` shows a
  **full-screen skeleton** for the first ~600ms so the empty state never flashes while discovery
  settles.
- **Source badges** (`Live` / `Example`) get a status dot + ring for a finished look.

## Verification (browser, mobile 375×812)

- Feed cards read premium: serif title (`The Loft`), ringed avatar, uppercase tags, a dominant
  **Visit House** vs a quiet **Peek in** (and **Visit Nest** vs **Create** for curated), vignette +
  deeper gradient, and a green-dot **LIVE** badge.
- **One-Nest paging** still snaps exactly (no peek); the room's furniture stays clear of the buttons.
- Images **fade in** smoothly; the Explore grid matches the premium treatment (`rounded-3xl`, dotted
  badges, larger titles).
- **No console errors.** `typecheck · lint · test (402) · build` all green (Node 20).

## Not changed (as required)

- **Discovery logic + backend untouched.** `lib/nest-discovery.ts` and `use-discovery.ts` are not
  modified; no data, tables, migrations, flags, or dependencies. The loading skeleton is a pure UI
  gate (a 600ms `setTimeout` in the feed component), not a change to how items are assembled.

## Do not accidentally change

- **Keep the feed safe zone ≥ the control-stack height** (`safe bottom 0.34`) so assets never cover
  the CTAs.
- **Tailwind arbitrary-color opacity must be a multiple of 5** (`/70`, `/95`) — non-multiples render
  transparent (a bug fixed in Beta Polish 1).
- The loading **skeleton gate is UI-only** — don't push it into `useDiscovery` / discovery logic.
