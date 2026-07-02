#!/usr/bin/env node
// ── M12 — Upload the curated Nest library to Supabase Storage + DB ───────────
//
//   node scripts/upload-nest-library.mjs
//
// Uploads the DEPLOYABLE library images (public/nests/library-v1/**, committed to
// git) to Storage buckets and upserts nest_backgrounds / nest_assets / nest_templates
// rows with the resulting public URLs. Reading committed images means this works from
// a fresh clone / CI (no dependency on gitignored candidate art).
//
// Uses the SERVICE ROLE key (bypasses RLS) — run it yourself; NOT from the app/CI.
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env (or .env.local).
// Idempotent (upsert + storage upsert:true). Fails gracefully.

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUB = resolve(ROOT, "public");

function loadEnv(name) {
  if (process.env[name]) return process.env[name];
  for (const f of [".env.local", ".env"]) {
    const p = resolve(ROOT, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(new RegExp(`^\\s*${name}\\s*=\\s*(.*)\\s*$`));
      if (m) return m[1].replace(/^["']|["']$/g, "").trim();
    }
  }
  return undefined;
}

const SUPABASE_URL = loadEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = loadEnv("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("[upload-nest-library] missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Aborting.");
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const CDN = (bucket, key) => `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${key}`;
const CTYPE = { ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg" };

const LIB = "/nests/library-v1"; // committed, deployable art (source of truth for upload)

// Manifest — mirrors lib/fixtures/nest-production-library-v1.ts (statuses seeded;
// admins re-curate later). Keep in sync if the fixture changes.
const BACKGROUNDS = [
  { id: "bg-creator-loft", title: "Creator Loft", style: "Loft · concrete & brick", status: "featured", tags: ["creator", "loft"] },
  { id: "bg-writer-nook", title: "Writer's Nook", style: "Study · walnut & books", status: "approved", tags: ["writer"] },
  { id: "bg-gamer-cave", title: "Gamer Cave", style: "Gamer · dark & RGB", status: "approved", tags: ["gamer"] },
  { id: "bg-minimal-zen", title: "Minimal Zen", style: "Zen · stone & plaster", status: "approved", tags: ["zen"] },
  { id: "bg-outdoor-balcony", title: "Outdoor Balcony", style: "Balcony · decking & sky", status: "draft", tags: ["outdoor"] },
  { id: "bg-warm-studio", title: "Warm Studio", style: "Living · warm plaster", status: "approved", tags: ["living-room"] },
  { id: "bg-focused-office", title: "Focused Office", style: "Office · olive calm", status: "hidden", tags: ["office"] },
];
const ASSETS = [
  { id: "ast-lr-sofa-boucle", title: "Bouclé Sofa", category: "furniture", slots: ["seat"], status: "approved" },
  { id: "ast-lr-media-oak-console", title: "Oak Media Console", category: "electronics", slots: ["media"], status: "approved" },
  { id: "ast-lr-table-oak-round", title: "Oak Coffee Table", category: "furniture", slots: ["table"], status: "approved" },
  { id: "ast-so-desk-oak", title: "Oak Desk", category: "furniture", slots: ["desk"], status: "approved" },
  { id: "ast-so-chair-task", title: "Task Chair", category: "furniture", slots: ["seat"], status: "approved" },
  { id: "ast-so-shelf-tall", title: "Tall Bookshelf", category: "furniture", slots: ["shelf"], status: "approved" },
  { id: "ast-lr-frame-portrait", title: "Photo Frame", category: "decor", slots: ["frame"], status: "draft" },
];
const P = (assetId, slotType, x, y, scale, zIndex) => ({ assetId, slotType, x, y, scale, zIndex });
const TEMPLATES = [
  { id: "tpl-creator-loft", title: "Creator Loft", persona: "Creator", background_id: "bg-creator-loft", status: "featured", tags: ["creator", "loft"],
    placements: [P("ast-lr-media-oak-console", "media", 0.5, 0.52, 0.78, 2), P("ast-lr-sofa-boucle", "seat", 0.36, 0.84, 0.62, 3), P("ast-lr-table-oak-round", "table", 0.56, 0.92, 0.3, 4), P("ast-so-shelf-tall", "shelf", 0.86, 0.7, 0.95, 3)] },
  { id: "tpl-gamer-cave", title: "Gamer Cave", persona: "Gamer", background_id: "bg-gamer-cave", status: "approved", tags: ["gamer"],
    placements: [P("ast-so-desk-oak", "desk", 0.5, 0.82, 0.5, 3), P("ast-so-chair-task", "seat", 0.5, 0.93, 0.55, 4), P("ast-lr-media-oak-console", "media", 0.78, 0.55, 0.7, 2)] },
  { id: "tpl-writer-nook", title: "Writer's Nook", persona: "Writer", background_id: "bg-writer-nook", status: "approved", tags: ["writer", "reading"],
    placements: [P("ast-so-desk-oak", "desk", 0.45, 0.82, 0.5, 3), P("ast-so-chair-task", "seat", 0.5, 0.93, 0.5, 4), P("ast-so-shelf-tall", "shelf", 0.83, 0.68, 0.95, 2)] },
  { id: "tpl-minimal-zen", title: "Minimal Zen", persona: "Minimalist", background_id: "bg-minimal-zen", status: "approved", tags: ["zen", "minimal"],
    placements: [P("ast-lr-sofa-boucle", "seat", 0.5, 0.85, 0.62, 3), P("ast-lr-table-oak-round", "table", 0.5, 0.93, 0.3, 4)] },
];

async function uploadImage(bucket, localPath) {
  const abs = resolve(PUB, "." + localPath);
  if (!existsSync(abs)) { console.warn(`   ! missing image ${localPath}`); return undefined; }
  const key = localPath.replace(/^\/nests\//, "").replace(/\//g, "__");
  const { error } = await db.storage.from(bucket).upload(key, readFileSync(abs), {
    contentType: CTYPE[extname(abs)] ?? "application/octet-stream", upsert: true,
  });
  if (error) { console.warn(`   ! upload failed ${key}: ${error.message}`); return undefined; }
  return CDN(bucket, key);
}

async function main() {
  const bgUrl = {};
  console.log("[upload-nest-library] uploading backgrounds…");
  for (const b of BACKGROUNDS) {
    const url = await uploadImage("backgrounds", `${LIB}/backgrounds/${b.id}.webp`);
    if (!url) continue;
    bgUrl[b.id] = url;
    await db.from("nest_backgrounds").upsert({ id: b.id, slug: b.id, title: b.title, image_url: url, variants: { standard: url }, style: b.style, status: b.status, camera_dna_version: "camera-dna-lock-v1", tags: b.tags });
    console.log(`   ✓ ${b.id}`);
  }
  console.log("[upload-nest-library] uploading assets…");
  for (const a of ASSETS) {
    const url = await uploadImage("assets", `${LIB}/assets/${a.id}.webp`);
    if (!url) continue;
    await db.from("nest_assets").upsert({ id: a.id, slug: a.id, title: a.title, image_url: url, cutout_url: url, variants: { standard: url }, category: a.category, compatible_slot_types: a.slots, status: a.status, camera_dna_version: "front-facing-v1", tags: [] });
    console.log(`   ✓ ${a.id}`);
  }
  console.log("[upload-nest-library] upserting templates…");
  for (const t of TEMPLATES) {
    await db.from("nest_templates").upsert({ id: t.id, slug: t.id, title: t.title, persona: t.persona, background_id: t.background_id, placements: t.placements, preview_image: bgUrl[t.background_id] ?? null, status: t.status, tags: t.tags });
    console.log(`   ✓ ${t.id} (${t.placements.length} placements)`);
  }
  console.log("[upload-nest-library] done. Re-run any time (idempotent).");
}

main().catch((e) => { console.error("[upload-nest-library] fatal:", e.message || e); process.exit(1); });
