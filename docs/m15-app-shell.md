# M15 — Real App Shell & Nest Home (branch `m12-nest-platform`)

> **Preview only.** Shipped on `m12-nest-platform`. **No merge to `main`, no production
> deploy.** Turns Nestudio from an "editor prototype" into a **real app** — navigation,
> identity, and ownership. NOT villages, social systems, or AI generation. Canonical record;
> see [changelog.md](changelog.md) and [decision-log.md](decision-log.md) (ADR-033).

## Why this sprint

Before M15 the Nest flow was a set of disconnected screens: onboarding lived at the internal
`/design/nest-onboarding`, the single editor (`/nest-editor`) exited to `/studio` — the **V1
house editor**, which showed a login wall (a *different* auth system than the one that had just
published), and there was **no home, no persistent navigation, and no owned identity**. A new
user felt like they were using a room editor, not an app they live in.

M15 adds a permanent mobile **app shell**, a real **Home**, and **username ownership**, built on
the **nest-auth identity** (the session that already owns NestDocuments + published nests) — not
a new auth system. Single editor preserved; persistence untouched.

## Decisions (see ADR-033)

- **Identity spine = the nest-auth session**, joined with a new light `nest-profile-store`
  (username · bio · avatar) + a **username registry** (uniqueness, `/@handle` resolution). No
  auth rewrite; the V1 AuthProvider/`profiles` table is left alone.
- **4 tabs, not 5** — `Home · Explore · Create · Updates`. Village is out of scope this sprint,
  so shipping a Village placeholder would be a dead tab; it returns as a real tab when village
  systems exist. Deliberately **not** a generic social-media pattern (cozy identity over
  Rooms.xyz mimicry).

## What shipped (task by task)

| Phase | Change | Key files |
|---|---|---|
| **1 — App shell** | Persistent, safe-area-aware bottom nav (Home · Explore · Create · Updates) with an emphasised centre **Create** action; a chrome wrapper; the V1 `SiteHeader` hides itself on nest-app routes. | [`bottom-nav.tsx`](../components/nest/app-shell/bottom-nav.tsx), [`nest-app-chrome.tsx`](../components/nest/app-shell/nest-app-chrome.tsx), [`site-header.tsx`](../components/site-header.tsx) |
| **Foundation** | Nest identity: `nest-profile-store` (username claim + uniqueness + bio/avatar), a shared `useNestIdentity` hook, and Home/Explore listing helpers on the existing NestDocument store (`listDrafts`, `listPublished`, `publishedUrl`). | [`nest-profile-store.ts`](../lib/nest-profile-store.ts), [`use-nest-identity.ts`](../components/nest/app-shell/use-nest-identity.ts), [`nest-document-store.ts`](../lib/nest-document-store.ts) |
| **2 — Create flow** | The **Create tab** is the single creation entry (Quick Start / Build My Own → editor). Onboarding is no longer disconnected: `/design/nest-onboarding` → `/create`. Editor **Done/Back** + publish gate now return to **`/home`** (not the `/studio` dead-end); the local publish signup registers the username in the identity store. | [`app/create/*`](../app/create), [`nest-editor.tsx`](../components/nest/editor/nest-editor.tsx), [`publish-gate.tsx`](../components/nest/editor/publish-gate.tsx) |
| **3 — Home** | Real home: profile summary (avatar · @username · bio · nest count), **Continue creating** (drafts), **Published Nests**, and a Create-New shortcut. Reads the same local store the editor writes. | [`app/home/*`](../app/home), [`profile-summary.tsx`](../components/nest/app-shell/profile-summary.tsx), [`nest-card.tsx`](../components/nest/app-shell/nest-card.tsx) |
| **4 — Username ownership** | Claim a username (validity + uniqueness + persistence) from Home or the publish gate; public profile at **`/@<username>`** (served from `/profile/[handle]` via a `next.config` rewrite, since `@` folders are reserved for Next parallel routes). | [`nest-profile-store.ts`](../lib/nest-profile-store.ts), [`app/profile/[handle]/*`](../app/profile), [`next.config.mjs`](../next.config.mjs) |
| **5 — Studio cleanup** | `/studio` → redirects to `/home`; removed `/studio` from the middleware `PROTECTED` list (it was bouncing creators to `/auth/login` — the exact post-publish login wall to remove); V1 header "My place" → `/home`; root `/` opens into the app shell (VillageWorld preserved for later). | [`app/studio/page.tsx`](../app/studio/page.tsx), [`middleware.ts`](../middleware.ts), [`app/page.tsx`](../app/page.tsx) |
| **6 — Explore** | Lightweight Explore: recently-published (this browser) + **curated examples** built from production templates, opened as real visitor Nests via the self-contained `?c=` link. No likes/comments/recommendations. | [`app/explore/*`](../app/explore) |
| **7 — Updates** | Friendly empty state ("No updates yet…"). No notifications backend. | [`app/updates/page.tsx`](../app/updates/page.tsx) |

## Routes created

`/home` · `/explore` · `/create` · `/updates` · `/@<handle>` (rewritten to `/profile/[handle]`).
Changed: `/` → redirects to `/home`; `/studio` → redirects to `/home`;
`/design/nest-onboarding` → redirects to `/create`.

## Verification (Phase 8 — iPhone viewport, 375×812)

Create → editor → draft persists → appears in **Continue creating**; claim `@hannan` →
profile summary + nest count; published Nest renders (LIVE badge + thumbnail) on Home and at
`/@hannan`; Explore shows curated example Nests; `/studio` and `/` both resolve to `/home`;
bottom nav persists; safe-area insets respected. No console errors.

## Known limitations / future

- **Local-mode identity.** Username/profile + published resolution live in `localStorage` (per
  browser), matching the current default `NEST_BACKEND=local`. `/@handle` resolves within the
  owner's browser until the Supabase backend + a `profiles`/username table back it. The
  nest-auth session and the V1 AuthProvider session remain separate — intentional for M15 (no
  auth rewrite); unifying them is a follow-up.
- **Village** returns as a real (5th) tab when village systems are built.
- **Explore** is a placeholder, not the final feed (no likes/comments/recommendations yet).
- Consider promoting `/@handle` to a server-resolved route once identity is in Postgres.

## Gates

`npm run typecheck` · `npm run lint` · `npm run test` (335 tests) · `npm run build` — all green
(Node 20). New tests: [`nest-profile-store.test.ts`](../test/nest-profile-store.test.ts),
[`nest-home-listings.test.ts`](../test/nest-home-listings.test.ts).
