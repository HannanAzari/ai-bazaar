/**
 * lib/segmentation/mask-utils.ts — pure mask math + canvas application.
 * The pure helpers are unit-tested; the canvas ones run in the browser.
 */

import type { RasterImage } from "@/lib/ai/types";
import { makeCanvas, toRaster, loadImage, featherAlpha, despeckle, trimTransparent } from "@/lib/ai/canvas";
import type { SegMask, BBox } from "./types";

/* ── Pure ─────────────────────────────────────────────────────────────────────── */

export function maskArea(mask: SegMask): number {
  let n = 0;
  const d = mask.data;
  for (let i = 0; i < d.length; i++) if (d[i] > 127) n++;
  return n;
}

export function maskBBox(mask: SegMask): BBox | null {
  const { width: w, height: h, data } = mask;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[y * w + x] > 127) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Intersection-over-union of two equal-sized masks. */
export function iou(a: SegMask, b: SegMask): number {
  if (a.width !== b.width || a.height !== b.height) return 0;
  let inter = 0, uni = 0;
  for (let i = 0; i < a.data.length; i++) {
    const ai = a.data[i] > 127, bi = b.data[i] > 127;
    if (ai || bi) uni++;
    if (ai && bi) inter++;
  }
  return uni === 0 ? 0 : inter / uni;
}

/** Fraction of the mask's foreground pixels that lie on the image border — a high
 *  value means the "object" is really the background. */
export function borderFraction(mask: SegMask): number {
  const { width: w, height: h, data } = mask;
  let border = 0, total = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[y * w + x] > 127) {
        total++;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border++;
      }
    }
  }
  return total === 0 ? 1 : border / total;
}

/** Nearest-neighbour rescale of a mask to new dims. */
export function scaleMaskNearest(mask: SegMask, w: number, h: number): SegMask {
  if (mask.width === w && mask.height === h) return mask;
  const out = new Uint8ClampedArray(w * h);
  const sx = mask.width / w, sy = mask.height / h;
  for (let y = 0; y < h; y++) {
    const my = Math.min(mask.height - 1, Math.floor(y * sy));
    for (let x = 0; x < w; x++) {
      const mx = Math.min(mask.width - 1, Math.floor(x * sx));
      out[y * w + x] = mask.data[my * mask.width + mx];
    }
  }
  return { width: w, height: h, data: out };
}

/** Is a normalized point inside the mask? */
export function pointInMask(mask: SegMask, nx: number, ny: number): boolean {
  const x = Math.min(mask.width - 1, Math.max(0, Math.round(nx * mask.width)));
  const y = Math.min(mask.height - 1, Math.max(0, Math.round(ny * mask.height)));
  return mask.data[y * mask.width + x] > 127;
}

/* ── Canvas (browser) ─────────────────────────────────────────────────────────── */

/** Draw a source image into a canvas at a working resolution. */
export async function sourceToCanvas(dataUrl: string, maxDim = 1400): Promise<HTMLCanvasElement> {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const c = makeCanvas(w, h);
  c.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return c;
}

/** Mask the source at full frame (no trim) — RGBA where mask>127, else transparent.
 *  Used for the aligned selection overlay and to seed the edge editor. */
async function maskToFrameCanvas(source: HTMLCanvasElement, mask: SegMask): Promise<HTMLCanvasElement> {
  const w = source.width, h = source.height;
  const scaled = scaleMaskNearest(mask, w, h);
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;
  for (let i = 0; i < scaled.data.length; i++) {
    px[i * 4 + 3] = scaled.data[i] > 127 ? px[i * 4 + 3] : 0;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Full-frame masked PNG (feathered, NOT trimmed) — aligns with the original. */
export async function maskToFrame(source: HTMLCanvasElement, mask: SegMask): Promise<RasterImage> {
  const canvas = await maskToFrameCanvas(source, mask);
  return featherAlpha(toRaster(canvas));
}

/** Apply a mask to the source canvas → a clean, feathered, trimmed transparent PNG. */
export async function maskToCutout(source: HTMLCanvasElement, mask: SegMask): Promise<RasterImage> {
  const canvas = await maskToFrameCanvas(source, mask);
  const feathered = await featherAlpha(toRaster(canvas));
  const cleaned = await despeckle(feathered);
  return trimTransparent(cleaned);
}
