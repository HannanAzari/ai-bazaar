# 01 · READ FIRST

> The only document you must read before doing anything. ~10 minutes.
> If you read nothing else, read this, then `06_NEXT_SPRINT.md`.

---

## What Nestudio is

**Nestudio is a digital home — the visual language of digital identity.**

A **Nest** is a personal room you assemble from objects. Each object reveals something about you (your Canon camera, your PlayStation, your guitar). Visitors don't scroll a feed or scan a link list — they **wander a place** and discover who you are.

The one-line thesis: **"Instagram is where you post. Nestudio is where you live."**

## Why it exists

The internet made identity into performance — feeds, comparison, infinite scroll, anxiety. Nestudio makes identity into **presence**: a warm, calm, coherent place that says *this is who I am*, and is **beautiful before you edit it**. It replaces the link-in-bio (Linktree), the aesthetic feed (Instagram), and the empty metaverse sandbox (Spatial/Rooms.xyz) with a curated, always-coherent personal room.

## What makes it different

- **A place, not a page.** You *dwell* in a Nest; you don't scroll it.
- **Coherent by construction.** A design *grammar* guarantees every Nest looks good without design skill. (See `03`.)
- **Objects are an alphabet.** A small, expressive, emoji-scale vocabulary of identity — not a furniture catalogue. Add an object only if it adds a new "letter." (See `03`.)
- **Curiosity, not utility.** Visitors explore because it's a world worth exploring; links are a byproduct, never the point.
- **Products become identity.** Businesses build Nests too; a product is an object in a room, discovered — never an ad. (See `03`.)

Nestudio is **not**: a social feed, a link page, a furniture catalogue, The Sims, or a metaverse.

---

## Current phase

**The design constitution is frozen, and the editor line is now frozen too.**

The Nestudio editor + runtime closed at tag **`editor-beta-v1`** (`533c8ec`, 2026-08-11).
`docs/EDITOR_BETA_V1_FREEZE.md` records its ten contracts and is authoritative for anything
touching the scene, gestures, layering, connected content, the frame/TV/player, or the media
storage key. There is real, tested, working product code — read it as the current product,
not as a pre-pivot artefact.

There is also an older **pre-pivot island** (`/bazaar`, `/discover`, `/tags`, `/collections`,
`/activity`, `/u/[handle]`, `/assets`, `/village-lab`) that predates the design pivot and is
awaiting its own deletion sprint. Do not mistake it for the current product.

## Current priorities

The immediate path (see `06_NEXT_SPRINT.md` for the exact next step):

1. **Apply `supabase/provision/m27a_media_storage.sql`** — the `nest-media` bucket has never
   existed, so **no real upload has ever run in this project's history**. Founder action.
2. **Restore the Vercel deployment** — `ai-bazaar` is `402 DEPLOYMENT_DISABLED`. Founder action.
3. **Run the first real photo upload end to end** — upload → frame → save → reopen → publish
   → visitor acceptance. This is the sprint's definition of done.

Then the launch line (D44, detailed in `05_ROADMAP.md`): Create/onboarding polish → profile/
social acceptance → Village v1 → asset/background/house pipeline hardening + launch content
generation → **simplified** Avatar v1 → Google/Apple auth → CI/CD + observability + analytics
→ performance/PWA → safety/legal → seeded world → launch QA / release candidate.

> **The Avatar Golden Reference track is closed** (D44). Older documents that name it as the
> current gate are historical. Do not resume it; avatars return later, simpler.

## What is frozen — do not re-open without a founder decision

- The **design constitution** (`03`): philosophy, the 4 object classes + 5 visual roles, the 12 grammar laws.
- **One of each**, forever: one **camera**, one **interaction language**, one **sound language**, one **design language**. (See `10_FUTURE_RULES.md`.)
- The **UOS architecture** — objects are data that reference shared registries; objects ship no bespoke code.
- The **editor contracts** in `docs/EDITOR_BETA_V1_FREEZE.md` — including the canonical **3:4 scene**, which does **not** change for the future landscape Studio View (D45).
- **GPT Image (`gpt-image-1`)** is the generation engine. **Gemini is deprecated — never revisit it.**
- Identity extraction is **objective facts only** (no style/material/finish words — those fight the render engine and caused regressions).
- Branch **`m12-nest-platform`**, preview only. Never merge `main`; never deploy production.
  (Deploying the founder-gated preview *is* authorised — D16b.)

## What must never change (the soul)

- **Objects are the alphabet of identity.** If a new object doesn't add a letter, it doesn't ship.
- **Coherence before freedom.** The grammar always wins; the editor is a stylist, not a blank canvas.
- **Negative space is luxury.** Restraint creates identity.
- **Curiosity before engagement. Places accumulate life. Products become identity.**

## What is intentionally postponed

Business-mode *implementation* · the AI room composer · the memory-accumulation system · sound *implementation* · scaling to 200–1000 objects · universal video transcoding (guarded instead) · a landscape Studio View (`docs/design/STUDIO_VIEW_LANDSCAPE.md`). All are designed-for in the architecture but built later. The **village** is no longer postponed — it is item 3 on the launch line.

---

## Where to go next

Read in this order, then start: **`02_PROJECT_STATE` → `03_DESIGN_CONSTITUTION` → `04_TECHNICAL_ARCHITECTURE` → `06_NEXT_SPRINT`**, then work.
Reference as needed: `05_ROADMAP`, `07_DECISIONS`, `08_GLOSSARY`, `09_REPOSITORY_STRUCTURE`, `10_FUTURE_RULES`.
