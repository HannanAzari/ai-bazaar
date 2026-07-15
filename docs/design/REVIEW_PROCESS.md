<!-- Governed by NESTUDIO_WORLD_BIBLE.md. The DNA is LOCKED (M23–M29); this is tooling. -->
# 👁️ Review Process

> The **review UI and board generators** for the Icon Lab — pure review, no creative decisions. Subordinate
> to the [World Bible](NESTUDIO_WORLD_BIBLE.md); the tests applied are [ICON_TESTS.md](ICON_TESTS.md); the
> loop is [EXPERIMENT_WORKFLOW.md](EXPERIMENT_WORKFLOW.md). The boards make judging *easy and consistent*;
> the **human** does the judging.

---

## The review instruments (HTML, data-driven from the manifest)

All boards read `public/test-photos/icon-lab/manifest.json` and show an empty state until M31. Append
`?demo=1` to any board to preview its controls with placeholder specimens.

| Board | File | Purpose |
|---|---|---|
| **Review board** | `icon-review-board.html` | the main instrument — compare 2–5 · zoom · hide labels · silhouette · night mode · weather preview · **emoji / favicon / small-app-icon previews** · print |
| **Comparison board** | `icon-comparison-board.html` | 2–4 finalists side by side at equal size for direct emotional A/B |
| **Silhouette board** | `icon-silhouette-board.html` | every candidate filled solid black — the gate |
| **Weather board** | `icon-weather-board.html` | one candidate across clear · rain · snow · sunset · night (Round 4) |
| **Memory board** | `icon-memory-board.html` | show → hide → draw from memory → reveal → compare (the Five-Year-Memory test, staged) |

These cover the board types the search needs — **Round · Comparison · Silhouette · Memory · Weather ·
Iteration** (the review board's compare + previews serve the round and iteration views). All are exportable
HTML (open in any browser; use the review board's **Print** for a physical board).

## Review capabilities (Part 3)

The review board provides, without ever making a decision:
- **Compare 2–5** candidates at once.
- **Zoom** — inspect form and edges.
- **Hide labels** — judge the image blind, free of names/metadata bias.
- **Silhouette toggle** — collapse to pure black (the gate).
- **Night mode** — judge the Warm Window in the dark (the icon's best hour).
- **Weather preview** — rain / snow / sunset / fog behind the candidate.
- **Scale previews** — the same image at **emoji**, **favicon**, and **small-app-icon** sizes (does it
  survive being tiny? — the Reduction round).
- **Print board** — export a physical review sheet.

## How review is run

1. Load the current round's candidates (the boards auto-populate from the manifest).
2. The **human creative director** applies the [ICON_TESTS](ICON_TESTS.md) battery + the round's one question
   ([ICON_LAB.md](ICON_LAB.md) tournament).
3. Decisions are **entered through the harness**, not the boards (`set-status …`), so every verdict lands in
   the database with its reason.
4. Claude records the outcome in [EXPERIMENT_HISTORY.md](EXPERIMENT_HISTORY.md).

> **The boards never decide.** They remove friction and bias so the human's taste can be applied *ruthlessly
> and consistently* — which is the whole point of the lab.
