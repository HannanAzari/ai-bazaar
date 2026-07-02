# AI Bazaar — Handoff

Read this first. It gets a new session productive in ~5 minutes. Deeper detail:
[architecture.md](../architecture.md) · direction: [roadmap.md](roadmap.md) ·
history: [changelog.md](changelog.md) · testing: [QA.md](QA.md) ·
room contract: [room-engine-spec.md](room-engine-spec.md).

> **Latest Nest sprint — M15 real app shell & Nest Home (2026-07-02):** Nestudio is now a real
> app — a permanent mobile bottom nav (`Home · Explore · Create · Updates`), a real **Home**
> (profile summary · drafts · published), **username ownership** at `/@<handle>`, and the Create
> tab as the single creation entry. Built on the **nest-auth identity** (`lib/nest-profile-store.ts`
> + `useNestIdentity`), no auth rewrite; single editor + persistence preserved. `/studio`, `/`,
> and `/design/nest-onboarding` redirect into the shell; the editor + publish gate return to
> `/home` (the old post-publish login wall is gone). Identity is **local-mode** for now. Shipped
> on `m12-nest-platform` (**preview only — not merged to `main`**). See
> [m15-app-shell.md](m15-app-shell.md) + decision-log ADR-033. Prior: M13 mobile stabilisation
> ([m13-mobile-stabilisation.md](m13-mobile-stabilisation.md), ADR-032).

**Before closing any sprint, follow [sprint-checklist.md](sprint-checklist.md)
(definition of done): update all source-of-truth docs, then pass typecheck +
lint + test + build.**

---

## Current State

AI Bazaar is a **cozy creator village**: claim a house in one of 10 villages,
decorate a **room**, and visitors discover you by exploring spaces, not a feed.

- **Stack:** Next.js 15 (App Router), React 19, strict TypeScript, Tailwind 3, lucide. **Node 20 required** (machine default is v16): `export PATH="/Users/hannan/.nvm/versions/node/v20.20.2/bin:$PATH"`.
- **Runs as a client-side demo.** Blank Supabase env → `lib/supabase/*` returns `null`; state lives in `localStorage`, seed content in `lib/data.ts`. The SQL schema is a **production-parity mirror, not run at runtime here.** Every feature has two layers: a demo lib + matching SQL.
- **Shipped:** village map → street → house kit; **Room Engine V1** (full-screen public room + studio editor), **V2 — Creator Studio** (free drag/resize, layers, duplicate, delete-confirm, multi-select, Edit/Preview, undo/redo, autosave, six templates), **V3 — Real Interactive Objects** (real gallery/video/link/product/booking/contact/profile panels, `profile` type, tooltips, visitor analytics, owner insights, inspector editors, working presets), **V4 — Multi-Room Houses** (`HouseRooms` + entry room, `door`/`stairs` + `room_link` navigation, public breadcrumb/back, studio room manager + room presets, whole-house undo, nav analytics, legacy migrate-on-read), and **V5 — Richer Visuals + Rotation** (per-category object sprites, engraved nameplates, rotation editor, five room background variants, improved empty state); creator profiles, notifications, guestbooks, collections, activity feed, tags, discovery, analytics, reporting/moderation, asset catalog. **Backend cutover prep** (2026-06-19): env-derived runtime mode + dev-only badge, a repository layer (local impls + Supabase stubs), and `docs/supabase-cutover.md` — demo remains the default and is unchanged. **AI Room Designer V1** (2026-06-20): a deterministic, selection-only designer (`lib/ai-room-designer.ts`) that turns a natural-language brief + style preset into a valid room from existing catalog assets — no image generation; surfaced as the studio **Design** mode with preview-before-apply + explanations. **AI Room Designer V2** (2026-06-21): advanced brief parser (creator type · mood · purpose · constraints), constraints engine, 8 creator presets, owner-private drafts (`lib/room-design-drafts.ts` + `room_design_drafts` table), session history, and a richer explanation panel. **AI Room Designer V3** (2026-06-22): Creator Auto Build — a deterministic, no-scraping profile analyzer (`lib/creator-analyzer.ts`) turns social URLs + bio into a creator type (12), auto room, auto social/profile objects, and a welcome message.
 **Production Cutover V1** (2026-06-23): real Supabase **auth** (unified `useSession()`), **profiles**, **room persistence** (jsonb on `rooms`), production **shop-claiming** (`lib/shop-claim.ts`: `claimShopInSupabase`/`getShopByAddress`), `SupabaseStorage`, `/onboarding`, subdomain prep — all mode-selected, **demo unchanged & default**. **Full authenticated flow verified LIVE on staging** (create account → onboarding → claim Nest → save → reload → persists from Supabase → logout → login → still exists; RLS owner-write/anon-deny/public-read hold). **Pilot Hardening V1** (2026-06-24): shared validation (`lib/validation.ts`), centralized friendly errors (`lib/errors.ts` — no raw Supabase leaks), loading/double-submit guards, internal funnel events, draft legal pages (`/privacy`,`/terms`,`/safety`,`/contact`); **safe for friends & family pilot** (see `docs/pilot-readiness.md`), not public-launch ready. **Analytics + Discovery V1** (2026-06-25, ADR-020): **mode-aware durable analytics** (`trackEvent` writes Supabase via the now-implemented `SupabaseEventsRepository` in production, localStorage in demo, local fallback on failure), **anonymous visitor sessions** (`lib/visitor-id.ts`/`lib/visitor-session.ts`: first/returning, start/end, duration), per-object `object_view` impressions, a pure **creator insights** engine (`lib/creator-insights.ts`) surfaced as a Studio **Insights & visitors** panel (visits, unique visitors, room entries, avg session, top objects/room/day, funnel + conversion), and **Featured Nests** discovery (`lib/discovery.ts` + `components/featured-nests.tsx`) on `/discover` (Trending/New/Recently active). `visitor_sessions` table + owner-read events RLS (`20260625_*`); demo unchanged.
