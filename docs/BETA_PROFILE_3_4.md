# Day 3.4 — Final Profile Interaction Polish

> Four interaction fixes only. No structural changes: hierarchy, house positioning, Nest list,
> Enter Nests, horizontal navigation, identity layout, follower placement, terminology and
> backend are all untouched. Gates: **typecheck · lint · 668 tests** green. **Not committed.**

## 1 · Links now open as an anchored overlay

`components/nest/profile/identity-box.tsx` — the links no longer expand inline. Tapping **Links**
opens an `absolute`-positioned popover anchored under the control, floating over the house.

**Measured live on `/@hannan` (375×812), before vs after opening:**

| | Before | After | |
|---|---|---|---|
| Identity card height | 135.875px | 135.875px | ✅ unchanged |
| House panel height | 454.125px | 454.125px | ✅ unchanged |
| House top offset | 203.875px | 203.875px | ✅ no shift |
| Scroll height | 800px | 800px | ✅ no new scroll |

The bio is now **always** `line-clamp-1` (it used to un-clamp on expand, which grew the card).

**Close paths — all asserted in the running app:** Escape ✅ · outside pointerdown ✅ ·
tapping Links again ✅ · navigating away unmounts. Overlay has `role="menu"`, items are
`role="menuitem"`, the trigger exposes `aria-expanded` + `aria-haspopup`, and each item is ≥36px.

**Bug found and fixed while verifying:** the popover was painted *behind* the house. The identity
card's `backdrop-blur` creates its own stacking context, so the later house sibling won over the
popover's `z-40`. Fixed by giving the card `relative z-30`. Same behaviour in creator + visitor
views (one shared component).

## 2 · Bottom-sheet headers cleaned up

`components/nest/social/bottom-sheet.tsx` — the grab handle used to sit **inside the same flex
row as the title**. Now (preferred option):

```
row 1:  ────  (handle, centred, alone, mobile only)
row 2:  Title ....................... [✕]
```

Also added: `role="dialog"`, `aria-modal`, `aria-label`, and focus moves into the sheet on open.
Because this is the shared sheet, **Edit profile, Profile photo and every other sheet** (comments,
sign-in gate, stats) get the same corrected header — consistent by construction.

## 3 · Owner avatar → focused centred modal

`app/profile/profile-dashboard-client.tsx` — `AvatarSheet` (a bottom sheet with one link) is
replaced by **`AvatarModal`**, a centred modal:

- current avatar preview (or the existing placeholder when empty)
- title **"Your avatar"**
- primary **"Create avatar"** when empty / **"Change avatar"** when one exists
- secondary **"Remove avatar"** only when one exists (uses the existing delete route)
- close button, Escape, backdrop

The primary action is a plain `Link` to **`/profile/avatar`** — the existing Avatar Generator
(upload → consent → generate → result). **No second pipeline, no generation form in the modal.**
On return the Profile re-reads the avatar (`getActiveAvatar` on open, `router.refresh()` after
removal) and the rest of Profile state is untouched.

## 4 · Visitor avatar preview

Tapping a creator's avatar in visitor view opens a centred preview: enlarged image,
`object-contain` (aspect preserved), dark blurred backdrop, close button, Escape, outside tap.
**No edit controls** — asserted live: the dialog's text contains no create/change/remove
(`showsEditControls: false`), and its `aria-label` is `"Hannan Azari's avatar"`.

**Empty placeholder does nothing** — when there is no avatar the element isn't a button at all
(asserted: `noAvatarIsInert: true`), so nobody taps into a misleading editor.

**Second bug found and fixed:** the modal was clipped to the identity card. `backdrop-filter`
makes an element a *containing block for `position: fixed` descendants*, so `fixed inset-0` was
being contained by the card. Fixed by rendering `CenteredModal` through a **portal to
`document.body`**. (Caught only because I looked at the screenshot — worth noting.)

## Screenshots captured (375×812)

1. Profile, Links closed ✅ 2. Links overlay open ✅ (floating over the house, card/house unmoved)
7. Visitor avatar preview ✅ 9. Final visitor Profile ✅

**Not captured — creator-side (3, 4, 5, 6, 8):** Edit Profile sheet header, owner avatar modal
(empty + filled), the Avatar Generator opened from it, and the final creator Profile. Same reason
as 3.2/3.3: the dev server has no Supabase session and I don't sign into accounts, so `/profile`
renders the signed-out state. The code paths are typecheck/lint clean and the two components they
depend on (`CenteredModal`, `BottomSheet`) are **proven in the browser** via the visitor preview
and the shared sheet. Please spot-check `/profile` on your session.

Screenshots again use locally seeded demo data (fictional creator + an SVG data-URI avatar).
Clear with: `localStorage.removeItem('nestudio-profiles'); localStorage.removeItem('nestudio-nest-documents'); localStorage.removeItem('nestudio-published')`

## Test results

Full suite **668 passed**; typecheck ✅; lint ✅ (no new tests — see below).

**Honest gap on "focused Profile interaction tests":** all four fixes are component-interaction
behaviours (overlay open/close, modal focus, sheet header order), and this repo still has **no
jsdom / React Testing Library** setup — `vitest.config.ts` explicitly runs without a DOM
environment. I could not add unit tests for these without introducing test tooling, which is a
dependency change outside this task's scope. Instead I verified each acceptance criterion **in the
running app** and recorded the actual numbers/assertions above (layout deltas, close paths,
aria state, absence of edit controls, inert placeholder). If you want these locked in
permanently, the next step is adding RTL + jsdom — say the word and I'll scope it.

## Files changed

- `components/nest/profile/identity-box.tsx` — links overlay, always-clamped bio, visitor preview, `z-30`.
- `components/nest/profile/modal.tsx` — **new** centred modal (portal, focus in/out, Escape, light/dark tone).
- `components/nest/social/bottom-sheet.tsx` — header rows, dialog semantics, focus.
- `app/profile/profile-dashboard-client.tsx` — `AvatarSheet` → `AvatarModal`.

## Remaining concerns

1. **Creator-side visuals unverified** (no session) — the standing gap across 3.2–3.4.
2. **`BottomSheet` is shared**, so comments/sign-in/stats sheets also got the new header. I judged
   that desirable (consistency) — flagging it since it reaches beyond Profile.
3. Two real rendering bugs surfaced here (stacking context, fixed-position containing block) both
   caused by `backdrop-blur` on the identity card. If more overlays get added to that card, they
   must portal too.
