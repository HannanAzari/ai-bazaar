# Staging Checklist — Production Cutover V1

The live verification this sprint **could not** run in the build environment
(anon key only; the schema is not yet applied to the project — `profiles`/`rooms`/
`shops` return `PGRST205`). Run this checklist on a real staging project to verify
the production path before any production flip. Pairs with
[supabase-cutover.md](supabase-cutover.md).

## 0z. Live result — 2026-06-23 (staging fully provisioned) ✅

With schema + seed + `room-images` bucket applied and **"Confirm email" OFF**, the
**full authenticated flow was verified live** against the real project (anon client +
a confirmed test user), no console errors:
create account (`signup 200`) → login → onboarding → **create Nest** (`shops 201`,
`moon.tiny.bell`) → **save room** (`rooms upsert 201` + prune `204`) → reload →
**room persists from Supabase** (5 objects) → logout → login again
(`signInWithPassword`) → **room still exists**. RLS: authenticated owner writes
succeed; anon writes denied (`401`); public reads `200`. Production shop-claim
shipped in `lib/shop-claim.ts`; public shop resolution via `getShopByAddress`.

> The remaining items below are retained as the repeatable runbook for any new
> staging/prod project.
>
> **Pilot Hardening V1 (2026-06-24):** production paths now show friendly errors
> (no raw Supabase strings; raw error stays in console) with loading/double-submit
> guards; input limits live in `lib/validation.ts`; draft legal pages exist. For the
> first-user audit + verdict see [pilot-readiness.md](pilot-readiness.md); for manual
> cleanup/verify steps see [pilot-ops.md](pilot-ops.md).

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

**Update — second live probe (seed now applied):**
- ✅ **`seed.sql` is applied** — `bazaars` = 10, `shop_slots` = 240; bazaar-by-slug
  lookup + per-village slot listing work with the anon client (the claim read-side).
- ✅ Anon RLS re-checked with data present: `insert` into `shops` → `401` (owner-write
  holds); public reads of `rooms`/`shops`/`bazaars`/`shop_slots` → `200`.

**Still blocked (sole remaining blocker — environment, not code):**
- ⚠️ **Email confirmation is still ON** (`mailer_autoconfirm:false`); sign-up returns
  a user with **no session** (`confirmation_sent_at` set) and the default sender is
  rate-limited (`429`). With anon-only access there is **no way to mint a confirmed
  session**, so create-account → session → onboarding → save → persist **cannot be
  run here**. This blocks the *entire* authenticated flow regardless of code.
  - **One action to unblock:** Supabase → Auth → **"Confirm email" = off** on
    staging (or custom SMTP + a confirmable inbox, or a dashboard/service-role
    pre-confirmed test user). After that the full flow can be run.

**Remaining code follow-up (for when a session is available):**
- ⚠️ **No production shop-claim path**: `claimShop` only writes localStorage, so
  onboarding's "create first Nest" won't insert a `shops` row in production and
  `saveHouse` throws "no shop found". This is **not built yet on purpose** — it
  can't be exercised/verified without a session, and the flow is blocked above. The
  exact rules are now known (verified against the live schema):
  - Pick a village → its DB `bazaars.slug`; the address **prefix** must equal
    `split_part(slug, '-', 1)` (e.g. `moon-court` → `moon.word.word`) per the
    `validate_shop_village_address` trigger.
  - Resolve an open `shop_slots` row (a slot with no `shops.slot_id` referencing it).
  - Insert `shops { owner_id = auth.uid(), slot_id, address, display_name }`
    (RLS "users claim one shop" requires `owner_id = auth.uid()` and no existing shop).
  - Then `persistHouse` works unchanged. Demo persistence is unaffected.

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
