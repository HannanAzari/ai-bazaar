// Sequential Style Lab generation runner (V3.2 rate-limit fix). Pure async
// orchestration — no React, no fetch — so it is fully unit-testable. Generates
// variations ONE AT A TIME (never in parallel), waits `delayMs` between provider
// calls to respect Replicate's rate limit (~6 req/min, burst 1), reports progress,
// and PRESERVES PARTIAL SUCCESSES (a later failure never discards earlier images).

export type OneResult = { ok: true; url: string } | { ok: false; error: string };

export type StyleBatchDeps = {
  /** Generate a single image for variation `index`. Called sequentially. */
  generateOne: (index: number) => Promise<OneResult>;
  /** Delay between calls in ms (skipped after the last call). */
  delayMs: number;
  /** Injectable sleep (tests pass a no-op recorder). */
  sleep?: (ms: number) => Promise<void>;
  /** Progress callback: (completed, total). */
  onProgress?: (completed: number, total: number) => void;
};

export type StyleBatchResult = {
  urls: string[];
  errors: { index: number; error: string }[];
};

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Run `total` single-image generations sequentially. Returns the URLs that
 * succeeded (in order) plus per-index errors. Order is guaranteed: call N+1 never
 * starts before call N resolves, and a `delayMs` pause sits between consecutive
 * calls (not before the first, not after the last).
 */
export async function runStyleBatch(total: number, deps: StyleBatchDeps): Promise<StyleBatchResult> {
  const sleep = deps.sleep ?? defaultSleep;
  const urls: string[] = [];
  const errors: { index: number; error: string }[] = [];

  for (let i = 0; i < total; i += 1) {
    deps.onProgress?.(i + 1, total);
    const result = await deps.generateOne(i);
    if (result.ok) urls.push(result.url);
    else errors.push({ index: i, error: result.error });

    if (i < total - 1 && deps.delayMs > 0) {
      await sleep(deps.delayMs);
    }
  }

  return { urls, errors };
}

/** Summarize a batch into a single user-facing line (or "" when fully successful). */
export function summarizeBatchErrors(total: number, result: StyleBatchResult): string {
  if (result.errors.length === 0) return "";
  const first = result.errors[0].error;
  return `${result.errors.length}/${total} failed — ${first}`;
}
