# M24 — founder-testing fixes, completion pass

> Read `CTO_HANDOFF.md` first. This supersedes the M24 section of `M23B_SPRINT_REPORT.md`.
> Commits: `235d2ab` (first pass) + this one.

## ⛔ DEPLOYMENT IS BLOCKED — and it is not a code problem

```
https://ai-bazaar.vercel.app/api/auth/whoami
  → HTTP 402  Payment required   DEPLOYMENT_DISABLED

https://ai-bazaar-git-m12-nest-platform-hannan.vercel.app/api/auth/whoami
  → HTTP 404  DEPLOYMENT_NOT_FOUND
```

**The Vercel project is disabled.** `402 / DEPLOYMENT_DISABLED` is Vercel refusing to serve
a project whose account is suspended — almost always a billing state (spend limit reached,
or a failed payment). The branch preview 404s because no preview exists to serve.

This is why `235d2ab` "did not deploy": nothing was wrong with the push or the build. The
production build passes locally (132 pages, 0 lint errors).

**Exact manual action required — only you can do this:**
1. Open the Vercel dashboard → the `ai-bazaar` project → **Settings → Billing / Usage**.
2. Clear whatever is disabling it (payment method, or raise/reset the spend limit).
3. Once the project is enabled, **redeploy the `m12-nest-platform` branch**.
4. Confirm with `<preview-url>/api/auth/whoami` — it must report
   `resolvedBackend: "supabase"`, `projectRef: "srrmkdsvldlyllsxyhtq"`, `vercelEnv: "preview"`
   and the commit hash.

I have no Vercel CLI, token, or `.vercel` linkage in this environment, so I cannot do any of
that or read the build logs. **I am not claiming this deployed.**

## Manual SQL required

**Apply `supabase/provision/m24_views_provision.sql`.** Additive and idempotent — creates
`nest_views` and `profile_views` with their dedup indexes and RLS. Views will read 0 until
it is applied; nothing else in the app depends on it.

(`m23b_nest_platform_provision.sql` is already applied — verified live: `nests` 3 rows,
`nest_objects` 11, `nest_likes` 5, `nest_comments` 6, `creator_follows` 2, `notifications` 13,
`profiles` has `house_style` + `links`.)

## What this pass completed

| § | Item | Status |
|---|---|---|
| 1 | Repo/deployment state verified | ✅ blocker identified (above) |
| 2 | Views — Supabase-backed, deduped, owner-excluded | ✅ code; **needs the SQL** |
| 3 | Notifications — page, states, tap-through, unread badge | ✅ |
| 4 | Comments sheet — iOS keyboard, focus, pinned composer | ✅ |
| 11 | Documentation reconciled | ✅ |
| 12 | Gates + regression tests | ✅ 849 tests / 92 files |

### §2 Views
`nest_views` / `profile_views`, with the rule enforced by the **database**: a unique index on
`(target, viewer_key, view_day)` makes recording an atomic `insert … on conflict do nothing`,
so two tabs cannot both count. Recorded only after **~2.5s of visible dwell**, restarted if
the tab is hidden; never for the owner; never from a thumbnail or Preview (the hook is only
called from the full Nest and the Profile). Anonymous viewers get a random per-browser key —
no IP, no fingerprint.

Beta simplifications, stated rather than hidden: the bucket is a **UTC day**, not a rolling
24h; and an anonymous viewer can inflate a count by clearing site data. Recorded as D-22.

### §3 Notifications
The table has been receiving rows since M23B — the read side was still localStorage, which
is why nothing ever appeared. Now: loading / error / empty / list states, actor avatars
resolved in one query, relative timestamps, unread styling, per-row mark-as-read on tap,
"Mark all read", and correct destinations (Follow → actor profile, Like/Comment → the Nest).
The nav badge reads the same shared count and refetches on tab focus + every 60s.

Opening the tab no longer blanket-marks everything read — that made the badge meaningless.

### §4 Comments sheet
`visualViewport` handling lifts the sheet by the keyboard's height on iOS (where the
keyboard does not resize the layout viewport, so a bottom-pinned sheet ends up underneath
it). Composer auto-focuses for signed-in viewers only — raising the keyboard just to show a
guest an auth gate is hostile. Composer is `shrink-0` so it stays pinned however long the
list gets; the list is its own scroller; body scroll is locked.

## Preserved from `235d2ab`

Explicit `w/h` persistence · Editor Preview on the canonical public renderer · public scene
replaying saved geometry · asset-library merge · shared house seed · portalled bottom sheets ·
Home hierarchy · shared social store · Profile back-button removal · no-scroll actions.

## Gates

typecheck ✅ · eslint **0 errors** ✅ · **849 tests / 92 files** ✅ · `next build` ✅ 132 pages

New this pass: `test/nest-views.test.ts` (11), `test/nest-notifications.test.ts` (7).

## NOT verified — do not treat these as done

The sprint asks for live verification of several items. I could not complete them and am
not claiming them:

- **§5 real-save Preview→Publish parity** — the round-trip is proven by unit test against
  the real reader/writer, **not** by publishing a Nest and comparing screenshots.
- **§6 two-account live social testing** — not performed. The shared store is unit-tested
  (17 cases) but not proven with two live accounts.
- **§7 live Asset Library verification** — the merge is verified (diagnostic reads
  `1 from Supabase + 19 bundled → 20 total`, and your own Nest went from 8 placeholders to
  fully rendered), but categories/search/filters were not exercised per-field.
- **§8 house parity screenshots** — proven by unit test across all 6 styles including Gamer
  Hollow; no side-by-side screenshots captured.
- **§9 no-scroll at 375/390/430** — implemented (`h-[100dvh]` + `min-h-0` + safe-area action
  bars) but measured at 375 only.
- **§10 full overlay matrix** — the portal fix is structural and covers every sheet, but I
  did not open each of the nine overlays individually.
- **Legacy re-save notice** — the §5 creator-only "re-save this Nest" banner is NOT built.

## Remaining known issues

1. **Vercel project disabled** — blocks all founder testing. Action above.
2. **`m24_views_provision.sql` unapplied** — views read 0 until then.
3. **Legacy Nests** (`w`/`h` NULL) keep derived geometry until re-saved (D-18). Your 3
   existing published Nests are affected.
4. **Realtime is not used** for notifications — focus-refetch instead (D-23).
