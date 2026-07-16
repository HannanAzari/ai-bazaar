/**
 * lib/segmentation/types.ts — Stage 1 (photo → object) reimagined as real,
 * on-device SEGMENTATION, not manual erasing and not an AI prompt.
 *
 * The Segmenter interface is provider-abstracted (like lib/asset-pipeline): a real
 * model (MediaPipe Interactive Segmenter, on-device WASM) is the primary backend; a
 * classical flood/region-grow segmenter is the always-available fallback so the
 * experience can NEVER fail and always runs locally (no server roundtrip).
 *
 * PURE TYPES — no DOM, no SDK.
 */

/** A single-channel alpha mask, one byte per pixel (0 = out, 255 = in). */
export type SegMask = { width: number; height: number; data: Uint8ClampedArray };

export type BBox = { x: number; y: number; w: number; h: number };

/** One detected object: its mask + geometry, for outlining + tap hit-testing. */
export type DetectedObject = { id: string; mask: SegMask; bbox: BBox; area: number };

/** Normalized point in [0,1]×[0,1] (origin top-left). */
export type NormPoint = { x: number; y: number };

export interface Segmenter {
  id: string;
  /** Human label ("On-device model" / "Local"). */
  label: string;
  /** Ready after init(); false means fall back. */
  ready(): boolean;
  /** Load the model / warm up. Resolves even on failure (ready() then false). */
  init(): Promise<void>;
  /** Segment the object under a normalized point. */
  segmentAtPoint(source: HTMLCanvasElement, p: NormPoint): Promise<SegMask>;
  /** Best-effort multi-object scan (seed points) → distinct objects, largest first. */
  detect(source: HTMLCanvasElement): Promise<DetectedObject[]>;
}
