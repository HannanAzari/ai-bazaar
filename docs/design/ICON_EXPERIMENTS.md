<!-- Governed by NESTUDIO_WORLD_BIBLE.md. The DNA is LOCKED (M23–M29); this is infrastructure. -->
# 🧫 Icon Experiments — the pipeline & database

> The **generation pipeline** and the **experiment database** for the Icon Lab. Subordinate to the
> [World Bible](NESTUDIO_WORLD_BIBLE.md); it runs the search defined in [ICON_LAB.md](ICON_LAB.md) using the
> [ICON_TESTS.md](ICON_TESTS.md) battery. **Infrastructure, not philosophy** — nothing here invents design;
> it records it.
>
> **Division of responsibilities (permanent, from M31):** **GPT creates · Human judges · Claude records.**
> Prompts are authored by GPT / the human creative director — *never* embedded in this repo.

---

## Part 1 — The icon generation pipeline

Tool: [`scripts/icon-lab.mjs`](../../scripts/icon-lab.mjs). Lab tooling, not production app code. It manages
the experiment database and the candidate lifecycle; it authors no creative prompts and — in M30 —
**generates nothing** (generation is hard-gated off; wired on in M31).

**Engines** (preferred → fallback): **`gpt-image`** (OpenAI Images, `OPENAI_API_KEY`) → **`gemini`** (the
existing local route). The harness tries the preferred engine and falls back automatically.

**What the pipeline tracks:** engine, **prompt-version** (`icon@N`, keyed into `promptVersions`), generation
number, iteration history (parent → child), and per-candidate experiment metadata.

### Every candidate record carries
| Field | Meaning |
|---|---|
| **ID** | `exp-<round>-<nnn>-c<gen>` |
| **Generation** | which iteration within its experiment |
| **Date** | ISO date created |
| **Prompt Version** | `icon@N` (the exact prompt that made it — reproducibility) |
| **Engine** | `gpt-image` \| `gemini` (the engine that actually produced it) |
| **Notes** | free notes |
| **Status** | `candidate` → `shortlisted` → `approved` · or `rejected` → `archived` |

**Status values:** `Candidate · Shortlisted · Approved · Rejected · Archived`.
**Never delete a rejected idea** — it moves to `archived` (image + frozen record → `/archive`). See
[EXPERIMENT_HISTORY.md](EXPERIMENT_HISTORY.md).

## Part 2 — The experiment database

State of record: `public/test-photos/icon-lab/manifest.json` (schema documented inline as
`_experimentSchema`). Archive: `public/test-photos/icon-lab/archive/`.

**Each experiment** captures the permanent learning of one hypothesis:

| Field | Meaning |
|---|---|
| **Round** | R1–R5 of the [tournament](ICON_LAB.md) |
| **Hypothesis** | the one thing being tested |
| **Emotion** | the single dominant feeling targeted |
| **Engine** | which engine the round used |
| **Prompt** | the prompt version (text authored by GPT/human, referenced by version) |
| **Image** | the candidate(s) produced |
| **Critique** | the human creative director's judgement |
| **Decision** | `advance` \| `improve` \| `cut` |
| **Next Action** | what to try next |

Every experiment becomes **permanent learning material** — the database is append-only in spirit; records are
updated (status, critique) but never removed.

### Harness commands (M31 usage)
```
node scripts/icon-lab.mjs new-experiment <round> "<hypothesis>" "<emotion>" [engine]
node scripts/icon-lab.mjs add-prompt <icon@N> <engine> "<why this version>"
node scripts/icon-lab.mjs generate <expId> --engine gpt-image --prompt-version icon@N --prompt-file <f> --run
node scripts/icon-lab.mjs set-status <candidateId> <status> --why "..." --rule "..." --emotion "..."
node scripts/icon-lab.mjs list
```
In M30, `generate` refuses (laboratory build only). See [EXPERIMENT_WORKFLOW.md](EXPERIMENT_WORKFLOW.md) for
the loop and [REVIEW_PROCESS.md](REVIEW_PROCESS.md) for the boards.
