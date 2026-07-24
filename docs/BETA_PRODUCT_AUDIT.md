# BETA_PRODUCT_AUDIT.md

> **Source of truth for the Nestudio Beta Stabilisation initiative.**
> Written 2026-07-24. Branch `m12-nest-platform`. This is an *understanding* document —
> no code was changed to produce it. Where a bug was found it is **recorded, not fixed.**
>
> Scale of what we are auditing: **~394 TypeScript/TSX files** (102 in `app/`, 205 in
> `lib/`, 87 in `components/`), **~55 page routes**, **~18 API routes**, plus a *second*
> deployable workspace at `apps/asset-factory/`. The architecture has genuinely grown
> faster than it has been audited. This document reverses that.

---

## 0. EXECUTIVE SUMMARY (the one page)

**What is healthy?**
- The **core creation loop** works and is self-consistent: `/create → /nest-editor → publish → /nest/[slug] → /profile`. Editor, publish gate, ownership, and the visitor view all function.
- **Authentication** (email/password) and the **new PKCE callback** are sound; there is now ONE canonical server session (`getServerUser`) and ONE client hook (`useNestIdentity`).
- The **generation platform** is well-architected: Asset + Nest + Avatar are thin modules on one shared `GenerationStudio`. The Asset engine is certified (Laptop benchmark) and frozen.
- The **app-shell navigation** (5-tab bottom bar) is clean and mobile-first.

**What is dangerous?**
- 🔴 **`/moderation` is completely unprotected** — no auth, no flag, no founder check. Any visitor can open the admin report queue. **Highest-priority fix.**
- 🔴 **Sign-up drops new users into a dead legacy funnel.** `/auth/sign-up → /onboarding` runs the *old* shop/house system and ends on `/shop/[address]` — a route that is now **redirected to `/home`**. The first thing a new Beta user does is fall into a broken, abandoned flow.
- 🔴 **The whole product is localStorage-backed by default.** Published Nests only resolve in the *owner's* browser unless `NEXT_PUBLIC_NEST_BACKEND=supabase`. A real visitor on another device sees nothing at a bare `/nest/[slug]`. This is the single biggest gap between "demo" and "Beta."
- 🟡 **Two whole product generations coexist.** A live "Nest" app and a dead "AI Bazaar / village / shop" island share the repo. The island is unreachable from primary nav but still compiles, still holds ~40% of the routes, and still creates confusion.
- 🟡 **Seven permission mechanisms**, two of them dead founder-token gates.

**What should disappear (before Beta)?**
- The **legacy V1 "AI Bazaar" island**: `/bazaar*`, `/shop/[address]`, `/discover`, `/tags*`, `/collections`, `/activity`, `/u/[handle]`, `/assets`, plus `/village-lab`, `/village-projection-lab`.
- The **dead founder-token auth** (`lib/founder-gate.ts`, `lib/founder-token.ts`, the `x-founder-token` header path).
- **Dev/design benches** from the production build or behind a real gate: all `/dev/*`, all `/design/*`.
- The **mock** `/api/generations` route (`provider: "mock"`).

**What absolutely must be fixed before Beta?**
1. Gate or delete `/moderation` (security).
2. Repoint sign-up → the canonical `/create` journey (kill the `/onboarding` shop funnel).
3. Decide the persistence story: turn on the Supabase backend for the core Nest loop, or scope Beta honestly to single-device. Today's default (localStorage) is not a shippable visitor experience.
4. Gate every wide-open founder/dev/design surface (or remove from the build).

