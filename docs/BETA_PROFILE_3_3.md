# Day 3.3 — Founder-Directed Profile Structure (correction pass)

> The arrival/scrolling direction is **reverted**. Public and Creator profiles now share one
> structure; only the actions differ. Gates: **typecheck · lint · 668 tests** green.
> **Not committed.**

## 1. Before / after file list

| File | Change |
|---|---|
| `components/nest/village/house-front.tsx` | **REVERTED to HEAD** — all Day-3.2/arrival edits removed (`arrival`, `below`, `links`, `action`, reordering, scrim). The village overlay is byte-identical to before 3.2. |
| `app/profile/[handle]/profile-client.tsx` | **Rewritten** — top controls → identity box → grounded house → one action. No `HouseFront`, no rail, no grid. |
| `app/profile/profile-dashboard-client.tsx` | **Rewritten** — same structure + owner actions + editable Nest list. The white-card dashboard is gone. |
| `components/nest/profile/identity-box.tsx` | **NEW** — the one compact expandable identity component (shared). |
| `components/nest/profile/house-scene.tsx` | **NEW** — grounded, bottom-anchored house scene (shared). |
| `components/nest/profile/top-controls.tsx` | **NEW** — back + weather pill (shared). |
| `app/nest/[slug]/visitor-client.tsx` | Reel navigation added (swipe · arrows · keyboard · dots). Everything else untouched. |
| `lib/nest-reel.ts` | Added `viewableReel()` — visibility-filtered reel. |
| `components/nest/app-shell/house-preview.tsx` | **Deleted** — superseded by the shared `HouseScene`. |
| `test/nest-reel.test.ts` | **NEW** — 8 focused tests. |

## 2. Screenshots (captured, 375×812 unless noted)

- **Public collapsed** — "The village" + "Afternoon · Cloudy" · identity box (avatar · Hannan Azari · @hannan · Follow · one-line bio · "0 followers" · "Links ⌄") · grounded house on the hill · full-width **Enter Nests**. One screen.
- **Expanded identity** — verified via the control's state (`aria-expanded`, label flips to "Hide links and full bio"); expanded row shows Website ↗ · GitHub ↗ · Twitter ↗.
- **First full-screen Nest** — immersive room, creator chip, Exit, **3 position dots (first active)**, right arrow, title/tags/Visit House, engagement rail.
- **Next Nest after swipe** — URL `→ /nest/night-studio-d3e4f`, title "Night Studio", indicator **"Nest 2 of 3"**.
- **No-Nest state** — the "This creator hasn't opened a Nest yet." panel replaces the button (code path verified; test-covered).
- **390×844 and 430×932** — measured, no scrolling (below).

⚠️ **Not captured: the creator profile screenshots** (creator profile, avatar action, edit sheet,
draft/published management, house preview). The dev-server restart cleared the Supabase session
and I don't sign into accounts, so the signed-in creator surface can't be rendered here. It is
typecheck/lint clean and shares the exact components proven on the public side. **This is the one
gap in this delivery** — please open `/profile` on your session.

Also: screenshots use **locally seeded demo data** (a fictional "Hannan Azari" profile + 3
published Nests written to `localStorage`), because there is no signed-in session. Shape matches
what the app writes. Clear with:
`localStorage.removeItem('nestudio-profiles'); localStorage.removeItem('nestudio-nest-documents'); localStorage.removeItem('nestudio-published')`

## 3. Components reused (not rebuilt)

`HouseExterior`, `SceneBackdrop`, `useAtmosphere`, `deriveHouse`, `DoorTransition`, `Avatar`,
`FollowButton`, `BottomSheet`, `NestPreview`, `AuthPanel`, `useNestIdentity`, `formatCount`,
`nest-document-store`, `nest-profile-store`, `nest-social`, and the **existing Nest viewer**
(`visitor-client.tsx`) — swipe was added inside it, not as a new system.

## 4. Day-3.2 / arrival elements removed

- "More from [creator]" heading + horizontal Nest thumbnail rail — **gone**.
- Public Nest grid ("Rooms in this house") — **gone** (already removed in 3.2, stays gone).
- The large scrolling arrival sequence (`min-h-[80svh]` hero, `flex-1` house, below-fold scrim,
  progressive disclosure) — **gone**, `HouseFront` reverted.
