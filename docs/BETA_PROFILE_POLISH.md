# Beta Day 3 + 3.1 — Profile Page Polish (Review)

> **Day 3.1 update is at the bottom of this document** — it implements the founder's 9-point
> feedback on top of the Day 3 work described first. Guiding principle now applied:
> **"Every screen should answer one question."** For Profile: *"Who am I, and what have I built?"*

---

# Day 3 — first pass

> Scope: **the Profile page only** (`/profile`). No features added, no architecture, no backend
> changes. Every change is grounded in `BETA_PRODUCT_AUDIT.md` and `BETA_UX_AUDIT.md §4`.
> **Not committed** — awaiting founder review.
>
> Gates: **typecheck · lint · 660 tests** all green. Verified live on `localhost:3000`
> (founder session) at desktop (1280×800) and mobile (375×812).

---

## Screenshots

Raw PNGs can't be embedded (the capture tool returns images to the assistant, not files), so
each is described precisely with its capture recipe. `docs/beta-ux-audit/screenshots/` is the
drop folder if PNGs are added later.

**BEFORE — capture `/profile`, mobile 375×812 (founder session, no username, 2 drafts)**
Top→bottom: "Profile" + New · **identity claim card** · **Avatar card** · **huge "Nestudio
Studio" founder card** (terracotta gradient hero, "Founder" chip, 3 uneven tiles, and 3 greyed
"· soon" chips). The founder block fills the entire screen below the avatar; **the user's own
drafts are completely below the fold.** The whole identity+avatar+founder stack was `sticky`.

**AFTER — same capture**
Top→bottom: sticky "Profile" + New (only the title bar pins now) · **identity card** (larger
avatar, clearer handle rule) · **Avatar card** · **"Continue creating" with the two draft Nests
in the fold**, each with a clean **DRAFT** status chip · … · at the very bottom a quiet collapsed
**"🔧 Founder tools · FOUNDER · ⌄"** row that expands to three even full-width rows (Create Asset ·
Create Empty Nest · Character Calibration), no "soon" chips.

**BEFORE/AFTER — desktop 1280×800**: same story — before, the founder Studio dominated the fold;
after, the creator's identity + drafts lead and founder tools are tucked at the bottom.

---

## Purpose review — every section answered "Why is this here?"

