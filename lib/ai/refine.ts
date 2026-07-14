/**
 * lib/ai/refine.ts — iterative generation: generate → score → improve → repeat.
 * -----------------------------------------------------------------------------
 * "Never accept the first generation." `improvePrompt` turns a QualityReport into
 * a corrected prompt (stronger directives for whatever failed), and
 * `generateWithRefinement` runs the generate → score → improve → regenerate →
 * keep-best loop. Both are generic over the image type and take injected
 * generate/score functions, so they're unit-tested without a canvas and the
 * engine wires the real ones. Designed for N passes; M21 defaults to 1.
 */

import type { AssembledPrompt } from "./types";
import type { QualityReport } from "./quality";

/** Rewrite a prompt to correct the issues a report found. Pure + deterministic. */
export function improvePrompt(prompt: AssembledPrompt, report: QualityReport): AssembledPrompt {
  const corrections: string[] = [];
  const negatives: string[] = [];
  for (const issue of report.issues) {
    switch (issue.code) {
      case "transparent_bg":
        corrections.push("on a 100% transparent background with no backdrop whatsoever");
        negatives.push("background", "backdrop", "floor", "surface");
        break;
      case "clipped":
      case "padding":
        corrections.push("the whole object fully visible inside the frame with generous, even margins on all sides");
        break;
      case "off_center":
        corrections.push("the object perfectly centered in the frame");
        break;
      case "too_small":
      case "underfilled":
        corrections.push("the object large and filling most of the frame");
        break;
      case "overfilled":
        corrections.push("comfortable margins around the object");
        break;
      case "resolution":
        corrections.push("crisp, high-resolution, sharp detail");
        break;
      default:
        break;
    }
  }
  const pass = Number(prompt.params.refinePass ?? 0) + 1;
  if (!corrections.length) return { ...prompt, params: { ...prompt.params, refinePass: pass } };
  return {
    ...prompt,
    positive: `${prompt.positive}. Correction: ${dedupe(corrections).join("; ")}`,
    negative: dedupe([...prompt.negative.split(", ").filter(Boolean), ...negatives]).join(", "),
    params: { ...prompt.params, refinePass: pass },
  };
}

export type RefinementAttempt<T> = { pass: number; image: T; report: QualityReport; prompt: AssembledPrompt };
export type RefinementResult<T> = { best: RefinementAttempt<T>; attempts: RefinementAttempt<T>[] };

/**
 * Run generate → score → (improve → regenerate) up to `passes` extra times,
 * keeping the highest-scoring candidate. Stops early once a candidate passes.
 */
export async function generateWithRefinement<T>(opts: {
  initialPrompt: AssembledPrompt;
  passes: number;
  generate: (prompt: AssembledPrompt) => Promise<T>;
  score: (image: T, prompt: AssembledPrompt) => Promise<QualityReport>;
  improve?: (prompt: AssembledPrompt, report: QualityReport) => AssembledPrompt;
}): Promise<RefinementResult<T>> {
  const improve = opts.improve ?? improvePrompt;
  const attempts: RefinementAttempt<T>[] = [];

  let prompt = opts.initialPrompt;
  for (let pass = 0; pass <= Math.max(0, opts.passes); pass++) {
    const image = await opts.generate(prompt);
    const report = await opts.score(image, prompt);
    attempts.push({ pass, image, report, prompt });
    if (report.ok) break; // good enough — stop early
    if (pass < opts.passes) prompt = improve(prompt, report);
  }

  const best = attempts.reduce((a, b) => (b.report.score > a.report.score ? b : a), attempts[0]);
  return { best, attempts };
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));
}
