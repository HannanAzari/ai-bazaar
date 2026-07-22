# 09 · REPOSITORY STRUCTURE

> Where documentation lives, so it never fragments or duplicates again.

## The rule

**One home per idea.** Before creating a doc, check if the idea already has one and edit that. Philosophy is consolidated in `03_DESIGN_CONSTITUTION.md` — do **not** create new philosophy files (see `10`).

## Target `/docs` layout

```
/docs
  /handoff        ← THIS onboarding package (01–10). The canonical entry point.
                     Update 02_PROJECT_STATE and 06_NEXT_SPRINT every sprint.
                     The design constitution (03) and decisions (07) are permanent.
  /product        Product-level specs: the Alphabet vocabulary spec,
                     starter-Nest definitions, business-mode spec.
  /design         Design system source specs (grammar, interaction, sound, backgrounds)
                     — but the consolidated, authoritative version is handoff/03.
  /architecture   Engineering architecture: the UOS spec (uos-spec.json + narrative),
                     surface/animation/sound registries, room engine.
  /roadmap        The phased roadmap (mirror of handoff/05) + phase working notes.
  /research       Explorations, experiments, rejected directions kept for the record.
                     Nothing here is authoritative.
```

## Where each future document belongs

| If you're writing… | Put it in… |
|---|---|
| The onboarding / handoff for a new session | `/docs/handoff` (this package) |
| The object vocabulary / a new object's data | `/docs/product` (+ the machine-readable `*-spec.json`) |
| A design rule (interaction timing, sound, spacing) | Amend `/docs/handoff/03` (authoritative); detail in `/docs/design` |
| The object/room engine architecture | `/docs/architecture` |
| A major decision | Append a row to `/docs/handoff/07_DECISIONS.md` |
| An experiment or a rejected idea | `/docs/research` |
| This sprint's plan | Overwrite `/docs/handoff/06_NEXT_SPRINT.md` |
| The current status | Update `/docs/handoff/02_PROJECT_STATE.md` |

## Machine-readable specs

Data specs (the object schema, vocabulary, registries) live as JSON next to their narrative doc and are the **source of truth** for implementation: e.g. `nestudio-alphabet-spec.json` (vocabulary), `nestudio-visual-language-v2.json`, `nestudio-alphabet-spec.json`, `uos-spec.json`. Keep the JSON authoritative; the Markdown explains it.

## Housekeeping notes

- The repo predates this structure and contains many older docs (`docs/*.md`) and uncommitted exploratory files from earlier milestones. **Do not sweep those into commits.** Migrate the still-true ones into the structure above over time; treat `docs/handoff` as the current authority.
- Older scattered handoff/sprint docs (`docs/SESSION_HANDOFF.md`, `docs/CURRENT_SPRINT.md`, etc.) are **superseded** by this package. Point people here.
