# Sprint 4 — Avatar Factory v1 (user-owned identity module)

Status: **module + private persistence contract built and gate-tested; NOT deployable until
(1) you provision `user_avatars` + the private bucket and (2) real end-user auth is confirmed
on the deploy. Dry-proven locally. No real photo used. $0 spend.**

Avatar is the **first user-owned module** on the Generation Platform, and the proof a genuinely
different generation type plugs in with almost no new orchestration.

## A · Plugged in without shell duplication

`app/profile/avatar/avatar-studio-client.tsx` is **7 lines**: `<GenerationStudio module={avatarModule} />`.
The avatar module (`lib/generation-platform/modules/avatar-module.tsx`) supplies only its engine +
screens + consent. Everything else (stage machine, upload, review, approve, progress, cost, error
recovery, mobile layout) is the shared engine. Avatar exposed **5 real, minimal platform gaps** —
all added generically, none duplicated:

1. `reviewQuestions[]` — multi-question approval (Avatar needs two; Asset/Nest keep one, unchanged).
2. `translate({upload})` + `publish({upload})` — image-first modules need the photo.
3. `canInterpret` gates on the upload for `uploadMode:"required"`.
4. `authMode:"user"` — user auth instead of the founder gate (401 → sign-in prompt).
5. `InputExtra` slot — pre-input content (the consent gate) that blocks Interpret until ready.

## Auth verdict (the blocking dependency)

Real email/password Supabase Auth works **client-side** (ownerId = a genuine `auth.users.id`; RLS
keyed to `auth.uid()` exists). **But no server route authenticated an end-user session before this
sprint.** Avatar adds the first: `lib/user-gate.ts` `requireUser()` reads the real Supabase session
(cookies) and fails closed. **Proven:** all four avatar routes return 401 with no session, and the
**founder token does NOT unlock them** ("Sign in required") — ownership is the real user, never the
founder capability.

Not yet confirmable from code: whether the live Supabase project lets end-users actually sign in
(email-confirmation setting, providers) — Google OAuth is not wired. **Confirm a real sign-in on the
deployed app before enabling Avatar publicly.**

## Persistence audit → contract (provision, don't auto-apply)

The existing system **cannot** support avatars: `profiles.avatar_url` is a single public URL the UI
never renders; **all buckets are public**; no per-user table/versioning/status/cost/deletion. So:

- `supabase/provision/user_avatars_provision.sql` — **shown for your approval, not applied.**
  Creates the **first private bucket** `avatar-private` (owner-folder RLS), the `user_avatars` table
  (owner-scoped RLS, one-active-per-user, soft delete), reusing the shared status enum. Additive,
  idempotent, no destructive statements.

Until provisioned, `publish`/`delete` fail closed (503) — **a source photo can never reach a public
bucket**, because there is nowhere public it is written (source → private bucket only, at publish).

## Privacy / security model (L)

- Source photo stays **client-side/in-memory through review**; it only reaches storage at publish,
  into the **private** bucket. Rejected generations persist nothing.
- All writes use the **user's own session client** (RLS owner-only) — **no service-role** in the
  avatar path, so user A can never read/write user B's source, output, or record.
- Active avatar: output copied to the public `avatars` bucket + `profiles.avatar_url`; the public
  profile shows only that selected output. Source is never public.
- Deletion revokes source + outputs (private + public) + soft-deletes the record + clears the profile
  reference.
- Translator obeys a **privacy law**: never infer/store ethnicity, religion, sexuality, health,
  disability, political identity, socioeconomic status; no age guessing; neutral visuals only.
- Double-tap guard (shared) + moderation in the translate step before the expensive generation.

## What is NOT done (gated / out of scope)

- **No deployed end-to-end proof** (E–K, the 18-step flow): needs the table + private bucket
  provisioned, a confirmed real sign-in, a real photo you upload on the deploy, and generation spend.
- **Editor "My Avatar" integration** (I/J): designed (editor asset from `editor_asset_url`, owner-scoped)
  but the deep asset-drawer wiring is deferred until persistence is provable — it depends on the table.
- **Profile header/card avatar-image rendering**: today the UI is monogram-only; rendering the
  active `avatar_url` image is a follow-up (kept out to avoid touching unrelated profile UI now).

## To make Avatar real (your steps)

1. Run `supabase/provision/user_avatars_provision.sql` (after review).
2. Confirm a real user can sign in on the deployed app (email/password); if not, that's the blocker.
3. Then I wire the editor "My Avatar" section + profile image rendering and we run the 18-step proof
   with your test photo (uploaded on the deploy, never in git).

## Known limitations (N)

- Image-to-image full-body from a single photo (esp. a headshot) is the main quality risk — the
  founder's eye (the two approval questions) is the gate; may need prompt iteration on real photos.
- No generation-job queue (synchronous, like the other modules).
- One pose (idle-standing); metadata carries `pose` for future Seated/Greeting without redesign.
