# Supabase Cutover Runbook

How to move AI Bazaar from the **localStorage demo** to a real **Supabase**
backend — without breaking demo mode. This is the prep/runbook; the actual data
wiring (the Supabase repository implementations) is still pending. See
[architecture.md](../architecture.md) §4 for the schema and
[decision-log.md](decision-log.md) ADR-003/004/014 for the why.

> **Status:** prep only. Runtime **mode detection** and a **repository layer**
> (`lib/repos/*`) are in place; the Supabase repositories are typed **stubs** that
> throw `NotImplementedError`. Demo mode remains the default and is unchanged.

---

## 1. Migration / schema drift audit

**Verdict: enum values are fully reconciled; there is one structural gap.**

### Enum reconciliation — clean ✓
`supabase/schema.sql` is a correct **superset** of the base enums plus every
`ALTER TYPE … ADD VALUE` migration. Spot-checked counts all match:

| Enum | schema.sql values | Built from |
|---|---|---|
| `event_type` | 23 | base 7 + `20260615_01` (6) + `20260616` (6) + `20260617_01` (4) |
| `room_action_type` | 11 | base 9 + `profile` (`20260616`) + `room_link` (`20260617_01`) |
| `room_kind` | 10 | base 5 + 5 (`20260617_01`) |
| `asset_category` | 9 | base 7 + `door`,`stairs` (`20260617_01`) |
| `report_target_type` | 4 | base 2 + `user`,`guestbook` (`20260611_01`,`20260612_01`) |
| `report_status` | 4 | base + `pending`,`reviewed`,`hidden` (`20260611_01`) |

The `_01_extend_enums` / `_02_*` split (commit new enum values before use) was
followed in every sprint. **No value drift.**

### Structural gap — the migration chain is NOT runnable from an empty DB ⚠️
The base enums (`decoration_type`, `generation_status`, `report_target_type`,
`report_status`) and the **core tables** (`profiles`, `bazaars`, `shops`,
`shop_slots`, `shop_decorations`, `shop_links`, `likes`, `follows`,
`generation_jobs`) are defined **only in `schema.sql`**, not in any migration. The
earliest migration (`20260610_village_model.sql`) `ALTER`s and adds a trigger to
`shops`/`bazaars`/`shop_slots` assuming they already exist.

**Consequence:** the `supabase/migrations/*` files are **incremental patches on an
implicit baseline**, not a from-zero builder.

**Resolution (chosen):**
- **Fresh project → apply `supabase/schema.sql`** (the canonical superset). This is
  already what the README instructs.
- **Existing/baselined DB → apply migrations in filename order** for incremental
  evolution.
- Migrations are **append-only and never reordered** (ADR-009), so we do **not**
  rewrite history. If a fully migration-driven from-zero build is later required,
  author a single `20260610_00_baseline.sql` that creates the base types/tables —
  tracked as future work, out of this prep sprint's scope.

---

## 2. Migration order

Apply in lexicographic filename order (= chronological). For a **fresh** DB, run
`schema.sql` instead of steps 1–13.

1. `20260610_village_model.sql` *(assumes baseline tables exist — see §1)*
2. `20260610_house_exteriors_and_room_zones.sql`
3. `20260611_01_extend_enums.sql` → 4. `20260611_02_tags_events_reports.sql`
5. `20260612_01_extend_enums.sql` → 6. `20260612_02_creator_engagement.sql`
7. `20260613_collections_activity_assets.sql`
8. `20260614_room_engine.sql`
9. `20260615_01_extend_enums.sql` → 10. `20260615_02_room_studio.sql`
11. `20260616_extend_enums.sql`
12. `20260617_01_extend_enums.sql` → 13. `20260617_02_multi_room.sql`
14. `supabase/seed.sql` (starter tag vocabulary)

`_01_extend_enums` files only `ADD VALUE`; they **must commit before** the paired
`_02` that uses the value.

---

## 3. Required env vars

