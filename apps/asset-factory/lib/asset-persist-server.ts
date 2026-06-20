import { promises as fs } from "fs";
import path from "path";
import { type RoomEngineAsset } from "@/lib/export";
import {
  GENERATED_DIR,
  CATALOG_DIR,
  CATALOG_FILE,
  assetFileName,
  isPlaceholderUrl,
  isLocalGeneratedUrl,
  localUrlFor,
  decodeDataUrl,
  mergeCatalog,
} from "@/lib/asset-persist";

// Server-only writer (V3.7.4): persists approved room-engine assets to the app
// filesystem — PNGs under public/generated/interior-v1 and a merged catalog under
// public/catalogs. NEVER import from a client component. fetch is injectable so the
// remote-image path is testable without the network.

export type FetchLike = (url: string) => Promise<{ ok: boolean; status?: number; arrayBuffer: () => Promise<ArrayBuffer> }>;

export type SaveOptions = { publicDir: string; fetchImpl?: FetchLike };

export type SaveResult = {
  saved: number;
  skipped: number;
  catalogCount: number;
  generatedDir: string;
  catalogPath: string;
  assets: RoomEngineAsset[];
};

/** Resolve the PNG bytes for an asset, "keep" if it's already local, or null to skip. */
async function bytesFor(asset: RoomEngineAsset, fetchImpl?: FetchLike): Promise<Buffer | "keep" | null> {
  const url = (asset.imageUrl || "").trim();
  if (!url || isPlaceholderUrl(url)) return null;   // never persist dry-run placeholders
  if (isLocalGeneratedUrl(url)) return "keep";       // already saved — keep as-is
  const data = decodeDataUrl(url);
  if (data) return data;                             // data:image/png;base64,...
  if (/^https?:\/\//i.test(url)) {                   // remote → fetch
    const doFetch = fetchImpl ?? ((u: string) => fetch(u));
    const res = await doFetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }
  return null;                                       // unknown local path → skip
}

/**
 * Save approved assets to disk and merge the catalog. Each saved asset's imageUrl is
 * rewritten to its local /generated/interior-v1/<file>.png path. Returns counts.
 */
export async function saveApprovedAssets(assets: RoomEngineAsset[], options: SaveOptions): Promise<SaveResult> {
  const genDir = path.join(options.publicDir, GENERATED_DIR);
  const catDir = path.join(options.publicDir, CATALOG_DIR);
  await fs.mkdir(genDir, { recursive: true });
  await fs.mkdir(catDir, { recursive: true });

  const savedAssets: RoomEngineAsset[] = [];
  let saved = 0;
  let skipped = 0;

  for (const asset of assets) {
    const bytes = await bytesFor(asset, options.fetchImpl);
    if (bytes === null) { skipped += 1; continue; }
    const fileName = assetFileName(asset);
    if (bytes === "keep") {
      // Already under generated/ — keep file, normalize the url to the canonical name.
      savedAssets.push({ ...asset, imageUrl: localUrlFor(path.basename(asset.imageUrl)) });
      saved += 1;
      continue;
    }
    // Overwrite ONLY this asset's own file (deterministic name per slug/id).
    await fs.writeFile(path.join(genDir, fileName), bytes);
    savedAssets.push({ ...asset, imageUrl: localUrlFor(fileName) });
    saved += 1;
  }

  const catalogPath = path.join(catDir, CATALOG_FILE);
  let existing: RoomEngineAsset[] = [];
  try {
    const raw = JSON.parse(await fs.readFile(catalogPath, "utf8"));
    if (Array.isArray(raw)) existing = raw as RoomEngineAsset[];
  } catch {
    existing = [];
  }
  const merged = mergeCatalog(existing, savedAssets);
  await fs.writeFile(catalogPath, JSON.stringify(merged, null, 2) + "\n");

  return { saved, skipped, catalogCount: merged.length, generatedDir: genDir, catalogPath, assets: savedAssets };
}
