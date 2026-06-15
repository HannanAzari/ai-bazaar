# Staging Checklist — Production Cutover V1

The live verification this sprint **could not** run in the build environment
(anon key only; the schema is not yet applied to the project — `profiles`/`rooms`/
`shops` return `PGRST205`). Run this checklist on a real staging project to verify
the production path before any production flip. Pairs with
[supabase-cutover.md](supabase-cutover.md).

## 0. What was / wasn't verified in the build env

- ✅ Supabase **Auth** endpoint reachable + email auth enabled (probed).
- ✅ **Demo** path end-to-end (login → onboarding → room → save → reload → persist
  → sign out → sign in) — verified in-browser.
- ✅ Gates: typecheck · lint · tests · build.
- ❌ Live **DB persistence** (profiles/rooms) + **RLS** — schema not applied, no
  elevated access. Verify here.

## 1. Environment variables (staging host)

| Var | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | flips the app to production mode |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | browser/SSR, RLS-guarded |
| `NEXT_PUBLIC_APP_URL` | yes | absolute base for links/redirects |
| `SUPABASE_SERVICE_ROLE_KEY` | only for applying schema/seed | **never** ship to client |

App self-check: the dev badge should read **LIVE · Supabase**.

## 2. Migrations

1. Take a fresh DB backup first.
2. **Fresh project → apply `supabase/schema.sql`** (the superset incl. the V1
   `rooms.client_id` / `rooms.objects` columns + `rooms_shop_client_idx`). Existing
   baselined DB → apply ordered migrations through `20260623_room_jsonb_persistence.sql`.
3. Apply `supabase/seed.sql`.
4. Confirm tables exist: `profiles`, `shops`, `rooms` (with `client_id`, `objects`).
5. Create a **Storage bucket** named `room-images` (public read) for `SupabaseStorage`.

## 3. Auth verification

- [ ] Sign up (email + password) → account created (check Auth → Users).
- [ ] Sign in → session persists across reload (cookie present).
- [ ] Sign out → session cleared; `/studio` + `/onboarding` redirect to `/auth/login`.
- [ ] If "Confirm email" is ON, sign-up shows the "check your email" notice.

## 4. Profiles

- [ ] First login creates a `profiles` row (id = auth user id, `display_name`, `username`).
- [ ] `profiles` loads automatically on subsequent logins.
- [ ] Profile update persists (`display_name` / `bio`).

## 5. Rooms (persistence)

- [ ] Onboarding "Build my Nest" creates a shop + saves the generated room.
- [ ] Studio edits autosave to `rooms` (one row per room, `client_id` set, `objects` jsonb populated).
- [ ] Reload → room loads from Supabase (not localStorage). Multi-room, descriptions,
      backgrounds, room links, interactive objects, action data, rotations all preserved.
- [ ] Sign out → sign in → room still exists.

## 6. Storage

- [ ] `getImageStorage()` returns `SupabaseStorage` in production.
- [ ] Upload writes to the `room-images` bucket; public URL resolves.
- [ ] Remove deletes the object.

## 7. RLS smoke tests (run as anon / a test user, not service role)

- [ ] Public can `select` visible `shops` / `rooms`; **cannot** read a hidden shop's rooms.
- [ ] Owner can `insert/update/delete` their own `rooms` (`owns_shop`); **not** another owner's.
- [ ] `rooms_one_entry_per_shop` rejects a 2nd `is_entry = true` per shop.
- [ ] `profiles`: a user can read/update **their own** row only.
- [ ] (Run the full §6 list in `supabase-cutover.md`.)

## 8. Subdomain (optional this sprint)

- [ ] `jane.localhost:3000` rewrites to `/u/jane`; root unaffected. (DNS not deployed.)

## 9. Rollback

- [ ] Unset `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` + redeploy → app returns to demo
      (localStorage) with no data migration. (Per-repo fallback also possible.)
- [ ] Restore from the pre-cutover backup if schema changes must be reverted.

## 10. Production readiness

- [ ] All of §3–§7 pass on staging.
- [ ] Service-role key is server-only; not in any client bundle.
- [ ] Gates green on the deployed build.
- [ ] Backup taken immediately before the production migration.
- [ ] Rollback (unset env) rehearsed on staging.

## Known V1 limitations (carry into the next sprint)

- Production **shop claiming** still uses the demo `claimShop` (localStorage); a
  Supabase `shops` insert repo is a follow-up. Onboarding's "create first Nest"
  persists the **room** to Supabase but the shop row must exist (seeded or claimed).
- `events`/`reports` Supabase repos remain `NotImplementedError` stubs (out of V1 scope).
- `ProfileRepository.getByHandle` (the `/u/[handle]` aggregate) returns `null` in
  production V1 (house aggregation deferred).
- Rooms persist as a **jsonb snapshot** on `rooms.objects` (not normalized
  `room_objects` rows) — see ADR-018.
