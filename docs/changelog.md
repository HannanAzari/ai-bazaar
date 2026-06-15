# Changelog

Historical record of all completed work. **Append-only** — entries are added
newest-first and never edited or removed. Every completed sprint has an entry.
Dates follow the repository's migration timestamps. See
[roadmap.md](roadmap.md) for direction and [architecture.md](../architecture.md)
for technical detail.

---

## 2026-06-23 — Production Cutover V1 · production shop claiming + full live verification

With staging fully provisioned (schema + seed + `room-images` bucket + **email
confirmation OFF**), implemented the last persistence gap and verified the entire
authenticated flow against the real Supabase project. No new product features.

### Added (bug-fix needed for production persistence)
- **`lib/shop-claim.ts`** — production "create first Nest": `claimShopInSupabase()`
  resolves the first village with an open `shop_slots` row and inserts a `shops`
  row (`owner_id = auth.uid()`, slot, village-prefixed address) under RLS;
  idempotent (returns an existing shop). Pure helpers `prefixFromSlug`,
  `villageAddress`, `firstOpenSlotId` are unit-tested. Also `getShopByAddress()`
  (public read) so production shops resolve on the public page.
- **`components/shop-route-client.tsx`** now resolves the shop from Supabase by
  address in production (demo still uses local data) — fixes the public room
  showing "door closed" for a production-claimed shop.
- Onboarding claims via Supabase in production (demo path unchanged). Tests +6
  (suite **176**).

### Verified LIVE (real project, anon client + a confirmed test user)
Full authenticated flow, no console errors:
1. **create account** → `POST /auth/v1/signup → 200` (session; profile auto-created by trigger)
2. **login** → session cookie set
3. **onboarding** → 4. **create first Nest** → `POST /rest/v1/shops → 201` (`moon.tiny.bell`)
5. **save room** → `POST /rest/v1/rooms?on_conflict=shop_id,client_id → 201` (+ prune `DELETE → 204`)
6. **reload** → 7. **room persists from Supabase** (5 objects render; loaded via `getShopByAddress` + `getStoredHouse`)
8. **logout** (session cleared) → 9. **login again** → real `signInWithPassword` → `/studio`
10. **room still exists** (5 objects from Supabase)
- **RLS**: authenticated owner writes succeed under `owns_shop`/`owner_id` (shops 201,
  rooms 201, profiles PATCH 200); anon writes denied (shops/rooms/profiles `401`);
  public reads `200`.

### Fixed earlier this day (kept)
- `signUp` gates on a returned session (no "logged-in but unauthenticated" state).
- `signUp` writes the `display_name` metadata key the profile trigger reads.

### Note
- A test user + shop (`moon.tiny.bell`) now exist in the **staging** project from
  verification.

---

## 2026-06-23 — Production Cutover V1 · live staging probe + auth fixes

Ran the live staging checks once the project schema was applied (anon key only).
No new features; fixed two auth-correctness bugs found during probing.

### Verified live (real project)
- Schema present (`profiles`/`shops`/`rooms` incl. `client_id`/`objects`, `bazaars`,
  `shop_slots`); production **read path** works in-browser (public room issues a real
  `shops` query, falls back to the derived room, no console errors, LIVE badge).
- **RLS (anon):** public read of `rooms`/`shops` allowed; anon insert into `rooms`
  and `profiles` denied (`401`). Bad-credential sign-in rejected.

### Fixed (bugs needed for production correctness)
- `SupabaseAuthClient.signUp` now requires a returned **session**; with email
  confirmation ON, Supabase returns a user but no session — the app asks the user to
  confirm instead of entering a broken "logged-in but unauthenticated" state.
- `signUp` writes the `display_name` metadata key (was `name`) that the
  `on_auth_user_created` trigger reads, so the auto-created profile is named correctly.
- Tests: +2 (suite **170**); `mapUser` now reads `display_name`.

### Blocked (environment, not code — documented in `docs/staging-checklist.md` §0a)
- **Authenticated** create-account→persist flow could **not** be run: email
  confirmation is ON + the default email sender hit `429` (no inbox/service-role to
  confirm), and **`seed.sql` is not applied** (no villages/slots → no `shops` row).
- **Follow-up bug:** no production shop-claim path yet (demo `claimShop` is
  localStorage-only); needed before live room persistence. Demo unaffected.

### Second probe (seed since applied) — 2026-06-23
- ✅ `seed.sql` now applied (`bazaars`=10, `shop_slots`=240); bazaar/slot read-side
  for a future shop-claim works with anon; anon `insert shops` → `401` (RLS holds).
- ⚠️ **Sole remaining blocker:** email confirmation is still ON → no session
  obtainable with the anon key → the authenticated flow still cannot be run live.
  Disable "Confirm email" (or provide a confirmed user) to proceed. The production
  shop-claim path remains the one code follow-up (rules recorded in the checklist),
  intentionally not shipped unverified.

---

## 2026-06-23 — Production Cutover V1

Moves AI Bazaar / Nestudio from a demo-only app toward a pilot-ready production
foundation: real Supabase **auth**, **profiles**, and **room persistence**, an
image-storage driver, an onboarding flow, and subdomain prep — all behind runtime
mode, with **demo mode preserved and unchanged** (localStorage remains the default
and the fully-verified path). No visual/village/room redesign; no payments/
marketplace/messaging/notifications/feeds/comments/followers/ads.

