# M21 — Navigation & User Journey Audit

> Walked every journey as a first-time user. Small/medium friction **fixed in this sprint**;
> anything structural is **explained, not implemented**. No new systems introduced.
> Gates: **typecheck · lint (0 errors) · 675 tests** green. **Not committed.**

Severity: 🔴 breaks the journey · 🟠 real friction · 🟡 polish · ⚪ noted

---

## Findings

| # | Sev | Problem | Where | Recommendation | Status |
|---|---|---|---|---|---|
| **N-01** | 🔴 | **Sign-up dead-ends.** New account → `/onboarding` (pre-pivot shop funnel) → finishes with `router.push('/shop/<address>')` → `next.config` redirects `/shop/*` → `/home`. The user does onboarding work and lands on the feed **with nothing to show for it**. | `app/auth/sign-up`, `app/onboarding` | Sign-up lands in the canonical Create journey; `/onboarding` forwards there too so the broken funnel is unreachable. | **FIXED** |
| **N-02** | 🔴 | **Create offers a path that 403s.** "Turn your object into a Nestudio asset" → `/creator-studio`, which has no page gate but whose APIs call `requireFounder`. A normal user picks it, writes a description, *then* is refused. | `app/create` | Ask `/api/auth/whoami` and only show the card when it will work. | **FIXED** |
| **N-03** | 🟡 | **Doubled browser titles** — "Asset Factory · Nestudio · Nestudio". Root layout has `template: "%s · Nestudio"` and 12 pages also hard-coded the suffix. | 12 pages | Drop the suffix from page metadata; let the template own it. | **FIXED** |
| **N-04** | 🟠 | **Username claim asked twice** — once on Profile, again mid-publish in the editor's PublishGate. The second one interrupts the moment of publishing. | `publish-gate.tsx` | Reduce the gate to "Set your @handle in Profile →" so a handle is claimed in exactly one place. | **DEFERRED** (editor surface; explained below) |
| **N-05** | 🟠 | **Home and Explore are both "discovery"** with the same Village pill and overlapping content — two tabs answering one question. | `/home`, `/explore` | Merge, or give Explore a distinct job (search/tags only). IA change → founder call. | **DEFERRED** (explained below) |
| **N-06** | 🟠 | **A shared Nest link only resolves for its author** on the default local backend unless the `?c=` payload rides along; `followers`/`private` produce bare slugs that show "private" to everyone else. | `nest-repo`, viewer | Turn on the Supabase Nest backend, or scope Beta to `?c=` links honestly. | **DEFERRED** (backend decision, Day-1 §7) |
| **N-07** | 🟠 | **Password rule mismatch** — inputs say "At least 6 characters" (`minLength={6}`) but `validatePassword` demands 8. A 6-char password passes the field and fails on submit. | login + sign-up | Align copy + `minLength` to 8. | **FIXED** |
| **N-08** | 🟡 | **Two chromes.** Auth pages render the legacy V1 `SiteHeader` (logo · Explore · avatar); everything else uses the 5-tab app shell. Signing in feels like leaving the app. | `site-header.tsx` | Hide the V1 header on `/auth/*` so auth sits inside the same world. | **FIXED** |
| **N-09** | 🟡 | **Back affordances are inconsistent** — `ChevronLeft` pill ("The village"), bare `ArrowLeft` icon (Avatar Studio, benches), browser-only back (some sheets). Different icons, sizes and labels for the same intent. | multiple | Standardise on the labelled `ChevronLeft` pill where a destination exists. | **PARTIAL** (profile surfaces unified; benches deferred) |
| **N-10** | 🟡 | **Dev badge overlaps the Home tab** on mobile ("LIVE · SUPABASE" sits on the first nav item). Dev-only, but it obscures a primary control while testing. | `dev-mode-badge` | Move it above the nav / behind a long-press. | **DEFERRED** (dev-only; cosmetic) |
| **N-11** | ⚪ | **No Settings/account surface.** Sign-out lives in a Profile overflow; there is no account deletion, email change, or notification preference anywhere. | — | Beta needs a minimal account screen. | **DEFERRED** (new surface = feature) |
| **N-12** | ⚪ | **Legacy V1 island still compiles** (`/bazaar`, `/discover`, `/tags`, `/collections`, `/activity`, `/u/[handle]`, `/assets`, `/village-lab`…). Unreachable from primary nav, but ~40% of routes. | many | Delete per Day-1 remove-list. | **DEFERRED** (explicitly a separate sprint) |

---

## Journey 1 — Guest → Landing → Explore → Village → Profile → House → Nest → Sign-up

**Works:** `/` → `/home` immediately; the feed's whole card is tappable; Village pill is consistent
on Home + Explore; House → **Enter Nests** is a single obvious CTA; inside a Nest the creator chip
opens the hub drawer and Exit returns along history.

**Fixed this sprint:** N-03 (titles).

**Remaining friction:** N-05 (Home ≈ Explore), N-06 (shared links). No dead ends found otherwise —
every gate (`Nest not found` / `private`) offers two ways onward, and the auth prompt is now the
centred modal from M20 rather than a sheet pinned to the top.

## Journey 2 — Sign up → profile → avatar → links → bio → first Nest → publish → home

**This journey was broken at step 1** (N-01) and has been repaired: sign-up now goes straight into
Create → template → editor → publish → `/nest/<slug>`, and `/onboarding` forwards to the same place.

