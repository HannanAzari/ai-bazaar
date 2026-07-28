# BETA_UX_AUDIT.md

> **Day 2 of Beta Stabilisation — a UX researcher's design-review walkthrough of every
> major user-facing page.** Documentation only. No code was modified, nothing was fixed
> or removed, nothing committed. Where a bug or friction point was found it is **recorded,
> not repaired.**
>
> Method: each page was opened live on the running app (`localhost:3000`, LIVE Supabase
> backend, a founder-authenticated session) at **desktop (1280×800)** and **mobile
> (375×812)** viewports; button/input/state/API details were verified against source.

### A note on the screenshots
The browser-capture tool returns images to the assistant, not files on disk, so raw PNGs
could not be embedded into this markdown. Instead, **every page's "Screenshots" section is a
precise written description of what renders at each viewport** (this is what a screenshot
would show), plus the exact **capture recipe** (URL + viewport) so the founder — or a
follow-up pass — can reproduce the exact image. A `docs/beta-ux-audit/screenshots/` folder
exists as the drop location if PNGs are added later.

---

## Cross-cutting facts (true on every page)

- **Data is localStorage by default.** None of the core pages makes a REST call in its own
  code; discovery, social (likes/comments/follows), notifications, drafts, and publishing all
  read/write browser `localStorage`. Supabase is used **only** when `NEXT_PUBLIC_NEST_BACKEND=supabase`,
  always with a silent local fallback. The single in-page `fetch()` is `GET /api/auth/whoami`
  (founder-hub visibility). The generation studios (Asset/Nest/Avatar) DO call real `/api/*` routes.
- **Two navigation chromes.** App-shell pages (`/home /explore /create /notifications /profile
  /profile/[handle] /village`) use the **5-tab bottom nav** (Home · Explore · Create(+) ·
  Notifications · Profile). Auth pages (`/auth/login`, `/auth/sign-up`) use the **legacy V1
  `SiteHeader`** (home logo · Explore · profile avatar). The editor, factories, and visitor
  view use their own custom top bars. → inconsistent chrome across the journey.
- **Dev badge.** A "LIVE · SUPABASE" pill + circular "N" sits bottom-left in dev; on mobile it
  **overlaps the Home bottom-nav tab**. (Dev-mode only — should not appear in production, worth
  confirming.)
- **Developer terminology leaks** into user-facing surfaces: "Factory", "Studio",
  "Calibration", "Interpret", "DNA", "spec". Fine for founder tools; risky if users ever see them.
- **Guests aren't blocked with disabled states** — like/follow open a slide-up `AuthGateSheet`.
- **No `/settings` route exists** (see §14).

---

## 1. Home  ·  `/home`

**Screenshots** — capture: `/home` at 1280×800 and 375×812.
- *Desktop*: A full-bleed immersive room fills the viewport (a "Reels for rooms" feed). Serif
  header "Wander cozy Nests" top-left; a terracotta **Village** pill top-right. An "● EXAMPLE"
  pill top-left over the image. Bottom-left overlay: circular "N" avatar, "Nestudio", bold
  "Creator Loft", tags `#CREATOR #LOFT`. Right rail: heart `0`, comment `0`, share. 5-tab bottom nav.
- *Mobile*: Same layout, one Nest per screen. **At capture the hero room render was blank
  (beige gradient) while the text overlay showed** — likely a lazy-load/responsive-image delay,
  worth verifying on a real device. Dev badge overlaps the Home tab.

**Purpose** — An immersive vertical feed to wander into example/published Nests.

**Entry points** — `/` redirects here; Home bottom-nav tab; default landing after publishing.

