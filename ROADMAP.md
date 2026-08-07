# ROADMAP

Status honestly separates *code exists* from *verified working in a deployment*.
Nothing is marked complete merely because the code is written.

State as of `56aa6f3` (M26A final). Gates: typecheck · lint 0 errors ·
**1156 tests / 101 files** · build 133 pages.

Legend — ✅ complete & verified locally · 🟨 implemented, **unverified in deployment** ·
⛔ blocked · ⏸ deferred by decision · 🔭 future

> The honest summary: **the code is far ahead of what anyone has been able to run.** One
> founder action — the Vercel billing block — gates the entire 🟨 section, and has for
> eight sprints.

---

## ✅ Complete & verified locally

### Rendering and the scene
- **Canonical rendering** — one geometry function; the creator's box replayed verbatim
  (D-18). Editor↔Preview delta **0.0027** (~1px). Bench `/dev/nest-parity`.
- **One runtime** — Preview, visitor, feed and cards all mount `NestRuntime` from the same
  document; `mode` decides input only (D-24, D-38).
- **One coordinate space** — fixed 3:4 stage, letterboxed by container-query units (D-25).
- **Pure scene resolution** in `lib/nest-scene.ts` (D-29).
- **Nest Stage (M26A)** — `NestStage` / `NestViewport` / `ScreenSpaceChrome`; one deep
  neutral stage with two variants, never stored in the document (D-51).

### The editor
- **Free zoom + pan, 1×–5×**, in both the visitor runtime and Arrange, from one camera
  (D-39, D-46).
- **One gesture dispatcher** — owner assigned at pointer-down, locked until pointer-up
  (D-52, D-55). **Two fingers never touch object geometry** (D-56).
- **Real screen-space chrome** — selection frame, handles and toolbar are siblings of the
  viewport, positioned per frame from `sceneToScreen()`. Measured 40×40 handles and a
  198×46 toolbar at both 1× and 5× (D-53, D-57).
- **Screen ⇄ scene** — one conversion for move, resize, rotate and placement; exact
  round-trip at 1×, 2× and 5×.
- **Adding while zoomed** — new assets land at the visible scene centre (D-54).
- **Edit | Preview** — one switch, both modes, no duplicate (D-58).
- **The camera is never persisted** (D-45).

### Interaction
- **Object interaction** — typed capability model; the object is the tap target; no
  permanent affordance chrome; Hint pulse (D-34, D-35, D-36, D-41, D-42).
- **Session vs authored state** — a visitor tap never writes to Supabase (D-40).
- **One creator Interaction panel**, in the creator's language (D-44, D-50).
- **Legacy Focus still plays**; it just cannot be authored (D-39).

### Platform
- **Auth** — no freeze (D-11…D-13), no false signup success (D-14).
- **Shared persistence** — all Supabase; no silent localStorage fallback (D-10).
- **Onboarding**, **Settings** (real sign-out + delete cascade), **drafts** (D-26),
  **delete Nest**, **per-Nest views** (D-22/D-27), **notifications** (D-23).
- **Schema tolerance that never discards work** (D-30 refined by D-37).
- **iOS form zoom fixed at the source** — 16px floor on coarse pointers (D-49).
- **Overlays in the root stacking context** (D-21), **no animation fill-mode** (D-28),
  **named layers** (D-16), **editor chrome removed while a sheet is open** (D-48).

## 🟨 Implemented but UNVERIFIED — blocked on the Vercel block

- **Everything above, as deployed.** Nothing has shipped since `235d2ab`.
- Two-account social: like, comment, follow, notification.
- Publish → visitor round-trip compared side by side.
- Views counted by a second account.
- Zoom smoothness frame-rate measured on a physical iPhone.

## 🟨 Not blocked — simply not done (see `NEXT_SPRINT.md` §A)

- **Mobile acceptance at 390×844 and 430×932.** Only 375×667 and 714×863 were run.
- **The 17-step creator flow.** Selection, zoom, chrome sizing and the mode switch were
  driven; drag, resize, rotate, add-from-library at 5×, Save Draft and reopen were not.
- **Adding an asset while zoomed through the real library sheet** — unit-tested through
  `addObject` and the wired `visibleCentre` call, not driven through the UI.
- **A Preview-mode screenshot.**

## ⛔ Blocked — one founder action

**Vercel `ai-bazaar` (team `hannanazaris-projects`) is disabled.** Production alias returns
`402 DEPLOYMENT_DISABLED`; the branch preview returns `410 GONE` — Vercel removed it, which
is what happens to preview deployments on a disabled project. Not a build failure.

`/api/build-info` exists so that, the moment it deploys, "which commit is this?" is
answerable from the phone.

**Do not guess Vercel hostnames.** A 404 on a guessed host proves nothing — a wrong team
slug hid the truth for several sprints.

## ⚠️ Known limitations (accepted and recorded)

- Legacy pre-M24 Nests keep derived geometry until re-saved; badged, never backfilled (D-18).
- `nest_assets` holds one row; the library merges Supabase over the bundled fixture (D-19).
- **Speaker, console, curtain and a standalone laptop have capability definitions but no
  art** (`AWAITING_ART`). They cannot appear in a room until the Asset Factory ships them.
- Notifications refetch on focus rather than via Realtime, which is not configured (D-23).
- Views bucket by UTC day and trust an anonymous browser key — a vanity metric (D-22).
- Creator links live in `profiles.links`; localStorage-only links are not migrated.

## ⏸ Deferred by decision

- **M26B — parent-child placement, shelf slots, the Content/Appearance/Placement/Action
  inspector.** Deliberately not started: M26A left objects freely positioned so hierarchy
  lands on a foundation known-good on a real device.
- No new AI, asset-generation, avatar, Google/Apple auth, marketplace or discovery work.
- Deleting the legacy pre-pivot island (`/bazaar`, `/discover`, `/tags`, `/collections`,
  `/activity`, `/u/[handle]`, `/assets`, `/village-lab`) — its own sprint.
- Avatar public release (`AVATAR_PUBLIC_ENABLED=1`).
- Village redesign; analytics changes; Interaction-inspector redesign.

## 🔭 Future

- **9:16 immersive background.** Typed seam exists (`ImmersiveBackground`); needs
  Asset-Factory art coordinated with the 3:4 room. No geometry change required (D-33).
- Asset-library growth — fix the Asset-Factory → `nest_assets` publishing seam.
- Art for speaker / console / curtain / laptop, against the existing capability contract.
- Realtime notifications, once Realtime is configured.
- Creator Generator → Interaction Engine → Memory Engine.

## Risks resolved

- ~~Silent localStorage fallback~~ (D-10) · ~~autosave divergence~~ (D-17) · ~~lossy `?c=`
  links~~ · ~~lossy Supabase write path~~ · ~~slug-regenerating backfill~~
- ~~Editor/publish displacement~~ — two distinct causes (D-18, D-25)
- ~~Focus objects lost on save~~ (D-32) · ~~focus data dropped at the DB boundary~~ (M24E)
- ~~The camera stealing object drags~~ (D-52, D-55) · ~~two-finger gestures rewriting
  geometry~~ (D-56) · ~~controls scaling with the room~~ (D-53, D-57)

## Risks still open

1. **Deployment.** Eight sprints of work has never reached a phone. Every "verified" claim
   here means *verified locally*.
2. **Nothing has been tested by two real accounts.** Social, notifications and visitor
   parity remain the least-proven areas.
3. **The creator flow is unproven end-to-end on a phone** — the architecture is measured,
   the workflow is not (`NEXT_SPRINT.md` §A).