- **Gates (all green):** `npm run typecheck && npm run lint && npm run test && npm run build` (236 tests, ~86 pages).

---

## Active Architecture Decisions (do not break)

1. **The room is the primary UX.** The public house page is a full-screen room; profile data is secondary (drawers/panels).
2. **The village is the navigation layer.** Hex map → village street → house. Don't turn navigation into a feed.
3. **The asset library is the source of truth** for anything placeable. Room objects reference catalog assets.
4. **AI never generates graphics.** AI may only *select/arrange* existing assets. The **AI Room Designer V1** (`lib/ai-room-designer.ts`) is a deterministic, rules-based recommender — no LLM/SD/Gemini, no image generation, no external APIs.
5. **Public rooms use the full-screen experience** (`RoomExperience`); the legacy room is only the `ENABLE_ROOM_ENGINE=off` fallback.
6. **Two layers, always in sync.** New feature = demo localStorage lib (SSR-guarded, try/catch, `*-changed` event) **and** schema.sql + a dated migration.
7. **No `Math.random`/`Date.now` in render** — hydration safety. Derive variation from stable seeds.
8. **Don't redesign village/street/house-exterior art** without an explicit visual sprint.
9. **V2 architecture — House → Nest (ADR-027) + front-facing camera (ADR-028).** The model is `Village → House → Nest → Objects → Content`; the user-facing **"Wall" concept is removed.** A **Nest** is a **front-facing cinematic scene** (full front wall + side slivers + floor, shallow depth — **not** isometric/30° iso/top-down) that is **composed** from a curated Nest Template + Scene Slots + Asset Library assets + avatar + a few personal belongings — **composition over generation.** AI generation is minimal (concept art to seed the library; runtime only for avatar + truly personal belongings). The shipped code is still **V1** (the room engine below); **no V2 implementation has started.** **Superseded — do not reopen:** wall-first (ADR-023/024), Room → Wall → Object (ADR-025), Scene-Pack/room-shell/wall-pack (ADR-021/022/026). The 28 approved ~30° iso assets are **V1 reference only** (ADR-028). Masters: [nestudio-production-pipeline.md](nestudio-production-pipeline.md), [golden-nest-production-bible.md](golden-nest-production-bible.md), [nestudio-cto-handoff.md](nestudio-cto-handoff.md).

---

## Important Files

