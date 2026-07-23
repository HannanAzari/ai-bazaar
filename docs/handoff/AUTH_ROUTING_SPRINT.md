# Authentication Repair + Routing Consolidation

## A · Root cause of the client/server auth mismatch

The SSR cookie plumbing is **correct**: the browser client is cookie-based
(`createBrowserClient`, `@supabase/ssr`, `lib/supabase/client.ts`), the server reads those
cookies (`createServerClient` + `cookies()`, `lib/supabase/server.ts`), and middleware refreshes
the session. So it is **not** a cookie/localStorage bug.

The real cause is a **stale build in demo mode**. `getRuntimeMode()` (`lib/runtime-mode.ts`) falls
back to **demo/localStorage** when `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` are absent **at build time**
(NEXT_PUBLIC_* are inlined at build). The build you tested (`c5755b7`) predated those Preview vars,
so the **client ran in demo mode**: sign-in wrote a fake localStorage session (Profile *looks*
signed in) while **no Supabase cookie ever existed** → the server saw no session → "sign in
required." The fresh build after the env vars (this commit) runs in Supabase mode; that is the fix.

## B · Session architecture (before → after)

- **Before:** three client auth states (`useNestIdentity` Supabase · `useSession` auth-provider ·
  `useDemo` localStorage) + two server reads (requireUser, requireFounder each calling getUser).
- **After (D36 + this sprint):** ONE client hook `useNestIdentity` (→ `lib/nest-account`, cookie
  session) drives header/profile/editor/all studios/login/sign-up; ONE server read
  `lib/auth/server-session.ts getServerUser()` backs `requireUser` + `requireFounder`. Legacy
  `useSession` = only `/onboarding`; `useDemo` = V1 shop/street only.

## C · Cookie/session evidence + the diagnostic

- Auth uses **cookies** (`@supabase/ssr`): `sb-<projectRef>-auth-token` (chunked). Sent to
  `/profile/avatar` + every `/api/ai/avatar/*` + `/api/avatar/*` (same-origin).
- **New diagnostic: `GET /api/auth/whoami`** returns what the **server** resolves from the request
  cookies. Signed out (local, verified): `{configured:true, projectRef:"srrmkdsvldlyllsxyhtq",
  backend:"supabase", authenticated:false, reason:"no_session"}`. **On the deploy, after login, it
  must return `authenticated:true` + your `userId` + `isFounder`** — that is Part 1's success
  criterion (a deployed API route returning the same user as the browser). `projectRef` confirms
  client + server share ONE Supabase project.

## D · Vercel Preview env — YOU verify (names only)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`OPENAI_API_KEY`, `NEXT_PUBLIC_NEST_BACKEND=supabase`, and `FOUNDER_EMAILS` and/or
`FOUNDER_USER_IDS` — all enabled for **Preview**, all the same Supabase project
(`srrmkdsvldlyllsxyhtq`), no secret is `NEXT_PUBLIC_`, and the build is the latest `m12-nest-platform`
commit (not a manual main deploy).

## E · Supabase Auth URL config — YOU verify
Site URL + Redirect URLs include the Vercel Preview domain (or `https://*.vercel.app`), the prod
domain, and `http://localhost:3000`. Login honours a safe same-origin `?next=` with **open-redirect
protection** (`next.startsWith("/") && !next.startsWith("//")`) — code done.

## F/G/H · Login / founder-role / Interpret — YOU run (I cannot sign in)
After the redeploy: sign in → `/api/auth/whoami` shows `authenticated:true` + `isFounder:true`
(founder) → Asset/Nest open with **no code screen**; a normal account shows `isFounder:false` and is
**denied (403)** Asset/Nest but keeps Avatar; Avatar Interpret succeeds.

## I · Canonical route map
| Route | Meaning |
|---|---|
| `/` → `/home` | Nestudio home (redirect, already) |
| `/login` → `/auth/login`, `/signup` → `/auth/sign-up` | canonical Nestudio auth (new aliases) |
| `/home` `/explore` `/create` `/profile` `/notifications` | Nestudio app shell (bottom nav) |
| `/nest-editor` · `/profile/avatar` | editor · Avatar Studio (user) |
| `/asset-factory` · `/nest-factory` | founder-only studios |
| `/nest/[slug]` · `/@handle` (`/profile/[handle]`) · `/u/[handle]` | public Nest / profile |
| `/api/auth/whoami` | auth diagnostic |

## J · Obsolete public routes handled
- **Redirected → Nestudio:** `/bazaar`, `/bazaar/*`, `/shop`, `/shop/*` → `/home`. Login copy
  de-bazaar'd (Nestudio branding).
- **NOT redirected (dependency first):** `/village` is still linked from Home + Profile ("Visit the
  village") and is *preserved for a future tab* — redirecting it now would break current links.
  Migration plan: remove those two links → then redirect `/village*` → `/home`.
- **Dev-only (not public nav, leave):** `/dev/*`, `/design/*`, `/nest-admin`, `/moderation`,
  `/village-lab`, `/village-projection-lab`, `/creator-studio`, `/assets`.

## O · Remaining legacy dependencies
- `/village` linked from `app/home/home-client.tsx` + `app/profile/[handle]/profile-client.tsx`.
- V1 `useDemo`/demo-provider still powers shop/street components + `/onboarding` (via `useSession`).
- These are the "migrate remaining consumers, then archive" items — not blocking auth; deferred with
  the plan above so nothing current breaks.
