# Sprint Checklist — Definition of Done

A sprint is **not complete** until every step below is done. Applies to every
sprint, every time. No exceptions.

## 1. Update the documentation (source of truth)

| # | Doc | Update with |
|---|-----|-------------|
| 1 | [README.md](../README.md) | New routes, flags, setup/run, migration order, demo behaviour |
| 2 | [architecture.md](../architecture.md) | New systems, schema/tables, routes, storage, completed-features list |
| 3 | [docs/roadmap.md](roadmap.md) | Move the sprint to **Completed**; set the next **In Progress** / **Next Sprint**; reprioritize backlog |
| 4 | [docs/changelog.md](changelog.md) | **Append** a dated entry (Added / Changed / Fixed / Database / Flags / Documentation); reference migrations + flags |
| 5 | [docs/handoff.md](handoff.md) | Current state, important files, flags table, open problems, next-sprint recommendation, do-not-change list |
| 6 | [docs/decision-log.md](decision-log.md) | **Append** an ADR for any new architectural decision (supersede, never edit) |
| 7 | [docs/room-engine-spec.md](room-engine-spec.md) | **Only if room behaviour changed** — keep it canonical and in sync |

Also update [docs/QA.md](QA.md) and `.env.example` when routes/actions/flags change.

Rules to respect:
- changelog.md and decision-log.md are **append-only** — never delete or rewrite entries.
- room-engine-spec.md is canonical; if room behaviour changed, it must change in the same sprint.

## 2. Run the gates (all must pass)

```bash
# Node 20 required (machine default is v16)
export PATH="/Users/hannan/.nvm/versions/node/v20.20.2/bin:$PATH"
npm run typecheck   # tsc --noEmit
npm run lint        # eslint, zero warnings
npm run test        # vitest
npm run build       # next build
```

## 3. Only then is the sprint complete

Confirm: docs updated · all four gates green. Then summarize changed files,
limitations, and what to manually test next.
