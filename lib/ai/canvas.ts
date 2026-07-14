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

/* ────────────────────────────────────────────────────────────────────────── */
/* M21 — premium processing (the quality lever)                                */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Remove ONLY the connected background: a flood fill from the four edges knocks
 * out pixels reachable from the border and within `tolerance` of the sampled
 * border colour — so a white mug interior or a similarly-coloured object region
 * is NOT eaten. Far more reliable than a global colour threshold.
 */
export async function floodFillBackground(src: RasterImage, tolerance = 32): Promise<RasterImage> {
  const img = await loadImage(src.dataUrl);
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const w = c.width, h = c.height;
  const image = ctx.getImageData(0, 0, w, h);
  const p = image.data;
  // Average the border as the background colour.
  let br = 0, bg = 0, bb = 0, n = 0;
  const sample = (x: number, y: number) => { const i = (y * w + x) * 4; br += p[i]; bg += p[i + 1]; bb += p[i + 2]; n++; };
  for (let x = 0; x < w; x++) { sample(x, 0); sample(x, h - 1); }
  for (let y = 0; y < h; y++) { sample(0, y); sample(w - 1, y); }
  br /= n; bg /= n; bb /= n;
  const tol = tolerance * 3;
  const near = (i: number) => Math.abs(p[i] - br) + Math.abs(p[i + 1] - bg) + Math.abs(p[i + 2] - bb) <= tol;
  const visited = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (visited[idx]) return;
    if (!near(idx * 4)) return;
    visited[idx] = 1;
    stack.push(idx);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const idx = stack.pop()!;
    const x = idx % w, y = (idx / w) | 0;
    p[idx * 4 + 3] = 0; // transparent
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  ctx.putImageData(image, 0, 0);
  return toRaster(c);
}

/** Soften the alpha edge (anti-halo): erode one pixel of the mask and blur the
 *  alpha slightly so cut-outs don't have a hard fringe of leftover background. */
export async function featherAlpha(src: RasterImage): Promise<RasterImage> {
  const img = await loadImage(src.dataUrl);
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const w = c.width, h = c.height;
  const im = ctx.getImageData(0, 0, w, h);
  const a0 = new Uint8ClampedArray(im.data.length / 4);
  for (let i = 0; i < a0.length; i++) a0[i] = im.data[i * 4 + 3];
  const out = new Uint8ClampedArray(a0.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      // 3×3 min-then-blur: erode fringe, then average for a soft edge.
      let min = 255, sum = 0, cnt = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const a = a0[ny * w + nx];
          if (a < min) min = a;
          sum += a; cnt++;
        }
      }
      out[i] = Math.round(Math.min(min + 40, sum / cnt));
    }
  }
  for (let i = 0; i < out.length; i++) im.data[i * 4 + 3] = out[i];
  ctx.putImageData(im, 0, 0);
  return toRaster(c);
}

/** Remove tiny isolated opaque specks left after cut-out. */
export async function despeckle(src: RasterImage): Promise<RasterImage> {
  const img = await loadImage(src.dataUrl);
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const w = c.width, h = c.height;
  const im = ctx.getImageData(0, 0, w, h);
  const p = im.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (p[i * 4 + 3] < 20) continue;
      let neighbours = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (p[(ny * w + nx) * 4 + 3] > 20) neighbours++;
        }
      }
      if (neighbours <= 1) p[i * 4 + 3] = 0;
    }
  }
  ctx.putImageData(im, 0, 0);
  return toRaster(c);
}

/** Relight toward the Nestudio law: a warm key from the upper-left, a soft cool
 *  falloff to the lower-right, and gentle edge ambient occlusion — applied only
 *  inside the object mask, so it reads as soft form shading. */
export async function relight(src: RasterImage, strength = 0.22): Promise<RasterImage> {
  const img = await loadImage(src.dataUrl);
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const w = c.width, h = c.height;
  const im = ctx.getImageData(0, 0, w, h);
  const p = im.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (p[i + 3] === 0) continue;
      const u = x / w, v = y / h;
      // key: bright top-left → dim bottom-right.
      const key = 1 + strength * (0.5 - (u + v) / 2) * 2;
      // ambient occlusion: darken pixels touching transparency.
      let edge = 1;
      if (
        (x > 0 && p[(y * w + x - 1) * 4 + 3] === 0) ||
        (x < w - 1 && p[(y * w + x + 1) * 4 + 3] === 0) ||
        (y > 0 && p[((y - 1) * w + x) * 4 + 3] === 0) ||
        (y < h - 1 && p[((y + 1) * w + x) * 4 + 3] === 0)
      ) edge = 0.86;
      const warm = key >= 1 ? key : 1;
      const f = key * edge;
      p[i] = clampByte(p[i] * f * (warm > 1 ? 1.02 : 1) + (key > 1 ? 6 : 0));
      p[i + 1] = clampByte(p[i + 1] * f);
      p[i + 2] = clampByte(p[i + 2] * f * (key < 1 ? 1.02 : 0.98));
    }
  }
  ctx.putImageData(im, 0, 0);
  return toRaster(c);
}