- Duplicate identity card beneath the house — **gone**.
- Duplicate stats (followers/following/Rooms repeated) — **gone**; followers appears once.
- Separate profile-management card under the house — **gone**.
- Bio/stat/link blocks scattered across the scene — **consolidated into the identity box**.
- `house-preview.tsx` (3.2 creator-only exterior card) — **deleted**, replaced by shared `HouseScene`.

## 5. Public viewport height — does it scroll?

Measured live (`scrollHeight` vs `clientHeight` of the app-shell scroller):

| Viewport | Content | Container | Scrolls? |
|---|---|---|---|
| **375 × 812** | 800 | 800 | **No** |
| **390 × 844** | 832 | 832 | **No** |
| **430 × 932** | 920 | 920 | **No** |
| Desktop | inside the `max-w-md` column | — | No |

The house scene is `flex-1 min-h-[200px]`, so it absorbs slack rather than overflowing; the
identity box and action are fixed-height. Expanding Links adds height and *may* scroll on the
smallest device — that is the intended exception.

## 6. Creator flow

`/profile` renders the **same three blocks**: top controls → identity box → house scene, then the
Nest list.
- **Identity box**: no Follow. One discreet **Edit** pill opens a focused `BottomSheet`
  (display name · bio · 4 link fields · Save) — never an inline form. **Avatar tap** opens a
  second sheet: Create/Change avatar → `/profile/avatar`, or Remove avatar.
- **House**: the same `HouseScene` visitors see, with one discreet **"View as visitor →"** chip.
  No exterior editor (out of scope).
- **Nests**: compact rows — 48px thumbnail, title, and a **Draft** (grey) or **Public/Unlisted/
  Followers/Private** (green) chip. Tapping opens the **editor**. No Create button here; the
  global Create tab remains the single creation path. Scrolling here is expected and fine.
- No handle yet → a focused claim card first (a House needs a handle).

## 7. Swipe behaviour

Inside the existing viewer, driven by `lib/nest-reel.ts`:
- **Touch**: horizontal pointer drag >55px, ignored when it's more vertical (`touchAction: pan-y`
  keeps vertical gestures native). Left → next, right → previous.
- **Non-gesture fallbacks**: on-screen arrows (44px, `aria-label="Next Nest: <title>"`) **and**
  ArrowLeft/ArrowRight keys.
- **Indicator**: dot strip under the header, `role="status"`, `aria-label="Nest 2 of 3"`.
- **Ends don't wrap** — no prev on the first, no next on the last.
- **Visibility**: visitors traverse only shareable (public/unlisted) Nests; followers-only and
  private are never reachable by swiping. The owner traverses all of their own.
- **Direct URLs still work** — resolution is unchanged; the reel only adds lateral movement.
- **Reduced motion**: no new animation was added; existing transitions already guard it.
- 0 Nests → no reel; 1 Nest → no dots/arrows.

## 8. Tests

`test/nest-reel.test.ts` — **8 new, all passing**: zero Nests · one Nest (entry point, no
neighbours) · multiple (ordering, index, forward/back, no wrap) · slug outside the reel ·
**visitor sees only shareable** · **owner sees all** · **a visitor can never reach a private/
followers Nest as a neighbour**.

Full suite: **668 passed** (was 660). typecheck ✅ lint ✅.

Coverage gap I should name: "public collapsed identity", "expanded bio/links" and "creator
actions" are **not** unit-tested — the repo has no jsdom/React-testing-library setup, so
component rendering can't be asserted. I verified those in the browser instead (aria state,
expanded links, layout measurements). Adding RTL would be a tooling change beyond this scope.

## 9. Remaining concerns

1. **Creator profile is unverified visually** (no session) — the single real gap. Please check `/profile`.
2. **Sky above the house** is reduced but still present; the scene is `flex-1`, so on very tall
   phones it grows. If you want it tighter I can cap it — but a cap left a dead beige gap, so I
   chose the sky over the hole. Worth your eye.
3. **Bare-slug Nests don't resolve on the Supabase backend** unless the row exists there (my
   seeded demo Nests are localStorage-only). Pre-existing Day-1 issue, not introduced here — but
   it means swiping produces URLs that depend on the same resolution path as before.
4. **Terminology**: no "Room" remains on Profile/arrival surfaces (verified by grep). Still
   outstanding elsewhere: `lib/nest-house.ts`, `components/nest/village/*` and the editor's
   "Main Nest"/"scenes". Documented, not renamed.
5. **`HousePreview` deletion** — if you liked that card, it's now the shared `HouseScene`.
