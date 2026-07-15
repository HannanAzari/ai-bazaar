/**
 * lib/cutout.ts — Stage 1 of the Nestudio Asset Pipeline: PHOTO → CUTOUT.
 * -----------------------------------------------------------------------------
 * This is a MASKING problem, deliberately kept SEPARATE from generation (Stage 2,
 * lib/asset-pipeline). The goal is a Telegram-grade experience: fast, simple,
 * forgiving. Auto-cutout gets you 90% there; a manual brush lets the user ERASE a
 * mistake or RESTORE something the auto-cut ate. Never overcomplicated.
 *
 * The heavy lifting is Canvas (browser only) and reuses the proven ops in
 * lib/ai/canvas.ts. The pure geometry helpers below are unit-tested; the canvas
 * functions run in the browser (the CutoutEditor component drives them).
 *
 * NEVER confuse a cutout with a Nestudio asset. A cutout is an intermediate — the
 * clean input Stage 2 reinterprets. We never ship a cutout as an asset.
 */

import type { RasterImage } from "@/lib/ai/types";
import {
  rasterFromDataUrl,
  resizeMax,
  floodFillBackground,
  knockoutBackground,
  featherAlpha,
  despeckle,
  trimTransparent,
  loadImage,
  makeCanvas,
  toRaster,
} from "@/lib/ai/canvas";

/* ── Config ──────────────────────────────────────────────────────────────────── */

export type CutoutMode = "corner" | "chroma";

export const CUTOUT_DEFAULTS = {
  /** Downscale huge phone photos before masking (perf + consistent brush feel). */
  maxDim: 1400,
  /** Background-detection tolerance (0–255). Higher = more aggressive removal. */
  tolerance: 32,
  /** Brush radius bounds, in source pixels. */
  minBrush: 6,
  maxBrush: 160,
  /** Spacing between stamped dabs along a drag, as a fraction of the radius. */
  stampSpacing: 0.35,
} as const;

export type CutoutBrush = "erase" | "restore";

/* ── Pure helpers (unit-tested; no DOM) ──────────────────────────────────────── */

export type Pt = { x: number; y: number };

/** Interpolate evenly spaced points from `a`→`b` so a fast drag paints a smooth
 *  line instead of dotted stamps. `spacing` is in pixels (≥ 1). Always includes the
 *  end point; includes the start only as the first step. */
export function pointsAlongStroke(a: Pt, b: Pt, spacing: number): Pt[] {
  const step = Math.max(1, spacing);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const n = Math.max(1, Math.round(dist / step));
  const out: Pt[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    out.push({ x: a.x + dx * t, y: a.y + dy * t });
  }
  return out;
}

/** Clamp a requested brush radius to the allowed range. */
export function clampBrush(radius: number): number {
  return Math.min(CUTOUT_DEFAULTS.maxBrush, Math.max(CUTOUT_DEFAULTS.minBrush, Math.round(radius)));
}

/** Map a display-canvas point to source-image pixels given the rendered rect.
 *  (The image is drawn `object-contain` inside the canvas; this inverts that.) */
export function displayToSource(
  point: Pt,
  view: { width: number; height: number },
  source: { width: number; height: number },
): Pt {
  const scale = Math.min(view.width / source.width, view.height / source.height);
  const drawnW = source.width * scale;
  const drawnH = source.height * scale;
  const offX = (view.width - drawnW) / 2;
  const offY = (view.height - drawnH) / 2;
  return { x: (point.x - offX) / scale, y: (point.y - offY) / scale };
}

/* ── Canvas ops (browser only) ───────────────────────────────────────────────── */

/**
 * Auto-cutout: normalize size → knock out the background → feather the edge →
 * despeckle → trim to the subject. Returns a transparent PNG raster + the resized
 * ORIGINAL (opaque), which the manual "restore" brush paints back from.
 */
export async function autoCutout(
  dataUrl: string,
  opts: { maxDim?: number; tolerance?: number; mode?: CutoutMode } = {},
): Promise<{ cutout: RasterImage; original: RasterImage }> {
  const raw = await rasterFromDataUrl(dataUrl);
  const original = await resizeMax(raw, opts.maxDim ?? CUTOUT_DEFAULTS.maxDim);
  const tol = opts.tolerance ?? CUTOUT_DEFAULTS.tolerance;
  // corner flood-fill handles most phone photos (uniform-ish background); chroma
  // knockout is the fallback for busy edges. Both feather + despeckle after.
  const knocked = opts.mode === "chroma" ? await knockoutBackground(original, tol) : await floodFillBackground(original, tol);
  const feathered = await featherAlpha(knocked);
  const clean = await despeckle(feathered);
  const cutout = await trimTransparent(clean);
  return { cutout, original };
}

/**
 * Composite a user-edited alpha mask onto the ORIGINAL to produce the final cutout.
 * `maskCanvas` is a full-resolution canvas where painted (opaque) pixels mean
 * "keep" and transparent means "drop" — the CutoutEditor maintains it as the user
 * erases/restores. We multiply the original's RGB by the mask's alpha.
 */
export async function compositeMask(original: RasterImage, maskCanvas: HTMLCanvasElement): Promise<RasterImage> {
  const img = await loadImage(original.dataUrl);
  const canvas = makeCanvas(original.width, original.height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, original.width, original.height);
  // keep only where the mask is opaque
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(maskCanvas, 0, 0, original.width, original.height);
  ctx.globalCompositeOperation = "source-over";
  const feathered = await featherAlpha(toRaster(canvas));
  return trimTransparent(feathered);
}