/** Matte grade: ease off saturation, warm the midtones, lift the deepest blacks
 *  so nothing reads glossy or harsh — the premium matte look. */
export async function matteGrade(src: RasterImage): Promise<RasterImage> {
  const img = await loadImage(src.dataUrl);
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const im = ctx.getImageData(0, 0, c.width, c.height);
  const p = im.data;
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] === 0) continue;
    const mean = (p[i] + p[i + 1] + p[i + 2]) / 3;
    // desaturate ~12% toward the mean
    let r = mean + (p[i] - mean) * 0.88;
    let g = mean + (p[i + 1] - mean) * 0.88;
    let b = mean + (p[i + 2] - mean) * 0.88;
    // warm + lift blacks
    r = 12 + r * 0.95 + 6;
    g = 10 + g * 0.95;
    b = 8 + b * 0.95 - 4;
    p[i] = clampByte(r); p[i + 1] = clampByte(g); p[i + 2] = clampByte(b);
  }
  ctx.putImageData(im, 0, 0);
  return toRaster(c);
}

/** Composite a soft, grounded contact shadow directly beneath the object (never
 *  floating) and return the object on top. Keeps the rest transparent. */
export async function addContactShadow(src: RasterImage): Promise<RasterImage> {
  const stats = await alphaStats(src);
  const img = await loadImage(src.dataUrl);
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext("2d")!;
  if (stats.coverage > 0) {
    const cx = (stats.bbox.minX + stats.bbox.maxX) / 2;
    const baseY = stats.bbox.maxY;
    const rx = (stats.bbox.maxX - stats.bbox.minX) * 0.5;
    ctx.save();
    ctx.filter = "blur(6px)";
    ctx.fillStyle = "rgba(40,28,18,0.28)";
    ctx.beginPath();
    ctx.ellipse(cx, baseY - rx * 0.06, rx * 0.92, Math.max(6, rx * 0.16), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.drawImage(img, 0, 0);
  return toRaster(c);
}

export type AlphaStats = {
  width: number;
  height: number;
  /** Fraction of pixels that are opaque. */
  coverage: number;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  /** Content centroid, normalized 0..1. */
  centroid: { x: number; y: number };
  /** True if the four corners are fully transparent. */
  transparentCorners: boolean;
  /** True if opaque content touches any frame edge (clipped). */
  edgeTouch: boolean;
};

/** Measure alpha coverage, bbox, centroid and edge/corner conditions — the raw
 *  inputs to quality validation. */
export async function alphaStats(src: RasterImage): Promise<AlphaStats> {
  const img = await loadImage(src.dataUrl);
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const w = c.width, h = c.height;
  const p = ctx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = 0, maxY = 0, count = 0, sx = 0, sy = 0;
  let edgeTouch = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (p[(y * w + x) * 4 + 3] > 24) {
        count++; sx += x; sy += y;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edgeTouch = true;
      }
    }
  }
  const cornerAlpha = [0, w - 1].flatMap((x) => [0, h - 1].map((y) => p[(y * w + x) * 4 + 3]));
  return {
    width: w, height: h,
    coverage: count / (w * h),
    bbox: count ? { minX, minY, maxX, maxY } : { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    centroid: count ? { x: sx / count / w, y: sy / count / h } : { x: 0.5, y: 0.5 },
    transparentCorners: cornerAlpha.every((a) => a === 0),
    edgeTouch,
  };
}

/** Dominant opaque colours as hex, most-common first (coarse bucketed). */
export async function dominantColors(src: RasterImage, k = 4): Promise<string[]> {
  const img = await loadImage(src.dataUrl);
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const p = ctx.getImageData(0, 0, c.width, c.height).data;
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] < 128) continue;
    const key = `${p[i] >> 5}-${p[i + 1] >> 5}-${p[i + 2] >> 5}`;
    const b = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    b.n++; b.r += p[i]; b.g += p[i + 1]; b.b += p[i + 2];
    buckets.set(key, b);
  }
  return Array.from(buckets.values())
    .sort((a, b) => b.n - a.n)
    .slice(0, k)
    .map((b) => hex(b.r / b.n, b.g / b.n, b.b / b.n));
}

function hex(r: number, g: number, b: number): string {
  const h2 = (v: number) => clampByte(v).toString(16).padStart(2, "0");
  return `#${h2(r)}${h2(g)}${h2(b)}`;
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
