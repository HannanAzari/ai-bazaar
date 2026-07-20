/**
 * lib/identity/repair.ts — targeted repair. Never rebuilds the whole asset.
 *
 * If only one area failed identity, fix only that area — deterministically, by
 * RE-APPLYING the source's own critical regions (the black B-handle, the lettering),
 * matte-adapted to the Nestudio finish, onto the styled body. This guarantees the
 * handle stays black and the lettering survives regardless of what the model did
 * (identity > style). Silhouette drift is clipped back to the source shape.
 *
 * Cost: zero extra generation — it's canvas compositing (Phase: one generation +
 * one optional targeted repair, never regenerate-until-acceptable).
 */

import type { RasterImage } from "@/lib/ai/types";
import { loadImage, makeCanvas, toRaster, matteGrade } from "@/lib/ai/canvas";
import type { IdentityContract } from "./types";

/** Bounding box of the opaque region of an image's alpha. */
function alphaBBox(px: Uint8ClampedArray, w: number, h: number) {
  let minX = w, minY = h, maxX = 0, maxY = 0, any = false;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 128) { any = true; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  return any ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null;
}

/**
 * Overlay an identity layer onto the base, ALIGNED by object bounding box (robust to
 * the model reshaping/repositioning the object). The layer is matte-adapted so its
 * re-applied darks belong to the Nestudio finish.
 */
async function overlayLayer(base: RasterImage, layer: RasterImage): Promise<RasterImage> {
  const adapted = await matteGrade(layer);
  const [baseImg, layerImg] = await Promise.all([loadImage(base.dataUrl), loadImage(adapted.dataUrl)]);

  // read alpha bboxes of both objects (in their own square framing)
  const bctx = makeCanvas(base.width, base.height).getContext("2d")!;
  bctx.drawImage(baseImg, 0, 0);
  const bbBase = alphaBBox(bctx.getImageData(0, 0, base.width, base.height).data, base.width, base.height);
  const lc = makeCanvas(layer.width, layer.height);
  lc.getContext("2d")!.drawImage(layerImg, 0, 0);
  const bbLayer = alphaBBox(lc.getContext("2d")!.getImageData(0, 0, layer.width, layer.height).data, layer.width, layer.height);

  const c = makeCanvas(base.width, base.height);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(baseImg, 0, 0);
  if (bbBase && bbLayer) {
    // map the layer's object bbox onto the base's object bbox
    ctx.drawImage(lc, bbLayer.x, bbLayer.y, bbLayer.w, bbLayer.h, bbBase.x, bbBase.y, bbBase.w, bbBase.h);
  } else {
    ctx.drawImage(lc, 0, 0, base.width, base.height);
  }
  return toRaster(c);
}

/** Clip the generated asset back to the source silhouette (remove drift). */
async function clipToSilhouette(base: RasterImage, contract: IdentityContract): Promise<RasterImage> {
  const [baseImg, srcImg] = await Promise.all([loadImage(base.dataUrl), loadImage(contract.source.dataUrl)]);
  const c = makeCanvas(base.width, base.height);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(baseImg, 0, 0);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(srcImg, 0, 0, base.width, base.height);
  return toRaster(c);
}

/**
 * Repair only the failing dimensions. Returns the generated image unchanged if there
 * is nothing to repair.
 */
export async function targetedRepair(generated: RasterImage, contract: IdentityContract, failures: string[]): Promise<RasterImage> {
  if (failures.length === 0) return generated;
  let out = generated;

  if (failures.includes("silhouette")) out = await clipToSilhouette(out, contract);

  const colourFailed = failures.some((f) => f.startsWith("colour:"));
  const graphicsFailed = failures.includes("graphics");

  // Colour drift (e.g., black handle → cream): re-apply the source's critical-colour
  // regions (handle + coloured parts), bbox-aligned + matte-adapted.
  if (colourFailed && contract.identityLayer) {
    out = await overlayLayer(out, contract.identityLayer);
  }

  // Graphics/lettering: re-apply the source's fine marks on top. When Preserve
  // Details is on and the source has graphics, this GUARANTEES the lettering survives
  // — re-applying the real lettering is always safe (it's the user's own object).
  if (graphicsFailed && contract.preserveDetails && contract.detailLayer) {
    out = await overlayLayer(out, contract.detailLayer);
  }

  return out;
}