| Var | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Project URL. **Presence flips the app to production mode.** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Anon key (browser/SSR, RLS-guarded). |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only | Admin tasks / seeding. **Never expose to the client.** |
| `NEXT_PUBLIC_APP_URL` | public | Absolute base URL for links/redirects. |
| `STORAGE_DRIVER`, `R2_*` | server | Image storage (separate from the DB cutover). |

**Mode detection** (`lib/runtime-mode.ts`): `getRuntimeMode()` returns
`"production"` only when **both** `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` are set; otherwise `"demo"`. A dev-only badge
(`components/dev-mode-badge.tsx`) shows the current mode in non-production builds.
The repository factory (`lib/repos/index.ts`) selects local vs Supabase repos from
this mode.

---

## 4. Local Supabase setup

```bash
# 1. Install the CLI (once)
brew install supabase/tap/supabase    # or: npx supabase --help

# 2. Start a local stack (Postgres + Studio) from the repo root
supabase init                          # if supabase/config.toml not present
supabase start                         # prints local URL + anon/service keys

# 3. Create the schema (fresh DB → schema.sql is the superset)
psql "$DB_URL" -f supabase/schema.sql
psql "$DB_URL" -f supabase/seed.sql

# 4. Point the app at it (.env.local)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from `supabase start`>
```

Restart `npm run dev`; the dev badge should read **LIVE · Supabase**. Until the
Supabase repositories are implemented, data-backed surfaces will surface
`NotImplementedError` — expected during prep.

---

## 5. Staging setup

1. Create a dedicated **staging** Supabase project (never reuse production).
2. Apply `schema.sql` (fresh) **or** the ordered migrations (existing), then `seed.sql`.
3. Set the three env vars in the staging host (e.g. Vercel preview env).
4. **Dry-run every new migration on staging before production** (ADR-004): the SQL
   has never been executed against live Postgres, so RLS and constraints need a
   real run.
5. Smoke-test (§6), then promote the same migration set to production.

---

## 6. RLS smoke tests

Run as the **anon** role (or a logged-in test user), not the service role, so RLS
is actually exercised.

- **Public read:** an unauthenticated client can `select` visible `shops`, `rooms`,
  `room_objects`, `bazaars`, `tags` — and **cannot** read a moderator-`hidden` shop's
  room.
- **Owner write:** a logged-in owner can `insert/update/delete` their own `rooms` /
  `room_objects` (`owns_shop`) but **not** another owner's.
- **Entry-room invariant:** the partial unique index `rooms_one_entry_per_shop`
  rejects a second `is_entry = true` row for the same shop.
- **Events:** a client can `insert` an `events` row via `record_event()` but cannot
  read another shop's raw events beyond the exposed `event_counts` view.
- **Reports:** any user can `insert` a report; only admins (`is_admin()`) can update
  `status` or read the full queue.
- **Guestbook:** a visitor can `insert` an entry; only the house owner can hide/delete.

Capture pass/fail per policy; a failing public-read or owner-write check blocks the
cutover.

---

## 7. Rollback plan

Mode detection makes rollback a **config** action, not a deploy:

1. **Instant rollback:** unset `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   in the host and redeploy/restart → `getRuntimeMode()` returns `"demo"` and the
   app runs entirely on localStorage again. No data migration needed.
2. **Schema rollback:** restore from the pre-cutover Supabase snapshot/backup taken
   immediately before applying migrations. Do **not** hand-edit applied migrations;
   forward-fix with a new dated migration if needed.
3. **Partial cutover:** because each surface goes through a repository, a single
   repo can fall back to its local implementation while others use Supabase — useful
   for staged rollout.
4. **Always** take a fresh DB backup before applying any migration to staging or
   production.

---

## 8. Checklist before flipping production

- [ ] Migrations dry-run clean on staging; `seed.sql` applied.
- [ ] All §6 RLS smoke tests pass.
- [ ] Supabase repository implementations replace the stubs in `lib/repos/supabase.ts`.
- [ ] Pre-cutover DB backup taken.
- [ ] Env vars set in the production host; service-role key server-only.
- [ ] Dev/staging badge reads **LIVE · Supabase**; gates green.
- [ ] Rollback (unset env vars) verified on staging.
