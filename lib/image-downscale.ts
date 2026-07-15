/**
 * lib/image-downscale.ts — resize an uploaded photo before it enters the AI pipeline.
 * -----------------------------------------------------------------------------
 * Real phone photos are large (12MP+, HEIC). We downscale to a sane long-edge on
 * the client so the upload is fast and never blows the data-URL guard — WITHOUT
 * destroying the object's identity (a 1600px long edge keeps plenty of detail for
 * the model, and the pipeline works at 1024 internally anyway). Re-encodes to JPEG.
 * Browser-only; the studio is a client page. HEIC decodes via the <img> path on
 * platforms that support it (iOS Safari).
 */

export async function downscaleDataUrl(dataUrl: string, maxDim = 1600, quality = 0.9): Promise<string> {
  if (typeof document === "undefined") return dataUrl;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("decode failed"));
    el.src = dataUrl;
  });
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  // Already small enough and not a format we need to normalize away from → keep as-is.
  if (scale >= 1 && /^data:image\/(jpeg|png|webp);/.test(dataUrl)) return dataUrl;
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, cw, ch);
  return canvas.toDataURL("image/jpeg", quality);
}
