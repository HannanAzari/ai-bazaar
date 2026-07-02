// ── Nestudio V2 — local surface image helpers (M8) ──────────────────────────
//
// Browser-only helpers for the surface editor: a small "recent images" gallery in
// localStorage, and a downscale-on-upload that turns a File into a compact JPEG data URL.
// The downscale exists purely so a photo fits in localStorage alongside the document — it
// is a storage step, not an image editor (no crop/filters). No cloud, no AI.

const GALLERY_KEY = "nestudio:surface-gallery:v1";
const MAX_GALLERY = 12;

/** Recent local surface images (most recent first). Empty on the server. */
export function loadSurfaceGallery(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GALLERY_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Prepend a data URL to the recent gallery (deduped, capped). Ignores quota failures. */
export function addToSurfaceGallery(src: string): void {
  if (typeof window === "undefined") return;
  try {
    const next = [src, ...loadSurfaceGallery().filter((s) => s !== src)].slice(0, MAX_GALLERY);
    window.localStorage.setItem(GALLERY_KEY, JSON.stringify(next));
  } catch {
    /* localStorage full — the gallery is best-effort only */
  }
}

/**
 * Read an uploaded image File and return a downscaled JPEG data URL (longest side ≤ maxDim).
 * Falls back to the raw data URL if the canvas encode fails. Client-only.
 */
export function downscaleImageFile(file: File, maxDim = 640, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.onload = () => {
      const raw = reader.result as string;
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round((img.width || 1) * scale));
        const h = Math.max(1, Math.round((img.height || 1) * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(raw);
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch {
          resolve(raw);
        }
      };
      img.onerror = () => resolve(raw);
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
}