**Room engine (the core)**
- `lib/types.ts` — `HouseRooms` (V4: `{ shopAddress, entryRoomId, rooms[] }`), `Room` (incl. optional `width`/`height`, `description`), `RoomZoneDef`, `RoomObject`, `RoomZoneType` (9), `RoomActionType` (11, incl. `profile`, `room_link`), `RoomKind` (+ V4 types), `AssetCategory` (+ `door`/`stairs`), rich `RoomActionData` (+ `targetRoomId`). *Note: distinct from the legacy `RoomZone` string-union used by `Decoration`.*
- `lib/room-schema.ts` — `ZONE_TEMPLATE`, `createRoom` (+ `nextRoomId`), `deriveDefaultRoom`, `validatePlacement`, and pure layout helpers (`addObjectFromAsset`, `moveObject`, `moveObjectTo`, `resizeObject`, `objectCenter`, `duplicateObject`, `deleteObject`, `bringToFront`/`sendToBack`, `bringForward`/`sendBackward`).
- `lib/house.ts` — pure `HouseRooms` ops: `deriveDefaultHouse`, `addRoom`, `renameRoom`, `updateRoomMeta`, `setEntryRoom`, `deleteRoom`/`canDeleteRoom`, `withRoom`, `isValidRoomLink`, `roomLinkTargets`, `normalizeHouse`/`houseFromRoom`.
- `lib/room-actions.ts` — pure action-data helpers (`galleryImages`, `productCard`, `contactMethods`, `faviconUrl`, `hostname`, `hasActionData`). `lib/embeds.ts` — `videoEmbed` (YouTube/Vimeo). `lib/room-insights.ts` — owner `getRoomInsights`. `lib/room-visuals.ts` — `objectVisual(assetId, category)` (per-category sprite kind) + `ROOM_BACKGROUNDS`/`roomBackground`/`defaultBackgroundForType` (background variants).
- `lib/room-templates.ts` — six object templates (`ROOM_TEMPLATES`, `applyTemplate`) + V4 room presets (`ROOM_PRESETS`, `buildPresetRoom`). `lib/room-history.ts` — pure undo/redo `History<T>`.
- `lib/room.ts` — house store: `getHouse`/`getStoredHouse`/`saveHouse`/`resetHouse` (key `ai-bazaar-rooms`, legacy single-room migrate-on-read) + back-compat `getRoom`/`saveRoom`/`resetRoom` (entry room).
- `components/room/room-experience.tsx` — full-screen public surface; renders the current room of a multi-room house, breadcrumb + back, `room_link` navigation, per-type `*_opened` + `room_entered`/`room_link_clicked` analytics.
- `components/room/room-editor.tsx` — **Creator Studio** editor: room manager (create/rename/retype/set-entry/delete + presets + switch), templates, palette, drag/resize canvas, inspector with per-action `ActionDataEditor`, Edit/Preview, whole-house undo/redo, autosave, save/reset house, delete-confirm, owner insights.
- `lib/ai-room-designer.ts` + `components/room/room-designer.tsx` — **AI Room Designer V1+V2** (studio Design mode, flag `ENABLE_AI_DESIGNER`): `matchIntent`/`scoreAssets`/`generateRoomDesign` (deterministic, selection-only) + V2 `parseBrief` (creator type · mood · purpose · constraints), constraints engine, `CREATOR_PRESETS` → preview-vs-current → Apply (replaces the selected room via `saveHouse`) / Regenerate (`variant`) / Save draft + "Why this layout" explanations; `room_design_*` analytics.
- `lib/room-design-drafts.ts` — owner-private designer **drafts** store (`getDrafts`/`saveDraft`/`getDraft`/`deleteDraft`, key `ai-bazaar-design-drafts`); SQL parity in `room_design_drafts`.
- **Production Cutover V1** — `lib/auth/*` (`getAuthClient`, `DemoAuthClient`/`SupabaseAuthClient`) + `components/providers/auth-provider.tsx` (`useSession`); `DemoProvider` derives user from the session. `middleware.ts` (session refresh + `/studio`,`/onboarding` guard + subdomain rewrite). `lib/house-store.ts` (async load/persist via `getRepositories`) adopted by editor/designer/experience. `lib/repos/supabase.ts` (profiles/houses/rooms real, lazy client) + `lib/repos/supabase-mappers.ts` (pure row↔Room). `lib/profile-store.ts`, `lib/storage/supabase.ts`, `lib/subdomain.ts`, `app/onboarding/page.tsx`, `lib/shop-claim.ts` (`claimShopInSupabase`/`getShopByAddress`), `components/shop-route-client.tsx` (mode-aware shop resolution).
- `lib/creator-analyzer.ts` — **V3 Creator Auto Build**: `analyzeCreator(input)` (deterministic, no network) → `{creatorType,mood,purpose,keywords,socialLinks,confidence,summary}`; `generateCreatorRoom()` (reuses `generateRoomDesign`, adds profile + per-platform link objects + welcome `description`); `welcomeMessage`. `creator_*` analytics. Surfaced in `components/room/room-designer.tsx`.
- `components/room/object-action-modal.tsx` — **real V3 interactive panels** (gallery lightbox, video embed, link, product, booking, contact, profile). `action-data-editor.tsx` — inspector field editor.
- `components/room/{room-canvas,room-object}.tsx` — rendering pieces; `room-canvas` owns editor pointer interaction (drag/resize/marquee) and threads `ownerName` for tooltips.
- `lib/assets.ts` — asset catalog; room-ready assets carry `compatibleZones`/`defaultScale`/`defaultActionType`; `roomReadyAssets()`, `getAsset()`.

