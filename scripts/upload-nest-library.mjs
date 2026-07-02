#!/usr/bin/env node
// ── M12 — Upload the curated Nest library to Supabase Storage + DB ───────────
//
//   node scripts/upload-nest-library.mjs
//
// Uploads the fixture library images (public/nests/**) to Storage buckets and
// upserts nest_backgrounds / nest_assets / nest_templates rows. Uses the SERVICE
// ROLE key (bypasses RLS) — run it yourself; it is NOT run from CI or the app.
// Requires: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment
// (or .env.local). Idempotent (upsert + upsert:true on storage). Fails gracefully.
//
// The MANIFEST below mirrors lib/fixtures/nest-production-library-v1.ts — keep the
// two in sync if the fixture changes (this is a one-time migration tool).

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

// Local image path (under public/) → { bucket, key }
const BG = "/nests/camera-dna-v1/candidates/backgrounds";
const PRODBG = "/nests/production-v1/candidates/backgrounds";
const OBJ = "/nests/production-v1/candidates/objects";

// Manifest — mirrors the fixture (statuses etc. are seeded; admin can re-curate).
const BACKGROUNDS = [
  { id: "bg-creator-loft", title: "Creator Loft", style: "Loft · concrete & brick", status: "featured", tags: ["creator", "loft"], local: `${BG}/bg-creator-loft/c1/bg-creator-loft-master.png` },
  { id: "bg-writer-nook", title: "Writer's Nook", style: "Study · walnut & books", status: "approved", tags: ["writer"], local: `${BG}/bg-writer-nook/c1/bg-writer-nook-master.png` },
  { id: "bg-gamer-cave", title: "Gamer Cave", style: "Gamer · dark & RGB", status: "approved", tags: ["gamer"], local: `${BG}/bg-gamer-cave/c1/bg-gamer-cave-master.png` },
  { id: "bg-minimal-zen", title: "Minimal Zen", style: "Zen · stone & plaster", status: "approved", tags: ["zen"], local: `${BG}/bg-minimal-zen/c1/bg-minimal-zen-master.png` },
  { id: "bg-outdoor-balcony", title: "Outdoor Balcony", style: "Balcony · decking & sky", status: "draft", tags: ["outdoor"], local: `${BG}/bg-outdoor-balcony/c1/bg-outdoor-balcony-master.png` },
  { id: "bg-warm-studio", title: "Warm Studio", style: "Living · warm plaster", status: "approved", tags: ["living-room"], local: `${PRODBG}/bg-lr-warm-studio/c3/bg-lr-warm-studio-master.png` },
  { id: "bg-focused-office", title: "Focused Office", style: "Office · olive calm", status: "hidden", tags: ["office"], local: `${PRODBG}/bg-so-focused-office/c2/bg-so-focused-office-master.png` },
];
const ASSETS = [
  { id: "ast-lr-sofa-boucle", title: "Bouclé Sofa", category: "furniture", slots: ["seat"], c: "c2", status: "approved" },
  { id: "ast-lr-media-oak-console", title: "Oak Media Console", category: "electronics", slots: ["media"], c: "c3", status: "approved" },
  { id: "ast-lr-table-oak-round", title: "Oak Coffee Table", category: "furniture", slots: ["table"], c: "c1", status: "approved" },
  { id: "ast-so-desk-oak", title: "Oak Desk", category: "furniture", slots: ["desk"], c: "c2", status: "approved" },
  { id: "ast-so-chair-task", title: "Task Chair", category: "furniture", slots: ["seat"], c: "c2", status: "approved" },
  { id: "ast-so-shelf-tall", title: "Tall Bookshelf", category: "furniture", slots: ["shelf"], c: "c3", status: "approved" },
  { id: "ast-lr-frame-portrait", title: "Photo Frame", category: "decor", slots: ["frame"], c: "c3", status: "draft" },
];
const TEMPLATES = [
  { id: "tpl-creator-loft", title: "Creator Loft", persona: "Creator", background_id: "bg-creator-loft", status: "featured" },
  { id: "tpl-gamer-cave", title: "Gamer Cave", persona: "Gamer", background_id: "bg-gamer-cave", status: "approved" },
  { id: "tpl-writer-nook", title: "Writer's Nook", persona: "Writer", background_id: "bg-writer-nook", status: "approved" },
  { id: "tpl-minimal-zen", title: "Minimal Zen", persona: "Minimalist", background_id: "bg-minimal-zen", status: "approved" },
];

async function uploadImage(bucket, localPath) {
  const abs = resolve(PUB, "." + localPath);
  if (!existsSync(abs)) { console.warn(`   ! missing image ${localPath}`); return undefined; }
  const key = localPath.replace(/^\/nests\//, "").replace(/\//g, "__"); // flat, stable key
  const body = readFileSync(abs);
  const { error } = await db.storage.from(bucket).upload(key, body, {
    contentType: CTYPE[extname(abs)] ?? "application/octet-stream", upsert: true,
  });
  if (error) { console.warn(`   ! upload failed ${key}: ${error.message}`); return undefined; }
  return CDN(bucket, key);
}

async function main() {
  console.log("[upload-nest-library] uploading backgrounds…");
  for (const b of BACKGROUNDS) {
    const url = await uploadImage("backgrounds", b.local);
    if (!url) continue;
    await db.from("nest_backgrounds").upsert({ id: b.id, slug: b.id, title: b.title, image_url: url, variants: { standard: url }, style: b.style, status: b.status, camera_dna_version: "camera-dna-lock-v1", tags: b.tags });
    console.log(`   ✓ ${b.id}`);
  }
  console.log("[upload-nest-library] uploading assets…");
  for (const a of ASSETS) {
    const local = `${OBJ}/${a.id}/${a.c}/${a.id}-cutout.png`;
    const url = await uploadImage("assets", local);
    if (!url) continue;
    await db.from("nest_assets").upsert({ id: a.id, slug: a.id, title: a.title, image_url: url, cutout_url: url, variants: { standard: url }, category: a.category, compatible_slot_types: a.slots, status: a.status, camera_dna_version: "front-facing-v1", tags: [] });
    console.log(`   ✓ ${a.id}`);
  }
  console.log("[upload-nest-library] upserting templates…");
  for (const t of TEMPLATES) {
    await db.from("nest_templates").upsert({ id: t.id, slug: t.id, title: t.title, persona: t.persona, background_id: t.background_id, placements: [], status: t.status, tags: [] });
    console.log(`   ✓ ${t.id}`);
  }
  console.log("[upload-nest-library] done. Re-run any time (idempotent).");
}

main().catch((e) => { console.error("[upload-nest-library] fatal:", e.message || e); process.exit(1); });
