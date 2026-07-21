/**
 * lib/asset-pipeline/cleanup.ts — production alpha cleanup (M36 P1).
 * -----------------------------------------------------------------------------
 * Even with `background:transparent`, GPT Image can leave EXTERNAL artefacts on the
 * transparent canvas: a soft glow, a dark halo, or a detached floor/contact shadow.
 * Nestudio assets must read like an official Apple-style icon: crisp true-alpha, the
 * object only, no external shadow. Internal shading / ambient occlusion (inside the
 * object's own silhouette) is KEPT — we only strip what lives outside it.
 *
 * Deterministic, automatic, free. No model call, no repair, no regeneration.
 *
 * Two steps do the work:
 *   1. hardenAlpha  — faint pixels (glow/haze) below a floor → fully transparent.
 *   2. keepLargest  — keep only the largest connected opaque region → detached
 *                     floor shadows and halo rings drop away; the object stays.
 *
 * Browser-only (Canvas).
 */

import type { RasterImage } from "@/lib/ai/types";
import { loadImage, makeCanvas, toRaster, alphaStats, floodFillBackground, despeckle, trimTransparent, padSquare } from "@/lib/ai/canvas";
import { NESTUDIO_ASSET_DNA } from "@/lib/asset-dna";

/** Faint alpha (soft glow / haze / shadow penumbra) below `floor` → 0. Anti-aliased
 *  object edges (which ramp 0→255 over a pixel or two) are largely preserved. */
export async function hardenAlpha(src: RasterImage, floor = 48): Promise<RasterImage> {
  const img = await loadImage(src.dataUrl);
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const im = ctx.getImageData(0, 0, c.width, c.height);
  const p = im.data;
  for (let i = 3; i < p.length; i += 4) if (p[i] < floor) p[i] = 0;
  ctx.putImageData(im, 0, 0);
  return toRaster(c);
}

/** Keep only the largest connected opaque region (4-connectivity over alpha>threshold).
 *  Removes detached floor/contact shadows and halo rings while keeping the object. */
export async function keepLargestComponent(src: RasterImage, threshold = 28): Promise<RasterImage> {
  const img = await loadImage(src.dataUrl);
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const w = c.width, h = c.height;
  const im = ctx.getImageData(0, 0, w, h);
  const p = im.data;
  const n = w * h;
  const label = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  let best = -1, bestSize = 0, cur = 0;

  for (let s = 0; s < n; s++) {
    if (label[s] !== -1 || p[s * 4 + 3] <= threshold) continue;
    // BFS this component.
    let head = 0, tail = 0, size = 0;
    queue[tail++] = s;
    label[s] = cur;
    while (head < tail) {
      const idx = queue[head++];
      size++;
      const x = idx % w, y = (idx / w) | 0;
      const nb = [
        x > 0 ? idx - 1 : -1,
        x < w - 1 ? idx + 1 : -1,
        y > 0 ? idx - w : -1,
        y < h - 1 ? idx + w : -1,
      ];
      for (const m of nb) {
        if (m < 0 || label[m] !== -1 || p[m * 4 + 3] <= threshold) continue;
        label[m] = cur;
        queue[tail++] = m;
      }
    }
    if (size > bestSize) { bestSize = size; best = cur; }
    cur++;
  }

  if (best >= 0) {
    for (let i = 0; i < n; i++) if (label[i] !== best) p[i * 4 + 3] = 0;
    ctx.putImageData(im, 0, 0);
  }
  return toRaster(c);
}

/** Erode the alpha by `radius` px (min-filter): shave the outermost semi-transparent
 *  fringe so no soft halo ring survives, regardless of its alpha value. The final
 *  downscale in padSquare re-introduces a clean 1px anti-alias. */
export async function erodeAlpha(src: RasterImage, radius = 1): Promise<RasterImage> {
  const img = await loadImage(src.dataUrl);
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const w = c.width, h = c.height;
  const im = ctx.getImageData(0, 0, w, h);
  const p = im.data;
  const a0 = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) a0[i] = p[i * 4 + 3];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let min = 255;
      for (let dy = -radius; dy <= radius && min; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) { min = 0; break; }
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) { min = 0; break; }
          const a = a0[yy * w + xx];
          if (a < min) min = a;
        }
      }
      p[(y * w + x) * 4 + 3] = min;
    }
  }
  ctx.putImageData(im, 0, 0);
  return toRaster(c);
}

/**
 * The production finish for the honest path — an official-asset-clean transparent PNG.
 * Key out any solid background (only if not already transparent), then strip EVERY
 * external artefact: soft glow, floor/contact shadow, halo ring, background residue.
 * NO recolour, NO palette, NO repair — masking + framing only; internal shading kept.
 *
 * Order matters: harden faint alpha → keep only the object → ERODE the 1px halo fringe
 * → despeckle → trim → pad (the downscale gives the clean anti-aliased edge). No
 * featherAlpha — its softened ring was itself a faint halo.
 */
export async function finishClean(
  raw: RasterImage,
  opts: { size?: number; padding?: number } = {},
): Promise<RasterImage> {
  const size = opts.size ?? NESTUDIO_ASSET_DNA.export.size;
  const padding = opts.padding ?? NESTUDIO_ASSET_DNA.padding.fraction;

  let img = raw;
  const stats = await alphaStats(img);
  // Opaque studio background → key it out first (native-transparent output skips this).
  if (!stats.transparentCorners) img = await floodFillBackground(img, 32);

  img = await hardenAlpha(img, 60);      // kill soft glow / haze / shadow penumbra
  img = await keepLargestComponent(img); // drop detached floor shadows / halo rings
  img = await erodeAlpha(img, 1);        // shave the residual 1px halo fringe
  img = await despeckle(img);            // stray specks

  const trimmed = await trimTransparent(img);
  return padSquare(trimmed, size, padding);
}
