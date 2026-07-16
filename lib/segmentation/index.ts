/**
 * lib/segmentation — public surface. Callers use getSegmenter(); they never know
 * whether the on-device model or the local flood fallback produced the mask.
 */

import type { Segmenter } from "./types";
import { mediapipeSegmenter } from "./mediapipe";
import { floodSegmenter } from "./flood";

export * from "./types";
export { maskToCutout, maskToFrame, sourceToCanvas, maskBBox, maskArea } from "./mask-utils";

let resolved: Segmenter | null = null;
let initPromise: Promise<Segmenter> | null = null;

/**
 * Resolve the best available segmenter: the on-device model if it loads, else the
 * always-available local fallback. Cached; init is attempted once.
 */
export function getSegmenter(): Promise<Segmenter> {
  if (resolved) return Promise.resolve(resolved);
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await mediapipeSegmenter.init();
    resolved = mediapipeSegmenter.ready() ? mediapipeSegmenter : floodSegmenter;
    return resolved;
  })();
  return initPromise;
}

/** The local fallback, for callers that want to force it (e.g. after a model miss). */
export { floodSegmenter } from "./flood";
