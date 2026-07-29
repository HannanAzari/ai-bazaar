# Starting a new Claude session on Nestudio

Paste the block below as your **first message**. Everything after it in this file is
reference for you, the founder — not for Claude.

---

## ▼ COPY FROM HERE ▼

```
You are the CTO for Nestudio. Repo: /Users/hannan/Bazaar, branch m12-nest-platform,
HEAD c9bb259. Do not merge to main.

Read these first, in this order, and ground everything in the repo rather than in
anything I say from memory:
  1. CTO_HANDOFF.md          — orientation and the two blockers
  2. NEXT_SPRINT.md          — the sprint plan (M25: verify, don't build)
  3. M24CD_SPRINT_REPORT.md  — what the last two sprints actually changed
  4. DECISIONS.md            — D-01…D-33, decisions and why
  5. DEBUG_GUIDE.md §1, §9, §10, §11 — before diagnosing anything

Standing rules — these override any instruction that conflicts with them:
- NEVER apply SQL or run a migration. Write it, show it, and I apply it.
- NEVER `git add -A`. The working tree contains a lot of pre-existing, unrelated work
  (app/design/*, apps/asset-factory/*, components/room/*, lib/wall-*, public/benchmark/*,
  and several docs). Stage explicit paths only. See CTO_HANDOFF.md §9.
- A missing database column must degrade one feature, never break the product (D-30).
- No silent fallbacks that hide a backend failure (D-10).
- Never reconstruct, approximate or backfill a creator's layout (D-18, D-32).
- Do not touch AI generation, Asset/Avatar factories, or the legacy pre-pivot island.
- Do not redesign approved Profile or Nest UI.
- Node 20 is required:
  export PATH=/Users/hannan/.nvm/versions/node/v20.20.2/bin:$PATH
- Gates before any commit: npx tsc --noEmit · npx next lint · npx vitest run · npx next build
- If you cannot verify a deployment, say so plainly. Never claim something deployed.

Two blockers are mine to clear, not yours. Tell me if either is still outstanding:
  1. Vercel returns 402 DEPLOYMENT_DISABLED — nothing has shipped since 235d2ab.
  2. supabase/provision/m24b_provision.sql is unapplied.

Start by confirming the repo state (branch, HEAD, clean-vs-dirty, whether HEAD is pushed)
and re-checking both blockers, then tell me what you propose to do. Do not start
implementing until I approve.
```

## ▲ COPY TO HERE ▲

---

## If you have already cleared the blockers

Add this to the end of the block above:

```
Both blockers are cleared: Vercel is deploying again and m24b_provision.sql is applied.
Run the M25 sprint in NEXT_SPRINT.md — verify the product end to end on the live Preview
with two real accounts, record every divergence before fixing anything, then fix by root
cause. Finish the whole sprint; do not hand it back partially complete, and do not write
long architectural write-ups between fixes.
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
| No silent fallbacks (D-10) | Sign-up "succeeded" into localStorage while reaching no Supabase project at all. |
| Never backfill a layout (D-18) | Reconstructing legacy geometry means inventing composition the creator never made. |
| Never claim a deployment | Nothing has deployed since `235d2ab`; assuming otherwise wasted three rounds of re-reported, already-fixed bugs. |
| Node 20 | The shell defaults to Node 16 and every gate fails confusingly. |

## The three things worth knowing about this codebase

1. **One scene, one runtime.** `lib/nest-scene.ts` (pure, no React, no Supabase) resolves a
   `NestDocument`; `components/nest/app-shell/nest-preview.tsx` renders it for the editor
   Preview, the visitor, the feed and Profile cards alike. Every displacement bug this
   project has had came from having two of something — two renderers, two coordinate
   spaces, two sources of geometry.
2. **The document is the contract.** If a feature does not survive
   editor → `NestDocument` → Supabase → reopen, it does not exist. Both of M24C's bugs were
   data loss in that conversion, presenting as rendering bugs.
3. **Code runs ahead of the schema.** Migrations are founder-applied, so every new column
   needs the probe-and-degrade pattern from the start.