### Added
- **Unified session** (`lib/auth/*`, `components/providers/auth-provider.tsx`): a
  mode-aware `AuthClient` (`DemoAuthClient` on localStorage, `SupabaseAuthClient`
  on Supabase email+password) + `useSession()` (sign up / in / out, persistence).
  `getAuthClient()` selects by runtime mode. `DemoProvider` now derives its user
  from the session, so every `useDemo().user` consumer is unchanged.
- **Protected routes + middleware** (`middleware.ts`): production refreshes the
  Supabase session cookie and gates `/studio` + `/onboarding`; demo is client-gated.
- **Profiles** (Task 2): `UserProfile` type (parity with `profiles`); extended
  `ProfileRepository` (`getById`/`ensureProfile`/`update`); demo store
  (`lib/profile-store.ts`) + Supabase impl. Profile is created on first login.
- **Real repositories** (Tasks 3–4): Supabase `profiles`/`houses`/`rooms`/
  `roomObjects` implemented (lazy client; anon + RLS) with pure, tested mappers
  (`lib/repos/supabase-mappers.ts`). An async **house-store seam**
  (`lib/house-store.ts`) is adopted by the room editor, designer, and experience;
  in demo it delegates to the same `lib/room.ts` (byte-for-byte identical).
- **Room persistence** preserves multi-room houses, metadata, descriptions,
  backgrounds, room links, interactive objects, action data, and rotations (V5).
- **Image storage** (Task 5): `SupabaseStorage` behind `ImageStorage`;
  `getImageStorage()` selects by mode (bucket `room-images`).
- **Onboarding V1** (`app/onboarding/page.tsx`): one screen — what you create +
  IG/TikTok/YouTube/Website → generate profile, run Creator Auto Build (V3), claim
  first Nest, land in the room. Reuses `creator-analyzer`; works in demo.
- **Subdomain prep** (`lib/subdomain.ts` + middleware rewrite): `<handle>.nestud.io`
  → `/u/<handle>`; local dev via `*.localhost`. No DNS deployed. Documented in
  `docs/subdomain-routing.md`.
- **Docs**: `docs/staging-checklist.md` (env/migrations/auth/storage/RLS/rollback/
  readiness) and `docs/subdomain-routing.md`.
- Tests (suite now **168**, target 150+): `auth` (demo + mocked Supabase),
  `profile-store`, `supabase-mappers` (room/house round-trip), `subdomain`,
  `onboarding` data path, and updated repository-selection (production selects
  Supabase, constructed lazily).

### Changed
- `lib/storage/index.ts` + `lib/repos/index.ts`: mode-aware factories (storage now
  selects Supabase in production).
- Auth pages use `useSession()` (email+password in production; passwordless demo).
- `lib/repos/supabase.ts`: stubs replaced by real profiles/houses/rooms impls
  (events/reports remain stubs — out of scope); client resolved lazily.

### Database
- `supabase/migrations/20260623_room_jsonb_persistence.sql` — `rooms.client_id`
  (app room id) + `rooms.objects` (jsonb) + `rooms_shop_client_idx`, so the Room
  Engine V5 model round-trips without uuid asset/room friction. Mirrored in
  `schema.sql`. Requires a Storage bucket `room-images` (manual, per checklist).

### Verification
- ✅ **Demo**: full flow verified in-browser (sign up → onboarding → room →
  reload → persist → sign out → sign in → room exists); no console errors.
- ✅ **Production auth**: live project reachable; real sign-in **rejects** bad
  credentials in-browser (LIVE badge); no console errors.
- ❌ **Production DB persistence / RLS**: **not** verified — the project's schema
  is not yet applied and only the anon key is available (no DDL). See
  `docs/staging-checklist.md`.

### Documentation
- README, architecture.md, roadmap.md, handoff.md, room-engine-spec.md,
  supabase-cutover.md updated; new ADR-018; new staging + subdomain docs.

---

## 2026-06-22 — AI Room Designer V3: Creator Auto Build

Lets a creator paste their social profiles + a bio and auto-generate a room from
their online identity. **Deterministic — no scraping, no APIs, no image
generation, no marketplace/payments/chat.** Builds on V1/V2; their contracts and
tests are preserved.

### Added
- **`lib/creator-analyzer.ts`** — a pure, no-network profile analyzer.
  `analyzeCreator({instagramUrl?, tiktokUrl?, youtubeUrl?, websiteUrl?, bio?})`
  reads usernames (URL paths), domain words, and bio text into
  `{ creatorType, mood, purpose, keywords[], socialLinks[], confidence, summary }`
  (reuses V2 `parseBrief` + platform/domain heuristics; confidence rises with
  signals). Helpers: `extractUsername`, `domainWords`, `welcomeMessage`,
  `generateCreatorRoom`.
- **`generateCreatorRoom(input, address, variant?)`** — feeds the analysis into
  the existing `generateRoomDesign()`, trims the base to leave zone capacity, then
  adds an **about-me profile object** (title/summary/links/type) and **one `link`
  object per supplied platform** (Instagram/TikTok/YouTube/Website), and sets a
  deterministic welcome `room.description`. Returns a `DesignResult` the existing
  preview / draft / apply UI consumes.
- **12 creator types** — `CreatorType` gains `consultant` and `personal` (so the
  full set is photographer, artist, developer, designer, podcaster, writer, coach,
  consultant, shop owner/online shop, small business, musician, personal creator),
  with keyword/intent/label maps updated (coach still wins "coach and consultant").
- **Creator Auto Build panel + Analyzer insights** (`components/room/room-designer.tsx`)
  — IG/TikTok/YouTube/Website + bio inputs, an insights panel (detected type /
  purpose / mood / keywords / confidence + rationale), preview-before-apply with
  Apply / Regenerate / Save draft (reuses the V2 drafts store).
