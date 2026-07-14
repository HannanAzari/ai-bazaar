/**
 * lib/ai/canvas.ts — browser image primitives for the pipeline + stub provider.
 * -----------------------------------------------------------------------------
 * These are the only DOM-touching helpers in lib/ai. They run in the browser
 * (Studio is a client page). Every function guards the environment so importing
 * this module on the server (engine, API route) never touches `document`; the DOM
 * is only reached when a function is actually called client-side. A server-side
 * real provider would swap these for a headless image lib — the pipeline contract
 * is unchanged.
 */

import type { RasterImage } from "./types";

function assertBrowser(): void {
  if (typeof document === "undefined") {
    throw new Error("lib/ai/canvas requires a browser; use a server image provider off the client.");
  }
}

export function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  assertBrowser();
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode image"));
    img.src = dataUrl;
  });
}

export function makeCanvas(width: number, height: number): HTMLCanvasElement {
  assertBrowser();
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  return c;
}

export function toRaster(canvas: HTMLCanvasElement, type = "image/png", quality?: number): RasterImage {
  return { width: canvas.width, height: canvas.height, dataUrl: canvas.toDataURL(type, quality) };
}

/** Decode a data URL into a RasterImage (measures real dimensions). */
export async function rasterFromDataUrl(dataUrl: string): Promise<RasterImage> {
  const img = await loadImage(dataUrl);
  const c = makeCanvas(img.naturalWidth || img.width, img.naturalHeight || img.height);
  c.getContext("2d")!.drawImage(img, 0, 0);
  return toRaster(c);
}

/** Scale down to fit within maxDim on the long edge, preserving aspect and the
 *  original edges (no padding) — so background detection still sees real corners. */
export async function resizeMax(src: RasterImage, maxDim: number): Promise<RasterImage> {
  const scale = Math.min(1, maxDim / Math.max(src.width, src.height));
  if (scale >= 1) return src;
  const img = await loadImage(src.dataUrl);
  const c = makeCanvas(src.width * scale, src.height * scale);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return toRaster(c);
}

/** Draw `src` scaled to *contain* within size×size, centered, on transparency. */
export async function containSquare(src: RasterImage, size: number): Promise<RasterImage> {
  const img = await loadImage(src.dataUrl);
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d")!;
  const scale = Math.min(size / src.width, size / src.height);
  const w = src.width * scale;
  const h = src.height * scale;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  return toRaster(c);
}

/** Knock out a near-uniform background to transparency by sampling the corners. */
export async function knockoutBackground(src: RasterImage, tolerance = 26): Promise<RasterImage> {
  const img = await loadImage(src.dataUrl);
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const p = data.data;
  const corners = [
    [0, 0],
    [c.width - 1, 0],
    [0, c.height - 1],
    [c.width - 1, c.height - 1],
  ].map(([x, y]) => {
    const i = (y * c.width + x) * 4;
    return [p[i], p[i + 1], p[i + 2]];
  });
  const bg = [0, 1, 2].map((k) => corners.reduce((s, cn) => s + cn[k], 0) / corners.length);
  for (let i = 0; i < p.length; i += 4) {
    const d = Math.abs(p[i] - bg[0]) + Math.abs(p[i + 1] - bg[1]) + Math.abs(p[i + 2] - bg[2]);
    if (d <= tolerance * 3) p[i + 3] = 0;
  }
  ctx.putImageData(data, 0, 0);
  return toRaster(c);
}

/** Crop to the bounding box of non-transparent pixels. */
export async function trimTransparent(src: RasterImage): Promise<RasterImage> {
  const img = await loadImage(src.dataUrl);
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  let minX = c.width, minY = c.height, maxX = 0, maxY = 0, found = false;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 8) {
        found = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!found) return src;
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const out = makeCanvas(w, h);
  out.getContext("2d")!.drawImage(c, minX, minY, w, h, 0, 0, w, h);
  return toRaster(out);
}

/** Center `src` on a size×size transparent square with `padding` fraction margin. */
export async function padSquare(src: RasterImage, size: number, padding: number): Promise<RasterImage> {
  const img = await loadImage(src.dataUrl);
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d")!;
  const inner = size * (1 - Math.min(0.45, Math.max(0, padding)) * 2);
  const scale = Math.min(inner / src.width, inner / src.height);
  const w = src.width * scale;
  const h = src.height * scale;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  return toRaster(c);
}

/**
 * Apply a cozy "Nestudio-ish" look: gently posterize colours, warm the midtones,
 * and lift saturation — a deterministic, dependency-free stand-in for a real
 * stylization model. Preserves the alpha channel.
 */
export async function stylizeCozy(src: RasterImage, levels = 6): Promise<RasterImage> {
  const img = await loadImage(src.dataUrl);
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const p = data.data;
  const step = 255 / (levels - 1);
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] === 0) continue;
    // posterize
    let r = Math.round(Math.round(p[i] / step) * step);
    let g = Math.round(Math.round(p[i + 1] / step) * step);
    let b = Math.round(Math.round(p[i + 2] / step) * step);
    // warm + saturate around the mean
    const mean = (r + g + b) / 3;
    r = clampByte(mean + (r - mean) * 1.12 + 8);
    g = clampByte(mean + (g - mean) * 1.08 + 2);
    b = clampByte(mean + (b - mean) * 1.05 - 6);
    p[i] = r;
    p[i + 1] = g;
    p[i + 2] = b;
  }
  ctx.putImageData(data, 0, 0);
  return toRaster(c);
}

/** Upscale by a factor with smoothing. */
export async function upscaleSmooth(src: RasterImage, factor: number): Promise<RasterImage> {
  const img = await loadImage(src.dataUrl);
  const f = Math.max(1, factor);
  const c = makeCanvas(src.width * f, src.height * f);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return toRaster(c);
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}
