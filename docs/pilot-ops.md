# Pilot Ops — Nestudio

Operator runbook for the pilot. No admin UI yet; these are manual steps via the
Supabase dashboard / SQL editor and the browser. Pairs with
[staging-checklist.md](staging-checklist.md).

> Destructive SQL needs the **service role / SQL editor** (dashboard), not the anon
> key. Always take a backup before bulk deletes.

## Remove a test user
1. Supabase → **Authentication → Users** → find the email → **Delete user**.
2. `on delete cascade` from `auth.users` removes their `profiles` row; `profiles`
   cascade removes their `shops`; `shops` cascade removes `rooms`/`room_objects`.
   So deleting the auth user cleans up their data.
3. Verify: `select count(*) from shops where owner_id = '<uuid>';` → 0.

## Delete a test shop (Nest) only
```sql
-- by address (rooms cascade automatically)
delete from public.shops where address = 'moon.tiny.bell';
```
The freed `shop_slots` row becomes claimable again.

## Reset local demo state (browser)
```js
Object.keys(localStorage).filter(k => k.startsWith("ai-bazaar-")).forEach(k => localStorage.removeItem(k));
location.reload();
```
Also clears the demo session (`ai-bazaar-user`), profiles, drafts, onboarding flag.

## Inspect Supabase tables
- Dashboard → **Table editor**: `profiles`, `shops`, `rooms` (look at `client_id`,
  `objects` jsonb, `is_entry`), `bazaars`, `shop_slots`.
- Quick counts (SQL editor):
  ```sql
  select count(*) from profiles;
  select count(*) from shops;
  select address, (select count(*) from rooms r where r.shop_id = s.id) rooms
  from shops s order by created_at desc limit 20;
  ```

## Check auth users
- Dashboard → **Authentication → Users** (emails, confirmed status, last sign-in).
- Confirm the **"Confirm email"** setting (Auth → Providers → Email) matches intent.

## Check the storage bucket
- Dashboard → **Storage → `room-images`** (exists, public read). Objects appear here
  after image uploads via `SupabaseStorage`.

## Roll back to demo mode (instant, no data migration)
1. Unset `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the host.
2. Redeploy / restart. `getRuntimeMode()` → `"demo"`; the app runs entirely on
   localStorage. The dev badge reads **DEMO**. (Per-repo fallback is also possible.)

## Verify the app after deployment
1. Dev badge shows the expected mode (**LIVE · Supabase** in pilot).
2. Run the [staging-checklist.md](staging-checklist.md) §0z flow:
   signup → onboarding → Nest → save → reload (persists) → logout → login (persists).
3. Public room loads (`/shop/<address>`); footer legal links work.
4. Browser console: **no errors / no hydration warnings**.
5. Gates on the built artifact: `typecheck · lint · test · build` green.

## If something breaks
- Calm user-facing copy comes from `lib/errors.ts`; the **real** error is in the
  browser console (`[context] <raw error>`). Grab that for debugging.
- Fastest mitigation: roll back to demo mode (above), then forward-fix.