- **Analytics** — four new `event_type`s: `creator_profile_analyzed`,
  `creator_room_generated`, `creator_room_applied`, `creator_social_object_created`.
- Tests (suite now **140**): new `test/creator-analyzer.test.ts` — URL/username/
  domain parsing, creator-type detection (bio/domain/platform), confidence scoring,
  social-link extraction, welcome message, creator-room generation (profile + per-
  platform objects + valid placement + description), and determinism.

### Changed
- `lib/ai-room-designer.ts`: `CreatorType` union + `CREATOR_TYPE_KEYWORDS`/
  `CREATOR_TYPE_INTENT`/`creatorTypeLabels` extended; new export
  `intentLabelForCreatorType`.
- `components/room/room-designer.tsx`: **fix** — `applyRoom` now persists the
  room's `description` (so the V3 welcome message is saved on Apply).
- `lib/events.ts`: `eventLabels` for the four new event types.

### Database
- `supabase/migrations/20260622_extend_enums.sql` — `event_type` += the four V3
  `creator_*` events. Enum-value additions only; stands alone (ADR-009). **No new
  table** — creator rooms are ordinary Rooms and drafts reuse `room_design_drafts`.
  Mirrored into `supabase/schema.sql`.

### Flags
- None new — reuses `ENABLE_AI_DESIGNER` (the panel lives in the same Design mode).

### Documentation
- README, architecture.md, roadmap.md, handoff.md, QA.md, room-engine-spec.md (§11)
  updated; new ADR-017 in decision-log.md.

---

## 2026-06-21 — AI Room Designer V2: Smarter Briefs, Constraints, Drafts

Makes the designer feel more intelligent while staying **deterministic and
selection-only** — no real AI, no image generation, no external APIs, no
marketplace/payments, no visual redesign. Builds on V1; the V1 contract and tests
are preserved.

### Added
- **Advanced brief parser** (`parseBrief` in `lib/ai-room-designer.ts`) — pure,
  keyword-based extraction of **creator type** (photographer, artist, developer,
  podcaster, shop owner, writer, musician, designer, coach, small business),
  **mood** (cozy, luxury, dark, playful, professional, warm, minimal, elegant),
  **purpose** (portfolio, booking, selling, storytelling, community, personal
  profile, gallery), and **constraints** (no plants / no video / no products, a max
  object count, minimal/clean, show social links / booking / gallery).
- **Constraints engine** — `generateRoomDesign` now excludes constrained
  assets/actions, caps the object count (minimal → ≤4; "max N" → ≤N), and boosts
  the assets that satisfy the purpose / show-X flags (product shelf for selling,
  desk-as-booking for bookings, gallery frames for portfolios, cards/shelf for
  social links). Still routes every placement through `addObjectFromAsset`, so the
  room stays valid by construction.
- **8 creator presets** (`CREATOR_PRESETS`) — Photographer Portfolio, Artist
  Gallery, Developer Studio, Podcast Room, Online Shop, Writer's Room, Coach /
  Consultant, Personal Bio Room — one click fills the brief + style and generates.
- **Designer drafts** (`lib/room-design-drafts.ts`) — save a generated design as a
  draft, list drafts per house, apply one later, delete one. localStorage key
  `ai-bazaar-design-drafts`; full SQL parity in the new `room_design_drafts` table.
- **Designer history** — a session "recent designs" list (brief · style · intent ·
  object count) you can click to revisit; "last applied" is surfaced in the panel.
- **Richer explanation panel** (`components/room/room-designer.tsx`) — detected
  creator type / mood / purpose / theme chips, the constraints applied, and a
  reason per placed object.
- **Result shape** — `DesignResult` now carries `parsed: ParsedBrief` and
  `detectedConstraints: string[]`; new exports `parseBrief`, `describeConstraints`,
  `CREATOR_PRESETS`, `creatorTypeLabels`/`moodLabels`/`purposeLabels`.
- **Analytics** — four new `event_type`s: `room_design_draft_saved`,
  `room_design_draft_applied`, `room_design_constraint_detected`,
  `room_design_preset_used`.
- Tests (suite now **125**): `test/ai-room-designer.test.ts` gains brief parsing,
  creator-type/mood/purpose detection, the constraints engine (excludes plants/
  video, caps count, prioritises product/booking), preset generation, and V2 result
  shape; new `test/room-design-drafts.test.ts` covers save/list/scope/find/delete.

### Changed
- `lib/ai-room-designer.ts` `generateRoomDesign` now parses the brief, derives
  style from mood when none is supplied, applies constraints, and emits richer
  explanations. V1 behaviour (intent matching, deterministic variant) is unchanged.
- `lib/events.ts`: `eventLabels` for the four new event types.

### Database
- `supabase/migrations/20260621_01_extend_enums.sql` — `event_type` += the four V2
  events (committed before `_02` per ADR-009).
- `supabase/migrations/20260621_02_design_drafts.sql` — new `room_design_drafts`
  table (owner-private; `owns_shop` RLS; `room`/`parsed` as jsonb) + index.
- Both mirrored into `supabase/schema.sql` (now 26 tables).

### Flags
- None new — reuses `ENABLE_AI_DESIGNER` (the V2 UI lives in the same Design mode).

### Documentation
- README, architecture.md, roadmap.md, handoff.md, QA.md, room-engine-spec.md (§11)
  updated; new ADR-016 in decision-log.md.

---

## 2026-06-20 — AI Room Designer V1

