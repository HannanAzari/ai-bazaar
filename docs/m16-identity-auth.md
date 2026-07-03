# M16 — Real Identity & Authentication (branch `m12-nest-platform`)

> **Preview only.** Shipped on `m12-nest-platform`. **No merge to `main`, no production
> deploy.** Replaces the temporary browser-local identity with a **real account system** that
> owns usernames, profiles, drafts, and published Nests. Infrastructure sprint — no social
> systems, villages, marketplace, or AI. Canonical record; see [changelog.md](changelog.md) and
> [decision-log.md](decision-log.md) (ADR-035).

## Goal

> "This is my place on the internet" — not "a temporary browser session." The goal is
> **ownership**; authentication is only the mechanism.

## Identity model (Phase 1)

```
account (email + password, session)          lib/nest-account.ts
  └─ profile (1:1 by account id)              lib/nest-profile-store.ts
        username (unique · validated · immutable) · display name · bio · avatar · socials
        └─ nests (1:many, ownerId)            lib/nest-document-store.ts / supabase nests
             drafts + published (visibility)
             └─ placements: overlays/stickers · links · rotation
                  └─ (future) villages
```
Ownership rule: only the owner edits / republishes / deletes; visitors view + share. Usernames
are lowercase, 3–20 chars, `[a-z0-9_]`, unique, and **immutable for now**.

## Auth architecture (Phase 2) — a backend facade

The Nest identity is a facade chosen by `NEXT_PUBLIC_NEST_BACKEND` (like `nest-repo` / `nest-auth`):

| | **local** (default · preview) | **supabase** (cutover) |
|---|---|---|
| Auth | `lib/nest-account.ts` multi-account localStorage (email + password, sessions). The **demo layer** — passwords are lightly hashed, *not* secure; stands in for Supabase Auth exactly as `DemoAuthClient` does for V1. | Real **Supabase Auth** via the existing [`SupabaseAuthClient`](../lib/auth/supabase-auth.ts) (email + password, `@supabase/ssr` session persistence + token refresh). |
| Profiles / username | `lib/nest-profile-store.ts` (unique index emulated in code) | `public.profiles` (real **unique index on `lower(username)`**) via `lib/repos` |
| Nests / ownership | `lib/nest-document-store.ts` (`ownerId`) | `public.nests` + RLS — **owner-only write already enforced server-side** ([migration](../supabase/migrations/20260702_01_nest_platform.sql)) |

This keeps the preview **fully verifiable with no external provisioning**, while the real Supabase
path is wired and enabled by flipping the flag after the cutover
([m12-supabase-cutover.md](m12-supabase-cutover.md)): apply migrations, enable email auth, set
`NEXT_PUBLIC_NEST_BACKEND=supabase`. Email-confirmation is handled both ways — if Supabase returns
no session, the UI shows "check your email, then sign in" instead of failing (Phase 8).

## What shipped (by phase)

| Phase | Change | Key files |
|---|---|---|
| **2 — Auth** | Nest account facade: email sign-up / sign-in / sign-out, session persistence + restore; multi-account local layer + Supabase path. | [`nest-account.ts`](../lib/nest-account.ts), [`use-nest-identity.ts`](../components/nest/app-shell/use-nest-identity.ts), [`auth-panel.tsx`](../components/nest/app-shell/auth-panel.tsx) |
| **3 — Username** | Unique, validated (`[a-z0-9_]`, 3–20), reserved-word list, **immutable once claimed**. | [`nest-profile-store.ts`](../lib/nest-profile-store.ts) |
| **4 — Migration** | On sign-in, adopt this browser's un-owned + legacy-stub work into the account — drafts, published history, overlays/stickers, links — and transfer the M15 stub username. Idempotent; no Nest loss. | [`nest-migration.ts`](../lib/nest-migration.ts), `nest-document-store.ts` (`adoptLocalWork`), `nest-profile-store.ts` (`adoptLegacyProfile`) |
| **5 — Ownership** | `ownerId` on every doc; only the owner edits/republishes/deletes; the editor denies opening another creator's Nest; visitors read/share. Supabase RLS enforces the same server-side. | `nest-document-store.ts` (`canEditDoc`, `setDocOwner`), [`nest-editor-mount.tsx`](../app/nest-editor/nest-editor-mount.tsx), `nest-repo.ts` (`publish(ownerId)`) |
| **6 — Profile completion** | display name, bio, avatar + optional website / github / twitter / youtube. | `nest-profile-store.ts`, [`profile-summary.tsx`](../components/nest/app-shell/profile-summary.tsx) |
| **7 — Public profiles** | `/@username` hero (avatar · name · @handle · bio · links) + published Nests. `username.nestud.io` remains possible (subdomain middleware already rewrites `<handle>.nestud.io`), not implemented. | [`app/profile/[handle]/*`](../app/profile) |
| **8 — Session UX** | Guest → create → editor → publish → sign-up → claim username → publish (no forced registration before creating; no login walls). Returning users are restored signed-in. | `publish-gate.tsx`, `use-nest-identity.ts` |

## Migration strategy (Phase 4, detail)

`migrateLocalWorkToAccount(accountId)` runs on every sign-in (idempotent):
1. `adoptLocalWork(accountId, legacyStubId)` re-stamps `ownerId` on every un-owned doc/publish and
   anything owned by the M15 `nest-auth-stub` session — **whole NestDocuments are re-stamped, not
   rebuilt**, so overlays/stickers/links/publish slugs are preserved.
2. `adoptLegacyProfile` moves the stub username + bio onto the account and frees the old row so
   uniqueness holds.
3. The stub session is retired so it can never re-own anything.
A different account's work is never touched (only un-owned / legacy / own is adopted).

## Verification (Phase 9 — iPhone 375×812, no console errors)

sign-up → claim `@hannan` → create (draft `ownerId` stamped) → publish (published `ownerId` =
account) → Profile shows 1 Nest → **sign out → sign in → work persists** (session restore) →
seed a legacy stub + guest drafts → sign up a new account → **all adopted, stub username
transferred, other account untouched** → open another creator's Nest in the editor → **denied** →
`/@hannan` renders publicly (no "Manage" for a visitor).

## Known limitations

- **Preview runs the local backend** (`NEST_BACKEND` unset). Real Supabase Auth + server-side RLS
  ownership + the `profiles`/`nests` tables go live only after the cutover (apply migrations,
  enable email auth, set the flag) — I can't run those ops from here.
- Local passwords are a **non-secure demo hash** (the local layer only); real credentials live in
  Supabase Auth on the supabase backend.
- Username immutability is a product choice for now (a future ADR can add a rename with a grace/
  redirect policy). Social columns (`website`/`github`/`twitter`/`youtube`) are stored on the local
  profile; the Supabase `profiles` table needs a follow-up migration to add them server-side.
- `/@handle` resolution is local (this browser) on the local backend; Supabase resolves it from
  `profiles` by the cutover.

## Gates

`typecheck · lint · test (344) · build` — all green (Node 20). New tests:
[`nest-account.test.ts`](../test/nest-account.test.ts) (auth + session restore),
[`nest-ownership-migration.test.ts`](../test/nest-ownership-migration.test.ts) (ownership + migration),
[`nest-profile-store.test.ts`](../test/nest-profile-store.test.ts) (username uniqueness + immutability).
