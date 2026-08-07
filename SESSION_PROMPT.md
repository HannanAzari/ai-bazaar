# Starting a new Claude session on Nestudio

Paste the block below as your **first message**. Everything after it in this file is
reference for you, the founder — not for Claude.

---

## ▼ COPY FROM HERE ▼

```
You are the CTO for Nestudio. Repo: /Users/hannan/Bazaar, branch m12-nest-platform,
HEAD 56aa6f3. Do not merge to main.

Read these first, in this order, and ground everything in the repo rather than in
anything I say from memory:
  1. CTO_HANDOFF.md          — orientation and the one blocker
  2. NEXT_SPRINT.md          — what to do next (§A unless I say otherwise)
  3. M26A_SPRINT_REPORT.md   — what the last sprint changed and what it did NOT finish
  4. DECISIONS.md            — D-01…D-58, decisions and why
  5. DEBUG_GUIDE.md §1, §9, §10, §11 — before diagnosing anything

Standing rules — these override any instruction that conflicts with them:
- NEVER apply SQL or run a migration. Write it, show it, and I apply it.
- NEVER `git add -A`. The working tree contains a lot of pre-existing, unrelated work
  (app/design/*, apps/asset-factory/*, components/room/*, lib/wall-*, public/benchmark/*,
  and several docs). Stage explicit paths only. See CTO_HANDOFF.md §9.
- A missing database column must degrade one feature, never break the product (D-30) —
  but never silently discard creator work: refuse the write and name the migration (D-37).
- Never infer an interaction from an asset id or name; resolve it from creator data (D-34).
- Two fingers are always a camera gesture and never touch object geometry (D-56).
- The camera is never saved or published (D-45).
- No silent fallbacks that hide a backend failure (D-10).
- Never reconstruct, approximate or backfill a creator's layout (D-18, D-32).
- Do not touch AI generation, Asset/Avatar factories, or the legacy pre-pivot island.
- Do not start M26B (parent-child placement) unless I explicitly ask.
- Node 20 is required:
  export PATH=/Users/hannan/.nvm/versions/node/v20.20.2/bin:$PATH
- Gates before any commit: npx tsc --noEmit · npx next lint · npx vitest run · npx next build
- If you cannot verify a deployment, say so plainly. Never claim something deployed.

One blocker is mine to clear, not yours:
  Vercel project `ai-bazaar` (team `hannanazaris-projects`) is DISABLED. Production alias
  returns 402; the branch preview returns 410 GONE. This is settled — do NOT spend time
  probing or guessing Vercel hostnames, and do not re-litigate it. All Supabase migrations
  are applied; probe the live schema BY COLUMN before believing any claim about it.

Start by confirming the repo state (branch, HEAD, clean-vs-dirty, whether HEAD is pushed)
and tell me what you propose to do. Do not start implementing until I approve.
```

## ▲ COPY TO HERE ▲

---

## If Vercel is deploying again

Add this to the end of the block above:

```
Vercel is deploying again. First, confirm the deployed commit at <url>/api/build-info.
Then run the standing verification debt in NEXT_SPRINT.md — two-account social, the
publish→visitor round-trip, views from a second account — before any new feature work.
Record every divergence before fixing anything, then fix by root cause.
```

## If you are starting a different piece of work

Keep the standing rules verbatim — they are what stops the recurring failure modes — and
replace the last paragraph with the actual task.

---

## Why each rule is in there

| Rule | What went wrong without it |
|---|---|
| Never apply SQL | Your explicit policy; migrations are yours to review and run. |
| Never `git add -A` | The tree carries a large amount of unrelated in-progress work that would otherwise be swept into sprint commits. |
| Degrade, don't break (D-30) | Selecting a not-yet-provisioned column took the whole live app down once. |
| Never discard creator work (D-37) | A save containing Focus regions reported "Saved ✓" and dropped every one of them. |
| No silent fallbacks (D-10) | Sign-up "succeeded" into localStorage while reaching no Supabase project at all. |
| Never backfill a layout (D-18) | Reconstructing legacy geometry means inventing composition the creator never made. |
| Two fingers never touch geometry (D-56) | Pinching to look closer silently resized and rotated the selected object. |
| Never claim a deployment | Nothing has deployed since `235d2ab`; assuming otherwise wasted several rounds of re-reported, already-fixed bugs. |
| Don't guess Vercel hostnames | A wrong team slug returned 404 and hid the 410 that proved the project existed — that error cost sprints. |
| Node 20 | The shell defaults to Node 16 and every gate fails confusingly. |

## The four things worth knowing about this codebase

1. **One runtime.** `nest-runtime.tsx` renders and runs a Nest for the editor Preview, the
   visitor, the feed and every card. `mode` decides input and nothing else. Every
   displacement and dead-interaction bug this project has had came from having two of
   something — two renderers, two coordinate spaces, two focus rectangles, two gesture
   systems.
2. **World space vs screen space.** The camera transform wraps the room and its objects.
   Editor chrome (selection frame, handles, toolbar) is a *sibling*, positioned per frame
   from `sceneToScreen()`. Anything inside the transform scales; anything outside must not.
3. **The document is the contract.** If a feature does not survive
   editor → `NestDocument` → Supabase → reopen, it does not exist. Several sprints' worth of
   "rendering bugs" turned out to be data loss in that conversion.
4. **The camera is not scene data.** It changes what you are looking at, never where an
   object is, and it is never written to the document.

## Reproducing things fast

- `/dev/nest-runtime` — editor Preview and visitor side by side on one document, with
  resolver output printed, a three-background switcher and a legacy-Focus toggle. The
  fastest way to tell "this isn't interactive" from "the data never arrived".
- `/dev/nest-parity` — the Editor↔Preview geometry bench.
- `/api/build-info` — commit, branch, project, env, Supabase ref. No secrets.
- `/api/auth/whoami` — which auth backend actually resolved.

## Known dev-server quirk

The editor sometimes renders blank after several HMR cycles, and the React hook-order
warnings that accompany it are HMR artefacts, not real ordering bugs. **Restart the dev
server** rather than debugging it.
