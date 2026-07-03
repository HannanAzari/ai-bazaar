# M18 — Social Foundation (branch `m12-nest-platform`)

> **Preview only.** Shipped on `m12-nest-platform`. **No merge to `main`, no production
> deploy.** The first real social layer — likes, follows, comments, notifications, activity, and
> owner analytics — so a creator feels *"someone visited my Nest."* No algorithms / villages /
> marketplace / DMs / AI. Canonical record; see [changelog.md](changelog.md) and ADR-038.

## Success criteria (all verified)

Publish a Nest → share it → receive a **like**, a **comment**, a **follow** → open the app and
**immediately know somebody interacted** (nav badge + inbox + a "Today" activity line + real feed
counts + owner stats).

## Architecture

Real, durable persistence via the same backend-facade pattern as M16/M17 — a working **local**
layer (localStorage, verifiable in preview) plus the **Supabase** schema for the cutover:

```
lib/nest-social.ts            likes · follows · comments · views (keyed by account id / slug)
lib/nest-notifications-store  likes/follows/comments → recipient inbox (unread · today tallies)
        │  (social actions create/remove notifications for the owner or followed creator; never you)
        ▼
UI: LikeButton · FollowButton · CommentButton + CommentSheet · AuthGateSheet   (components/nest/social/*)
    EngagementBar (feed + visitor) · Notifications tab · nav unread badge · owner stats · "Today"
```

- **A Nest is identified by its published slug.** Social actions resolve the Nest owner from the
  local publish registry to route notifications.
- **Guests are gated in place** — tapping like/follow/comment opens a sign-in **sheet** (no
  navigation away); on success the action can proceed.
- **Supabase cutover:** [`supabase/migrations/20260703_01_nest_social.sql`](../supabase/migrations/20260703_01_nest_social.sql)
  authors `nest_likes` · `creator_follows` · `nest_comments` · `notifications` (+ enum + RLS —
  world-readable counts, owner-only writes, recipient-only inbox). Enabled by the documented cutover.

## What shipped (by scope item)

| # | Feature | Notes |
|---|---|---|
| 1 | **Real likes** | Toggle, one-per-user, instant count, optimistic; guest → sign-in. `LikeButton` animates a pop. |
| 2 | **Real follows** | Follow/unfollow, instant; follower/following counts on profiles; guest → sign-in. `FollowButton`. |
| 3 | **Comments V1** | Add · delete own · newest-first · **creator badge** beside the owner's comments · auth required. Flat (no replies/reactions/threads). |
| 4 | **Comment sheet** | Slides up (Instagram/TikTok feel), never navigates away — warm Nestudio surface, not a forum. |
| 5 | **Notifications V1** | someone liked / followed / commented → recipient inbox, **unread badge** on the nav (cleared on open). No push/email. |
| 6 | **Activity on profile** | Owner-only **"Today: +N followers · +N likes · +N comments"** (from today's notifications). |
| 7 | **Visitor analytics** | Owner view shows **Views · Likes · Comments · Followers** (real counters; views skip the owner's own visits). |
| 8 | **Preserved** | editor · publishing · discovery feed · profile · ownership · guest-publish untouched. |

## Mobile UX

Comments slide up; likes animate (pop); follow flips instantly; every interaction is
optimistic/local — **no page refreshes, no full navigations**. The auth gate is a sheet, not a
redirect.

## Verification (iPhone 375×812, two accounts, no console errors)

Seeded creator **@creatora** (published "Creator A Studio") + visitor **@visitorb**. As @visitorb:
opened the Nest (view counted), **liked** (❤1 + owner notified), **followed** (Following, owner
notified), **commented** in the slide-up sheet ("This is so cozy!" + owner notified). Switched to
@creatora: nav **bell badge = 3** → feed card shows **❤1 💬1** → **Notifications** lists comment/
follow/like (newest first, type-icon avatars) → **Profile: "Today: +1 follower · +1 like · +1
comment", 1 Follower** → owner **Nest stats: Views 1 · Likes 1 · Comments 1 · Followers 1** (own
visit didn't inflate views). Guest tapping like → sign-in sheet.

## What was intentionally NOT built (hard rules)

No villages, marketplace, DMs, chat, AI recommendations, ranking algorithms, infinite recommendation
systems, reposts, stories, reels, or a hashtag backend. No auth rewrite; no push/email.

## Known limitations

- Social data is **local per browser** (durable across reloads) until the Supabase social tables +
  a `SECURITY DEFINER` notify function are provisioned at the cutover. Counts/inboxes are then
  server-side + cross-device.
- Notifications for likes/comments require the actor to be on a browser that knows the Nest owner
  (the local publish registry) — always true in the same browser; cross-browser routing lands with
  Supabase.

## Gates

`typecheck · lint · test (365) · build` — all green (Node 20). New tests:
[`nest-social.test.ts`](../test/nest-social.test.ts) — likes/follows/comments/views + notification
creation, self-action skipping, delete-own, today tallies.