Lets a creator describe a room in plain language and have the app compose a layout
from existing catalog assets. **Selection only — no image generation, no external
APIs, no LLM/SD/Gemini** (ADR-006/ADR-015, room-engine-spec §11). Deterministic and
fully testable. Demo behaviour for every other surface is unchanged.

### Added
- **`lib/ai-room-designer.ts`** — the deterministic engine. `matchIntent(brief)` scores the brief against ten design intents (reading, photography, gallery, art studio, gaming, podcast, office, shop, garden, + a personal fallback) by keyword; `scoreAssets(intent, style, variant)` ranks the room-ready assets by core-asset / tag / category / action / style affinity (navigation door/stairs excluded); `generateRoomDesign(input)` composes a valid `Room` via `addObjectFromAsset` and returns `{ room, picks, explanations, matchedKeywords, intentLabel }`. Six **style presets** (Cozy · Minimal · Modern · Creative · Professional · Playful) modulate object count + scoring. Determinism: identical input ⇒ identical room; a `variant` (bumped by Regenerate) deterministically reshuffles near-ties.
- **`components/room/room-designer.tsx`** — the studio **Design** mode: brief input + example chips, style picker, optional room-type override, room-to-replace selector (multi-room houses), **current-vs-proposed** `RoomCanvas` preview, **Apply** / **Regenerate**, and a "Why this layout" explanation panel. Nothing persists until Apply, which replaces the selected room's contents via `saveHouse` (room identity preserved).
- **Studio Design tab** (`app/studio/page.tsx`) — a new mode alongside Room / Exterior / Classic interior, shown when `ENABLE_ROOM_ENGINE` and `ENABLE_AI_DESIGNER` are on.
- **Analytics** — three new `event_type`s: `room_design_generated`, `room_design_applied`, `room_design_regenerated` (recorded by the designer; counts surface on `/moderation`).
- Tests (`test/ai-room-designer.test.ts`, suite now **92**): tokenize, keyword matching (incl. fallback + every intent's own keyword), asset ranking (core > unrelated, no door/stairs, sorted by score), deterministic generation (identical input ⇒ identical room; variant varies the layout; room-type override), room validity (valid for every style; placed objects pass `validatePlacement`), and explanation generation.

### Changed
- `lib/flags.ts` + `.env.example`: new `ENABLE_AI_DESIGNER` flag (default **on**; the Design tab also requires `ENABLE_ROOM_ENGINE`).
- `lib/events.ts`: `eventLabels` for the three new event types.

### Database
- `supabase/migrations/20260620_extend_enums.sql` — `event_type` += `room_design_generated`, `room_design_applied`, `room_design_regenerated`. **Enum-value additions only**, so it stands alone (ADR-009); no table change — the designer composes existing `Room`/`room_objects` shapes. Mirrored into `supabase/schema.sql`.

### Flags
- `ENABLE_AI_DESIGNER` (default on). Off → the studio Design tab is hidden; everything else is unaffected.

### Documentation
- README, architecture.md, roadmap.md, handoff.md, QA.md, room-engine-spec.md (§11 Future → shipped V1) updated; new ADR-015 in decision-log.md.

---

## 2026-06-19 — Production Backend Cutover Prep

Prepares the move from the localStorage demo to a real Supabase backend **without
breaking demo mode**. No visuals/AI/payments/marketplace. No app rewiring — demo
remains the default and behaves identically; this sprint adds the seams + runbook.

### Added
- **Migration/schema drift audit** (in `docs/supabase-cutover.md`): enum values fully reconcile (`schema.sql` is a correct superset; no value drift). **Finding:** the migration chain is **not runnable from an empty DB** — base enums (`decoration_type`, `generation_status`, `report_target_type`, `report_status`) and core tables (`profiles`, `bazaars`, `shops`, `shop_slots`, `shop_decorations`, `shop_links`, `likes`, `follows`, `generation_jobs`) live only in `schema.sql`; `20260610_village_model.sql` assumes them. Resolution: fresh DB → apply `schema.sql`; migrations are incremental patches (append-only, not rewritten).
- **`docs/supabase-cutover.md`** — audit, migration order, env vars, local + staging setup, RLS smoke tests, rollback plan, pre-flip checklist.
- **Runtime mode detection** (`lib/runtime-mode.ts`): `getRuntimeMode()` → `demo | production` from the presence of `NEXT_PUBLIC_SUPABASE_URL` + `_ANON_KEY`; `hasSupabaseEnv`, `isProductionBackend`, `runtimeModeLabel`.
- **Dev-only mode badge** (`components/dev-mode-badge.tsx`, mounted in `app/layout.tsx`): a corner chip showing DEMO/LIVE; renders nothing in production builds.
- **Repository layer** (`lib/repos/`): async interfaces for houses, rooms, room objects, profiles, events, reports (`types.ts`); local implementations delegating to the existing demo libs (`local.ts`); Supabase **stubs** that throw `NotImplementedError` (`supabase.ts`); a `getRepositories(mode?)` factory selecting by runtime mode (`index.ts`), mirroring `getImageStorage()`.
- Tests (`test/runtime-mode.test.ts`, suite now **75**): mode detection (env present/absent/partial), repository selection (demo→local resolve; production→stub throws), and schema/migration file presence + order.

### Changed
- None to runtime behaviour — the app keeps calling the existing libs directly; the repository layer is the (currently unused) cutover seam.

### Database
- **None.** No migration added; `schema.sql` and the migration set are unchanged (audit only).

### Flags
- None. (Backend mode is env-derived, not a feature flag.)

### Documentation
- README, architecture.md, roadmap.md, handoff.md, QA.md updated; new ADR-014 in decision-log.md; new `docs/supabase-cutover.md`.

---

## 2026-06-18 — Room Engine V5: Richer Visuals + Rotation

Makes room objects visually richer and more place-like, and lets owners rotate
them — **without** redesigning the village, houses, palette, typography, or art
direction. No AI/marketplace/payments/chat; all prior room behaviour preserved.

### Added
- **Per-category object sprites** (`lib/room-visuals.ts` + `components/room/room-object.tsx`): generic icon tiles are replaced by CSS treatments around the existing glyph — framed artwork (gallery/photo, shows the object's first image when present), TV/screen (video), shelf (bookshelf/product/display), desk (desk/guestbook table), placard/card (sign/business card), portrait/certificate/pin-board (profile), door, stairs, plant, rug, sofa, and a generic-tile fallback. `objectVisual(assetId, category)` resolves the kind (asset → category → tile).
- **Rotation editor UI** (`room-editor.tsx`): a rotation slider plus rotate-left/right (±15°) buttons; persists `rotation` and is respected in both the editor and the public room. Live-drag + commit mirrors the scale control.
- **Natural object labels**: the floating pill is replaced by an engraved museum-placard nameplate at each object's base.
- **Room background variants** (`lib/room-visuals.ts` `ROOM_BACKGROUNDS` + `room-canvas.tsx`): Warm studio, Gallery wall, Shop floor, Office, Garden room — palettes that recolour the **existing** room shell via the `--room-wall` variable + a soft mood tint. Owners pick a background in the studio room-meta panel; new/preset rooms default by room type (`defaultBackgroundForType`). Stored in `room.background`.
- **Improved empty-room state**: a warm illustrated placeholder + guidance instead of the dashed box.
- Tests (`test/room-visuals.test.ts`, suite now **67**): visual-variant selection, background-style validation, and rotation/background persistence through the store.

### Changed
- `RoomCanvas` applies the room's background palette; `RoomObjectView` renders the sprite and the engraved nameplate while keeping the selection ring, hidden state, interactive cue, hover tooltip, resize handles, rotation, and `data-object-id`/`data-resize-handle` hooks intact.
- `addObjectFromAsset`'s `action.data` param widened to the canonical `RoomActionData` (type-correctness; carried over from the V4 audit).

### Database
- **None.** `room_objects.rotation` and `rooms.background` already exist; backgrounds are app-defined style keys (no enum), so no migration was needed.

### Flags
- None (under the existing `ENABLE_ROOM_ENGINE`).

### Documentation
- README, architecture.md, roadmap.md, handoff.md, room-engine-spec.md, QA.md updated; new ADR-013 in decision-log.md.

---

## 2026-06-17 — Room Engine V4: Multi-Room Houses

Turns a house from a single room into connected spaces a visitor explores via
doors and stairs. **No visual redesign**; no AI/marketplace/payments/chat; all
prior functionality preserved.

### Added
- **Multi-room data model** (`lib/types.ts`): `HouseRooms { shopAddress, entryRoomId, rooms[] }`; `Room` gains `description`. One room is the entry room (single `entryRoomId` pointer). Room types extended (`living_room, office, bedroom, garden, custom` added to the existing kinds).
- **Door & stairs** as first-class asset categories (`door`, `stairs`) and a new **`room_link`** action type whose `actionData.targetRoomId` navigates to another room — instant, client-side, no page reload. `ast-door`/`ast-stairs` updated accordingly.
- **House helpers** (`lib/house.ts`): `deriveDefaultHouse`, `addRoom`, `renameRoom`, `updateRoomMeta`, `setEntryRoom`, `deleteRoom`/`canDeleteRoom`, `withRoom`, `isValidRoomLink`, `roomLinkTargets`, plus `normalizeHouse`/`houseFromRoom` for migrate-on-read.
- **Public navigation** (`room-experience.tsx`): renders the current room, a subtle breadcrumb (`House › Room › Room`) with crumb jumps and a back button; client-side room state (no URL change).
- **Room manager** (`room-editor.tsx`): create (blank or preset), rename, set type/description, set entry, delete (guarded), switch active room; whole-**house** undo/redo + autosave; door target picker in the inspector (`action-data-editor.tsx`).
- **Room presets** (`lib/room-templates.ts`): `ROOM_PRESETS` + `buildPresetRoom` — Gallery, Studio, Podcast Room, Shop, Office — build a furnished new room from existing assets.
- **Analytics**: `room_entered`, `room_created`, `room_deleted`, `room_link_clicked` (`lib/events.ts`), on the moderation counts grid.
- Tests (`test/house.test.ts`, suite now **60**): room creation, deletion + entry/objects guards, entry validation, door-target validation, persistence (incl. legacy single-room migration), duplicate-id guard, and analytics.

### Changed
- The room store (`lib/room.ts`) persists a `HouseRooms` per address on the **same `ai-bazaar-rooms` key**; layouts saved before V4 (a single `Room`) are **migrated on read** into a one-room house (that room becomes the entry room) — no saved layout is lost. Back-compat single-room helpers (`getRoom`/`saveRoom`/`resetRoom`) now operate on the entry room.

### Validation (no-ops that keep the house valid)
- Door/stairs with a missing or unknown `targetRoomId` are inert. Can't delete the last room, the (non-empty) room with objects, and deleting the entry room reassigns entry + clears doors that pointed at the removed room. Room ids are unique (collisions regenerated).

### Database
- Migration `20260617_01_extend_enums.sql`: `asset_category` += `door`, `stairs`; `room_kind` += `living_room`, `office`, `bedroom`, `garden`, `custom`; `room_action_type` += `room_link`; `event_type` += the four `room_*` events.
- Migration `20260617_02_multi_room.sql`: `rooms.description`, `rooms.is_entry` + a partial unique index (one entry room per shop). `room_objects.room_id` (existing) scopes objects to a room; door targets live in `action_data` jsonb. Mirrored in `schema.sql`.

### Flags
- None (under the existing `ENABLE_ROOM_ENGINE`).

### Documentation
- README, architecture.md, roadmap.md, handoff.md, room-engine-spec.md, QA.md updated; new ADR-012 in decision-log.md.

---

## 2026-06-16 — Room Engine V3: Real Interactive Objects

Turns room objects from decorative placeholders into real, useful destinations a
visitor can explore without leaving the room. **No visual redesign** — village,
houses, room shell, typography, and palette are unchanged. No AI, marketplace,
payments, or chat.

### Added
- **Real action panels** (`components/room/object-action-modal.tsx` rewrite): gallery lightbox (multi-image, next/prev, captions, dot nav, keyboard arrows, mobile full-screen), embedded video (YouTube/Vimeo, local fallback), link card (favicon + title + description → opens externally), product card (image/title/price → redirect, no payments), booking card (Calendly iframe / external), unified contact modal (email/website/phone/socials), and a **profile** panel (creator card with followers/likes/visitors + recent activity, links to the full profile/collections).
- **New `profile` action type** + 3 profile assets (`ast-avatar-portrait`, `ast-certificate`, `ast-achievement-board`) and 4 thematic assets (`ast-projector`, `ast-sign`, `ast-display-table`, `ast-business-card`).
- **Rich `RoomActionData`** (jsonb-backed): `title`, `description`, `images[]`, `price`, `image`, `email`, `website`, `phone`, `socials[]`.
- **Object tooltips** (`components/room/room-object.tsx`): hover/focus shows title + description + owner.
- **Visitor analytics**: `gallery_opened`, `video_opened`, `product_opened`, `booking_opened`, `contact_opened`, `profile_opened` (`lib/events.ts`), on the moderation counts grid.
- **Owner room insights** (`lib/room-insights.ts` + a studio panel): total object clicks, most-clicked object, popular object type — derived from existing events, no new store.
- **Inspector action-data editors** (`components/room/action-data-editor.tsx`): per-action field groups (gallery image rows, video URL, link, product, booking, contact + socials rows) so owners configure real objects.
- **Working presets**: the six templates now ship sample `actionData` (real gallery images, a video, products, contacts, a profile) so an applied preset is immediately interactive.
- Pure helpers `lib/room-actions.ts` (`galleryImages`, `productCard`, `contactMethods`, `faviconUrl`, `hostname`, `hasActionData`) and `lib/embeds.ts` (`videoEmbed`).
- Tests (`test/room-actions.test.ts`, suite now **46**): gallery/video/product/contact validation, URL helpers, `hasActionData`, and analytics tracking.

### Changed
- `room-experience.tsx` `onActivate`: gallery/video/link/product/booking/contact/profile all open their real in-room panel (the visitor stays in the room); each fires its specific `*_opened` event.
- `RoomCanvas`/`RoomObjectView` accept an `ownerName` for tooltips; `ObjectActionModal` now takes the `shop`.

### Database
- Migration `20260616_extend_enums.sql`: `room_action_type` += `profile`; `event_type` += the six `*_opened` values (enum-value additions, per ADR-009; `action_data` is already jsonb). Mirrored in `schema.sql`.

### Flags
- None (all behaviour sits under the existing `ENABLE_ROOM_ENGINE`).

### Documentation
- README, architecture.md, roadmap.md, handoff.md, room-engine-spec.md, QA.md updated; new ADR-011 in decision-log.md.

---

## 2026-06-15 — Room Engine V2: Creator Studio

Turns the V1 zone/anchor editor into a real creator tool. **No visual redesign** —
the village, houses, colours, typography, and room shell are unchanged; only
editing capability grew.

### Added
- **Free drag-and-drop placement** (`components/room/room-canvas.tsx`): objects move with the pointer (mouse + touch), clamped inside the room bounds. Anchor/zone dropdowns remain for category validation; drag adjusts the fine offset (`moveObjectTo`, `ROOM_BOUND_MARGIN`).
- **Resize** — a scale slider plus corner resize handles on the selected object; stores `scale`, `width`, `height` (`resizeObject`, rejects zero/negative; `MIN_OBJECT_SIZE`).
- **Layer management** — Bring Forward / Send Backward (`bringForward`/`sendBackward`, neighbour z-swap) alongside the existing front/back; z-index persists.
- **Duplicate** (asset, scale, action, tags, new id) and **Delete with a confirmation dialog** (single or batch).
- **Multi-select** — shift-click and a drag-selection marquee; batch move (drag), delete, and layer change.
- **Edit / Preview toggle** — Preview renders the room exactly as the public surface, with editing controls dimmed.
- **Undo / Redo** — pure history stack (`lib/room-history.ts`) over add/delete/move/resize/duplicate/layer/template; keyboard `⌘Z` / `⌘⇧Z` (`⌃` on non-mac; suppressed while typing in a field).
- **Autosave** — persists 5s after the last change, with a Saved / Saving… / Unsaved-changes status; the manual Save button remains.
- **Room templates** (`lib/room-templates.ts`): six starter layouts — Creator, Photographer, Artist, Developer, Shop, Podcast — composed only from existing room-ready assets (no generated graphics).
- **Analytics**: `room_object_added`, `room_object_deleted`, `room_object_moved`, `room_object_resized`, `room_template_applied` (`lib/events.ts`), surfaced on the moderation counts grid.
- Tests (`test/room.test.ts`, now 33): move/drag bounds, resize validation, undo/redo history, and template generation validity.

### Changed
- `RoomObject` gains optional `width`/`height` (px box; `scale` multiplies). Objects render at width × height instead of a fixed tile size; rooms saved before V2 fall back to the base size.
- `RoomCanvas` editor mode now owns pointer interaction (drag/resize/marquee) via an `editor` prop bundle; the public-mode signature is unchanged.

### Fixed
- Corrected SQL parity: `object_click` (shipped in the V1 TypeScript `EventType`) was never mirrored into the `event_type` enum — added in this sprint's enum migration.

### Database
- Migration `20260615_01_extend_enums.sql`: `event_type` += `object_click`, `room_object_added`, `room_object_deleted`, `room_object_moved`, `room_object_resized`, `room_template_applied` (values only, per the enum-split rule).
- Migration `20260615_02_room_studio.sql`: `room_objects.width` / `.height` (nullable, `> 0` checks). Both mirrored in `schema.sql`.

### Flags
- None (all behaviour sits under the existing `ENABLE_ROOM_ENGINE`).

### Documentation
- `architecture.md`, `docs/roadmap.md`, `docs/handoff.md`, `docs/room-engine-spec.md`, `docs/QA.md`, README updated; new ADR-010 in `docs/decision-log.md`.

---

## 2026-06-14 — Documentation & source-of-truth pass

### Documentation
- Added `architecture.md` (vision, room engine, village, schema, flags, routes, storage, completed features, limitations).
- Added `docs/roadmap.md` (vision, pillars, completed/in-progress/next sprint, backlog, not-planned, principles).
- Added `docs/changelog.md` (this file).

---

## 2026-06-14 — Room Engine V1

### Added
- Full-screen public room surface (`components/room/room-experience.tsx`): room canvas fills the viewport; owner info/stats/links and the guestbook live in slide-over drawers; like/follow/save/share/report in a corner cluster.
- Nine-zone room data model (`lib/room-schema.ts`, `lib/types.ts`): `Room`, `RoomZoneDef`, `RoomObject` with zones `back_wall, left_wall, right_wall, floor_left, floor_center, floor_right, shelf, window, door` and 9 action types (`link, video, product, booking, contact, gallery, guestbook, collection, none`).
- Room store (`lib/room.ts`, key `ai-bazaar-rooms`) with `getRoom`/`saveRoom`/`resetRoom`; houses without a saved layout render a furnished default derived from their decorations + links.
- Studio room editor (`components/room/room-editor.tsx`): asset palette, selectable canvas, inspector (label, action + URL, zone, anchor, scale, layer, hide, duplicate, delete), Save/Reset layout.
- Room canvas/object/action components (`room-canvas`, `room-object`, `object-action-modal`) reusing the existing room shell CSS.
- 12 room-ready catalog assets (`lib/assets.ts`) with `compatibleZones`/`defaultScale`/`defaultActionType`; helpers `roomReadyAssets()`, `getAsset()`.
- Analytics event type `object_click`.
- Tests `test/room.test.ts` (schema creation, zone validation, placement validation, action-type validation, save/reset) — suite now 25 tests.

### Changed
- `/shop/[address]` renders the full-screen room by default; the legacy profile-style room is the fallback.
- Studio gains a **Room** mode (default when the flag is on); the old interior tab is relabelled "Classic interior".

### Fixed
- Removed a needless id-generator indirection and a garbled class string in room components; avoided double `house_view`/`room_view` tracking by routing through a thin wrapper.

### Database
- Migration `20260614_room_engine.sql`: tables `rooms`, `room_objects`, `room_object_tags`; enums `room_zone_type`, `room_action_type`, `room_kind`; RLS. Mirrored in `schema.sql`.

### Flags
- Added `ENABLE_ROOM_ENGINE` (default **on**; off falls back to the legacy room rather than 404).

### Documentation
- README Room Engine section; `docs/QA.md` room routes + editor flow; `.env.example` flag entry.

---

## 2026-06-13 — QA & stability

### Added
- Vitest harness + unit suite (18 tests) for the demo libs (`test/setup.ts` localStorage shim, `test/{tags,utils,collections,notifications,reports}.test.ts`); `npm run test` script.
- `docs/QA.md` manual test checklist (routes, actions, demo-mode notes, reset).
- Assets catalog empty-state message.

### Changed
- Consolidated the duplicated `timeAgo` helper into `lib/utils.ts`.

### Fixed
- Simplified the `markRead` parameter that shadowed the module `read()` in `lib/notifications.ts`; merged duplicate import lines in `shop-page-client` and `creator-profile-client`.

### Database
- None.

### Documentation
- README: feature-flags table, demo/localStorage behaviour + key table, reset snippet, test command.

---

## 2026-06-13 — Sprint 2: Saving, activity & assets

### Added
- Collections (`lib/collections.ts`, `components/save-button.tsx`, `components/collections-client.tsx`, `/collections`): three default collections, quick-save on cards + full menu on house pages.
- Activity feed (`lib/activity.ts`, `components/activity-feed.tsx`, `/activity`) — global stream + per-creator feed on profiles; 7 activity types.
- Asset catalog (`lib/assets.ts`, `components/assets-client.tsx`, `/assets`) — internal, read-only, filterable.

### Changed
- Creator-profile "recent activity" placeholder replaced by the real activity feed.
- `recordActivity` wired into like / follow / guestbook / claim / update / add-decoration / save.
- Footer adds Collections and Activity links (flag-gated).

### Database
- Migration `20260613_collections_activity_assets.sql`: tables `collections`, `collection_items`, `activity_events`, `assets`; enums `saved_kind`, `activity_type`, `asset_category`, `asset_placement`, `asset_rarity`, `asset_status`, `asset_owner_type`; RLS. Mirrored in `schema.sql`.

### Flags
- Flipped `ENABLE_COLLECTIONS`, `ENABLE_ACTIVITY_FEED`, `ENABLE_ASSET_CATALOG` to default **on** (implemented).

### Documentation
- README + `docs/QA.md` updated for the three features.

---

## 2026-06-12 — Sprint 1: Creator identity

### Added
- Feature-flag module `lib/flags.ts` (`NEXT_PUBLIC_ENABLE_*`, server+client safe).
- Creator profiles (`/u/[handle]`, `components/creator-profile-client.tsx`, `lib/creators.ts`): avatar, bio, links, owned houses, follower/following, follow button, activity placeholder.
- Notifications (`lib/notifications.ts`, header bell, `/notifications`): 6 types, read/unread, mark-all, demo seed.
- Guestbooks (`lib/guestbook.ts`, `components/guestbook-panel.tsx`): per-house notes, owner hide/delete, report a note, owner notification on new note.

### Changed
- Owner names/avatars on house pages and cards link to creator profiles.
- Report dialog gains a guestbook target; report target type `guestbook` added.

### Database
- Migration `20260612_01_extend_enums.sql` (`report_target_type` += `guestbook`).
- Migration `20260612_02_creator_engagement.sql` (`guestbook_entries`, `notifications` + `push_notification()` + insert trigger, `reports.guestbook_entry_id` + check). Mirrored in `schema.sql`.

### Flags
- Added `ENABLE_CREATOR_PROFILES`, `ENABLE_NOTIFICATIONS`, `ENABLE_GUESTBOOKS` (default **on**); `ENABLE_COLLECTIONS`, `ENABLE_ACTIVITY_FEED`, `ENABLE_ASSET_CATALOG` scaffolded **off**.

### Documentation
- README creator-identity section; `.env.example` flag entries.

---

## 2026-06-11 — Platform foundations

### Added
- Hexagon district map (`components/village-world.tsx`) replacing the circular-village map; villages carry axial `hex` coords.
- Tags (`lib/tags.ts`, `/tags`, `/tags/[tag]`, studio editing): lowercase-normalized tags on houses, decorations, links.
- Discovery modes (`/discover`): trending, newest, popular tags, explore-by-tag, mobile swipe deck, desktop grid/list.
- Analytics events (`lib/events.ts`, `trackEvent`) and basic counts.
- Reporting + moderation (`lib/reports.ts`, `components/report-dialog.tsx`, `/moderation`): report house/item/user; admin queue with status workflow; soft-hide.

### Changed
- World map navigation reworked to hex grid; house page leans room-first.

### Fixed
- Map hydration mismatch resolved by emitting fixed-precision coordinates.

### Database
- Migration `20260611_01_extend_enums.sql` (`report_target_type` += `user`; `report_status` `pending`/`reviewed`/`hidden`).
- Migration `20260611_02_tags_events_reports.sql` (`tags`, `shop_tags`, `decoration_tags`, `link_tags`; `events` + `record_event()` + `event_counts` view; reports user target). `seed.sql` adds a starter tag vocabulary. Mirrored in `schema.sql`.

### Documentation
- README discovery/tags/analytics/moderation section.

---

## 2026-06-10 — Visual redesign "Lantern Hollow" (Phase 0–1)

### Added
- Design-token system + shadow/light tokens (`app/globals.css`, `tailwind.config.ts`).
- Fonts via `next/font`: Fraunces (display) + Nunito Sans (UI) (`app/layout.tsx`).
- Seed-deterministic SVG house kit (`components/scene/house/`: `house.tsx`, `spec.ts`) used by street, discover cards, and exterior preview.
- Internal `/design` house-kit showcase.

### Changed
- De-SaaS chrome: buttons, header, and cards moved to a parchment/timber language.
- Display + eyebrow typography updated; weight 900 retired.
- Street view and discover cards render the shared house kit (replacing CSS-rectangle houses).

### Fixed
- Gable-roof texture overflow, dome-roof shading seam, and name-sign sizing in the house kit.

### Database
- None.

### Documentation
- `docs/visual-redesign-plan.md` (art direction + phased plan).

---

## 2026-06-10 — Visual feeling & UX polish

### Added
- Village atmosphere: chimney smoke, fireflies, swaying trees, glowing windows; per-house plots (grass, path, signage).
- Room interior redesigned as furniture-like objects in a perspective room; house page made room-first.

### Changed
- Street view: detached houses with gaps, individual front yards, varied roofs/doors/windows.
- Village map redrawn as an illustrated town (meadow, roads, central features).
- User-facing copy shifted from "shop/store" to "house/place".

### Fixed
- Owned-house badge bug (`undefined === undefined` marked every empty house as owned).
- Hydration mismatch from floating-point coordinate serialization.
- Tailwind `content` not scanning `lib/`, which dropped palette gradients.
- Street scene layers clipped to the first screen width instead of scrolling with the rail.

### Database
- None (baseline migrations `20260610_village_model.sql` and `20260610_house_exteriors_and_room_zones.sql` pre-existed).

### Documentation
- Memory note: Node 20 required for the toolchain.