**Primary goal** — Discover a Nest and tap in (visit the room, or the creator's house).

**Buttons** (all client-side, no API, no loading/success/error/disabled unless noted):
| Label | Action | Destination |
|---|---|---|
| Village pill | Link | `/village` |
| Feed card (whole room) | Link | `item.href` (published Nest URL / curated preview) |
| Like ♥ | `toggleLike` (local `nest-social`); guest → `AuthGateSheet` | none · success = heart fills + count pops |
| Comment ▢ | opens `CommentSheet` slide-up | none |
| Share | `navigator.share` else clipboard | none · success = "Copied!" 1.4s · **errors silently swallowed** |
| Follow (creator row) | `toggleFollow`; guest → auth sheet | hidden if no creator/self |
| Visit House | Link | `/@username` (only if username exists) |
| Create card (feed end) | Link | `/create` |

**Inputs** — none.

**Empty state** — dashed card "No Nests to wander yet" / "Be the first — make a cozy place that
feels like you." + "Create a Nest" (`/create`) + "Explore examples" (`/explore`).

**Loading** — `FeedSkeleton` shimmer for the first 600ms so the empty state never flashes.

**Errors** — none surfaced; share failures swallowed.

**Mobile** — vertical snap-scroll (one Nest per viewport), safe-area insets, tap targets fine;
the hero-image blank at capture + dev-badge/Home-tab overlap are the two concerns.

**Journey** — from `/` or bottom-nav → swipe feed → tap a room (visitor view) / "Visit House"
(`/@username`) / end-card → `/create`.

**Friction / recommendations (document only)**
- Home and Explore are both "discovery" and share a Village pill → two overlapping concepts.
- Silent share failure gives no feedback.
- Hero-render blank on mobile capture → verify image loading/responsive sizing.
- "EXAMPLE" pill wording is unexplained to a first-time visitor.

---

## 2. Explore  ·  `/explore`

**Screenshots** — capture: `/explore` at 1280×800 / 375×812.
- *Desktop*: Serif "Explore" + "Search cozy Nests, creators, and themes." + Village pill.
  Rounded search bar (magnifier, placeholder "Search Nests, creators & themes"). Category chips
  (Creator · Gamer · Writer · Minimalist). "TRENDING THEMES" chips (#creator #loft #gamer #writer
  #reading #zen #minimal). "Discover" heading with grid/list toggle (top-right). Two "EXAMPLE"
  Nest cards (Creator Loft; a neon Gamer room). Bottom nav.
- *Mobile*: single-column, chips wrap, cards stack.

**Purpose** — Active search/filter discovery (vs Home's passive feed).

**Entry points** — Explore bottom-nav tab; Home empty-state "Explore examples".

**Primary goal** — Find a specific Nest/creator/theme and open it.

**Buttons**
| Label | Action | Destination |
|---|---|---|
| Village pill | Link | `/village` |
| Category chip | `setCategory` toggle (client filter) | none · active = terracotta fill |
| Trending tag chip | `setTag` toggle | none (max 8 shown) |
| Grid / List toggle | `setLayout` | none |
| Nest card / creator / Visit | Link | `item.href` / `/@username` |
| "Create a Nest" (empty) | Link | `/create` |
| "Clear filters" (empty) | resets query+tag+category | none (only when filtering) |

**Inputs** — Search field: free text, no validation, placeholder "Search Nests, creators &
themes", default `""`, `fontSize:16` (prevents iOS zoom), `aria-label="Search"`, **no `inputMode`**.

**Empty state** — dashed "No Nests match your search yet." + "Create a Nest" + conditional "Clear
filters". (Same block also shows when there is genuinely no data.)

**Loading** — **none** (results derive synchronously via `useMemo`; no skeleton).

**Errors** — none.

**Mobile** — chips wrap; search input sized to avoid iOS zoom; no sticky search bar.

**Journey** — bottom-nav → search/filter → tap card / creator; dead-ends → `/create`.

**Friction / recommendations**
- Duplicates Home's discovery purpose; the two could be one surface.
- No loading state — on a slow hydrate the grid can flash empty then populate.
- Empty state can't distinguish "no results for your search" from "no data at all".
- Search input lacks `inputMode="search"` (mobile keyboard shows no Search key).

---

## 3. Create  ·  `/create`

**Screenshots** — capture: `/create` at 1280×800 / 375×812.
- *Desktop/Mobile* (near-identical, centered column): "Nestudio / **Create your Nest** / Step
  into a space that feels like you. No account needed to start." Three stacked cards: **Quick
  Start** (sand, ✨, "Create your Nest in under 2 minutes.", "Recommended" chip); **Turn your
  object into a Nestudio asset** (lilac, 🪄, "Photograph a real belonging and place it in your
  Nest."); **Build My Own** (white, 🎨, "Design every detail yourself."). Bottom nav (center + emphasised).
- Quick-Start sub-step: "Pick a ready-made Nest. You can change everything later." + template
  cards (Creator Loft "Creator · 4 pieces · ★ Featured"; Gamer Cave "Gamer · 2 pieces") + "Tap
  a template to choose it. No sign-up needed to start."

**Purpose** — The single creation entry: pick a path → create a `NestDocument` → open the editor.

**Entry points** — Create(+) bottom-nav tab; Home/Explore/Profile CTAs; `/design/nest-onboarding` redirect.

**Primary goal** — Land in `/nest-editor?document=<id>` (or `/creator-studio` for the AI path).

**Buttons** (3-step machine: entry → quick | build)
| Label | Action | Destination / API | States |
|---|---|---|---|
| Back | reset to entry | in-page | shown when not on entry |
| Quick Start card | `setStep("quick")` | in-page | — |
| Turn your object… card | `router.push` | `/creator-studio` | — |
| Build My Own card | `setStep("build")` | in-page | — |
| Template / Room card | select (ring) | in-page | — |
| **Use this template →** | `createFromTemplate` → `setDocOwner` → push | `/nest-editor?document=<id>` (local store / Supabase w/ fallback) | Loading "Opening…" · Disabled while busy · **Error: silently re-enables, no message** |
| Change template | `setSelTpl(undefined)` | in-page | stays clickable during "Opening…" |
| **Start with this room →** | `createFromBackground` → push | `/nest-editor?document=<id>` | Loading "Opening…" · Disabled while busy · **no error path (always returns a doc)** |

**Inputs** — none. Title is auto-derived ("My <name>" / "My Nest"). Selection is card-tap only.

**Empty states** — Quick: "No templates are published yet." · Build: "No rooms are published yet."

**Loading** — library hydrates on mount with no skeleton; only the "Opening…" button label.

**Errors** — template path re-enables the button silently on failure (no user message); background
path has no error handling; Supabase failures fall back to local silently.

**Mobile** — clean stacked cards, good spacing; template cards are a horizontal swipe row.

**Journey** — Create tab → 3 paths → select template/room → editor; or AI path → `/creator-studio`.

**Friction / recommendations**
- **"Turn your object into a Nestudio asset" (the AI path) routes to `/creator-studio`, which is
  founder-gated server-side** — a normal user who picks this card will hit a 403 downstream (see
  Day-1 audit). A user-facing card leads to a founder-only tool.
- Silent failure on "Use this template" (button just re-enables) — user gets no explanation.
- Three visual styles for the three cards (sand/lilac/white) with no shared logic → weak system.

---

## 4. Profile  ·  `/profile`

**Screenshots** — capture: `/profile` at 1280×800 / 375×812.
- *Desktop/Mobile*: Serif "Profile" + "＋ New" (top-right). **Claim-username card**: circular
  avatar, "Claim your username", "hannan.azari@gmail.com · pick a permanent …", sign-out ⇥ icon,
  `@username` input + "Claim" button (disabled when blank), hint "Lowercase, 3–20 chars,
  letters/numbers/underscore. Permanent for now." **Avatar card**: "Create a full-body Nestudio
  avatar from a photo. Private to you." + terracotta "Create Avatar". **Nestudio Studio** (founder
  only): ✨ header, "Founder" chip, "Build the official Nestudio world.", tiles **Create Asset ·
  Create Empty Nest · Character Calibration**, greyed "soon" chips (Official Asset Library · Empty
  Nest Library · Generation History). Drafts/Published sections render below (not in first fold).

**Purpose** — The creator's private dashboard: identity + avatar + drafts/published Nests (+ founder tools).

**Entry points** — Profile bottom-nav tab; default post-login redirect; editor/publish return here.

**Primary goal** — Resume creating (drafts) / manage & share published Nests / start new.

**Buttons**
| Label | Action | Destination / API |
|---|---|---|
| ＋ New / "Create a Nest" | Link | `/create` |
| "Explore examples" (empty) | Link | `/home` |
| Claim (username) | `claimUsername` (local/Supabase) | inline error on fail; disabled when blank |
| Sign-out ⇥ | `signOut` | — |
| Create Avatar | Link | `/profile/avatar` |
| Draft NestCard | Link | `/nest-editor?document=<id>` (badge "Draft") |
| Published NestCard | Link | `publishedUrl(entry)` (badge "Live") |
| Studio tiles (founder) | Link | `/asset-factory` · `/nest-factory` · `/nest-studio/calibration` |

**Inputs** — Username: lowercase, 3–20 chars, `[a-z0-9_]`, placeholder "@username", default `""`.

**Empty state** — "Your Nest awaits" / "Make your first Nest…" + Create + Explore. `ActivityToday`
renders nothing with no activity.

**Loading** — none explicit (local reads); founder Studio renders nothing until `whoami` resolves.

**Errors** — username claim inline error; no async error paths otherwise.

**Mobile** — cards stack; **founder Studio tiles are a 2-col grid with uneven heights** (Create
Asset = 1 line vs the 2-line tiles); dev badge overlaps Home tab.

**Journey** — bottom-nav / post-login → `/create`, `/nest-editor`, a published URL, `/profile/avatar`, or a founder tool.

**Friction / recommendations**
- **The founder-only "Nestudio Studio" block lives inside the normal user Profile** — mixes two
  audiences on one page (it's `whoami`-hidden for non-founders, but it's still the profile's
  visual centre for founders, pushing the user's own drafts below the fold).
- **"Claim your username" here duplicates the identical claim step inside the Publish gate** (§11).
- "Permanent for now" is self-contradictory wording.
- Uneven founder-tile heights; "soon" chips add visual noise.
- Sign-out is a small unlabelled ⇥ icon (discoverability + a11y).

---

## 5. Login  ·  `/auth/login`

**Screenshots** — capture: `/auth/login` at 1280×800 / 375×812.
- *Desktop/Mobile*: Legacy **V1 SiteHeader** (home logo "Nestudio" · "Explore" · profile avatar).
  A parchment card: terracotta home glyph, "NESTUDIO", serif "**Welcome back to your Nest.**",
  "Sign in with your email and password.", **Email** field (✉, "you@example.com"), **Password**
  field (🔑, "At least 6 characters"), terracotta "**Log in →**", "New to Nestudio? **Create your account**".

**Purpose** — Sign an existing user in.

**Entry points** — Sign-up "Log in" link; any gated route appending `?next=`. Not in bottom-nav.

**Primary goal** — Authenticate → land on `?next=` (safe same-origin) or `/profile`.

**Buttons**
| Label | Action | Destination / API | States |
|---|---|---|---|
| Log in → | `signIn(email,password)` (local `nest-account` / Supabase SDK) | success → `?next=` or `/profile` | Loading "Signing in…" + disabled · Error = rose banner · no success toast |
| Create your account | Link | `/auth/sign-up` | — |

**Inputs**
| Field | Validation | Placeholder | Type / keyboard | Req | Default |
|---|---|---|---|---|---|
| Email | `type=email`, required | you@example.com | email | yes | "" |
| Password | `minLength=6`, `required={!isDemoMode()}` | "At least 6 characters" / "Not needed in demo" | password | prod: yes | "" |

**Empty / Loading / Errors** — no empty state. Loading = button label + disabled. Errors: demo
"**Wrong email or password.**"; prod = Supabase message or "Sign-in failed." No 401/403 UI beyond the banner.

**Mobile** — single card, legacy header on top; keyboard covers nothing critical; letterboxed cream below.

**Journey** — from sign-up link / gated `?next=` → `?next=` target or `/profile`.

**Friction / recommendations**
- **Password says "At least 6 characters" but the backend requires 8** (`validatePassword` →
  "Use at least 8 characters."). A 6–7 char password passes HTML validation then fails at submit. **(bug)**
- Legacy V1 header here vs app-shell nav elsewhere → chrome whiplash.
- Demo-mode copy ("any email signs you in") contradicts the code, which still returns "Wrong
  email or password." for an unknown email.
- **No Google/OAuth button** although `signInWithGoogle` exists in the codebase.

---

## 6. Signup  ·  `/auth/sign-up`

**Screenshots** — capture: `/auth/sign-up` at 1280×800 / 375×812.
- *Desktop/Mobile*: Legacy V1 header. Card: teal ✨ glyph, "NESTUDIO", serif "**Create your
  Nest.**", "Make your account, then step into a space that feels like you.", **Display name**
  (👤 "Your name"), **Email** (✉ "you@example.com"), **Password** (🔑 "At least 6 characters"),
  teal "**Create account →**", "Already have an account? **Log in**".

**Purpose** — Register a new account.

**Entry points** — Login "Create your account"; sign-up CTAs. Not in bottom-nav.

**Primary goal** — Register → `trackEvent("signup_completed")` → onboard.

**Buttons**
| Label | Action | Destination / API | States |
|---|---|---|---|
| Create account → | `signUp(email,password,name)` | success → **`/onboarding`** | Loading "Creating…" + disabled · Error banner · Confirm-notice banner |
| Log in | Link | `/auth/login` | — |

**Inputs**
| Field | Validation | Placeholder | Req | Default |
|---|---|---|---|---|
| Display name | text, required | "Your name" | yes | "" |
| Email | `type=email`, required | you@example.com | yes | "" |
| Password | `minLength=6`, `required={!isDemoMode()}` | "At least 6 characters" | prod: yes | "" |
(no `inputMode` on any field)

**Errors** — rose banner: "Enter a valid email address.", "**Use at least 8 characters.**",
"An account with this email already exists. Sign in instead." (or Supabase / "Sign-up failed.").
Teal notice: "**Check your email to confirm your account, then sign in.**" (Supabase confirm-on;
sign-up "succeeds" with no session, user stays on page).

**Journey** — from login → **`/onboarding`** on success (or stays with confirm notice).

**Friction / recommendations**
- **Same 6-vs-8 password mismatch bug** as Login.
- **Success routes to `/onboarding`, which the Day-1 audit found runs the abandoned legacy
  shop/house funnel** (ends on `/shop/[address]`, now redirected to `/home`). The new user's very
  first flow is broken. **(highest-impact journey defect)**
- Sign-up **ignores `?next=`** — a user gated into sign-up from Avatar Studio can't be returned there.
- Confirm-email path leaves the user on a page that still shows the filled form (no clear next step).

---

## 7. Avatar Studio  ·  `/profile/avatar`

**Screenshots** — capture: `/profile/avatar` at 1280×800 / 375×812.
- *Desktop/Mobile*: A phone-frame column. Back ← + "**Your Avatar** / Your digital self, made
  from a photo." A large dashed **3:4 upload card** (image-plus icon, "**Choose a photo** / A clear
  photo of you, facing the camera."). A disabled tan "**Continue**" bar pinned at the bottom. Tab
  title shows a doubled "My Avatar · Nestudio · Nestudio".

**Purpose** — Turn a user's photo into a private full-body avatar (the first *user-owned* generation).

**Entry points** — Profile "Create Avatar" / avatar-manager. **Not** in the founder hub.
Server-gated by `requireAvatarAccess` (founder-only until `AVATAR_PUBLIC_ENABLED=1`; else user 403 "in founder testing").

**Primary goal** — "Use avatar" → publish one active, private avatar (private bucket + `profiles.avatar_url`).

**Buttons** (shared studio stages; avatar specifics)
| Stage | Label | Action / API | States |
|---|---|---|---|
| input | Choose/Change photo | local FileReader | — |
| input | **Continue** | `translate` → `POST /api/ai/avatar/translate` | Loading "Reading your photo…" · **Disabled until photo + all 3 consent boxes** · 401→login · 403→beta message |
| spec | Adjust style | → reset | — |
| spec | **Create Avatar** | `generate` → `POST /api/ai/avatar/generate` | Loading phrases cycle 8s ("Finding your features"…"Almost ready") · disabled if moderation fails |
| review | Try again | re-generate | — |
| review | **Use avatar** | `publish` → `POST /api/avatar/publish` | Loading "Saving your avatar…" · **approve always enabled** (clean reveal, no questions) |
| saved | Create another | reset | — |

**Inputs** — required photo (`accept=image/*`); **3 required consent checkboxes** ("I have
permission…", "…processed to create an avatar", "I can delete the source photo and result");
optional style textarea ("Optional — a word about your style (glasses, smart-casual)…"); 3 style
cards (Soft/Balanced/Bold); "Name your avatar" text input.

**Empty / Loading / Errors** — consent gate is the blocking empty state (Continue disabled until
consented); upload-required; emotional loading phrases; moderation `Warn` "Please try another
photo"; `AvatarReveal` fades the result in on a checker bg; errors as rose banner. **30s slow-
timeout escape hatch** ("Taking longer than expected" → Keep waiting / Cancel safely).

**Mobile** — phone-first; large tap target for upload; sticky bottom action bar with safe-area.

**Journey** — from `/profile` → back to `/profile` (avatar shows on profile; private to user).

**Friction / recommendations**
- On desktop the consent checkboxes aren't visible until a photo is chosen — the disabled
  "Continue" gives no hint *why* it's disabled (needs photo **and** consent).
- Doubled tab title "· Nestudio · Nestudio". **(bug)**
- "Interpret/translate/spec" internals are hidden well here, but "Advanced details (details)" still
  exposes DNA/camera/cost jargon.
- Beta-gate 403 copy ("in founder testing right now") will confuse a normal user who reached the
  page from their own profile.

---

## 8. Asset Factory  ·  `/asset-factory`  *(founder-only)*

**Screenshots** — capture: `/asset-factory` at 1280×800 / 375×812.
- *Desktop*: Phone-frame column centred with cream margins. Back ← + "**Asset Factory** / Describe
  it — Nestudio makes it belong." A large textarea (placeholder "e.g. A warm acoustic guitar with
  a medium-brown wooden body and a simple modern shape."), an "Upload a reference (optional)" pill,
  a disabled tan "**Interpret →**" bar. Doubled tab title "· Nestudio · Nestudio".

**Purpose** — Founder tool: describe an object → generate a transparent catalog asset → publish to the global library.

**Entry points** — Founder hub "Create Asset"; nest-editor Asset drawer "Create". Server `requireFounder`.

**Primary goal** — Approve & Add one global asset to `nest_assets` + Storage.

**Buttons / flow** (shared `GenerationStudio`: input → interpreting → spec → generating → review → publishing → saved)
| Stage | Label | API | States |
|---|---|---|---|
| input | Interpret → | `POST /api/ai/translate` | disabled until text · Loading "Interpreting…" · 401/403/"Could not interpret the request." |
| input | Upload a reference (optional) | local | — |
| spec | Generate · $X.XX | `POST /api/ai/reference` (if no upload) → `POST /api/ai/generate` | phrases "Studying…","Shaping it","Crafting…","Adding the Nestudio finish" · disabled if moderation fails |
| review | Regenerate / Edit / **Approve & Add** | `POST /api/founder/publish-asset` | Loading "Publishing to your Nestudio library…" · **disabled until the review question = Yes** · Error "Publish failed: … retry Approve." |
| saved | Create another | reset | — |

**Inputs** — description textarea; optional reference upload (checker preview); spec editing (name,
"Generation subject", read-only Class/Role/Materials/Interaction/Pose/Placement/Surface/Est. cost);
`Warn` chips (Brand-neutral, Safety); review question "**Would I proudly place this in a Nest?**".

**Empty / Loading / Errors** — spec `Warn` chips; amber brand-neutrality banner; segmentation
best-effort (20s/15s timeouts → falls back to full image); 150s generation timeout; **30s slow
escape hatch**. Saved: "✓ <name> published … Saved to Supabase … survives reload."

**Mobile** — phone-native; sticky bottom action bar; safe-area.

**Journey** — founder hub / editor → back to `/nest-editor` (asset appears in the Assets tray).

**Friction / recommendations**
- Doubled tab title. Developer name "Factory" + "Interpret" + cost strings are founder-facing (OK
  for founders, but this page is one click from a *user*-facing Create card via `/creator-studio`).
- On desktop the phone-frame column with wide cream margins wastes space and looks unfinished.

---

## 9. Nest Factory  ·  `/nest-factory`  *(founder-only)*

**Screenshots** — capture: `/nest-factory` at 1280×800 / 375×812.
- *Desktop*: Same phone-frame shell. "**Nest Factory** / Describe an empty room — Nestudio builds
  the stage." Textarea (placeholder "e.g. A warm modern music studio with a large back wall, wooden
  floor and soft evening light."), hint "Architecture only — walls, floor, ceiling, windows, light,
  mood. No furniture; creators decorate it later.", disabled "**Interpret →**". Doubled tab title.

**Purpose** — Founder tool: describe an EMPTY room → text-to-image → publish to the Nest Library (`nest_backgrounds`).

**Entry points** — Founder hub "Create Empty Nest". Server `requireFounder`.

**Primary goal** — Approve & Publish one empty Nest, selectable in Create → Build My Own.

**Buttons / flow** — identical shell to Asset; `uploadMode:none` (no upload UI).
| Stage | Label | API | States |
|---|---|---|---|
| input | Interpret → | `POST /api/ai/nest/translate` | disabled until text · "Could not interpret the room." |
| spec | Generate · $X.XX | `POST /api/ai/nest/generate` | Loading "Designing your space" |
| review | Regenerate / Edit / **Approve & Publish** | `POST /api/founder/publish-nest` | "Publishing to your Nest Library…" · disabled until question Yes ("**Would I proudly let creators build inside this Nest?**") |
| saved | Create another | reset | — |

**Inputs** — description textarea; spec editing (name; "Room description"; read-only
Category/Mood/Style/Walls/Floor/Windows/Lighting/Est. cost; "suits:" tags); Brand-neutral + Safety chips.

**Empty / Loading / Errors** — no upload state; DNA check list in "Advanced details (DNA checks ·
cost · camera)"; image at `NEST_EDITOR_ASPECT`, opaque (no checker). Saved: "Open Create → Build My Own…".

**Mobile** — phone-native shell, sticky action bar.

**Journey** — founder hub → back to `/create` (Build My Own chooser).

**Friction / recommendations**
- Doubled tab title; same phone-frame-on-desktop whitespace as Asset.
- Shares the exact shell with Asset Factory — good consistency, but also means both inherit the
  founder-jargon and the desktop letterboxing.

---

## 10. Nest Editor  ·  `/nest-editor?document=<id>`

**Screenshots** — capture: reach via `/create` → Quick Start → a template → "Use this template".
- *Desktop/Mobile* (a `fixed inset-0` phone-first fullscreen editor): Top bar — back ←, undo,
  redo, "⋯" More, terracotta "**⬆ Publish**", ink "**Done**" (label mirrors save state, e.g. "All
  changes saved"). A "MAIN NEST" badge. A dismissible toast "Tap a piece to edit it — or Publish
  when you're ready." The room fills the canvas; **placed assets render as labelled bounding-box
  outlines (`ast-tv`, `ast-lr-sofa-boucle`, `ast-so-shelf-tall`, `ast-lr-table-oak-round`) rather
  than furniture images**. Bottom-left: "Text", "Sticker". Bottom command bar: **Arrange · Assets ·
  Connect · Focus · Surface · Preview**.

**Purpose** — The single fullscreen editor to arrange assets, wire interactions, author focus/surfaces, preview, and publish one Nest.

**Entry points** — `/nest-editor?document=<id>` (also `?doc=`, `?pick=`) from Create/templates/Profile draft/visitor "Edit Nest".

**Primary goal** — Compose and publish a Nest.

**Buttons**
| Label | Action | Destination / API |
|---|---|---|
| Back to Profile (←) | hard nav | `/profile` |
| Undo / Redo | local history | disabled via `canUndo/canRedo` |
| More (⋯) | menu: role, zoom/Fit, Advanced, Grid/Snap, Save now, Load draft, Import/Export JSON, Reset | all local/localStorage |
| **Publish** | opens `PublishGate` overlay (§11) | no direct API |
| **Done** | `saveNow()` → `window.location.href="/profile"` | local |
| Arrange/Assets/Connect/Focus/Surface | set `mode` (open bottom sheets) | local state (Focus hidden in detail scenes) |
| Preview | `mode="preview"` → renders the real visitor `NestSceneNavigator` | local |
| Text / Sticker | add overlay (sticker via hidden file input) | local |
| Asset outline (per piece) | select/drag/resize | local |

**Inputs** — asset placement/drag/resize on canvas; text + sticker overlays; hotspot bindings
(Connect); surface content (Surface); focus-area geometry (Focus); JSON import (hidden file input).

**Empty state** — no assets: "Tap Assets to add your first piece, then Publish when ready." When
populated: "Tap a piece to edit it — or Publish when you're ready."

**Loading** — `NestEditorMount` renders `null` while identity + doc load (portal mounts when ready).

**Errors** — **ownership gate**: a doc you don't own → state `"denied"` → "This Nest isn't yours to edit" + Back-to-Home.

**Mobile** — the whole surface is phone-first: `fixed inset-0`, `touchAction:none`, `env(safe-area-inset-*)`,
≥44px targets, bottom sheets with snap points. This is the intended primary form factor.

**Journey** — from Create/template/Profile draft/visitor Edit → Publish (gate) or Done → `/profile`.

**Friction / recommendations**
- **Placed assets appear as labelled outlines in the editor but as solid furniture in the visitor
  view (§12)** — the edit canvas doesn't show the real render, so a creator can't see what they're
  actually composing until Preview/publish. **(significant — record & verify)**
- Six bottom-bar modes ("Connect/Focus/Surface") expose a lot of power with developer-ish names;
  no onboarding beyond the one toast.
- "Done" vs "Publish" both live top-right; "Done" silently leaves to Profile without publishing —
  easy to confuse "Done" with "finish & publish".
- More-menu mixes user actions (Save now) with debug tools (Grid/Snap, Import/Export JSON, Reset).

---

## 11. Publish  ·  `PublishGate` (overlay inside the editor)

**Screenshots** — capture: in the editor, tap **Publish**.
- *Desktop/Mobile*: A centred bottom-sheet card over the dimmed room. Observed at the **username
  stage**: "**Claim your username** / Signed in as hannan.azari@gmail.com. Pick a permanent
  username." + `@username` input + disabled "**Claim @username**". (Other stages: sign-in panel;
  name + 4 visibility radios + Publish; success panel.)

**Purpose** — A gated dialog that turns the draft into a published, shareable Nest.

**Entry points** — Editor Publish button (`showPublish`). Not a route.

**Primary goal** — Sign in → claim username → name + visibility → publish → shareable link.

**Buttons**
| Stage | Label | Action / API | States |
|---|---|---|---|
| not signed in | (AuthPanel — delayed sign-up) | — | — |
| no username | **Claim @username** | `claimUsername` | disabled when blank · inline error |
| ready | **Publish (`<visibility>`)** | `persistDoc` → `setDocOwner` → `publish(id,visibility)` (local `nestudio-published` map; Supabase if backend set, silent fallback) | Loading "Publishing…" + disabled · Errors "No document to publish." / "Sign in to publish." / "Publish failed." |
| success | Copy / **Open my Nest →** / Back to Profile | clipboard / `window.location.href=result.url` / `/profile` | "Copied!" toggle |

**Inputs** — `@username` (claim stage); **Name your Nest** (seeded from `doc.title`); 4 visibility
radios (**Public · Unlisted · Followers only · Private**).

**Empty / Loading / Errors** — heading changes per stage; red inline errors; success = green "Your
Nest is live 🎉" + read-only URL box.

**Returned URL** — Public/Unlisted → `/nest/<slug>?c=<encoded doc>` (portable, works anywhere).
Followers/Private → bare `/nest/<slug>` (**only the owner can open it**). `slug` = slugified title + 5 random chars.

**Mobile** — bottom-sheet, safe-area; inputs trigger the keyboard over the dimmed editor.

**Journey** — editor Publish → (sign-in) → (claim username) → name/visibility → success → Open Nest / Profile.

**Friction / recommendations**
- **Username claim mid-publish duplicates the Profile claim step (§4)** — a user who already ignored
  it on Profile is interrupted again at the moment of publishing.
- The **portability gotcha is invisible to users**: Followers/Private produce a bare-slug link that
  only the owner can open (localStorage backend) — a creator could share a link that shows nobody anything.
- Four visibility options at first publish is a lot of decision for a Beta; no plain-language help text.

---

## 12. Visitor Nest  ·  `/nest/<slug>?c=<encoded>`

**Screenshots** — capture: open the shareable link from a Home feed card (the `?c=` URL).
- *Desktop/Mobile*: Full-bleed room, **rendered with real furniture** (sofa, TV, shelves, table).
  Top-left creator chip ("N · A Nestudio creator"); top-right "**Exit**". Right engagement rail:
  ♥ 0 · ▢ 0 · share. Bold title "Creator Loft" bottom-left. `max-w-[460px]`, `100dvh`, no page scroll.

**Purpose** — Fullscreen public viewer of one published Nest; engage (like/comment/share/follow); owner can manage.

**Entry points** — `/nest/<slug>?c=<encoded>` (portable link) or bare `/nest/<slug>` (owner's browser / server backend). `noindex`.

**Primary goal** — Experience the room and engage; owner branches to edit/manage.

**Buttons**
| Label | Action | Destination |
|---|---|---|
| Creator chip | opens `CreatorDrawer` | local |
| Exit | `router.back()` else `/@username` else `/village` | — |
| Like / Comment / Share | `nest-social` (keyed by slug) / share `href=/nest/<slug>` | local |
| Visit House (visitor) | Link | `/@username` |
| Edit Nest / View House / Stats (owner) | Link / sheet | `/nest-editor?document=<id>` · `/@handle` · StatsSheet |
| Follow (in drawer, non-owner) | `toggleFollow` | local |

**Inputs** — none on the view (comments handled inside the Comment component).

**Empty / error states** (`Gate`): **notfound** — "Nest not found — This Nest link is invalid or
was never published."; **private** — "This Nest is private — The owner hasn't shared this Nest
publicly." Both offer "Create your own" (`/create`) + "Explore Nests" (`/home`).

**Loading** — renders `null` while `resolvePublished` runs.

**Resolution** — `?c=` present → decode (works in any browser). Else Supabase backend (RLS) → row
or private. Else local `nestudio-published` map → owner-only for non-shareable. **A bare
`/nest/<slug>` without `?c=` resolves to notfound in any browser but the publisher's own** (default local backend).

**Mobile** — `100dvh`, `overflow-hidden` (no scroll), safe-area, `active:scale-95` tap feedback,
left-slide drawer with `prefers-reduced-motion` guard.

**Journey** — from a shared link / Profile / village → Exit returns back; owner → Edit / View House.

**Friction / recommendations**
- **The editor shows outlines but the visitor view shows real furniture** — the two renders don't
  match, so creators compose blind (see §10). **(record & verify)**
- **The whole visitor experience hinges on the `?c=` payload** on the default local backend; a bare
  slug (or a Followers/Private link) shows "Nest not found/private" to everyone but the owner. This
  is the Day-1 "no real cross-device visitor experience" risk, felt here directly.
- "A Nestudio creator" placeholder identity when no username is claimed → anonymous-feeling visits.

---

## 13. Notifications  ·  `/notifications`

**Screenshots** — capture: `/notifications` at 1280×800 / 375×812.
- *Desktop/Mobile*: Serif "Notifications"; a dashed card with a bell icon, "**No notifications
  yet**", "When people interact with your Nest, you'll see it here." (signed-in empty state). Bottom nav.

**Purpose** — Newest-first inbox of likes/follows/comments on the user's Nests.

**Entry points** — Notifications bottom-nav tab (with unread badge); `/updates` redirects here.

**Primary goal** — Read recent interactions; opening the tab auto-clears the unread badge.

**Buttons**
| Label | Action | Destination |
|---|---|---|
| Notification row | Link via `describe()` | like/comment → `/nest/<id>`; follow → `/@username` or `/profile` |

(No "Mark all read" button — marking is automatic on mount via `markAllRead`.)

**Inputs** — none.

**Empty states** — signed-out: "No notifications yet" / "Sign in to see when people like, follow,
or comment on your Nests." · signed-in: "…When people interact with your Nest, you'll see it here."

**Loading** — renders `null` while identity resolves.

**Errors** — none (local reads).

**Mobile** — standard app-shell page; bottom nav; dev badge overlap on Home tab.

**Journey** — bottom-nav / `/updates` → tap a row → `/nest/<id>` or `/@handle`.

**Friction / recommendations**
- Unread auto-clears on mount, so a glance from another tab can silently zero the badge before the
  user reads anything.
- A **second, orphaned notifications UI exists** (`components/notifications-client.tsx`, with
  "Mark all read" + per-row read toggle) that is **not imported anywhere** — dead code / drift.
- Empty state gives no way to test/seed a notification.

---

## 14. Settings  ·  **(route does not exist)**

**Screenshots** — none: **there is no `/settings`, `/account`, or `/preferences` route in the app.**

**Finding** — Item 14 on the audit list has no implementation. The pieces a "Settings" page would
normally hold are scattered:
- **Sign out** — the ⇥ icon on the Profile username card.
- **Username** — the claim card on Profile (and again in the Publish gate).
- **Avatar** — the Avatar card on Profile → `/profile/avatar`.
- **Privacy/legal** — `/privacy`, `/terms`, `/safety`, `/contact` (footer-only, legacy V1 chrome).
- **Account deletion, email change, notification prefs, theme, data export** — **none exist.**

**Recommendation (document only)** — Beta needs at least a minimal account surface (sign out,
delete account, privacy links, avatar). Today these are either missing or buried in the Profile card.

---

## Top friction themes (summary — document only, do not fix)

| # | Theme | Where | Severity |
|---|---|---|---|
| 1 | Sign-up → `/onboarding` legacy shop funnel (broken first-run) | §6 | 🔴 |
| 2 | Password "6 chars" UI vs 8-char backend rule | §5 §6 | 🔴 |
| 3 | Editor renders asset outlines; visitor renders real furniture (compose-blind) | §10 §12 | 🔴 |
| 4 | Visitor experience depends on the `?c=` payload; bare/private slugs show nothing | §11 §12 | 🔴 |
| 5 | "Turn your object" user card leads to founder-gated `/creator-studio` (403) | §3 | 🟠 |
| 6 | Username claim duplicated (Profile + Publish gate) | §4 §11 | 🟠 |
| 7 | Founder "Studio" block embedded in the user Profile | §4 | 🟠 |
| 8 | Two chromes: legacy V1 header on auth pages vs app-shell nav | §5 §6 | 🟠 |
| 9 | Home & Explore both "discovery" (overlap) | §1 §2 | 🟡 |
| 10 | Developer terminology: Factory/Studio/Calibration/Interpret/DNA | §7–§9 | 🟡 |
| 11 | Silent failure states (Create "Opening…", share) — no user feedback | §1 §3 | 🟡 |
| 12 | Doubled tab titles "· Nestudio · Nestudio" on the studios | §7–§9 | 🟡 |
| 13 | Dev "LIVE · SUPABASE" badge overlaps the Home nav tab (mobile) | cross-cutting | 🟡 |
| 14 | Home hero render blank on mobile at capture (verify) | §1 | 🟡 |
| 15 | No Settings/account page; no OAuth button though code exists | §14 §5 | 🟡 |
| 16 | Uneven founder-tile heights; unlabelled sign-out icon (a11y) | §4 | ⚪ |

---

### Appendix — capture log
Live walkthrough on `localhost:3000` (founder session, LIVE Supabase). Desktop (1280×800)
captured for all 13 real pages: Home, Explore, Create (+ Quick Start), Profile, Login, Sign-up,
Avatar, Asset Factory, Nest Factory, Nest Editor, Publish gate, Visitor Nest, Notifications.
Mobile (375×812) captured for Home, Create, Login, Profile (representative of the shared app-shell
chrome; the editor/visitor are `fixed inset-0` phone-first by construction). Button/input/state/API
details verified against source (`app/*`, `components/nest/*`, `components/generation/*`,
`lib/generation-platform/*`, `lib/nest-*`). No code changed. Not committed.


