<!-- Governed by NESTUDIO_WORLD_BIBLE.md. The DNA is LOCKED (M23–M29); this is process. -->
# 🔁 Experiment Workflow

> How the Icon Lab is *run*, from M31 onward. Subordinate to the [World Bible](NESTUDIO_WORLD_BIBLE.md);
> uses the pipeline in [ICON_EXPERIMENTS.md](ICON_EXPERIMENTS.md), the boards in
> [REVIEW_PROCESS.md](REVIEW_PROCESS.md), and the log in [EXPERIMENT_HISTORY.md](EXPERIMENT_HISTORY.md).

---

## The division of responsibilities (permanent)

> **GPT creates · Human judges · Claude records.**

- **GPT** authors prompts and generates candidates (the creator).
- **The human creative director** judges with ruthless, consistent taste (the only one who chooses).
- **Claude** runs the harness, keeps the database honest, builds the boards, and writes the history (the
  recorder). Claude makes **no creative decisions.**

## The loop

```
Hypothesis
   ↓
Generate 5
   ↓
Review
   ↓
Destroy 4
   ↓
Improve 1
   ↓
Repeat
```

**Rules of the loop:**
- **Never generate 30 at once.** Generate **five**, judge, cut to one, improve, repeat. Breadth kills focus;
  the search advances one honest step at a time.
- **Never keep mediocre ideas.** "Fine" is a failure. Each round keeps only the *one* candidate that most
  advanced the target emotion; the other four are archived with their reasons.
- **One variable per improvement.** The surviving candidate is iterated by changing one thing (the discipline
  that made M23–M25 hold). The prompt version bumps `icon@N → icon@N+1`.
- **Judge emotion, never beauty.** A rougher candidate that stirs longing beats a polished one that doesn't.
- **Every cut is recorded**, never deleted ([EXPERIMENT_HISTORY.md](EXPERIMENT_HISTORY.md)).

## A round, step by step

1. **Frame the hypothesis** — `new-experiment R<n> "<hypothesis>" "<emotion>"`. One testable claim.
2. **GPT authors the prompt** — registered as `icon@N` (`add-prompt`); text lives with GPT/human, referenced
   by version.
3. **Generate 5** — `generate … --run` (M31), preferred engine `gpt-image`, fallback `gemini`.
4. **Review** — open the boards ([REVIEW_PROCESS.md](REVIEW_PROCESS.md)); the human judges against the
   [ICON_TESTS](ICON_TESTS.md) battery and the round's question.
5. **Destroy 4** — `set-status … rejected --why … --rule …` then `archived`. Keep the one.
6. **Improve 1** — GPT bumps the prompt; generate the next 5 from the survivor's direction.
7. **Record** — Claude writes what survived, what died, which rule broke, which emotion improved.

## The closing question (every session ends here)

> **"Did we create something people will remember, or just something that looks nice?"**

This question is logged at the end of every experiment session in
[EXPERIMENT_HISTORY.md](EXPERIMENT_HISTORY.md). If the honest answer is "just nice," the session did not
advance the icon — and that, too, is recorded as learning. Nestudio is now designed by **taste, not text**:
an identity that emerges from many prototypes judged with ruthless consistency, exactly as Apple's did.
