/**
 * lib/segmentation/flood.ts — the always-available fallback segmenter.
 *
 * A classical region-grow (neighbour-difference flood with an edge stop) from the
 * tapped point. Not a neural model, but real segmentation: fully local, no network,
 * instant, and it guarantees the experience NEVER fails when the on-device model
 * can't load. Honest about being the fallback.
 */

import { makeCanvas } from "@/lib/ai/canvas";
import type { DetectedObject, NormPoint, SegMask, Segmenter } from "./types";
import { maskArea, maskBBox, borderFraction, iou } from "./mask-utils";

const WORK = 256; // working resolution for speed (60fps-friendly)
const TOL = 30; // neighbour colour-distance tolerance

function workCanvas(source: HTMLCanvasElement): { canvas: HTMLCanvasElement; scale: number } {
  const scale = Math.min(1, WORK / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const c = makeCanvas(w, h);
  c.getContext("2d")!.drawImage(source, 0, 0, w, h);
  return { canvas: c, scale };
}

function grow(px: Uint8ClampedArray, w: number, h: number, sx: number, sy: number, tol: number): SegMask {
  const data = new Uint8ClampedArray(w * h);
  const stack = [sy * w + sx];
  const at = (i: number) => [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]] as const;
  while (stack.length) {
    const i = stack.pop()!;
    if (data[i]) continue;
    data[i] = 255;
    const x = i % w, y = (i / w) | 0;
    const [r, g, b] = at(i);
    const nb = [
      x > 0 ? i - 1 : -1,
      x < w - 1 ? i + 1 : -1,
      y > 0 ? i - w : -1,
      y < h - 1 ? i + w : -1,
    ];
    for (const j of nb) {
      if (j < 0 || data[j]) continue;
      const [r2, g2, b2] = at(j);
      if (Math.abs(r - r2) + Math.abs(g - g2) + Math.abs(b - b2) < tol * 3) stack.push(j);
    }
  }
  return { width: w, height: h, data };
}

/** Morphological close (fill small holes) via a 1px dilate then erode. */
function close(mask: SegMask): SegMask {
  const { width: w, height: h, data } = mask;
  const dil = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let on = data[y * w + x] > 127;
    if (!on) {
      if (x > 0 && data[y * w + x - 1] > 127) on = true;
      else if (x < w - 1 && data[y * w + x + 1] > 127) on = true;
      else if (y > 0 && data[(y - 1) * w + x] > 127) on = true;
      else if (y < h - 1 && data[(y + 1) * w + x] > 127) on = true;
    }
    dil[y * w + x] = on ? 255 : 0;
  }
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let on = dil[y * w + x] > 127;
    if (on) {
      if (x > 0 && dil[y * w + x - 1] < 127) on = false;
      else if (x < w - 1 && dil[y * w + x + 1] < 127) on = false;
      else if (y > 0 && dil[(y - 1) * w + x] < 127) on = false;
      else if (y < h - 1 && dil[(y + 1) * w + x] < 127) on = false;
    }
    out[y * w + x] = on ? 255 : 0;
  }
  return { width: w, height: h, data: out };
}

export const floodSegmenter: Segmenter = {
  id: "flood",
  label: "Local",
  ready: () => true,
  async init() {},

  async segmentAtPoint(source: HTMLCanvasElement, p: NormPoint): Promise<SegMask> {
    const { canvas } = workCanvas(source);
    const w = canvas.width, h = canvas.height;
    const px = canvas.getContext("2d")!.getImageData(0, 0, w, h).data;
    const sx = Math.min(w - 1, Math.max(0, Math.round(p.x * w)));
    const sy = Math.min(h - 1, Math.max(0, Math.round(p.y * h)));
    return close(grow(px, w, h, sx, sy, TOL));
  },

  async detect(source: HTMLCanvasElement): Promise<DetectedObject[]> {
    const seeds: NormPoint[] = [
      { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.4 }, { x: 0.4, y: 0.55 }, { x: 0.6, y: 0.55 },
    ];
    const objs: DetectedObject[] = [];
    for (const s of seeds) {
      const mask = await this.segmentAtPoint(source, s);
      if (borderFraction(mask) > 0.75) continue; // background, not an object
      const area = maskArea(mask);
      if (area < mask.width * mask.height * 0.01) continue;
      if (objs.some((o) => iou(o.mask, mask) > 0.6)) continue;
      const bbox = maskBBox(mask);
      if (bbox) objs.push({ id: `f${objs.length}`, mask, bbox, area });
    }
    return objs.sort((a, b) => b.area - a.area).slice(0, 4);
  },
};