**Merged steps (no new UI):** profile, avatar, links and bio are *not* separate onboarding steps —
they already live in one compact identity box (avatar tap → avatar modal; one Edit sheet holds
name, bio and unlimited links). Nothing was added; the previous multi-step funnel simply isn't
used any more.

**Fixed:** N-01, N-02, N-07.
**Still exposed:** the publish gate asks for a username mid-flow (N-04).

## Journey 3 — Returning creator → notifications → profile → edit → publish → visit houses → home

**Works:** Notifications badge clears on open; rows deep-link to the Nest or the creator; Profile
lists Drafts/Published with clear status chips and taps straight into the editor; the Nest viewer's
owner actions (Edit · View House · Stats) keep management inside the immersive view; the drawer's
Nest list is now a real switcher.

**Friction:** publishing still interrupts with the username claim (N-04); no "publish changes"
shortcut from the Profile list — you go through the editor (acceptable, noted).

---

## Fixes applied

1. **N-01** — `app/auth/sign-up/page.tsx` → `/create`; `app/onboarding/page.tsx` is now a redirect
   to `/create`. The legacy implementation is preserved beside it as
   `legacy-shop-onboarding.tsx.bak` (not deleted — Day-1 rule).
2. **N-02** — `/create` asks `whoami` and hides the AI card from non-founders.
3. **N-03** — removed the duplicated `· Nestudio` suffix from 12 pages.
4. **N-07** — login + sign-up now say **"At least 8 characters"** with `minLength={8}`, matching the
   backend rule.
5. **N-08** — the legacy `SiteHeader` no longer renders on `/auth/*`.
6. **N-09 (partial)** — profile/arrival surfaces share one labelled `ChevronLeft` pill via
   `TopControls`; founder benches still use a bare `ArrowLeft` (left alone — internal tools).

## Major recommendations — explained, NOT implemented

**A. Collapse the username claim to one place (N-04).** The PublishGate's claim step exists because
publishing needs a handle. Better: Profile owns handle-claiming, and the gate shows a one-line
"Set your @handle in Profile →". *Why not now:* it touches the editor's publish flow, which this
sprint's scope excludes and which is the most delicate path in the app. Small change, real risk —
worth doing deliberately.

**B. Merge Home and Explore (N-05).** They answer the same question. Options: (i) one Discover tab
with a search affordance, freeing a nav slot; (ii) keep both but make Explore search-only. This is
an information-architecture decision and changes the 5-tab bar — explicitly your call.

**C. Decide the persistence story (N-06).** Until the Supabase Nest backend is on, a "share" is only
truly shareable when it carries the `?c=` payload. Either enable it for the Nest loop or state the
Beta limitation in the publish success copy. Backend decision, not navigation.

**D. Delete the legacy island (N-12).** ~40% of routes are unreachable but still compile, still
appear in search, and still confuse anyone reading the codebase. Day-1 has the remove-list; it
deserves its own sprint with a typecheck-driven cleanup.

---

## Consistency, empty states, gestures, a11y

**Visual:** modals now share one component (`CenteredModal`) — radius, padding, backdrop and close
button are identical for auth, avatar-editor and avatar-preview. Sheets share `BottomSheet` (handle
centred on its own row since 3.4). Remaining drift: founder benches use their own neutral styling
(intentional — internal), and the editor has its own toolbar language (frozen surface).

**Empty states:** Home, Explore, Profile, Notifications, Nest-not-found, Nest-private and "No Nests
yet" all explain what the space is, what happens next, and offer exactly one primary action; none
reads as an error. Gaps: **no links**, **no avatar**, **no comments** and **no likes** have no
explicit empty copy — they simply render nothing (acceptable, but they're the four places a first
Beta user will most often be "empty"). Noted, not invented.

**Auth gates:** following, liking, commenting all route through the same centred `AuthGateSheet`
modal (M20). Publishing/editing/creating gate server-side. No auth prompt is attached to the top of
the screen any more.

**Gestures:** horizontal swipe moves between Nests (`touchAction: pan-y` keeps vertical scrolling
native); tap-outside dismisses every modal, sheet, popover and drawer; Escape dismisses all four;
arrows + keyboard are the non-gesture fallback. Consistent.

**Accessibility:** interactive targets on the polished surfaces are ≥32–44px; every icon button has
an `aria-label`; expand/collapse controls expose `aria-expanded`; the reel indicator is a
`role="status"` with "Nest 2 of 3"; modals are `role="dialog"` + `aria-modal` with focus moved in
and restored on close; all new animation respects `prefers-reduced-motion`. **Unverified:** large
accessibility font sizes, landscape, and very small phones — I checked 375/390/430 widths only.

---

## Remaining concerns

1. **Creator-side visuals still unverified** (no Supabase session on the dev server; I don't sign
   into accounts). N-01's new sign-up destination and N-02's founder-only card were verified by
   route/DOM assertions rather than a signed-in walkthrough.
2. **N-01 is a journey change**, not pure polish. I judged it an obvious broken dead-end (its
   destination redirects away) and your Day-1 audit already prescribed the fix, so I applied it —
   it reverts by changing one `router.push` back and restoring the `.bak` file.
3. The four missing empty states (links/avatar/comments/likes) are **flagged, not written** — adding
   copy there is a content decision.
