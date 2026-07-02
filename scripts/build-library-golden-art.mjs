// Build deployable, web-optimized WEBP for the restored Golden Nest assets (M13).
//
// The approved golden cut-outs live as transparent PNGs under
// public/nests/golden-nest-v1/cutouts-v2/. The production library serves asset art
// from public/nests/library-v1/assets/<id>.webp (the committed, Vercel-served
// convention used by the oak assets + the Supabase image fallback). This script emits
// one web-optimized WEBP per restored golden asset, keyed by its catalog asset id, so
// the tray renders them in both backends with no code change.
//
//   node scripts/build-library-golden-art.mjs   (Node 20 + sharp)

import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const SRC = "public/nests/golden-nest-v1/cutouts-v2";
const OUT = "public/nests/library-v1/assets";

// cut-out file (SRC/<file>-v2.png) → catalog asset id (matches the hotspot/surface
// catalogs so connect + surfaces light up for the restored assets).
const MAP = [
  ["tv-v2", "ast-tv"],
  ["frame-v2", "ast-framed-photo"],
  ["lamp-v2", "ast-floor-lamp"],
  ["plant-v2", "ast-side-plant"],
  ["avatar-v2", "ast-avatar"],
  ["desk-v2", "ast-desk"],
  ["books-v2", "ast-stacked-books"],
  ["bookshelf-v2", "ast-bookshelf"],
];

await mkdir(OUT, { recursive: true });

for (const [src, id] of MAP) {
  await sharp(`${SRC}/${src}.png`)
    // Cap the longest side so the tray art stays light; keep the alpha channel.
    .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 4, alphaQuality: 100 })
    .toFile(`${OUT}/${id}.webp`);
  console.log(`wrote ${OUT}/${id}.webp  ← ${SRC}/${src}.png`);
}

console.log(`\nDone: ${MAP.length} golden assets → ${OUT}`);