**Wiring / surfaces**
- `components/shop-page-client.tsx` — switch: `RoomExperience` (flag on) vs `LegacyHouseView` (fallback / hidden state).
- `app/studio/page.tsx` — owner editor; modes `room` (default) / `exterior` / `interior`.
- `components/providers/demo-provider.tsx` — `useDemo()`/`useAllShops()`; user, claimed shop, likes, follows.
- `lib/data.ts` — 10 villages + 10 sample houses (`HOUSES_PER_VILLAGE = 24`).
- `lib/flags.ts` — feature flags. `app/globals.css` — shared room shell CSS.

**Village (don't redesign visuals)**
- `components/village-world.tsx` (hex map), `components/street-walk.tsx` (street), `components/scene/house/` (seed-deterministic SVG house kit).

**Demo libs (same pattern each):** `lib/{events,reports,notifications,guestbook,collections,activity}.ts`, plus `lib/{tags,creators,use-hidden}.ts`.

**Nestudio visual kit — templates (2026-06-25, ADR-022 · builds on ADR-021):**
> **⚠️ Superseded by ADR-027 (architecture) + ADR-028 (camera).** These are **V1 reference code/assets** (iso room-shell + wall-pack image templates, the 28 ~30° iso furniture assets). They are **not** the V2 production standard — V2 uses front-facing Nests composed from a camera-matched Asset Library. Kept because the code still ships in the V1 app and the export-bridge/registry *patterns* will inform the V2 pipeline.
- **Strategy:** curated/generated **image templates** (exterior/room/village) + interactive assets layered on top — NOT CSS-drawn scenes. See `docs/visual-kit.md`.
- **Types** (`lib/types.ts`): `VisualTemplate` base + `RoomShellTemplate` / `ExteriorShellTemplate` / reserved `VillageTileTemplate`. **Registries:** `lib/templates/room-shells.ts` (`nestudio-cozy-v1`) + `lib/templates/exterior-shells.ts` (`nestudio-cottage-v1`); static, no runtime Supabase yet. Shell images in `public/{room,exterior}-shells/*.svg` are **temporary placeholders** — swap for Factory-generated images via `imageUrl` + recalibrate `placementZones` + bump `version`.
- **Real furniture catalog bridge:** `scripts/export-style-lab-catalog.mjs` (service-role, Node 20 + `SUPABASE_SERVICE_ROLE_KEY`) → `lib/asset-catalogs/nestudio-interior-v1.json` (**28 real assets, public Supabase URLs**); loader `lib/asset-catalogs/index.ts` merged into `lib/assets.ts`. Approved set is furniture-only so far.
- **Layered renderer:** `components/room/room-shell-stage.tsx` (shell image background + furniture placed on calibrated zones, clickable). `furnishRoomShell()` resolves zones→assets. Image-first via `renderableAssetImage()` (`lib/room-visuals.ts`) + `components/room/room-object.tsx` keeps classic/icon rooms working (`RoomCanvas`/`RoomExperience` untouched).
- **Debug pages:** `/design/interior-v1` (room shell + real furniture + panel), `/design/exterior-v1` (exterior shell + metadata panel). Runtime Supabase template/asset loading deferred. **AI design engine's future role:** choose a template + place assets, not draw scenes.

**Analytics + Discovery V1 (2026-06-25):**
- `lib/events.ts` — **mode-aware** `trackEvent` (demo localStorage / production Supabase `record_event`, local fallback) + `trackEventLocal` (the writer the local repo + fallback share). `lib/repos/supabase.ts` — `SupabaseEventsRepository` (`record`/`list`/`counts`, `mapEventRow`).
- `lib/visitor-id.ts` — low-level anonymous visitor/session id storage (no deps, breaks the events↔session cycle). `lib/visitor-session.ts` — session lifecycle (`startSession`/`endSession`/`useVisitorSession`, first-vs-returning, duration).
- `lib/creator-insights.ts` — pure `computeCreatorInsights(events, shopId, house)` (visits, unique visitors, room entries, avg session, top objects/room/day, funnel + conversion, per-object engagement) + `formatDuration`. `components/room/creator-insights-panel.tsx` — Studio dashboard. `lib/discovery.ts` — `rankTrending`/`rankNewCreators`/`rankRecentlyActive`. `components/featured-nests.tsx` — `/discover` rails.

**Database:** `supabase/schema.sql` (fresh-install superset), `supabase/migrations/*` (ordered), `supabase/seed.sql`.

**Backend cutover seam (prep — not yet consumed by the app):**
- `lib/runtime-mode.ts` — `getRuntimeMode()` (`demo`|`production`) from Supabase env presence; `components/dev-mode-badge.tsx` (dev-only chip, in `app/layout.tsx`).
- `lib/repos/` — async repo interfaces (`types.ts`), local impls delegating to the demo libs (`local.ts`), Supabase **stubs** that throw (`supabase.ts`), and `getRepositories(mode?)` factory (`index.ts`). Mirrors `lib/storage/`.
- `docs/supabase-cutover.md` — drift audit + migration order + env + local/staging setup + RLS smoke tests + rollback.

---

## Current Feature Flags

`NEXT_PUBLIC_ENABLE_*` (build-time inlined). Access via `flags` in `lib/flags.ts`.

| Flag | Default | Controls | Off |
|---|---|---|---|
| `ENABLE_CREATOR_PROFILES` | on | `/u/[handle]`, owner links | route 404, links plain text |
| `ENABLE_NOTIFICATIONS` | on | bell, `/notifications` | route 404, bell hidden |
| `ENABLE_GUESTBOOKS` | on | guestbook panel/drawer | hidden |
| `ENABLE_COLLECTIONS` | on | save buttons, `/collections` | route 404, buttons hidden |
| `ENABLE_ACTIVITY_FEED` | on | `/activity`, profile feed, recording | route 404, recording skipped |
| `ENABLE_ASSET_CATALOG` | on | `/assets` (internal) | route 404 |
| `ENABLE_ROOM_ENGINE` | on | full-screen room + room editor | **legacy room (no 404)** |
| `ENABLE_AI_DESIGNER` | on | studio **Design** mode (AI room designer) | Design tab hidden (needs `roomEngine`) |

---

## Open Problems (known limitations)

- Room object actions are **real** (V3); their panels load **third-party embeds/images** (YouTube, Vimeo, Calendly, favicons, sample preset images) — external requests that won't render offline.
- Placement is **free drag + resize + rotate** (V2/V5). Objects render as **CSS sprites around an icon** (V5) — richer than a tile but not per-asset illustration; resize-handle math is axis-aligned, so resizing a heavily rotated object is approximate. Objects can crowd on tiny viewports.
- **Multi-room ships in V4**, but navigation is **client-only**: a visitor always lands in the entry room and a URL can't deep-link to a specific inner room yet.
- **Backend cutover is prep only:** the Supabase repositories (`lib/repos/supabase.ts`) are `NotImplementedError` stubs and the repo layer is **not yet consumed by components** (they still call the demo libs). The migration chain can't build from an empty DB — fresh DB → apply `schema.sql` (see `docs/supabase-cutover.md`).
- **AI and image storage are mocked** (`/api/generations`, placeholder asset URLs).
- **SQL never executed against live Postgres here** — dry-run migrations + RLS on staging before production.
- Tests cover **libs, not UI** (no component/E2E).
- Demo is **single-user**: notifications/activity are seeded + self-generated; "following" counts are demo-derived.

---

## Recommended Next Sprint

**V2 Nest architecture (ADR-027 + ADR-028) — building toward the Nest Composer.** The model is
`Village → House → Nest → Objects → Content`. A **Nest** is a **front-facing cinematic scene**
(front wall + side slivers + floor, shallow depth — camera locked by ADR-028, **not** isometric)
**composed** from a curated **Nest Template** + **Scene Slots** + **Asset Library** assets + avatar
+ a few personal belongings — **composition over generation.** Interactions are **Object →
Animation → Content.**

**M0 (just completed): camera decision + source-of-truth cleanup** — front-facing camera locked
(ADR-028); the 30° iso Perspective Contract superseded; wall-first/Room→Wall docs demoted to
history. Documentation only.

**Following milestones (toward a production-ready Nest Composer; spec before build):** (1) lock the
constants — front-facing camera spec + scene-box geometry + slot taxonomy; (2) define the V2 data
model (`Asset`, `NestTemplate`, `SceneSlot`, `Interaction`, `ComposedNest`); (3) one Nest Template
+ Scene Slots (static registry); (4) a minimal **Nest Composer** (re-point the deterministic
`lib/ai-room-designer.ts` from zone-placement to slot-snapping); (5) a mobile front-facing renderer
+ 3–5 interactions → **one Golden Nest** end-to-end (bible's Definition of Done).

**Asset Library V2:** the 28 approved ~30° iso assets are **V1 reference only** (ADR-028); V2 assets
are authored/re-authored to the front-facing camera (later sprint).

**Still owed (sequence alongside/after):** the production backend cutover (Supabase repos in
`lib/repos/supabase.ts`, adopt `getRepositories()`, staging RLS smoke tests; rollback = unset
Supabase env). Explicitly **not** marketplace/payments/chat.

> **Superseded (do not reopen):** wall-first creator homes (ADR-023/024), Room → Wall → Object
> (ADR-025), Scene-Pack/room-shell/wall-pack (ADR-021/022/026) — all superseded by ADR-027; their
> docs are reference history.

---

## Do Not Accidentally Change

- **Room object schema** (`RoomObject`/`Room` in `lib/types.ts` + `room_objects` columns) — public rooms and saved layouts depend on the exact shape; migrate, don't mutate. `width`/`height` are **optional** (V2); `RoomActionData` fields are **all optional** (V3) and stored in the `action_data` jsonb — grow it additively, keep fields optional so old saved rooms stay valid.
- **`RoomActionType` is a closed enum** — adding a type (like V3's `profile`) means a TS change, a `room_action_type` enum-value migration, a panel in `object-action-modal.tsx`, and a spec/ADR update.
- **Demo-by-default backend signal** — the app must stay pure-demo when the Supabase env vars are absent. `getRuntimeMode()` keys off `NEXT_PUBLIC_SUPABASE_URL` + `_ANON_KEY`; don't gate the backend behind a feature flag or make any path require Supabase to run. The repo layer must keep its local implementations as the demo fallback.
- **`HouseRooms` shape + entry invariant** (V4) — a house has ≥1 room and exactly one `entryRoomId` that references a real room; `lib/room.ts` migrates a legacy single-`Room` save on read. Don't change the `ai-bazaar-rooms` key or break migrate-on-read, or pre-V4 layouts vanish. Door/stairs targets (`actionData.targetRoomId`) must be validated against existing rooms.
- **Migration ordering / enum split** — new enum *values* must commit (in `_01_extend_enums`) before use (`_02_*`); never reorder or rename existing migration files.
- **localStorage keys** (`ai-bazaar-*`, e.g. `ai-bazaar-rooms`, `ai-bazaar-shop`, `ai-bazaar-design-drafts`, `ai-bazaar-user`, `ai-bazaar-profiles`, `ai-bazaar-onboarded`) — renaming silently wipes demo state. `DemoAuthClient` shares `ai-bazaar-user` with `DemoProvider`; keep them on the same key.
- **Unified session** — components read auth via `useSession()` (AuthProvider, mode-aware); `DemoProvider.user` is derived from it. Don't reintroduce a second user source. Production must stay demo-by-default: `getRuntimeMode()` keys off Supabase env presence only.
- **Room persistence shape** — production stores rooms as a jsonb snapshot on `rooms` (`client_id`+`objects`); `lib/repos/supabase-mappers.ts` is the contract. Keep it V5-faithful.
- **Public room route behavior** — `/shop/[address]` must keep the `RoomExperience` (flag on) / `LegacyHouseView` (off or hidden) switch; the hidden-by-moderator "resting" path must stay.
- **The legacy `RoomZone` string-union** — used by `Decoration`; not the room-engine `RoomZoneType`. Keep them separate.
- **The seed-deterministic house kit** (`components/scene/house/spec.ts`) — variation must derive from stable seeds (SSR/hydration), never random.
- **`lib/data.ts` village/house seed** — addresses and counts are referenced across routes and `generateStaticParams`.
- **Mode-aware analytics** — `trackEvent` is the single API; demo writes localStorage, production writes Supabase (`record_event`) with a local fallback. Don't reintroduce a sync-only writer at call sites or import `@/lib/repos` statically into `lib/events.ts` (it's a **dynamic** import to avoid a cycle). `lib/visitor-id.ts` must stay dependency-free (both `events.ts` and `visitor-session.ts` import it). Visitor/session ids live in the `events.metadata` jsonb in production — don't add columns for them. The event funnel is **derived from events**; `visitor_sessions` is the parity mirror, not a second runtime store.
