/**
 * lib/identity/validator.ts — Gate 1: IDENTITY (hard pass/fail, never a weighted score).
 *
 * Runs BEFORE the style gate. Checks the immutable contract survived generation:
 * silhouette, critical colours (in roughly the right place), proportion, and graphics/
 * lettering (when Preserve Details is on). ANY failure → the gate fails and drives
 * targeted repair. This is where "the handle must stay black" is enforced.
 *
 * The comparison is pure once both objects are normalized to the same square.
 */

import type { RasterImage } from "@/lib/ai/types";
import { loadImage, makeCanvas, trimTransparent, padSquare } from "@/lib/ai/canvas";
import { clusterForeground, detailMaskOf } from "./extract";
import type { IdentityContract, IdentityReport, RGB } from "./types";

const dist = (a: RGB, b: RGB) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

/** IoU of two equal-length alpha arrays (threshold at 128). */
export function alphaIoU(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  const n = Math.min(a.length, b.length);
  let inter = 0, uni = 0;
  for (let i = 0; i < n; i++) {
    const ai = a[i] > 128, bi = b[i] > 128;
    if (ai || bi) uni++;
    if (ai && bi) inter++;
  }
  return uni === 0 ? 0 : inter / uni;
}

/** Coverage of a colour within a set of clusters (sum of nearby clusters' coverage). */
function coverageOf(clusters: ReturnType<typeof clusterForeground>, rgb: RGB): number {
  return clusters.filter((c) => dist(c.rgb, rgb) < 90).reduce((s, c) => s + c.coverage, 0);
}

async function normalizeToSquare(image: RasterImage, size: number, pad: number): Promise<{ data: Uint8ClampedArray; alpha: Uint8ClampedArray; w: number; h: number }> {
  const square = await padSquare(await trimTransparent(image), size, pad);
  const img = await loadImage(square.dataUrl);
  const c = makeCanvas(size, size);
  c.getContext("2d")!.drawImage(img, 0, 0, size, size);
  const data = c.getContext("2d")!.getImageData(0, 0, size, size).data;
  const alpha = new Uint8ClampedArray(size * size);
  for (let i = 0; i < size * size; i++) alpha[i] = data[i * 4 + 3];
  return { data, alpha, w: size, h: size };
}

/** Gate 1 — verify the generated asset preserved the object's identity. */
export async function validateIdentity(generated: RasterImage, contract: IdentityContract): Promise<IdentityReport> {
  const size = contract.silhouette.width; // NORM
  const gen = await normalizeToSquare(generated, size, 0.12);
  const genColours = clusterForeground(gen.data, gen.w, gen.h);

  const dims: IdentityReport["dims"] = [];

  // 1. Silhouette
  const iou = alphaIoU(gen.alpha, contract.silhouette.alpha);
  dims.push({ key: "silhouette", label: "Silhouette", pass: iou >= 0.6, detail: `IoU ${iou.toFixed(2)}` });

  // 2. Critical colours preserved (present, ~in the right amount)
  for (const rgb of contract.criticalColours) {
    const src = coverageOf(contract.colours, rgb);
    const got = coverageOf(genColours, rgb);
    const pass = got >= 0.02 && got >= 0.4 * src;
    dims.push({ key: `colour:${rgb.join(",")}`, label: `Colour ${rgb.join(",")}`, pass, detail: `src ${(src * 100) | 0}% → got ${(got * 100) | 0}%` });
  }

  // 3. Proportion (object aspect via alpha bbox)
  const bboxAspect = (alpha: Uint8ClampedArray, w: number, h: number) => {
    let minX = w, minY = h, maxX = 0, maxY = 0, any = false;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (alpha[y * w + x] > 128) { any = true; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    return any ? (maxX - minX + 1) / (maxY - minY + 1) : 1;
  };
  const srcAspect = bboxAspect(contract.silhouette.alpha, size, size);
  const genAspect = bboxAspect(gen.alpha, gen.w, gen.h);
  const propOk = Math.abs(genAspect - srcAspect) / Math.max(srcAspect, 0.2) < 0.35;
  dims.push({ key: "proportion", label: "Proportion", pass: propOk, detail: `${srcAspect.toFixed(2)} → ${genAspect.toFixed(2)}` });

  // 4. Graphics / lettering (only when Preserve Details is on and the source has them)
  if (contract.preserveDetails && contract.hasGraphics) {
    const srcDetail = detailMaskOf((await normalizeToSquare(contract.source, size, 0.12)).data, size, size).coverage;
    const genDetail = detailMaskOf(gen.data, gen.w, gen.h).coverage;
    const pass = genDetail >= 0.3 * srcDetail;
    dims.push({ key: "graphics", label: "Graphics / lettering", pass, detail: `src ${(srcDetail * 100).toFixed(1)}% → got ${(genDetail * 100).toFixed(1)}%` });
  }

  const failures = dims.filter((d) => !d.pass).map((d) => d.key);
  return { pass: failures.length === 0, dims, failures };
}
