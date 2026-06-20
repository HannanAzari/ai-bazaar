import { type RoomEngineAsset } from "@/lib/export";

// Pure helpers for persisting approved room-engine assets to the app filesystem
// (V3.7.4). No fs/network here — the side-effecting writer lives in
// lib/asset-persist-server.ts and imports these. Kept pure so they are unit-testable.

/** Directory (under public/) where approved interior PNGs are written. */
export const GENERATED_DIR = "generated/interior-v1";
/** Directory (under public/) for the room-engine catalog JSON. */
export const CATALOG_DIR = "catalogs";
/** The canonical catalog filename the room engine reads. */
export const CATALOG_FILE = "nestudio-interior-v1.catalog.json";
/** Public URL prefix for saved PNGs. */
export const LOCAL_PREFIX = "/generated/interior-v1/";

/** Filesystem-safe base name. */
export function sanitizeBase(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "asset";
}

/** PNG filename for an asset — prefers slug, falls back to id. */
export function assetFileName(a: { slug?: string; id: string }): string {
  const base = a.slug && a.slug.trim() ? a.slug : a.id;
  return `${sanitizeBase(base)}.png`;
}

/** A dry-run placeholder image (must never be persisted). */
export function isPlaceholderUrl(url: string): boolean {
  return url.startsWith("/samples/");
}

/** An image that is already saved under the generated dir. */
export function isLocalGeneratedUrl(url: string): boolean {
  return url.startsWith(LOCAL_PREFIX);
}

/** The public URL for a saved PNG. */
export function localUrlFor(fileName: string): string {
  return `${LOCAL_PREFIX}${fileName}`;
}

/** Decode a base64 image data URL to bytes, or null if it isn't one. */
export function decodeDataUrl(url: string): Buffer | null {
  const m = /^data:image\/[a-zA-Z0-9.+-]+;base64,([\s\S]+)$/.exec(url.trim());
  if (!m) return null;
  try {
    return Buffer.from(m[1], "base64");
  } catch {
    return null;
  }
}

/**
 * Merge incoming room-engine assets into an existing catalog, deduped by **id**
 * (incoming wins) and then by **imageUrl** (a url is kept once). Output is stable,
 * sorted by id.
 */
export function mergeCatalog(existing: RoomEngineAsset[], incoming: RoomEngineAsset[]): RoomEngineAsset[] {
  const byId = new Map<string, RoomEngineAsset>();
  for (const a of existing) byId.set(a.id, a);
  for (const a of incoming) byId.set(a.id, a); // incoming overwrites same id
  const seenUrl = new Set<string>();
  const out: RoomEngineAsset[] = [];
  for (const a of [...byId.values()].sort((x, y) => x.id.localeCompare(y.id))) {
    if (seenUrl.has(a.imageUrl)) continue; // dedupe by imageUrl
    seenUrl.add(a.imageUrl);
    out.push(a);
  }
  return out;
}
