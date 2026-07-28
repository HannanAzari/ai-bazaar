# M20 — Profile & Nest Experience Polish

> Refinement only. Layout, house hero, spacing, palette and IA are untouched.
> Gates: **typecheck · lint (0 errors) · 675 tests** green. **Not committed.**

## Item-by-item

| # | Item | Done | Evidence |
|---|---|---|---|
| 1 | Expandable bio | ✅ | 2 lines + **More ▾**; card grows in place 183.75 → 219.5px, label → "Less"; **no page scroll introduced**. `ResizeObserver` only offers "More" when the text genuinely overflows. Identical in both views (one shared component). |
| 2 | Links overlay polish | ✅ | Kept. Fade + slight scale (`pop-in`, reduced-motion guarded). Re-measured with 4 links: card unchanged, house unchanged, no shift. |
| 3 | Unlimited links | ✅ | `ProfileLink[]` on the profile; Edit Profile has label+URL rows, **+ Add link**, per-row delete. No platform hard-coded. Verified live with Spotify · Discord · Patreon · a bare Steam URL (label derived → "Store"). |
| 4 | Remove "View as visitor" | ✅ | Footer removed from the creator `HouseScene`. |
| 5 | Three metrics | ✅ | One quiet row, no cards: **"3 Nests · 0 Views · 0 Followers"**. Same component and layout on creator + visitor. Uses the existing `viewsForOwner`. |
| 6 | Richer Nest drawer | ✅ | Avatar · name · @handle · full bio · stats · Follow · published-Nest list. Scrim lightened to `black/30` so the room stays visible. |
| 7 | Follow placement | ✅ | Directly beneath the identity block, above the Nest list (asserted: `followBeforeList: true`). |
| 8 | Nests in drawer | ✅ | Compact rows with thumbnails + active dot; selecting switches the Nest and closes the drawer. Verified: Reading Room → `/nest/reading-room-g5h6i`. |
| 9 | Like / Comment / Share | ⚠️ **see note** | Already implemented and wired (optimistic toggle + persistence via `nest-social`, comment sheet, native share with clipboard fallback). Guests now get the **new centred auth modal**. I did not rebuild them. |
| 10 | Auth modal | ✅ | `AuthGateSheet` now renders through `CenteredModal` — centred, rounded, blurred backdrop, dismissible, styled with the avatar modal. Added the "Join Nestudio" perk list. Export name unchanged, so **like / follow / comment all upgrade at once** — this is now the reusable auth component. |
| 11 | Avatar modal | ✅ | Kept from 3.4: large preview, single primary **Create/Change avatar** into the existing `/profile/avatar` pipeline (not duplicated), Remove when applicable. Visitor tap → centred enlarged preview, no edit controls. |
| 12 | Smooth Nest switching | ✅ | ~240ms directional slide before navigation (`nest-slide-left/right`), fade-in on arrival, `prefers-reduced-motion` skips it entirely. Asserted: animation class present mid-transition. |
| 13 | Preserve layout | ✅ | No structural change: profile card, house hero, spacing, palette, minimal design all as approved. |

## New tests

`test/profile-links.test.ts` — **7 passing**: label derivation from any host, legacy fixed-four still read, unlimited custom links on arbitrary platforms, legacy+custom merge with de-duplication by destination, blank-row pruning, protocol normalisation.

Suite total **675** (was 668).

## Data model note (additive, no backend redesign)

`NestProfile` gained `links?: ProfileLink[]`. The legacy `socials` object is still **read** so
existing profiles keep working, and on first save the fixed four are migrated into rows and the
legacy keys cleared — a link then lives in exactly one place (`profileLinks()` also de-dupes
defensively). localStorage-backed as before; nothing server-side changed.

## Screenshots captured (375×812)

Public profile with 2-line bio + More ▾ + three metrics · links overlay with four custom
platforms floating over the house · creator drawer (bio, stats, Follow above the Nest list, three
Nests with thumbnails, room visible behind).

⚠️ **Creator-side screenshots still not captured** — the standing gap since 3.2: no Supabase
session on the dev server and I don't sign into accounts, so `/profile` renders signed-out. The
creator identity box, Edit Profile sheet (with **+ Add link**) and avatar modal are typecheck/lint
clean and share the exact components proven on the visitor side. Please spot-check `/profile`.

Screenshots use locally seeded demo data. Clear with:
`localStorage.removeItem('nestudio-profiles'); localStorage.removeItem('nestudio-nest-documents'); localStorage.removeItem('nestudio-published')`

## Files changed

- `lib/nest-profile-store.ts` — `ProfileLink`, `links` field, patch type.
- `lib/profile-links.ts` — **new** shared link resolution (legacy + unlimited, de-duped).
- `components/nest/profile/identity-box.tsx` — expandable bio, three metrics, links overlay.
- `components/nest/social/auth-gate-sheet.tsx` — centred premium auth modal.
- `app/profile/[handle]/profile-client.tsx` — stats + unlimited links.
- `app/profile/profile-dashboard-client.tsx` — stats, unlimited-links editor, "View as visitor" removed.
- `app/nest/[slug]/visitor-client.tsx` — creator hub drawer, Nest navigator, slide transition.
- `test/profile-links.test.ts` — **new**.

## Remaining concerns

1. **Item 9 was already functional** — I verified rather than rebuilt it. If you expected specific
   behaviour changes there (e.g. a different like animation), tell me what's missing; I didn't want
   to churn working code on a polish sprint.
2. **Creator-side unverified visually** (no session) — unchanged from 3.2–3.4.
3. **Google / Apple buttons** in your auth mock are **not** added: `signInWithGoogle` exists but has
   no UI anywhere, and Apple isn't implemented at all. Adding provider buttons is a feature +
   provider config, not polish — flagged rather than faked.
4. Interaction behaviours still lack unit tests (no jsdom/RTL in this repo); verified in-browser
   with recorded measurements, as in 3.4.
