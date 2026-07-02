# Nestudio Creator Onboarding V2 — A Home in Under Five Minutes

> How a creator builds a house in **< 5 minutes** by **connecting content**, not designing a
> room. Built on the Portal model ([wall-object-system.md](wall-object-system.md)) and the
> spatial-link system ([spatial-link-system.md](spatial-link-system.md)).
>
> **Product/UX/IA design only.** No code, assets, rooms, or commits.
>
> **M13 update (2026-07-02):** the built onboarding flow (`/design/nest-onboarding` → Quick
> Start / Build My Own) opens the single editor at `/nest-editor?document=<id>` on real
> production placements. M13 restored the Golden Nest assets to the tray, repointed the Quick
> Start templates (TV→`ast-tv`, desk→`ast-desk`, flawed chair dropped), and the editor's
> **Done** button now returns the creator to `/studio` (their profile), not the homepage.
> See [m13-mobile-stabilisation.md](m13-mobile-stabilisation.md).

---

## 1. The promise

> **"You bring your links. We build your home."**

The creator never designs a room. They **pick a type → connect content → done.** AI handles
furniture, decoration, layout, composition, and atmosphere.

## 2. The four-step flow

```
STEP 1  Pick creator type            (~5s)
STEP 2  AI suggests a room of PORTALS (instant — a starter "portal kit")
STEP 3  Connect content              (~2–3 min — mostly pasting URLs / uploading)
STEP 4  AI composes the room         (instant) → Accept or Customize  (~30s)
                                      → PUBLISH (live at the three-word address)
```

### Step 1 — Pick creator type
Ten one-tap options: **YouTuber · Developer · Designer · Artist · Musician · Writer · Startup
Founder · Creator · Business · Custom.** (Custom = start from an empty portal palette.)
Optional: **Auto-detect** — paste your main profile/socials and Creator Auto Build
(`lib/creator-analyzer.ts`, deterministic, no scraping) proposes the type + kit.

### Step 2 — AI suggests a room (a portal kit)
The type seeds **3–5 portal objects** with empty bindings (each shows a friendly "connect me"
state). The creator sees a *named, half-built room* immediately — momentum from second one.

### Step 3 — Connect content
For each portal: **paste a URL** (smart detection auto-binds + labels + fetches favicon) or
**upload media** (images → a gallery/bio portal). Add/remove portals from the palette. This is
the only real work, and it's *paste, not design.* (See spatial-link-system §2 for detection.)

### Step 4 — AI composes + publish
The composer (the re-pointed AI Room Designer) places the portals on the container (Golden
Interior Shell #1) + dresses with furniture/decor/lighting. The creator **Accepts**,
**Regenerates** for a different arrangement, or opens **Customize** (optional advanced room
tweaks). Publish → live + discoverable in the village. A **quick-links list** is generated
automatically alongside (the accessible/SEO floor — wall-object §8).

## 3. The five-minute budget (realistic)

| Step | Time |
|---|---|
| Pick type (or auto-detect) | 5–20s |
| Kit appears | instant |
| Connect 3–5 links / upload a few images | 2–3 min |
| Compose + review | 30–60s |
| **Total** | **≈ 3–4.5 min** |

The budget holds **only** if: smart URL detection works (Step 3 is the cost center), the kit
is pre-populated, and composition is instant. If detection misfires or the kit is empty, the
budget blows — so detection quality is the make-or-break (spatial-link-system §2).

## 4. Creator type → starter portal kit

Each kit is 3–5 portals (object/surface → default destination). Creators edit freely.

| Type | Starter portal kit |
|---|---|
| **YouTuber** | TV → YouTube · Story (desk/profile) → bio · Achievement board → milestones · Shelf → sponsors/products |
| **Developer** | Computer → GitHub · Screen → portfolio site · Achievement board → awards · Desk → about-me |
| **Designer** | Painting/camera → portfolio (Behance/Dribbble) · Screen → website · Frame → Instagram · Desk → bio |
| **Artist** | Painting → gallery · Store shelf → shop (prints) · Frame → Instagram · Desk → story |
| **Musician** | Speaker → Spotify · Painting → album wall · Store shelf → merch · Desk → story |
| **Writer** | Bookshelf → blog/Substack · Screen → website · Frame → social · Desk → bio |
| **Startup Founder** | Screen → product · Whiteboard → roadmap · Calendar → demo booking · Desk → about |
| **Creator (generic)** | Frame → main social · TV → video · Store shelf → products · Desk → bio |
| **Business** | Store shelf → products · Calendar → bookings · Screen → website · Desk → contact |
| **Custom** | empty palette — drag any portal object, bind anything |

Kits are **starting points**, not locks — every portal is editable, removable, re-bindable.

## 5. The new design goal (explicit)

> The creator should **never** need to manually design a room. They **connect content, upload
> media, choose a style.** AI owns furniture, decoration, layout, composition, atmosphere.

Manual room design (free drag/resize) survives only as an **optional "Customize"** behind the
accept screen — never on the critical path. Beginners never face a blank canvas.

## 6. The Nestudio Moment, delivered

The first home a creator sees is a warm room **already composed around their own content** (their
YouTube on the TV, their GitHub on the computer), in their accent — and they immediately get to
**zoom into their own portals** to preview the visitor experience. *"This is mine, and it
already feels like me"* — earned in under five minutes.

## 7. Honest onboarding risks (and the guards)

- **Detection misfire → manual fiddling → abandonment.** Guard: confident default + obvious
  one-tap override; never block on a failed fetch (bind anyway, label later).
- **Empty/awkward AI room.** Guard: Regenerate + a sane default layout; the container always
  looks good empty (Golden Shell #1).
- **Too many steps before "live."** Guard: the home can publish with **one** connected portal;
  the rest can be added later.
- **Link-maximalists (20+).** Guard: cap per room, auto-spill to a second room, and surface the
  quick-links list for the long tail.

---

*Product/UX documentation only. Reuses Creator Auto Build, the AI designer (as composer), the
per-action data editors (as portal binders), and the room/house/village engine. No code,
assets, or commits.*