**What should wait until after Beta?**
- Villages (explicitly out of scope; `VillageWorld` preserved).
- Avatar *public* release — needs the founder-run Golden Reference first (`AVATAR_PUBLIC_ENABLED=1`).
- The Asset "material voice" redesign (wooden-everything look).
- Creator Generator / Interaction Engine / Memory Engine.
- Deep refactors of the 205-file `lib/` (map it, don't rewrite it, this week).

---

## 1. CURRENT ARCHITECTURE (for a new engineer)

Nestudio is a **"digital home / visual language of identity"** product: a user makes a
profile, gets a **Nest** (a stylised room), **decorates** it with generated **assets**, and
**publishes** it for visitors. It is a Next.js 15 App Router app (React, TypeScript,
Tailwind, Supabase, OpenAI `gpt-image-1`), deployed to Vercel from `m12-nest-platform`.

### The two generations of the product (critical mental model)
The repo contains **two overlapping products**:

| | **V1 — "AI Bazaar" (legacy)** | **V2 — "Nestudio / Nest" (current)** |
|---|---|---|
| Metaphor | Village → House → Shop | Home feed → Profile → Nest |
| Chrome | `SiteHeader` + `Footer` | 5-tab app-shell bottom nav |
| Data | seed `lib/data.ts` + demo provider | `NestDocument` (localStorage / Supabase) |
| Entry | `/discover`, `/bazaar`, `/shop` | `/home`, `/create`, `/profile` |
| Status | **Unreachable island** (see §3) | **Live product** |

`/` redirects to `/home` (V2). The V1 chrome renders **only** on V1 routes, so a live user
never enters the V1 island — but all of it still exists and compiles.

### Major modules (`lib/`, 205 files)
- **Nest core** (`nest-*.ts`, ~60 files): the document model (`nest-document-*`), editor
  engine (`nest-editor-*`, ~18 files), rendering/projection (`nest-render`, `nest-focus-*`,
  `nest-visual-*`), placement, hotspots, surfaces, house/village derivations.
- **Generation platform** (`generation-platform/`, `art-engine/`, `visual-dna.ts`): the
  shared studio contract + the Art Engine (structured Visual DNA → per-type prompt compiler).
- **Factories** (`asset-pipeline/`, `avatar-factory/`, `nest-factory/`, `ai/`, `ai-inventory/`).
- **Auth** (`auth/`, `user-gate.ts`, `founder-role.ts`, `founder-gate.ts`, `founder-token.ts`,
  `nest-auth*.ts`, `runtime-mode.ts`).
- **Supabase/storage** (`supabase/`, `storage/`, `repos/`).
- **Legacy V1** (`data.ts`, `creators.ts`, `shop-claim.ts`, `collections.ts`, `tags.ts`,
  `activity.ts`, `discovery.ts`, `village-*.ts`, `house*.ts`, `room-*.ts`).

### Authentication (see §4)
`@supabase/ssr` cookie auth. ONE server read (`getServerUser`) and ONE client hook
(`useNestIdentity`). Falls back to a **localStorage demo stub** when `NEXT_PUBLIC_SUPABASE_*`
is absent at build time (`runtime-mode.ts`). Middleware refreshes the session cookie and
protects `/onboarding`.

### Founder tools (see §5)
Role-based: a signed-in Supabase user **on the allowlist** (`FOUNDER_EMAILS` /
`FOUNDER_USER_IDS`). Founder hub lives on `/profile` (`NestudioStudio`), linking the factories.

### Storage & data
- **Supabase tables** (via `supabase/provision/*.sql`): `nest_assets`, `nest_backgrounds`,
  `user_avatars`; `avatar_identities` (SQL written, **not yet applied**).
- **Buckets**: `nestudio-assets` (public), `avatars` (public), `avatar-private` (private),
  `founder-nest-factory`.
- **Default runtime data**: **localStorage** for the entire Nest loop unless
  `NEXT_PUBLIC_NEST_BACKEND=supabase`.

### AI pipelines (see §6)
All share the honest path (one generation, no repair loops, `gpt-image-1`, native transparency):
- **Asset**: describe/upload → translator → spec → `furniture@8` (certified) → publish → `nest_assets`.
- **Nest**: intent → empty-room spec → text-to-image → publish → `nest_backgrounds`.
- **Avatar**: photo → (one-shot) OR (Stage 1 identity capture → Stage 2 dual-reference
  assembly) → private `user_avatars`.
- The Art Engine (`lib/visual-dna` + `lib/art-engine`) is the shared "visual brain."

### How it connects (the healthy path)
```
Visitor → / → /home (feed) ─┐
                            ├─ /create → /nest-editor → publish → /nest/[slug] (visitor view)
/profile (dashboard) ───────┘                                      └→ /profile
Founder → /profile → NestudioStudio → /asset-factory · /nest-factory · /nest-studio/calibration
```

---

## 2. FEATURE INVENTORY

Every feature classified as exactly one of: ✅ Stable · 🟡 Needs polish · 🔴 Broken · ⚪ Experimental · ⚫ Dead/obsolete.

| Feature | Class | Note |
|---|---|---|
| Home discovery feed (`/home`, `/explore`) | ✅ Stable | Mobile-first, localStorage data |
| Nest editor (`/nest-editor`) | ✅ Stable | Full editor, ownership enforced |
| Create entry (`/create`) | ✅ Stable | Single entry → the one editor |
| Publish + visitor view (`/nest/[slug]`) | 🟡 Needs polish | Works via `?c=` embed; bare slug is local-only |
| Profile dashboard (`/profile`) | ✅ Stable | Drafts + published |
| Public profile / House (`/profile/[handle]` = `/@handle`) | 🟡 Needs polish | Real but localStorage-only |
| Notifications (`/notifications`) | ✅ Stable | Real inbox, mobile-first |
| Auth — email/password | ✅ Stable | Real Supabase or demo stub |
| Auth — PKCE callback (`/auth/callback`) | ✅ Stable | New, Preview-safe |
| Auth — Google OAuth | ⚪ Experimental | `signInWithGoogle` in lib; **no button in the login UI** |
| Onboarding (`/onboarding`) | 🔴 Broken | Legacy shop/house funnel → dead `/shop/[address]` |
| Server persistence (Nest loop) | 🔴 Broken | localStorage by default; no cross-device visitor view |
| Asset Factory (`/asset-factory`) | ✅ Stable | Founder-only, certified DNA, frozen |
| Asset material voice ("wooden everything") | 🟡 Needs polish | Rejected look; redesign specified, not built |
| Nest Factory (`/nest-factory`) | ✅ Stable | Founder-only, empty rooms |
| Avatar Studio (`/profile/avatar`) | ⚪ Experimental | Founder-only Beta; style not yet approved |
| Avatar two-stage identity + A/B bench | ⚪ Experimental | Built; founder-run A/B not yet done |
| Art Engine / Visual DNA | ✅ Stable | Shared compiler, tested |
| Founder hub (`NestudioStudio`) | ✅ Stable | whoami-gated visibility |
| Moderation queue (`/moderation`) | 🔴 Broken | **No auth — anyone can open it** |
| Design/library admin (`/design/nest-admin`) | ⚪ Experimental | localStorage flag only |
| Dev benches (`/dev/*`) | ⚪ Experimental | Wide open, noindex |
| Design benches (`/design/*`) | ⚪ Experimental | Wide open, noindex; 5 untracked |
| Creator Studio (`/creator-studio`) | 🔴 Broken | Linked from Create; server 403s normal users |
| V1 AI Bazaar island (`/bazaar`, `/shop`, `/discover`, `/tags`, `/collections`, `/activity`, `/u/[handle]`, `/assets`) | ⚫ Dead/obsolete | Unreachable from primary nav |
| Villages (`/village`, `/village-lab`, `/village-projection-lab`) | ⚫ Dead/obsolete (lab) / 🟡 (`/village` still linked) | Out of scope; labs are throwaway |
| Legal pages (`/privacy`, `/terms`, `/safety`, `/contact`) | ✅ Stable | Static, footer-linked |
| `/api/generations` | ⚫ Dead/obsolete | Returns `provider: "mock"` |
| Founder-token auth (`founder-gate.ts`, `founder-token.ts`) | ⚫ Dead/obsolete | Superseded by role gate |

---

## 3. ROUTE AUDIT

Legend: **Reachable** = linked from live UI. **Orphan** = exists, no UI link, not a redirect target.

### Live product routes (V2)
| Route | Purpose | Owner | Used? | Deprecated | Duplicate | Prod-ready |
|---|---|---|---|---|---|---|
| `/` | Redirect → `/home` | shell | yes | no | no | ✅ |
| `/home` | Discovery feed | Nest | yes (tab) | no | overlaps `/explore` | ✅ |
| `/explore` | Discovery grid | Nest | yes (tab) | no | overlaps `/home` | ✅ |
| `/create` | Creation entry | Nest | yes | no | vs `/onboarding` | ✅ |
| `/nest-editor` | The one editor | Nest | yes | no | no | ✅ |
| `/nest/[slug]` | Visitor view | Nest | yes | no | vs `/shop/[address]` | 🟡 (local-only) |
| `/profile` | Private dashboard | Nest | yes (tab) | no | vs `/studio`,`/home`(old) | ✅ |
| `/profile/[handle]` (`/@handle`) | Public House | Nest | yes | no | vs `/u/[handle]` | 🟡 |
| `/profile/avatar` | Avatar Studio | Avatar | founder-hub | no | no | ⚪ (Beta-gated) |
| `/notifications` | Inbox | Nest | yes (tab) | no | no | ✅ |
| `/village` | Village scene | Nest | yes | (descoped) | no | 🟡 |
| `/onboarding` | First-run (legacy) | **V1** | sign-up→here | **should be** | vs `/create` | 🔴 |
| `/auth/login` | Login | Auth | yes | no | no | ✅ |
| `/auth/sign-up` | Sign up | Auth | yes | no | no | ✅ |
| `/auth/complete` | Neutral post-login bounce | Auth | redirect | no | no | ✅ |

### Founder / dev / design (see §5)
| Route | Purpose | Gated | Used | Prod-ready |
|---|---|---|---|---|
| `/asset-factory` | Founder asset gen | server `requireFounder` | founder-hub | ✅ (founder) |
| `/nest-factory` | Founder nest gen | server `requireFounder` | founder-hub | ✅ (founder) |
| `/nest-studio/calibration` | Character calibration | client `whoami.isFounder` | founder-hub | ✅ (founder) |
| `/nest-studio/avatar-ab` | Avatar A/B bench | client `whoami.isFounder` | orphan | ⚪ |
| `/creator-studio` | M20 AI studio | **none (page)**; API 403s | linked from `/create` | 🔴 |
| `/creator-studio/review` | Asset-review lens | client `dev-mode` | orphan | ⚪ |
| `/moderation` | Report queue | **NONE** | orphan | 🔴 |
| `/nest-admin` → `/design/nest-admin` | Library curation | client `admin-mode` | orphan | ⚪ |
| `/dev/art-engine`,`/dev/asset-benchmark`,`/dev/calibration`,`/dev/gpt-image` | Benches | **none**, noindex | orphan | ⚪ remove |
| `/design`, `/design/*` (8+, 5 untracked) | Visual prototypes | **none**, noindex | orphan | ⚪ remove |

### Legacy V1 island (unreachable from primary nav)
| Route | Verdict | Note |
|---|---|---|
| `/bazaar`, `/bazaar/[slug]` | ⚫ Dead | `/bazaar*` **redirects to `/home`**; page shells still exist |
| `/shop/[address]` | ⚫ Dead | `/shop*` **redirects to `/home`**; still *linked* from island → lands on `/home` |
| `/discover` | ⚫ Dead | Superseded by `/explore`; V1 header/footer only |
| `/tags`, `/tags/[tag]` | ⚫ Dead | Footer/island only |
| `/collections` | ⚫ Dead | Footer, `flag.collections` |
| `/activity` | ⚫ Dead | Footer, `flag.activityFeed` |
| `/u/[handle]` | ⚫ Dead | Superseded by `/profile/[handle]` |
| `/assets` | ⚫ Dead | Internal sample catalog, `flag.assetCatalog` |
| `/studio` | ⚫ Dead | Redirect → `/profile` |
| `/updates` | ⚫ Dead | Redirect → `/notifications`; never linked |
| `/village-lab`, `/village-projection-lab` | ⚫ Dead | Self-described throwaway prototypes |

### Redirects & rewrites (complete)
| Kind | Source | Destination | Where |
|---|---|---|---|
| rewrite | `/@:handle` | `/profile/:handle` | `next.config.mjs` |
| rewrite | `<handle>.nestud.io/` | `/u/<handle>` | `middleware.ts` |
| redirect | `/login` | `/auth/login` | `next.config.mjs` |
| redirect | `/signup`, `/sign-up` | `/auth/sign-up` | `next.config.mjs` |
| redirect | `/bazaar`, `/bazaar/*` | `/home` | `next.config.mjs` |
| redirect | `/shop`, `/shop/*` | `/home` | `next.config.mjs` |
| redirect (page) | `/studio` | `/profile` | `app/studio/page.tsx` |
| redirect (page) | `/nest-admin` | `/design/nest-admin` | `app/nest-admin/page.tsx` |
| redirect (page) | `/design/nest-onboarding` | `/create` | page |
| middleware protect | `/onboarding` | `/auth/login?next=` if no session | `middleware.ts` |

> **Recorded bug:** `/bazaar/[slug]` and `/shop/[address]` pages still exist and are still
> linked from island clients, but the `next.config` redirects intercept them → every such
> link dead-ends on `/home`. The `/u/[handle]` subdomain rewrite also points into the dead island.

---

## 4. AUTHENTICATION AUDIT

**One canonical spine:** server `getServerUser()` (`lib/auth/server-session.ts`) + client
`useNestIdentity` (`components/nest/app-shell/use-nest-identity`). Cookies via `@supabase/ssr`;
middleware refreshes them. Demo fallback to localStorage when `NEXT_PUBLIC_SUPABASE_*` absent.

| Flow | Implementation | State |
|---|---|---|
| **Email/password sign-in** | `SupabaseAuthClient.signIn` → `signInWithPassword` | ✅ Works |
| **Email/password sign-up** | `SupabaseAuthClient.signUp` (+ `emailRedirectTo` → `/auth/callback`) | ✅ Works; lands on broken `/onboarding` (§3) |
| **Google OAuth** | `nest-auth.ts signInWithGoogle` → `/auth/callback` | ⚪ Implemented, **not surfaced** — login page is email/password only |
| **PKCE callback** | `app/auth/callback/route.ts` → `exchangeCodeForSession` → neutral `/auth/complete` | ✅ New, Preview-safe |
| **Founder detection** | `isFounder` (allowlist `FOUNDER_EMAILS`/`FOUNDER_USER_IDS`) | ✅ Server-only |
| **Preview** | `getSiteUrl` → `window.location.origin` / `NEXT_PUBLIC_VERCEL_URL` | ✅ New |
| **Production** | `getSiteUrl` → `NEXT_PUBLIC_SITE_URL` | ✅ New |
| **Localhost / demo** | `runtime-mode.ts` → localStorage stub auth | ✅ Works |

### Duplicate / overlapping auth implementations (record, reconcile later)
1. **Two sign-up code paths**: `lib/auth/supabase-auth.ts` `signUp` (used by `useNestIdentity`)
   **and** `lib/nest-auth.ts` `signUpWithEmail` (facade). Overlapping.
2. **Backend-aware facade** `nest-auth.ts` (`getNestSession`, local stub vs Supabase) sits
   beside the canonical `getServerUser`/`useNestIdentity`. Two "who am I" concepts.
3. **Local username stub** `nest-auth-stub.ts` — legacy M11 auth, still imported by the
   creator-studio surface.

*Not a security hole — but three overlapping notions of "the session" is exactly the kind of
thing this initiative should collapse to one.*

---

## 5. FOUNDER TOOLS

| Page | Why it exists | Belongs in Beta? | Stay hidden? |
|---|---|---|---|
| `/asset-factory` | Founder grows the asset library | Yes (founder-only) | Yes (founder hub) |
| `/nest-factory` | Founder grows empty-Nest library | Yes (founder-only) | Yes |
| `/nest-studio/calibration` | "One world?" visual check | Yes | Yes |
| `/nest-studio/avatar-ab` | Two-stage vs one-shot identity test | Yes (this week's work) | Yes |
| `/creator-studio` (+ `/review`) | M20 AI studio (older) | **No** — superseded by factories; **broken link from Create** | Remove/redirect |
| `/moderation` | Report queue | Maybe post-Beta | **Must gate NOW** |
| `/design/nest-admin` (`/nest-admin`) | Library curation prototype | Post-Beta | Gate properly |
| `/dev/*` (4) | Engine benchmarks | No | Remove from build |
| `/design/*` (8+) | Visual prototypes | No | Remove from build |

### Founder / permission mechanisms — **7 distinct, with real duplication**
| Mechanism | What it is | Where | Verdict |
|---|---|---|---|
| `requireFounder` + `isFounder` (`founder-role.ts`) | Supabase user + allowlist (+ emergency token) | all `/api/ai/*`, `/api/founder/*`, `whoami` | ✅ **Canonical** |
| `assertFounder` (`founder-gate.ts`) | shared-secret `x-founder-token` | only a test + a stale comment | ⚫ **Dead — remove** |
| `founderHeaders()` (`founder-token.ts`) | client localStorage token header | `generation-studio.tsx` | ⚫ **Vestigial — remove** |
| `requireUser`/`requireAvatarAccess` (`user-gate.ts`) | any signed-in user; avatar Beta-gate | `/api/ai/avatar/*` | ✅ Consistent |
| client `whoami.isFounder` | visibility only | founder hub, benches | ✅ OK |
| `dev-mode` (localStorage) | `?dev=1` UI toggle | creator-studio | 🟡 Bypassable |
| `admin-mode` (localStorage) | console-settable flag | `/design/nest-admin` | 🟡 Bypassable |

> **Recorded:** two founder-token gates keyed to the same `FOUNDER_ACCESS_TOKEN`
> (`founder-gate.ts` is production-dead); the studio still ships an `x-founder-token` header
> the canonical gate ignores; three unrelated "privileged" concepts (founder allowlist,
> `dev-mode`, `admin-mode`) share no source of truth.

---

## 6. AI SYSTEMS

| | **Asset Factory** | **Nest Factory** | **Avatar Factory** |
|---|---|---|---|
| **State** | Shipped, **frozen** | Shipped | Founder-only Beta, evolving |
| **Route** | `/asset-factory` | `/nest-factory` | `/profile/avatar` + `/nest-studio/avatar-ab` |
| **Pipeline** | describe/upload → translator → spec → `furniture@8` → publish → `nest_assets` | intent → empty-room spec → text-to-image → publish → `nest_backgrounds` | photo → one-shot **or** Stage 1 capture → Stage 2 dual-ref → `user_avatars` (private) |
| **Gate** | server `requireFounder` | server `requireFounder` | `requireAvatarAccess` (founder until `AVATAR_PUBLIC_ENABLED=1`) |
| **Quality** | Certified (Laptop benchmark, ~95% at scale) | Empty rooms consistent | Two-stage just built; not yet judged |
| **Known failures** | "Wooden everything" material voice (rejected look); camera non-determinism (#1 risk); ~1/56 moderation false-positive | Must never change canonical camera | One-shot collapses faces to a mascot; body inferred as childlike — the reason two-stage exists |
| **Blockers** | Material-system rework (design debt) | — | **Avatar Golden Reference** (founder-run A/B → "That's it" → freeze) |
| **Ready for Beta?** | Yes as a **founder** tool (users don't generate assets) | Yes as a **founder** tool | **No** — needs the Golden Reference before `AVATAR_PUBLIC_ENABLED=1` |

Shared: the **Art Engine** (`lib/visual-dna` structured DNA → `lib/art-engine` compiler +
validators + Golden-Reference slots) is the one visual brain. `furniture@8` is intentionally
*not* compiler-driven yet (rewiring needs a Laptop re-cert).

---

## 7. TECHNICAL DEBT (ranked)

| # | Rank | Item |
|---|---|---|
| 1 | 🔴 Critical | `/moderation` unauthenticated; `/dev/*`, `/design/*` wide open ("hidden URL" ≠ a gate) |
| 2 | 🔴 Critical | Persistence is localStorage-by-default → no real cross-device visitor experience |
| 3 | 🔴 Critical | Sign-up → `/onboarding` → dead legacy shop funnel |
| 4 | 🟠 High | Two product generations in one repo (V1 island + V2 Nest); ~40% of routes are dead V1 |
| 5 | 🟠 High | 7 permission mechanisms; 2 dead founder-token gates; `dev-mode`/`admin-mode` bypassable |
| 6 | 🟠 High | Three overlapping "session" notions (`getServerUser` vs `nest-auth` facade vs stub) |
| 7 | 🟠 High | `lib/` is 205 files with heavy `nest-*` sprawl (~18 editor files, ~60 nest files) — undocumented |
| 8 | 🟡 Medium | `/bazaar/[slug]` & `/shop/[address]` pages linked but shadowed by redirects (dead nav) |
| 9 | 🟡 Medium | `/api/generations` mock route still live |
| 10 | 🟡 Medium | Uncommitted experimental routes in the tree (5× `design/*`, `dev/calibration`) |
| 11 | 🟡 Medium | Second workspace `apps/asset-factory/` — separate deployable, easy to forget |
| 12 | 🟡 Medium | `avatar_identities` table SQL written but unapplied (freeze is in-session until provisioned) |
| 13 | ⚪ Low | Asset "wooden voice" material redesign (specified, not built) |
| 14 | ⚪ Low | Google OAuth implemented but not surfaced in login UI |
| 15 | ⚪ Low | Many `<img>` lint warnings across generation modules (cosmetic) |

---

## 8. UX DEBT

| Area | Issue |
|---|---|
| Onboarding | New user's first flow is the **broken** legacy shop funnel, not `/create` |
| Navigation | `/home` vs `/explore` both "discovery"; two overlapping tabs |
| Navigation | `/profile` vs `/profile/[handle]` vs legacy `/u/[handle]` — three profile concepts |
| Navigation | Island links (`/shop`, `/bazaar`, `/tags`) silently bounce to `/home` |
| Terminology | Developer terms exposed: "Studio", "Factory", "Calibration", "A/B", "DNA", "bench" in user-adjacent surfaces |
| Creator Studio | Linked from `/create` as the "AI" path but 403s a normal signed-in user |
| Sharing | A shared `/nest/[slug]` link only works if it carries the `?c=` blob; bare slug shows nothing to a visitor |
| Founder hub | Founder tools mounted inside the normal `/profile` page (fine, but mixes audiences) |
| Unfinished screens | `/dev/*`, `/design/*` benches reachable by URL, unstyled for users |
| Mobile | Core loop is mobile-first ✅; legacy V1 island is not consistently so |

---

## 9. REMOVE LIST (before Beta)

**Routes / pages**
- Legacy V1 island: `app/bazaar/*`, `app/shop/*`, `app/discover`, `app/tags/*`, `app/collections`, `app/activity`, `app/u/[handle]`, `app/assets`, `app/updates`, `app/studio` (keep redirects only if inbound links exist).
- Village prototypes: `app/village-lab`, `app/village-projection-lab`.
- Dev benches: `app/dev/*` (art-engine, asset-benchmark, calibration, gpt-image).
- Design benches: `app/design/*` (incl. 5 untracked).
- `/creator-studio` + `/creator-studio/review` (superseded by the factories) — or repoint `/create`'s "AI" link.

**Auth / code**
- `lib/founder-gate.ts`, `lib/founder-token.ts`, and the `x-founder-token` header in `generation-studio.tsx` (dead path).
- One of the two sign-up paths (`nest-auth.ts signUpWithEmail` vs `supabase-auth.ts signUp`).
- `nest-auth-stub.ts` once the creator-studio surface is removed.

**API**
- `/api/generations` (mock).

**Components (after route removal)** — the V1-only clients: `village-world`, `street-walk`, `shop-*`, `discovery-client`, `collections-client`, `tags-*`, `activity-feed`, `moderation-client` (unless moderation is kept + gated), `site-header`/`footer` (if the V1 island goes).

> Removal method: **delete the route, run typecheck, delete now-unreferenced lib/components.**
> Do NOT delete a lib file that is still imported by a live surface (several `house-*`/`room-*`
> helpers feed `/village` and the editor). Verify each with a grep before deletion.

---

## 10. BETA JOURNEY (the ONE canonical flow)

```
Visitor lands            →  /  → /home  (discovery feed)
  ↓ Sign up              →  /auth/sign-up
  ↓ Create profile       →  (post sign-up: go to /create, NOT /onboarding)   ← FIX REQUIRED
  ↓ Enter home           →  /home  (their feed + "New")
  ↓ Visit / make a nest  →  /create  →  /nest-editor?document=<id>
  ↓ Decorate             →  /nest-editor  (place assets, hotspots)
  ↓ Publish              →  publish gate  →  /nest/<slug>  (+ Supabase persistence)  ← FIX REQUIRED
  ↓ Visitor experience   →  /nest/<slug>  (works on ANY device, server-backed)       ← FIX REQUIRED
```

**No alternative flows.** Everything below is explicitly *not* the journey and should be
removed or hidden: `/onboarding` (legacy), `/shop/*`, `/bazaar/*`, `/discover`, `/creator-studio`,
`/village*`, `/u/[handle]`, all `/dev/*` and `/design/*`.

**Three changes make the journey real** (do not build them this week — record them):
1. Sign-up → `/create` (retire the `/onboarding` shop funnel).
2. Turn on the Supabase Nest backend (`NEXT_PUBLIC_NEST_BACKEND=supabase`) + a server-resolvable
   `/nest/[slug]` so visitors on other devices see the Nest.
3. Gate/remove every non-journey surface so a Beta user can only walk this one path.

---

### Appendix — audit method
Route/recency map from `git log` per route dir; three parallel read-only exploration passes
(legacy island · core journey · nav+founder gating); founder/auth/AI verified by direct read
of `founder-role.ts`, `founder-gate.ts`, `user-gate.ts`, `generation-studio.tsx`, the `/api/*`
routes, `next.config.mjs`, `middleware.ts`. No files were modified.
