/**
 * lib/identity/extract.ts — build the immutable IdentityContract from the object.
 *
 * Deterministic: dominant-colour clusters WITH spatial regions, the critical colours
 * that must survive (distinctive darks/lights/saturated), the silhouette, and the
 * graphics/lettering marks — extracted as re-appliable layers so targeted repair can
 * GUARANTEE identity without trusting the model.
 *
 * The pure clustering/detail helpers are unit-tested; the canvas assembly runs in the
 * browser. Everything is normalized into one square framing (matching generation
 * output) so the identity layers align with the generated asset for re-apply.
 */

import type { RasterImage } from "@/lib/ai/types";
import { loadImage, makeCanvas, toRaster, trimTransparent, padSquare } from "@/lib/ai/canvas";
import type { RGB, ColourRegion, IdentityContract } from "./types";

const NORM = 512; // contract working resolution (square)
const PAD = 0.12; // match finishAsset framing so layers align with the generated asset

const lightness = (r: number, g: number, b: number) => (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
const satOf = (r: number, g: number, b: number) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 510;
  return mx === mn ? 0 : (mx - mn) / 255 / (1 - Math.abs(2 * l - 1) || 1);
};
const dist = (a: RGB, b: RGB) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

/** A colour is "critical" (must survive) if it's distinctive: very dark, very light,
 *  or saturated — and covers a meaningful fraction of the object. */
function isCritical(rgb: RGB, coverage: number): boolean {
  if (coverage < 0.03) return false;
  const l = lightness(rgb[0], rgb[1], rgb[2]);
  const s = satOf(rgb[0], rgb[1], rgb[2]);
  return l < 0.25 || l > 0.82 || s > 0.45;
}

/** Cluster the object's foreground colours into dominant regions (pure). */
export function clusterForeground(data: Uint8ClampedArray | number[], w: number, h: number): ColourRegion[] {
  type Bin = { n: number; r: number; g: number; b: number; minX: number; minY: number; maxX: number; maxY: number };
  const bins = new Map<number, Bin>();
  let fg = 0;
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3] < 128) continue;
    fg++;
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const x = i % w, y = (i / w) | 0;
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5); // 3 bits/channel
    const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0, minX: w, minY: h, maxX: 0, maxY: 0 };
    bin.n++; bin.r += r; bin.g += g; bin.b += b;
    if (x < bin.minX) bin.minX = x; if (x > bin.maxX) bin.maxX = x;
    if (y < bin.minY) bin.minY = y; if (y > bin.maxY) bin.maxY = y;
    bins.set(key, bin);
  }
  if (fg === 0) return [];
  // merge bins into clusters greedily by colour proximity, strongest first
  const sorted = Array.from(bins.values()).sort((a, b) => b.n - a.n);
  const clusters: Bin[] = [];
  for (const bin of sorted) {
    const c: RGB = [bin.r / bin.n, bin.g / bin.n, bin.b / bin.n];
    const host = clusters.find((k) => dist([k.r / k.n, k.g / k.n, k.b / k.n], c) < 60);
    if (host) {
      host.n += bin.n; host.r += bin.r; host.g += bin.g; host.b += bin.b;
      host.minX = Math.min(host.minX, bin.minX); host.minY = Math.min(host.minY, bin.minY);
      host.maxX = Math.max(host.maxX, bin.maxX); host.maxY = Math.max(host.maxY, bin.maxY);
    } else clusters.push({ ...bin });
  }
  return clusters
    .map((k): ColourRegion => {
      const rgb: RGB = [Math.round(k.r / k.n), Math.round(k.g / k.n), Math.round(k.b / k.n)];
      const coverage = k.n / fg;
      return {
        rgb,
        coverage,
        bbox: { x: k.minX / w, y: k.minY / h, w: (k.maxX - k.minX + 1) / w, h: (k.maxY - k.minY + 1) / h },
        critical: isCritical(rgb, coverage),
      };
    })
    .filter((c) => c.coverage >= 0.02)
    .sort((a, b) => b.coverage - a.coverage)
    .slice(0, 6);
}

/** Detect graphics/lettering: dark marks sitting on a lighter surface (pure). */
export function detailMaskOf(data: Uint8ClampedArray | number[], w: number, h: number): { mask: Uint8ClampedArray; coverage: number } {
  const mask = new Uint8ClampedArray(w * h);
  let fg = 0, marks = 0;
  const R = 3;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (data[i * 4 + 3] < 128) continue;
      fg++;
      const l = lightness(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
      if (l > 0.35) continue; // only consider dark pixels
      // local surround lightness
      let sum = 0, n = 0;
      for (let dy = -R; dy <= R; dy += R) for (let dx = -R; dx <= R; dx += R) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (data[j * 4 + 3] < 128) continue;
        sum += lightness(data[j * 4], data[j * 4 + 1], data[j * 4 + 2]); n++;
      }
      if (n > 0 && sum / n > 0.5) { mask[i] = 255; marks++; } // dark mark on a light area
    }
  }
  return { mask, coverage: fg === 0 ? 0 : marks / fg };
}

/* ── Canvas assembly (browser) ────────────────────────────────────────────────── */

async function normalizedSquare(cutout: RasterImage): Promise<HTMLCanvasElement> {
  const trimmed = await trimTransparent(cutout);
  const square = await padSquare(trimmed, NORM, PAD);
  const img = await loadImage(square.dataUrl);
  const c = makeCanvas(NORM, NORM);
  c.getContext("2d")!.drawImage(img, 0, 0, NORM, NORM);
  return c;
}

/** Build a layer canvas keeping only the pixels where `mask` is set. */
function layerFrom(square: HTMLCanvasElement, keep: (i: number) => boolean): RasterImage {
  const w = square.width, h = square.height;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(square, 0, 0);
  const im = ctx.getImageData(0, 0, w, h);
  const p = im.data;
  for (let i = 0; i < w * h; i++) if (!keep(i)) p[i * 4 + 3] = 0;
  ctx.putImageData(im, 0, 0);
  return toRaster(c);
}

/** Extract the immutable identity contract from the cutout. */
export async function extractContract(opts: { cutout: RasterImage; subject: string; preserveDetails: boolean }): Promise<IdentityContract> {
  const square = await normalizedSquare(opts.cutout);
  const w = square.width, h = square.height;
  const data = square.getContext("2d")!.getImageData(0, 0, w, h).data;

  const colours = clusterForeground(data, w, h);
  const criticalColours = colours.filter((c) => c.critical).map((c) => c.rgb);
  const { mask: detail, coverage: detailCov } = detailMaskOf(data, w, h);
  const hasGraphics = detailCov > 0.004;

  // identity layer: pixels belonging to a CRITICAL colour cluster (e.g., black handle
  // + lettering) — re-applied during repair to guarantee identity.
  const critCentroids = colours.filter((c) => c.critical).map((c) => c.rgb);
  const identityLayer = critCentroids.length
    ? layerFrom(square, (i) => {
        if (data[i * 4 + 3] < 128) return false;
        const rgb: RGB = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
        return critCentroids.some((c) => dist(c, rgb) < 90);
      })
    : undefined;
  const detailLayer = hasGraphics ? layerFrom(square, (i) => detail[i] === 255) : undefined;

  const alpha = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = data[i * 4 + 3];

  return {
    objectType: (opts.subject || "object").trim(),
    preserveDetails: opts.preserveDetails,
    silhouette: { width: w, height: h, aspect: w / h, alpha },
    colours,
    criticalColours,
    hasGraphics,
    source: toRaster(square),
    identityLayer,
    detailLayer,
  };
}
