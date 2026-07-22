# Auth + Navigation Polish Sprint

Fixes the three deployed-mobile bugs. Code is done + locally verified; the remaining items
are **Vercel/Supabase config actions only you can do** (I can't read your dashboard).

## A · Root cause of "Auth is not configured on the server"

That exact string comes from **one place**: `lib/user-gate.ts` when `createSupabaseServerClient()`
returns **null** — which happens **only** when `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
are absent at **server runtime**. `middleware.ts` checks the same vars and, when missing, falls into
"demo mode" (no session refresh). That single cause explains all three symptoms together: header shows
"Log in" (no real Supabase session → demo/localStorage mode), photo upload works (pure client), but
Interpret's server call 503s. **→ The deployed preview is missing those two `NEXT_PUBLIC_` vars for the
Preview environment, or wasn't redeployed after they were added.**

## B · The fix (code — shipped)

- **Friendly errors:** the server logs the technical detail; users see "Please sign in to create your
  avatar" (401) or "Sign-in is temporarily unavailable" (503) — never internals.
- **Login redirect + return:** an unauthenticated studio call routes to `/auth/login?next=<path>`; the
  login page now honours `?next=` and returns you to the studio. (Verified: Interpret while signed out →
  `/auth/login?next=%2Fasset-factory`.)
- **Role-based admin (Bug 2):** the temporary founder-code screen is **removed**. Global studios
  (Asset/Nest) now require **signed-in + founder role** via `lib/founder-role.ts requireFounder()`
  (server-side allowlist `FOUNDER_USER_IDS` / `FOUNDER_EMAILS`, never `NEXT_PUBLIC_`). 401→login,
  403→"for founders only", signed-in admin → opens automatically. Avatar requires any signed-in user.
  The founder token survives only as an OFF-by-default emergency backstop (`FOUNDER_TOKEN_EMERGENCY=1`).
- **Back button (Bug 3):** every studio header has a top-left back arrow → Avatar `/profile`, Asset
  `/nest-editor`, Nest `/create`; confirms before discarding a draft or leaving mid-generation.
- **Consistent header:** `SiteHeader` now reads the real Supabase session (`useNestIdentity`, not demo
  auth) and is hidden on the studios (no more duplicate "Log in" header).

Access matrix now enforced server-side:

| Account | Asset Factory | Nest Factory | Avatar Studio |
|---|---|---|---|
| Founder/admin (allowlisted) | ✅ | ✅ | ✅ |
| Normal signed-in user | ❌ 403 | ❌ 403 | ✅ |
| Signed out | → login | → login | → login |

## C · Vercel environment variables — YOU must verify (Preview scope) + redeploy

Set for **Preview AND Production** (names only; never paste values):

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Preview+Prod | **the missing one causing Bug 1** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Preview+Prod | **the missing one causing Bug 1** |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only | admin ops (publish) |
| `OPENAI_API_KEY` | server-only | generation |
| `FOUNDER_USER_IDS` or `FOUNDER_EMAILS` | server-only | **new — your admin allowlist** (e.g. your Supabase user id / email) |

No secret may use `NEXT_PUBLIC_` (audited: none do). **Redeploy the Preview after setting these.**

## D · Supabase Auth redirect URLs — YOU must verify

In Supabase → Authentication → URL Configuration, ensure the **Site URL / Redirect URLs** include the
current Vercel preview domain (or a wildcard like `https://*.vercel.app`), so sign-in on the preview
establishes a session. Without this, the session cookie won't stick and the header stays "Log in".

## Mobile proof (E–H) — YOU run on the deployed preview after C+D

Signed out → open Avatar Studio → redirected to Login → sign in → returns to Avatar Studio → header shows
you → upload → Interpret succeeds → Back → Profile. Then: admin account opens Asset Factory with **no
code screen**; a normal test user is **denied** (403) Asset Factory but Avatar Studio still works.

## I · Avatar without the founder token

Confirmed in code: avatar routes use `requireUser` (real Supabase session) and **reject the founder
token** — ownership is always the authenticated Supabase user id.

## Local verification done
typecheck · lint · 596 tests · build green; `/asset-factory` shows the studio + back button (no code
screen, no duplicate header); Interpret-while-signed-out → `/auth/login?next=…`.
