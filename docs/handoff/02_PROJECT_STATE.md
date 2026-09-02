# 02 · PROJECT STATE

> Honest snapshot of where implementation actually is. Read after `01`.
> The headline (2026-09-03): **the editor line is closed and frozen** at tag `editor-beta-v1`
> (`533c8ec`, 2026-08-11). The next work is not a feature — it is **unblocking storage and
> deployment and proving the first real media upload** (`06_NEXT_SPRINT.md`).
> The **Avatar Golden Reference is no longer the current priority** (superseded, D44).

---

## 🆕 Closed this milestone — Editor Beta v1 (2026-08-11, tag `editor-beta-v1`)

`docs/EDITOR_BETA_V1_FREEZE.md` is the authoritative document. Ten frozen contracts:

- **The canonical 3:4 scene** — one coordinate system, `0..1`; geometry stored as the
  creator's actual box; the Stage is app environment, never in the document; the camera is a
  viewport transform and is **never persisted**.
- **One gesture pipeline** (`use-scene-camera`) with one owner per pointer session. Two
  fingers are never a swipe; an object mid-drag can never be stolen by the camera.
- **One layer file** (`lib/nest-layers.ts`) — every stacking value, no exceptions.
- **`contents[]`** — the canonical connected-content model, with `resolveContents()` as the
  single boundary that normalises the legacy shape. No migration was ever needed.
- **One display resolver** (`lib/nest-object-display.ts`) for editor, Preview, Home card and
  the published visitor Nest. There is no second renderer.
- **Frame** (immediate photo, horizontal swipe, wraps), **TV** (off → on → play, runtime-owned),
  **media player** (one index, one element, collapse ≠ stop, the room is never touched).
- **Storage key contract** `<ownerId>/<nestId>/<objectId>/<mediaId>.<ext>` — the first
  segment *is* the RLS ownership check.
- **iPhone video guard** — HEVC-inside-mp4 refused before upload by a real `<video>` probe.

Verified on device widths 375/390/430 through the real UI on a real published Nest.
Gates: typecheck ✓ · lint 0 errors ✓ · **1516 tests / 115 files** ✓ · production build ✓.

## ✅ Completed

**Design (frozen, documented in `03`/`04`):** product philosophy, the Alphabet (~57-object
vocabulary), Nest Grammar (12 laws), the Universal Object System architecture.

**Editor + runtime (M24–M27, frozen):** the canonical scene, one runtime for Preview /
visitor / feed / cards, free zoom + pan, screen-space chrome, Edit|Preview, connected media,
frame + TV behaviours, the in-app media player. See the freeze document.

**Creation studios:** Asset Factory (**FROZEN**, D20) → `nest_assets`; Nest Factory (D24) →
`nest_backgrounds`; Avatar Studio (founder-only Beta, D31/D32/D39) → `user_avatars` + private
`avatar-private` bucket. All three are thin modules on one shared `GenerationStudio`
(D28–D30, `GENERATION_PLATFORM.md`). Art Engine v1 (D40) single-sources the Visual DNA.

**Generation engine:** GPT Image (`gpt-image-1`); the honest single-pass path; `furniture@8`
certified; vision identity extraction states objective facts only. Validated at scale on a
56-object batch (~95% technically clean).

**Platform:** one auth source of truth — `getServerUser()` (server) + `useNestIdentity`
(client), role-gated founder studios (D35/D36/D37); shared Supabase persistence with no
silent localStorage fallback; onboarding, settings, drafts, delete, per-Nest views,
notifications.

## 🚧 In progress

**Sprint 0 — unblock and prove media** (`06_NEXT_SPRINT.md`): apply the storage migration,
restore the deployment, then run the first real photo upload → frame → save/reopen →
publish → visitor acceptance. Steps 1 and 2 are founder actions.

## ⛔ Not started

Everything on the post-freeze roadmap (`05_ROADMAP.md`): Create/onboarding polish → profile/
social acceptance → Village v1 → pipeline hardening + launch content → **simplified** Avatar
v1 → Google/Apple auth → CI/CD + observability + analytics → performance/PWA → safety/legal →
seeded world → launch QA/RC.

## 🔴 Blocked / needs founder

1. **`supabase/provision/m27a_media_storage.sql` is not applied.** The `nest-media` bucket
   has never existed, so **no real upload has ever run in this project's history** — all media
   verification to date used URL-connected content. Additive and idempotent; gate is
   `node scripts/verify-nest-media.mjs`.
   *State as of 2026-09-03: unconfirmed. The Supabase host does not resolve from the
   development machine (`ENOTFOUND`), so the last hard evidence remains 2026-08-11.*
2. **Vercel `ai-bazaar` is disabled** — production `402 DEPLOYMENT_DISABLED`, preview
   `410 GONE`. A billing state, not a build failure. Every "deployed" claim is gated on it.
   Never guess Vercel hostnames.

## ⚠️ Known risks

- **Deployment.** Many sprints of work have never reached a phone through a deployment.
  Every "verified" claim means *verified locally or on a dev build*.
- **Media has never been exercised for real.** The upload path is written, tested in units,
  and completely unproven against a live bucket.
- **Social is the least-proven area** — two-account like/comment/follow/notification/views
  have not been run end to end.
- **Brand/legal.** The vision keeps recognisable brands (Canon, PlayStation…). A founder/
  counsel decision, unresolved; scheduled at roadmap item 9.
- **OpenAI moderation** false-positives on roughly 1 in 56 generations — batch tooling must
  flag, never silently skip.
- **GPT Image cost/latency**: ~$0.44 and ~45–70s per asset at high quality; a 1000-object
  library is ~$440 and hours. Needs a budget before launch content generation.
- **Model dependency** on `gpt-image-1` (the pipeline is provider-abstracted, which helps).

## 🧾 Technical debt

- Pre-pivot app code (the legacy `/bazaar`, `/discover`, `/tags`, `/collections`, `/activity`,
  `/u/[handle]`, `/assets`, `/village-lab` island) is not mapped onto the UOS and wants its
  own deletion sprint.
- Inventory is device-local `localStorage` only — fine for demo, not for production.
- `furniture@8` is a single hard-coded material voice and is not compiler-driven (rewiring
  needs a Laptop re-cert, D40).
- Many exploratory files from old milestones sit uncommitted in the working tree (do **not**
  sweep them into commits).
- Recorded editor rough edges, deliberately unfixed under the freeze: every new asset lands
  at the same default position; a selection toolbar can cover a smaller object behind it; a
  decorative asset painted over an interactive one blocks its gestures.

## 🎨 Design debt

- Backgrounds carry too much baked-in decoration; the mix should shift toward simple **canvas
  rooms** and masters wide enough to survive a future landscape view
  (`docs/design/STUDIO_VIEW_LANDSCAPE.md`, D45).
- Sound and the interaction/memory layers are designed on paper only.

## 🌱 Future opportunities

- Landscape **Studio View** for editor and visitor, portrait retained (D45 — recorded, not scheduled).
- AI auto-composer that builds a grammar-valid Nest from three questions.
- Business Nests as a distinct, high-value segment (products-as-identity).
- Memory accumulation as an emotional retention loop no competitor has.
- Starter Nests (13 archetypes) as an instant-onboarding growth lever.
