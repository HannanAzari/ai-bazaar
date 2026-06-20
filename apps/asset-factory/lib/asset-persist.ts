// Pure helpers for persisting approved assets to Supabase (V3.7.5). No network here —
// the side-effecting saver lives in lib/asset-persist-server.ts. Kept pure so they are
// unit-testable. (Production target is Supabase Storage + DB, NOT the local filesystem.)

/** Storage path prefix (inside the asset-candidates bucket) for interior assets. */
export const STORAGE_PREFIX = "interior-v1";

/** Filesystem-/path-safe id. */
export function sanitizeId(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "asset";
}

/** Storage object path for an asset: interior-v1/<id>.png (one file per id). */
export function interiorStoragePath(id: string): string {
  return `${STORAGE_PREFIX}/${sanitizeId(id)}.png`;
}

/** A dry-run placeholder image (must never be persisted). */
export function isPlaceholderUrl(url: string): boolean {
  return url.startsWith("/samples/");
}

/** True when the url is already a public Supabase Storage URL for our bucket. */
export function isSupabasePublicUrl(url: string): boolean {
  return /\/storage\/v1\/object\/public\/asset-candidates\//.test(url);
}
