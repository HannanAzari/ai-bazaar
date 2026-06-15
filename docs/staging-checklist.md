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
- ❌ Live **authenticated DB persistence** (profiles/rooms) — blocked (see §0a).

## 0a. Live probe results — 2026-06-23 (schema now applied, anon key only)

Ran against the real project. **Verified live:**
- ✅ Schema present: `profiles`, `shops`, `rooms` (+ `rooms.client_id`/`rooms.objects`),
  `bazaars`, `shop_slots` all resolve (REST `200`).
- ✅ **Production read path** in-browser: the public room issues a real
  `GET /rest/v1/shops?address=eq.…` (`200`), finds none, and renders the derived
  room — no crash, no console errors, LIVE badge.
- ✅ **RLS (anon)**: public `select` on `rooms`/`shops` → `200`; anon `insert` into
  `rooms` → `401` and into `profiles` → `401` (owner-write protection holds).
- ✅ Auth endpoint rejects bad credentials (`400`).

**Blocked (could NOT verify live — environment, not code):**
- ⚠️ **Email confirmation is ON** (`mailer_autoconfirm:false`) and the project uses
  the **default email sender** → sign-up immediately hit `429
  over_email_send_rate_limit`. With anon-only access there is **no way to obtain a
  confirmed session** (can't read the inbox, no service role to admin-confirm). So
  create-account → session → onboarding → save → persist **cannot be run here**.
  - **Fix to unblock:** in Supabase → Auth, either enable **"Confirm email" = off**
    for staging, or configure a **custom SMTP** sender and confirm a test inbox, or
    create+confirm a test user via the dashboard/service role.
- ⚠️ **`seed.sql` is NOT applied** (`bazaars` count = 0) → no `bazaars`/`shop_slots`
  → a real `shops` row **cannot** be created (it requires a `slot_id` FK + the
  village-address trigger). Apply `supabase/seed.sql`.
- ⚠️ **No production shop-claim path** (code follow-up): `claimShop` only writes
  localStorage, so even with a session + seed, onboarding's "create first Nest"
  won't insert a `shops` row and `saveHouse` throws "no shop found for address".
  This is the **next required bug-fix** for live persistence (a `shops` insert repo:
  resolve an open `shop_slots` row in the chosen village, insert `shops` with
  `owner_id = auth.uid()` + the village-prefixed address). Demo persistence is
  unaffected.

**Fixed this pass (auth correctness bugs found during probing):**
- Sign-up now gates on a returned **session**: with confirmation ON, Supabase
  returns a user but no session — the app no longer treats that as logged-in
  (which would have left every RLS call unauthenticated); it asks the user to
  confirm their email.
- Sign-up writes the `display_name` user-metadata key the `on_auth_user_created`
  trigger reads (was `name`), so the auto-created `profiles.display_name` is correct.

Once email-confirm + seed + the shop-claim fix are in place, run §3–§7 below.

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

> Prereq (see §0a): for an automatable flow, set **Confirm email = off** on
> staging, or use a custom SMTP + a confirmable inbox. The default sender is
> rate-limited (`429`) after a few sends and blocks the create-account step.

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
