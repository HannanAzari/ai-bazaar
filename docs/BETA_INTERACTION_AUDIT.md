# M22 — Interaction Audit (lived, not reasoned)

> I used Nestudio as a first-time visitor: landed on Home, searched Explore for nonsense, walked
> into a stranger's house, tried to like their Nest as a guest, switched rooms, hit a broken link.
> Everything below is something I *felt*, not something I inferred from code.
> Gates: **typecheck · lint (0 errors) · 675 tests** green. **Not committed.**

Severity: 🔴 breaks the feeling · 🟠 real friction · 🟡 polish · ⚪ noted

---

## Fixed immediately

### I-01 🔴 The app labelled every home "LIVE" / "DEMO" / "EXAMPLE"
**Flow:** Home, Explore — the first thing anyone sees.
**Was:** every card carried a badge from the *data layer*: `published → "Live"`, `curated →
"Example"`, else `"Demo"`.
**Why it felt wrong:** I read "LIVE" and expected a livestream. "DEMO" told me the product itself
was fake. It is internal vocabulary stamped on the most emotional surface in the app — the moment
you're supposed to feel you're looking at someone's home, you're looking at a build status.
**Now:** a real person's Nest carries **no badge at all** (a home doesn't need one). Only curated
sample rooms are marked, quietly, as "Example" so nobody mistakes a showcase for a real home.
**Nothing was added — a label was removed.**

### I-02 🟠 The app blamed the creator for a broken link
**Flow:** opening a shared Nest link.
**Was:** *"This Nest is private — The owner hasn't shared this Nest publicly."*
**Why it felt wrong:** the Nest I opened **was public**. This screen is also reached when a link
simply can't be resolved, so the app confidently told me something false about a stranger's
intentions, and left me with nothing to do about it.
**Now:** *"This Nest isn't open — It may be private, or the link may be incomplete. Ask the creator
for a fresh link."* Honest about both cases, and it hands me a next move.

### I-03 🟠 Searching for nothing told me to go build a house
**Flow:** Explore → search "zzzzqqq".
**Was:** "No Nests match your search yet." with **Create a Nest** as the primary button and "Clear
filters" secondary.
**Why it felt wrong:** I was mid-search, in a browsing mindset. Being told to create my own home
reads as the app deflecting — the useful action is to get back to looking.
**Now:** while searching → *"Nothing here yet — try a different word."* with **Clear search** as
the single primary. Genuinely empty (no filter) still leads with **Create a Nest**. Same box, the
action now matches why it's empty.

### I-04 🟡 The auth modal pitched before it explained
**Flow:** guest taps ♥ inside a Nest.
**Was:** title → four perks → *then* "Sign in to like this Nest".
**Why it felt wrong:** the reason I was interrupted arrived after the sales pitch.
**Now:** the contextual line leads, perks support it. Verified live: modal is centred, blurred
backdrop, and the copy reads "Sign in to like this Nest — it only takes a moment."

### I-05 🟡 Doubled browser titles / legacy header on auth *(carried from M21)*
"Asset Factory · Nestudio · Nestudio" and the pre-pivot header on `/auth/*` both made the product
feel stitched together. Both fixed.

---

## What already feels good (worth protecting)

- **Entering a Nest.** The door transition into a room genuinely feels like arriving, not routing.
  The single "Enter Nests" CTA earns the moment.
- **The creator drawer** now reads as walking up to someone rather than opening a profile — the
  room stays visible behind it, Follow sits where you expect, and the Nest list switches rooms
  in place with a short slide.
- **Guest → like → join** is a good moment: centred modal, contextual reason, no navigation away.
- **The house on the profile** sits on the ground and feels like a destination, not a hero image.
- **Empty states on Home / Profile / Notifications** all explain themselves and offer one action.

---

## Deferred (needs a founder decision, not a tweak)

| # | Sev | What I felt | Why it isn't a quick fix |
|---|---|---|---|
| **I-06** | 🔴 | A shared Nest link only truly opens for its author unless the long `?c=` payload rides along. As a visitor I hit "isn't open" on a public room. | Backend decision (turn on the Supabase Nest backend) — Day-1 §7. The copy fix (I-02) is the honest stopgap, not the cure. |
| **I-07** | 🟠 | Home and Explore feel like the same place twice — same Village pill, same rooms, different tab. | Information architecture; changes the 5-tab bar. Explicitly your call (M21-B). |
| **I-08** | 🟠 | Publishing interrupts to ask for a username I was never told I'd need. | Touches the editor's publish path — the most delicate flow in the app (M21-A). |
| **I-09** | 🟡 | Four places render *nothing* when empty: no links, no avatar, no comments, no likes. They don't feel broken, but they don't invite either. | Writing copy for four states is a content decision; I didn't want to invent voice. |
| **I-10** | 🟡 | The dev badge ("LIVE · SUPABASE") sits on top of the Home tab on mobile. | Dev-only build artefact; harmless in production but it obscured a primary control every time I tested. |
| **I-11** | ⚪ | On one mobile capture the Home hero rendered blank while the overlay text was already visible — the room "popped" in late. | Needs device profiling to confirm; may be dev-server image serving rather than a real regression. |

---

## Micro-interaction notes

**Immediate feedback exists** on: like (optimistic + pop), follow (morphs to "Following"), share
("Copied!" for 1.4s), publish ("Publishing…"), generation (warm rotating phrases), avatar removal
("Removing…"), Nest switching (240ms directional slide), drawer (340ms slide-in), modals (fade +
scale), links popover (fade + scale). All animation respects `prefers-reduced-motion`.

**Where feedback is still silent** — recorded, not fixed, because each is a behaviour change rather
than polish: tapping "Use this template" can fail and simply re-enable the button with no message;
the share action swallows its errors entirely. Both leave you unsure whether you did something
wrong.

---

## Honest limits of this audit

- **I could not test as a signed-in creator.** No Supabase session on the dev server and I don't
  sign into accounts, so the *returning creator* journey (edit → publish → notifications) was
  walked by reading state and routes, not by feeling it. Everything above marked "lived" was on
  the guest/visitor side.
- **Expired session, cancelled sign-in and failed login were not exercised** for the same reason.
- I tested 375 / 390 / 430 widths. **Large accessibility fonts, landscape, and very small phones
  remain unverified** — as does haptics, which the web app has no access to.
- Screenshots throughout used locally seeded demo data (a fictional creator), since there's no
  real account to browse.

## Files touched

`components/nest/app-shell/discovery.tsx` (I-01) · `app/nest/[slug]/visitor-client.tsx` (I-02) ·
`app/explore/explore-client.tsx` (I-03) · `components/nest/social/auth-gate-sheet.tsx` (I-04).
