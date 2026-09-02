# 06 · NEXT SPRINT

> **Start here after `01`.** Working document for the next session. Update every sprint.
> Track: **post-editor-freeze launch line.** Current sprint: **Sprint 0 — unblock and prove media.**
> The Avatar Golden Reference track is **NOT current** (superseded — see D44). Do not resume it.

---

## Where we are (2026-09-03)

The **editor line is closed and frozen** at tag `editor-beta-v1` (commit `533c8ec`,
2026-08-11), documented in `docs/EDITOR_BETA_V1_FREEZE.md`. That document is authoritative
for the scene, gesture, layering, `contents[]`, display-resolver, frame, TV, player and
storage-key contracts. Do not redesign any of them without a deliberate decision to reopen.

Gates at freeze: typecheck ✓ · lint 0 errors ✓ · 1516 tests / 115 files ✓ · production build ✓.

Two things block everything, and neither is code.

---

## Sprint 0 — unblock and prove media (current)

Strictly in order. Nothing after step 3 starts until step 3 passes.

### 1. Apply `supabase/provision/m27a_media_storage.sql` — FOUNDER ACTION

The `nest-media` bucket has never existed. Verified three ways on 2026-08-11 against the
live project: bucket list `200 []`, `GET /storage/v1/bucket/nest-media` → `NoSuchBucket`,
public object read → `NoSuchKey`. Re-verification on 2026-09-03 was **not possible** — the
Supabase host does not resolve from the development machine (`ENOTFOUND`), so the state is
*unconfirmed*, not *confirmed still missing*.

The SQL is additive and idempotent: one bucket (public, 25 MB, image/video MIME allow-list)
and four RLS policies keyed on `(storage.foldername(name))[1] = auth.uid()::text`.
Apply in: Supabase dashboard → SQL Editor → paste → Run.

Then, from a machine with network access:

```bash
node scripts/verify-nest-media.mjs
```

It exits non-zero with the reason until the SQL is applied; after that it checks the bucket
shape, anonymous read, and that anonymous write is refused.

### 2. Restore the Vercel deployment — FOUNDER ACTION

`ai-bazaar` is disabled: production returns `402 DEPLOYMENT_DISABLED`, the branch preview
`410 GONE`. This is a billing state, not a build failure, and it has gated every "deployed"
claim for many sprints. **Do not guess Vercel hostnames** — a wrong team slug once hid the
truth for several sprints.

After the redeploy, confirm Preview env carries `NEXT_PUBLIC_SUPABASE_*`,
`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `FOUNDER_EMAILS`/`FOUNDER_USER_IDS`,
`NEXT_PUBLIC_NEST_BACKEND=supabase`, and that Supabase Auth redirect URLs include the
preview domain (`AUTH_ROUTING_SPRINT.md`). `/api/build-info` answers "which commit is this?"
from a phone.

### 3. One real photo upload, end to end — the acceptance run

**No real upload has ever run in this project's history.** Every media verification to date
used URL-connected content. This run is the first, and it is the sprint's definition of done:

```
upload a real photo  →  connect it to a Framed Photo  →  Save draft
  →  leave the editor  →  reopen (geometry + contents[] byte-identical)
  →  publish  →  visit as a visitor (signed out)  →  the photo renders
  →  reload as the visitor  →  still there
```

Run it on a real phone at 375×812 / 390×844 / 430×932. Also confirm the storage object key
is `<ownerId>/<nestId>/<objectId>/<mediaId>.<ext>` — the first segment must be the owner uid
or every RLS policy silently stops matching.

The iPhone video guard (`videoPlaybackRejection()`) is in place: `.MOV` is refused on MIME,
and an HEVC-inside-`video/mp4` file is refused by handing it to a `<video>` element before
the upload. Transcoding stays post-beta.

---

## The roadmap after Sprint 0

The canonical product order after the editor freeze (D44). Each item is a sprint or more;
do not reorder without a founder decision.

1. **Create / onboarding polish** — the path from arriving to a first Nest.
2. **Profile / social acceptance** — two real accounts: like, comment, follow, notification,
   views. Still the least-proven area of the product.
3. **Village v1** — the spatial layer, first real version.
4. **Asset / Background / House pipeline hardening + launch content generation** — make the
   generation pipelines dependable, then produce the launch library. See the landscape note
   below for how backgrounds should be composed from here on.
5. **Simplified Avatar v1** — a deliberately simpler avatar than the old Golden Reference
   track assumed. That track is superseded (D44); do not resurrect its scope.
6. **Google / Apple auth.**
7. **CI/CD, observability, analytics.**
8. **Performance / PWA.**
9. **Safety / legal** — including the unresolved branded-asset question (RV1).
10. **Seeded world** — a populated place, not an empty one, on day one.
11. **Launch QA / release candidate.**

## Recorded for later — landscape Studio View

`docs/design/STUDIO_VIEW_LANDSCAPE.md` (D45). Not scheduled. It matters *now* only because
of item 4: new backgrounds should preferably come from a **wider master composition with a
strong 3:4 central safe area**, and the mix should shift toward simple **canvas rooms**
(clean walls/floor, less baked-in decoration). **Do not change the frozen 3:4 scene
architecture** to chase it.

## Guardrails carried forward

- The **editor is frozen** (`EDITOR_BETA_V1_FREEZE.md`). Reopening a contract is a decision,
  not a refactor.
- Additive migrations only, shown and **founder-provisioned**. Never destructive DDL, never
  a silent fallback table.
- Never change the canonical camera.
- Asset Factory and Nest Factory Create flows stay frozen (D20) — no redesign without a bug.
- Founder-gated generation/publish (D22/D35); users never generate Nests (D26).
- A real-person photo must never become public (D31/D32).