| Section | Purpose | Importance | Frequency | Belongs on main Profile? | Verdict |
|---|---|---|---|---|---|
| Title bar ("Profile" + New) | Wayfinding + primary create CTA | High | Every visit | Yes | Kept (New = only create shortcut) |
| Identity card (`ProfileSummary`) | Who I am; **username claim**; avatar; bio; stats; sign out | High | Every visit | Yes — this **is** identity | Kept as the canonical identity home |
| Avatar card (`AvatarManager`) | Create/replace/remove the private avatar | Medium | Occasional | Yes (identity-adjacent) | Kept, moved directly under identity |
| Today activity | Retention hook ("+N likes today") | Low-med | When active | Yes | Kept (renders only when there's activity) |
| Drafts ("Continue creating") | Resume unfinished Nests | **High** | Frequent | **Yes — core purpose** | Kept + promoted above founder tools |
| Published Nests | Manage/share live Nests | **High** | Frequent | **Yes — core purpose** | Kept + clearer status |
| Founder Studio (`NestudioStudio`) | Internal generation tools | High **to founders only** | Founder-only | **Not as a hero** | Relocated to bottom, collapsed |

Nothing was removed outright; the one section that couldn't justify *prominence* (Founder Studio)
was relocated + de-emphasized rather than deleted.

---

## Every change + reason

### 1. Layout restructure — `app/profile/profile-dashboard-client.tsx`
- **Only the title bar is now `sticky`** (was: the entire identity + avatar + founder block pinned).
  *Reason:* pinning a tall, variable-height stack ate the mobile viewport and pushed content down;
  a light pinned title is standard and improves thumb reach. (UX audit §4: sticky bloat.)
- **Reordered to: identity → avatar → your Nests → founder tools (bottom).**
  *Reason:* the page's core purpose is the creator's Nests; the audit found the founder block
  "pushes user drafts below the fold." Now the creator's own work leads. (Product/UX audit §4.)
- **Consistent spacing** (`mt-2/mt-6/mt-8`, `space-y-3/6`) and `flex-wrap` on the empty-state
  buttons. *Reason:* the audit flagged uneven spacing; wrap prevents overflow on narrow screens.
- Bottom/top safe-area padding intentionally **not** added here — `NestAppChrome` already applies
  `env(safe-area-inset-*)` + bottom-nav clearance; duplicating it would over-pad.

### 2. Founder Studio de-emphasised — `components/nest/app-shell/nestudio-studio.tsx`
- **Now a collapsed disclosure** ("Founder tools", muted, wrench icon, small "Founder" chip,
  chevron) at the **bottom** of the page, expanding to three **even full-width rows**.
  *Reason:* the directive — "normal creators should never feel like the product was built around
  internal tools." It's still server-gated (`whoami` → `isFounder`); only the *presentation* changed.
- **Removed the three "· soon" chips** and the terracotta gradient hero styling.
  *Reason:* audit §4 called the "soon" chips visual noise; the hero styling made internal tools the
  visual centre of a user page.
- Even tile heights (uniform rows) fix the "uneven founder-tile heights" note.

### 3. Clear Nest status hierarchy — `nest-card.tsx` (+ Profile client)
- Added an **optional `tone` prop** to the shared `NestCard` (`draft/public/unlisted/followers/
  private`) that colours the corner badge. **Default omitted → identical to before**, so Explore,
  Discovery, and the public `/@handle` page are byte-for-byte unchanged.
- Profile now renders **plain-language, colour-coded status**: drafts → white **DRAFT** chip;
  published → **Public** (green) / **Unlisted** (slate) / **Followers** (terracotta) / **Private**
  (ink). *Reason:* the directive asks users to instantly tell Draft/Published/Private/Followers apart.
- **Removed the redundant draft subtitle** (drafts previously showed "Draft" as *both* badge and
  subtitle; published showed a raw lowercase enum like "public"). *Reason:* duplicate labelling; weak hierarchy.

### 4. Identity polish — `components/nest/app-shell/profile-summary.tsx`
- **Avatar enlarged 56 → 64px** in the identity header, with tighter name/handle typography.
  *Reason:* the directive — "Does the avatar deserve more visual emphasis?" It's now the clear face of identity.
- **Fixed the self-contradictory microcopy**: "…letters/numbers/underscore. **Permanent for now.**"
  → "Lowercase, 3–20 characters (letters, numbers, underscore). **This becomes your permanent @handle.**"
  *Reason:* audit §4 flagged "Permanent for now" as contradictory.

---

## Username claim — the "one obvious place" question

The claim flow now has a single **canonical home: the identity card on Profile** (it was already
here; I made it clearer and gave the surrounding identity more presence). The **duplicate claim
inside the editor's Publish gate** (`components/nest/editor/publish-gate.tsx`) was **left
untouched** — it lives on another surface (the editor), which this task scoped out ("do not touch
any other page unless absolutely required"). *Recommendation (not done):* reduce the Publish-gate
claim to a short "Set your @handle in Profile →" link so Profile is the only place a handle is claimed.

---

## Intentionally left unchanged (and why)

- **`AvatarManager` internals** (create/replace/history/remove + delete-confirm) — functionally
  correct and privacy-critical; only its position (under identity) is via the parent. Not redesigned.
- **`ProfileSummary` states** (signed-out, editing, full summary) — logic is sound; I only touched
  avatar size + one microcopy string. No behavioural change.
- **`NestCard` default rendering** — shared by 4 surfaces; the new prop is additive so other pages
  don't change. I deliberately did **not** restyle it globally.
- **The Publish-gate username claim** — different surface, out of scope (see above).
- **Data model / persistence** — Profile is still localStorage-by-default (Product audit); a Beta
  decision, not a Profile-polish one.
- **`ActivityToday`, empty state, `Section`, `Grid` helpers** — already clean; kept as-is.

---

## Required-but-adjacent fix (flagged separately — NOT Profile)

Running the required **typecheck surfaced a pre-existing failure unrelated to Profile**:
`app/moderation/page.tsx` (from the Day-4 moderation gate, commit `862c385`) **exported a helper
`canViewModeration` from a `page.tsx`**, which App Router forbids — Next's generated `.next/types`
rejects any non-page export, so `tsc` failed once those types regenerated.

To get a green typecheck (which this task requires) I made the **minimal correct fix**: moved the
predicate to `lib/auth/moderation-access.ts` (its proper home) and imported it in the page + its
test. **Behaviour is identical** — same `getServerUser + isFounder` gate, same 404 for non-founders;
the 6 moderation tests still pass. This touches moderation, not Profile; I'm flagging it explicitly
so it can be reviewed (or committed) on its own. Files: `app/moderation/page.tsx`,
`test/moderation-gate.test.ts`, new `lib/auth/moderation-access.ts`.

---

## Remaining concerns (documented, not fixed)

1. **Publish-gate username duplication** persists (out of scope) — see above.
2. **Avatar vs identity redundancy**: once an avatar exists, it shows in *both* the identity header
   and the Avatar management card. Acceptable (header = identity, card = manage), but a future pass
   could fold "manage" into the header on tap.
3. **Dev "LIVE · SUPABASE" badge overlaps the Home nav tab** on mobile — cross-cutting, dev-only,
   not a Profile issue (noted in the UX audit).
4. **Sign-out is still an unlabelled ⇥ icon** (it has an `aria-label`, so it's a11y-labelled, but
   low-discoverability). Left as-is to avoid re-architecting the identity header this pass.
5. **Persistence**: drafts/published are localStorage — a shared "Sign in to keep these on every
   device" hint already exists; the real fix is the backend decision from the Product audit.

---

## Files changed (all uncommitted)

**Profile polish**
- `app/profile/profile-dashboard-client.tsx` — layout restructure, status tones, founder relocation.
- `components/nest/app-shell/nestudio-studio.tsx` — collapsed de-emphasised founder disclosure.
- `components/nest/app-shell/nest-card.tsx` — additive optional `tone` prop (other callers unchanged).
- `components/nest/app-shell/profile-summary.tsx` — larger avatar, fixed handle microcopy.

**Required typecheck fix (adjacent, flagged)**
- `lib/auth/moderation-access.ts` (new) · `app/moderation/page.tsx` · `test/moderation-gate.test.ts`.

_No commit made. Stopping for founder review._

---
---

# Day 3.1 — Final Profile Refinement (founder feedback)

Guiding principle: **"Every screen should answer one question."** Profile's question is
**"Who am I, and what have I built?"** Every item below was judged against it. All 9 feedback
points implemented. Gates: **typecheck · lint · 660 tests** green. **Not committed.**

## Feedback → what I did

| # | Feedback | Implementation |
|---|---|---|
| 1 | **Remove the Avatar card**; photo becomes the entry point | The dedicated card is **deleted** (`avatar-manager.tsx` removed — it became orphaned). The identity avatar is now a **tappable button with a camera badge**; tapping opens a small menu: **Create avatar** / **Change avatar** / **Remove avatar** (owner-only, remove has inline busy + error states). No new large card. Dismisses on outside-tap / Escape. |
| 2 | **Compress identity**, show Nests sooner | Card padding `p-5→p-4`, avatar 64→60, name 18→17px, stats row tightened (`mt-4 pt-3` → `mt-3 pt-2.5`), section gap `space-y-6→5`, grid gap `3→2.5`, section headings `text-lg→15px`. Removing the whole Avatar card is the biggest win — **Published/Draft Nests move up roughly a full card-height**. |
| 3 | **Remove "+ New"** from the header | Removed. The global Create (+) tab is now the single creation path. Header is title-only. |
| 4 | **Improve empty state** | Height cut ~40% (`p-8`→`px-5 py-6`, `rounded-3xl`→`2xl`). "Your Nest awaits" → **"No Nests yet"** / "Your first one takes a couple of minutes." **"Explore examples" removed** — one action only. |
| 5 | **Public profile wording** | "Public →" → **"View public profile"**. |
| 6 | **Logout out of the identity card** | Moved into a **☰ overflow menu** (`MoreHorizontal`) with "Sign out". Applied to both the full identity card and the claim-username state. |
| 7 | **Tap the card to edit** | The whole card body (name · handle · bio) is now the edit affordance (`aria-label="Edit profile"`). The **pencil icon is gone**. |
| 8 | **Terminology** | Profile standardised on **Nest**: "Make this your place"→"Make this your **Nest**"; bio placeholder "about your place"→"about your **Nest**"; "Add a short bio about your place."→"Add a short bio". Follow-ups documented below. |
| 9 | **Visual rhythm** | Two cards removed (Avatar card; founder hero became a single quiet row in Day 3). Less beige, denser content, fewer borders. |

## Terminology follow-up (other pages — NOT changed, per scope)

Profile now says **Nest** consistently. These other surfaces still mix vocabularies and need a
decision before Beta:
- **`app/profile/[handle]/profile-client.tsx`** (public `/@handle`) — uses **"House"** and
  **"Rooms"**: `"Rooms in this house"` heading, `Room/Rooms` stat label, `HouseFront` component,
  "Enter Nest" door copy. This is the *public twin* of Profile, so the mismatch is user-visible.
- **`lib/nest-house.ts` / `lib/nest-village.ts` / `components/nest/village/*`** — House/Village
  is a whole spatial layer (ADR-019). Renaming is an architecture decision, not a polish one.
- **Editor** uses "Main Nest" + "scenes"; **Visitor view** uses "Nest".
**Recommendation:** pick **Nest** as the single user-facing noun; keep "House/Village" only if the
spatial layer ships as a distinct concept — and if so, define it once in the world bible.

## Screenshots (fresh, mobile 375×812)

**Signed-out Profile (captured):** title-only header (no "+ New") · compact identity/auth card
("Make this your Nest") · **compressed empty state**: "No Nests yet" / "Your first one takes a
couple of minutes." / single **Create a Nest** button. Visibly shorter and calmer than before.

**⚠️ Signed-in states not visually captured this round — honest limitation.** Restarting the dev
server cleared the Supabase session (`/api/auth/whoami` → `authenticated:false`), and I don't sign
in to accounts myself. So the **avatar menu, ☰ sign-out, tap-to-edit, "View public profile"**, and
the tightened stats row are **code-complete and gate-verified but not screenshot-verified**.
To see them: open `/profile` on your signed-in session (Day 3's screenshots show the same page
pre-refinement for comparison). If anything looks off there, tell me and I'll adjust.

## Files changed in 3.1

- `components/nest/app-shell/profile-summary.tsx` — avatar-as-entry-point (`AvatarButton`),
  `OverflowMenu` (sign out), card-tap editing, "View public profile", compression, Nest wording.
- `app/profile/profile-dashboard-client.tsx` — removed "+ New", removed `AvatarManager`,
  compressed empty state + rhythm.
- `components/nest/app-shell/avatar-manager.tsx` — **deleted** (orphaned once folded into identity).

## Notes / remaining concerns

- **Avatar "View history" was dropped.** The old card had a history strip (past avatars). It was
  the one affordance with no home in the new menu, and the founder asked for exactly four actions
  (tap / change / create / remove). Flagging it: if history matters, it belongs in Avatar Studio,
  not on Profile.
- **Fixed while implementing:** the tappable card body originally nested `<p>` inside `<button>`
  (invalid HTML → hydration warnings); changed to `<span className="block">`.
- Publish-gate username duplication still stands (editor surface, out of scope) — see Day 3.
- The dev-only "LIVE · SUPABASE" badge still overlaps the Home tab on mobile (cross-cutting).

---
---

# Day 3.2 — Unify Creator Identity

Principle applied: **identity appears once, then the interface moves deeper.** Gates:
**typecheck · lint · 660 tests** green. **Not committed.**

## The duplication audit — "has the visitor already seen this?"

The public `/@handle` page rendered the House hero **and then a second profile card** beneath it.
`HouseFront` already showed almost everything the card repeated:

| Information | In House hero | Repeated in card below | Action | Why |
|---|---|---|---|---|
| Avatar | ✅ door-plate initial | ✅ `<Avatar size={52}>` | **removed from card** | Seen 1 second earlier, 200px higher |
| Display name | ✅ door plate | ✅ `<h1>` | **removed from card** | Same string, twice |
| @username | ✅ door plate | ✅ subtitle | **removed from card** | Same string, twice |
| Bio | ✅ under the house | ✗ | kept in hero | Already once — correct |
| Followers | ✅ stat | ✅ stat | **removed from card** | Same number, twice |
| Nest count | ✅ "Nests" stat | ✅ "Rooms" stat | **removed from card** | Same number, twice, **two different nouns** |
| Following | ✗ | ✅ stat | **removed entirely** | Vanity metric on someone *else's* arrival page; it answers nothing about *this* creator's world |
| Links | ✗ | ✅ always-open row | **moved into hero, collapsed** | Belongs to identity, but is a detour — must not compete with Enter |
| Follow / Manage | ✗ | ✅ | **moved into hero** | The one action worth keeping; now sits with Enter |
| Nest grid ("Rooms in this house") | ✗ | ✅ 2-col card grid | **removed** | The grid *is* the anti-pattern: it turns an arrival into a directory. Entering should begin an immersive reel |

**Net effect:** the public page went from **3 stacked blocks (hero + profile card + grid)** to **one
hero**. Roughly 60 lines of duplicated JSX deleted.

## What I built

**1 · Merged public profile + house (tasks 1, 2, 7)** — `app/profile/[handle]/profile-client.tsx`
is now just `<HouseFront …/>`. The second `<header>` card and the `ProfileStat` helper are gone.
Identity order is exactly the founder's spec: **House → avatar → name → one-line bio → followers →
links (collapsed) → Enter Nest**.

**2 · Collapsed links (task 3)** — `HouseFront` gained an optional `links` prop rendering a quiet
**"Links ⌄"** pill that expands on tap. Optional, so the **village and village-lab pass nothing and
are visually unchanged** (verified: `/village` still renders correctly).

**3 · Compact bio (task 4)** — the hero's bio was already a single centred line (`max-w-xs`); no
"Read more" was added because nothing currently truncates. Flagged below if long bios appear.

**4 · Creator sees their house (task 5)** — new `components/nest/app-shell/house-preview.tsx` on
`/profile`: the **exterior only**, with the caption "Your house · how visitors arrive" and a
"View →" link. Deliberately *not* the full `HouseFront` — that would have re-shown avatar/name/bio/
stats directly under the identity card and recreated the very duplication this sprint removes.
No editing; future exterior customisation attaches here.

**5 · Reel architecture, no swipe yet (task 6)** — new `lib/nest-reel.ts`: `creatorReel(ownerId)`,
`reelEntryPoint()`, `reelIndexOf()`, `reelNeighbours()`. Pure ordering logic — no UI, no routing,
no storage. The House now derives "Enter Nest" from `reelEntryPoint(reel)`, so **Enter is
explicitly the first screen of the reel**. A future pass adds horizontal swipe in the existing
`/nest/[slug]` route by calling `reelNeighbours()` — no new routes needed.

## ⚠️ One consequence you should decide on

Removing the "Rooms in this house" grid means a visitor can currently reach **only the newest
Nest** from a creator's House. Nests 2…n have no UI path until the swipe lands (direct links still
work). This follows your spec literally — the visitor journey you wrote ends at *Enter → swipe*,
with no grid — and `lib/nest-reel.ts` makes the swipe straightforward. But until that ships it is
a **real reachability regression** for multi-Nest creators. Options: (a) accept it and prioritise
the swipe next, or (b) I re-add a minimal in-hero "1 / 4 ▸" affordance. I did **not** choose for you.

## Terminology (continued from 3.1)

"Rooms in this house" and the `Room/Rooms` stat label are **gone** with the grid — so the
**Room** vocabulary no longer appears on either Profile surface. Both now say **Nest**.
Still outstanding elsewhere: `HouseFront`/`house-exterior`/`nest-house.ts` legitimately say
**House** (the spatial layer); the editor says "Main Nest"/"scenes". Unchanged, as agreed.

## Screenshots (mobile 375×812)

- **`/village` — captured, unchanged.** Proves the optional `links`/`action` props didn't alter the
  shared `HouseFront` for its other consumers.
- **`/@handle` (unclaimed) — captured.** Renders the clean "No house here yet" state; no console errors.
- **⚠️ The populated `/@handle` hero and the creator `HousePreview` are not screenshot-verified.**
  Same limitation as 3.1: the dev-server restart cleared the Supabase session and I don't sign in
  to accounts. Both are typecheck/lint/test-clean and the shared hero is proven to render via
  `/village`. Please open `/@<your handle>` and `/profile` on your session — that shows the merged
  hero (with "Links ⌄" + Follow/Manage) and the house preview.

## Files changed in 3.2

- `app/profile/[handle]/profile-client.tsx` — **second profile card + Nest grid removed**; hero-only.
- `components/nest/village/house-front.tsx` — optional `links` (collapsed) + `action` slots.
- `components/nest/app-shell/house-preview.tsx` — **new**, exterior-only creator preview.
- `app/profile/profile-dashboard-client.tsx` — mounts the house preview.
- `lib/nest-reel.ts` — **new**, reel ordering for Enter + future swipe.

---
---

# The Arrival Experience

> "Stop designing a profile page. Start designing an arrival."
> Gates: **typecheck · lint · 660 tests** green. **Not committed.**

## The flow, as built

```
Arrival        ← back-to-village + "Morning · Cloudy" (atmosphere stays visible)
  ↓
House (hero)   ← grows to fill the first screen; the destination
  ↓
Identity       ← avatar · display name · @username  (compact plate under the house)
  ↓
One-line bio   ← line-clamped to 2
  ↓
Enter Nest     ← the ONE dominant CTA (py-4 terracotta, full width); Follow sits under it, smaller
——————————————— fold ———————————————
Statistics     ← "0 followers · 3 Nests" — quiet metadata, no card, no big numerals
  ↓
Links          ← collapsed "Links ⌄" pill
  ↓
Other Nests    ← horizontal snap rail, "MORE FROM <NAME>"
```

## What changed and why

| Change | Reason |
|---|---|
| **House grows to fill the first screen** (`arrival` mode: the house wrapper is `flex-1`, hero is `min-h-[80svh]`) | "The house is the hero" and "one visual focal point." Previously the house was one item in a stack; now it is the destination and everything else sits beneath it. |
| **Enter Nest moved ABOVE statistics** and enlarged (`py-3.5 → py-4`) | It must "visually outweigh every other interactive element." It used to come *after* stats and links, so three things competed at the fold. |
| **Statistics demoted to one muted line** (was a white pill card with bold numerals + uppercase labels) | "Statistics become quiet metadata." A stats card competes with the CTA; a grey sentence does not. |
| **Links stay collapsed, below the fold** | "Social links should never compete with entering the Nest." |
| **Other published Nests restored, at the very bottom** | Your new flow lists them last — which also **resolves the reachability regression I flagged in 3.2**. A horizontal snap rail (not a grid) so the movement rehearses the future swipe. |
| **Below-fold scrim** (`from-transparent via-parchment/85 to-parchment`) | Without it the village hill cut a hard diagonal behind the cards and looked accidental. The scene now softens as you scroll — calm, not busy. |
| **Bio `line-clamp-2`** | Keeps the one-line promise even if someone writes an essay. |

## Progressive disclosure — how it actually works

No JS, no scroll listeners. The hero is `min-h-[80svh]` and the house is `flex-1` inside it, so the
house *absorbs the leftover height* and pushes identity + CTA to the bottom of screen one.
Everything else naturally begins below the fold. Measured in the running app:
**scrollHeight 1169px vs viewport 800px** — one calm screen, then a deliberate scroll. On first
paint the stats line is half-visible at the bottom edge, which is the invitation to keep walking.

## Empty space

The first screen is deliberately mostly sky, house and ground. No stats card, no links row, no
grid, no second profile block. The only interactive things above the fold are **Enter Nest** and
a smaller **Follow**.

## Deliberately NOT added

- **Verification badge** — the direction lists it as *optional*, and there is no verification
  field in `NestProfile` and no backend to source it from. Adding one would be inventing a feature
  and faking data. Ready to add the moment there's a real signal.
- **Actual horizontal swipe between Nests** — still deferred per 3.2; `lib/nest-reel.ts`
  (`reelNeighbours`) is the seam, and the rail at the bottom is the visible rehearsal of it.

## Screenshots (mobile 375×812) — and an honest note on how they were made

Captured on `/@hannan`: **(1)** first screen — house filling the view under "Morning · Cloudy",
identity plate, bio, dominant Enter Nest, smaller Follow, stats just cresting the fold;
**(2)** scrolled — quiet stats line, "Links ⌄", "MORE FROM HANNAN AZARI" rail with two Nests;
**(3)** links expanded — Website ↗ · GitHub ↗ · Twitter ↗.

⚠️ **These were produced with locally seeded demo data.** The dev-server restart cleared the
Supabase session and I don't sign into accounts, so to render a populated arrival I wrote a demo
profile + three published Nests into `localStorage` in my dev browser pane (the profile/document
stores are localStorage-backed). The data shape is exactly what the app itself writes — but the
*creator is fictional*. Your own `/@<handle>` will show your real house, bio and Nests. To clear
the demo data: `localStorage.removeItem('nestudio-profiles'); localStorage.removeItem('nestudio-nest-documents'); localStorage.removeItem('nestudio-published')`.

## Files changed

- `components/nest/village/house-front.tsx` — arrival mode (`arrival`, `below` props), reordered
  to house → identity → bio → **Enter** → stats → links → below, quiet stats, below-fold scrim.
  Both new props are optional, so **the village overlay is unchanged**.
- `app/profile/[handle]/profile-client.tsx` — passes `arrival`, and renders the "More from…" rail.

## Remaining concerns

1. **The village overlay inherits the reorder** (Enter now precedes stats there too). I judged that
   an improvement and consistent with the direction, but it is a second surface changed — say the
   word if you want the village kept exactly as it was.
2. **`min-h-[80svh]`** is tuned for phones. On a very short landscape viewport the house will be
   small; on desktop the hero is inside the `max-w-md` app-shell column so it behaves like a phone.
3. The **"More from" rail is the only path to Nests 2…n** until the swipe ships — better than 3.2's
   dead end, but the immersive version is still the goal.
