# Subdomain Routing — `username.nestud.io` (prep)

Infrastructure to serve each creator at `https://<handle>.nestud.io`. **No DNS is
deployed in this sprint** — this documents the routing/middleware/local-dev
strategy and the code that's already in place.

## Strategy

- **One wildcard, one rewrite.** A request to `<handle>.nestud.io/` is rewritten
  (server-side, no redirect, URL unchanged in the browser) to the existing
  `/u/<handle>` creator route. No new pages, no visual change.
- **Pure host parser** (`lib/subdomain.ts`): `extractSubdomain(host)` returns the
  handle for `<handle>.nestud.io` / `<handle>.localhost`, and `null` for the root,
  `www`, and reserved labels (`app`, `api`, `studio`, `admin`, `staging`).
  `subdomainRewritePath(handle)` → `/u/<handle>`. Unit-tested.
- **Middleware** (`middleware.ts`): on `/`, if a handle subdomain is present it
  `NextResponse.rewrite`s to `/u/<handle>`. This runs in **both** modes (it's just
  a host check) and is a no-op when there's no subdomain.

## Assumptions

- The apex/app is served from `nestud.io` and `www.nestud.io` (both → app, not a
  handle).
- A creator's `handle` equals their `profiles.username` (and the demo creator
  handle). Handle uniqueness is enforced by `profiles.username UNIQUE`.
- Only the **left-most** label is the handle; deeper nesting is ignored.
- Reserved subdomains never resolve to a creator.

## DNS (when ready — not in this sprint)

1. Add a wildcard record: `*.nestud.io → <host>` (e.g. Vercel).
2. Add `nestud.io` + `*.nestud.io` as domains on the host; issue a wildcard TLS cert.
3. No app code change needed — the middleware already rewrites.

## Local development

Wildcard subdomains work on `localhost` in modern browsers:

```bash
npm run dev
# visit:
http://jane.localhost:3000      # → rewritten to /u/jane
http://localhost:3000           # → app root (no rewrite)
```

If a browser/OS doesn't resolve `*.localhost`, add hosts entries:

```
127.0.0.1  jane.localhost
127.0.0.1  app.localhost
```

…or use a wildcard dev domain like `*.lvh.me` / `*.localtest.me` (both resolve to
127.0.0.1) — `extractSubdomain` only special-cases `nestud.io` and `localhost`, so
add your dev root to `ROOT_DOMAINS` if you use a different one.

## Not in scope

- DNS/cert provisioning, custom domains per creator, apex redirects, reserved-name
  claiming UX. Tracked as follow-ups.
