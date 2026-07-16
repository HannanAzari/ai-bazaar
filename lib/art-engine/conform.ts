/**
 * lib/art-engine/conform.ts — the deterministic "material language" + "production"
 * passes of the Art Engine (Phase 3, passes 4–5). Any provider's output is pulled
 * toward ONE Nestudio visual language WITHOUT recolouring the object's identity (the
 * hard-won M22 fidelity rule: only the light is warm; hue is preserved).
 *
 * `matteGrade` desaturates gently toward each pixel's own mean (kills gloss/oversat),
 * warms the light and lifts pure blacks — hue-preserving. `featherAlpha` unifies the
 * edge softness to match the hand-painted official assets. Deterministic + free — no
 * extra generation cost (Phase 7).
 */

import type { RasterImage } from "@/lib/ai/types";
import { matteGrade, loadImage, makeCanvas, toRaster } from "@/lib/ai/canvas";
import { computeFingerprint, type StyleFingerprint } from "./fingerprint";

/**
 * Tame blown-out highlights + pure whites toward a warm matte off-white, and pure
 * blacks toward a warm near-black. This is the single loudest "AI vs handcrafted"
 * fix: raw generator output has glossy specular hotspots and pure #fff pixels that
 * the hand-painted official library never has. We only touch the near-white/near-black
 * EXTREMES (which carry no hue), so object identity/colour is preserved (the M22 rule).
 */
// warm MATTE cream + warm near-black anchors. The cream is deliberately below the
// specular threshold (lightness ≈ 0.75) so tamed highlights stop reading as gloss.
const CREAM: [number, number, number] = [211, 198, 173];
const NEAR_BLACK: [number, number, number] = [44, 35, 30];
const clamp255 = (x: number) => (x < 0 ? 0 : x > 255 ? 255 : x);

function tameCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d")!;
  const im = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const p = im.data;
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] === 0) continue;
    const r = p[i], g = p[i + 1], b = p[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const l = (mx + mn) / 510; // 0..1
    const chroma = mx - mn;
    // Bright, low-chroma pixels (white/grey highlights & gloss) → warm matte cream.
    // Chroma-gated so saturated bright colours keep their identity (M22 rule).
    if (l > 0.72 && chroma < 55) {
      const k = Math.min(1, (l - 0.72) / 0.28) * 0.85;
      p[i] = clamp255(r + (CREAM[0] - r) * k);
      p[i + 1] = clamp255(g + (CREAM[1] - g) * k);
      p[i + 2] = clamp255(b + (CREAM[2] - b) * k);
    } else if (l < 0.06) {
      p[i] = NEAR_BLACK[0]; p[i + 1] = NEAR_BLACK[1]; p[i + 2] = NEAR_BLACK[2];
    }
  }
  ctx.putImageData(im, 0, 0);
}

/**
 * Pull a generated asset into the Nestudio material language (identity-preserving):
 * `matteGrade` (gloss ↓, warm light, blacks lifted — hue-preserving) then tame the
 * highlight/pure-pixel extremes. We do NOT soften the edge — the official library
 * measures CRISP (edge-softness ≈ 0.09); finishAsset already gives a clean keyed edge.
 */
export async function conformToNestudio(image: RasterImage): Promise<RasterImage> {
  const matte = await matteGrade(image);
  const img = await loadImage(matte.dataUrl);
  const c = makeCanvas(matte.width, matte.height);
  c.getContext("2d")!.drawImage(img, 0, 0);
  tameCanvas(c);
  return toRaster(c);
}

/** Fingerprint a finished asset (for the validator gate). Browser-only. */
export async function fingerprintOf(image: RasterImage): Promise<StyleFingerprint> {
  const img = await loadImage(image.dataUrl);
  const w = img.width, h = img.height;
  const c = makeCanvas(w, h);
  c.getContext("2d")!.drawImage(img, 0, 0);
  const id = c.getContext("2d")!.getImageData(0, 0, w, h);
  return computeFingerprint({ data: id.data, width: w, height: h });
}
