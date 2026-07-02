#!/usr/bin/env node
// ── M9.2 — P0 Production Generation Pilot (generation step) ──────────────────
//
// Generates the 9 P0 pilot assets via the Gemini image API — 3 candidates each
// (27 calls), synchronous (NO Batch API for this pilot). Saves candidates under
// public/nests/production-v1/candidates/ and writes per-asset generation metadata
// + a manifest the validation step consumes.
//
//   node scripts/generate-p0-pilot.mjs
//
// Env: GEMINI_API_KEY from process.env, falling back to a manual parse of
// .env.local (no dotenv dependency). The key is NEVER printed/logged and is sent
// via the x-goog-api-key header (never a URL). Fails gracefully if missing.
//
// Prompts + specs are assembled from docs/asset-generation-prompt-bible.md and
// metadata/production-pack-v1.json. The ASSETS array below IS the Section-3
// confirmation (ids, prompts, master resolutions, output paths, editable surfaces).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CAND = resolve(ROOT, "public/nests/production-v1/candidates");
const MODEL = "gemini-3.1-flash-image"; // per M9.2
const CANDIDATES = 3; // 3 candidates per asset (do not auto-approve)

// ── Key loading (never logged) ──────────────────────────────────────────────
function loadApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  for (const f of [".env.local", ".env"]) {
    const p = resolve(ROOT, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*GEMINI_API_KEY\s*=\s*(.*)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, "").trim();
    }
  }
  return null;
}

// ── Shared DNA prompt + negative (docs/asset-generation-prompt-bible.md §1/§2) ─
const BASE_DNA =
  "Cozy handcrafted stylized 3D illustration in the \"Nestudio\" style: warm, premium-matte, " +
  "rounded, soft-edged forms with thick readable silhouettes. Warm earthy palette — oiled oak, " +
  "warm plaster, parchment, oatmeal — with restrained soft form-shading and subtle ambient occlusion. " +
  "Soft warm key light from the upper-left, gentle ambient fill, cool-plum shadow (#46365a), never grey. " +
  "Front-facing cinematic camera, eye-level to slightly elevated, gentle ~5-10 degree downward tilt. " +
  "Parallel / near-orthographic, no strong perspective convergence. Matte finish, no gloss, no chrome, " +
  "no plastic sheen. Friendly slightly-exaggerated but grounded proportions. Calm, uncluttered, generous " +
  "negative space. Crisp and readable at small size.";

const SHARED_NEGATIVE =
  "Avoid entirely: photorealism, photo, harsh gloss, chrome, glass shine, specular highlights, plastic " +
  "sheen, neon, lens flare, dramatic/sunset/night lighting, hard cast shadows, isometric, 30 degree, " +
  "top-down, one-point tunnel perspective, dutch tilt, fisheye, vanishing-point convergence, transparency " +
  "checkerboard pattern, text, letters, watermark, logo, UI, caption, signature, clutter, busy, ornate, " +
  "baroque, anime, painterly, flat vector, clipart, sticker-art, kawaii, chibi, Animal Crossing, Stardew " +
  "Valley, The Sims, Dreamlight Valley look.";

const OBJ_ISOLATION =
  "Render ONE object only, isolated and centered, fully in frame, on a FLAT PLAIN SOLID pure-white " +
  "background (for a clean cut-out) — no room, no floor, no wall, no props, and NO cast/contact/floor " +
  "shadow under the object. Baked self-shading only, lit from the upper-left.";

const BG_RULES =
  "An EMPTY front-facing room stage: full front wall + narrow left/right wall slivers + a floor meeting the " +
  "wall at a seam ~62% down the frame. Completely UNFURNISHED — no furniture, no props, no people. Calm, " +
  "low-detail, soft value range, generous empty wall and floor. Opaque background.";

// ── The 9 P0 assets (Section 3 confirmation, single source of truth) ─────────
// master: exact master pixel dims (M9.2). imageSize: Gemini imageConfig hint
// ("4K"/"2K"/"1K"); the validation step resizes the model output to `master`.
export const ASSETS = [
  {
    id: "bg-lr-warm-studio", kind: "background", dir: "backgrounds",
    aspectRatio: "3:4", master: [4096, 5461], imageSize: "4K", deliverMaxKB: 350, transparency: false,
    subject:
      "An empty cozy living-room stage. Warm plaster walls in soft honey-oatmeal (#e6cfa9), a warm oiled-oak " +
      "wood floor, a soft window on the upper-left casting gentle daylight.",
  },
  {
    id: "bg-so-focused-office", kind: "background", dir: "backgrounds",
    aspectRatio: "3:4", master: [4096, 5461], imageSize: "4K", deliverMaxKB: 350, transparency: false,
    subject:
      "An empty focused home-office stage. Warm plaster walls with a soft olive tint (#e3ddca), warm wood " +
      "floor, calm and quiet, soft upper-left window daylight. Room left for a desk and shelving.",
  },
  {
    id: "ast-lr-media-oak-console", kind: "object", dir: "objects", tier: "hero",
    aspectRatio: "1:1", master: [2048, 2048], imageSize: "2K", deliverMaxKB: 400, transparency: true, trimToAspect: "16:10",
    editableSurface: { kind: "screen", bounds: { x: 0.18, y: 0.05, width: 0.64, height: 0.5 }, contentType: "video" },
    subject:
      "An oak media console with a wide TV on top, front-facing. The TV SCREEN is an EMPTY flat warm-dark " +
      "matte panel with a very subtle soft reflection — NO image, NO video, NO content, a blank warm-off " +
      "display. The console top is a clean empty surface. Rounded soft body, warm oiled-oak casing, one caramel accent.",
    extraNegative: "screen content, image on screen, video on screen, app ui, wallpaper on screen, bright white screen, glossy glare",
  },
  {
    id: "ast-lr-frame-portrait", kind: "object", dir: "objects", tier: "medium",
    aspectRatio: "1:1", master: [1536, 1536], imageSize: "2K", deliverMaxKB: 400, transparency: true, trimToAspect: "3:4",
    editableSurface: { kind: "photo", bounds: { x: 0.12, y: 0.1, width: 0.76, height: 0.7 }, contentType: "gallery" },
    subject:
      "A single portrait photo frame, front-facing, rounded soft-cornered warm-oak frame with a warm cream mat. " +
      "The photo APERTURE inside is an EMPTY warm cream mat — NO photo, NO image, NO picture inside it, just a " +
      "soft blank inset. One sage accent on the frame edge.",
    extraNegative: "photo inside frame, picture inside frame, portrait of a person, printed art inside",
  },
  {
    id: "ast-lr-sofa-boucle", kind: "object", dir: "objects", tier: "hero",
    aspectRatio: "1:1", master: [2048, 2048], imageSize: "2K", deliverMaxKB: 400, transparency: true, trimToAspect: "16:9",
    subject:
      "A single cozy bouclé two-seater sofa in cream/oatmeal, front-facing, rounded plump-but-tailored cushions " +
      "and soft rounded arms, warm oiled-oak feet. Premium matte bouclé upholstery, gentle even drape.",
  },
  {
    id: "ast-lr-table-oak-round", kind: "object", dir: "objects", tier: "medium",
    aspectRatio: "1:1", master: [1536, 1536], imageSize: "2K", deliverMaxKB: 400, transparency: true, trimToAspect: "4:3",
    editableSurface: { kind: "surface-projection", bounds: { x: 0.1, y: 0.0, width: 0.8, height: 0.35 }, contentType: "none" },
    subject:
      "A single low round coffee table, front-facing, rounded soft-cornered warm oiled-oak top, tapered soft " +
      "legs. The top surface is a clean, EMPTY flat plane — nothing on it.",
    extraNegative: "objects on table, books on table, cup on table, decor on top",
  },
  {
    id: "ast-so-desk-oak", kind: "object", dir: "objects", tier: "hero",
    aspectRatio: "1:1", master: [2048, 2048], imageSize: "2K", deliverMaxKB: 400, transparency: true, trimToAspect: "3:2",
    editableSurface: { kind: "surface-projection", bounds: { x: 0.08, y: 0.0, width: 0.84, height: 0.3 }, contentType: "none" },
    subject:
      "A single oak writing desk with a slim drawer, front-facing, rounded soft-cornered warm-oak top, clean " +
      "simple legs. The desktop is a clean EMPTY flat surface — no laptop, no lamp, no mug, nothing on it.",
    extraNegative: "laptop, monitor, computer, lamp, mug, books, clutter on desk",
  },
  {
    id: "ast-so-chair-task", kind: "object", dir: "objects", tier: "medium",
    aspectRatio: "1:1", master: [1536, 1536], imageSize: "2K", deliverMaxKB: 400, transparency: true, trimToAspect: "3:4",
    subject:
      "A single soft task chair, front-facing three-quarter, rounded soft forms, a rounded matte-fabric back " +
      "and seat, warm matte frame, one teal accent.",
  },
  {
    id: "ast-so-shelf-tall", kind: "object", dir: "objects", tier: "hero",
    aspectRatio: "1:1", master: [2048, 2048], imageSize: "2K", deliverMaxKB: 400, transparency: true, trimToAspect: "1:2",
    editableSurface: { kind: "surface-projection", bounds: { x: 0.08, y: 0.06, width: 0.84, height: 0.8 }, contentType: "article" },
    subject:
      "A single tall four-shelf bookshelf, front-facing, warm oiled-oak, rounded soft-cornered frame, open " +
      "shelves that are mostly EMPTY with only a few soft structural books built in — leave open room on the shelves.",
  },
];

export function buildPrompt(a) {
  const parts = [BASE_DNA];
  if (a.kind === "background") parts.push(BG_RULES, a.subject);
  else parts.push(OBJ_ISOLATION, a.subject);
  parts.push(SHARED_NEGATIVE);
  if (a.extraNegative) parts.push("Also avoid: " + a.extraNegative + ".");
  return parts.join("\n\n");
}

async function generateCandidate(a, n, apiKey) {
  const prompt = buildPrompt(a);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: a.aspectRatio, imageSize: a.imageSize }, // best-effort
    },
  };
  const started = new Date().toISOString();
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  const img = parts.find((p) => p.inlineData?.data);
  if (!img) throw new Error("no image part in response");
  const buf = Buffer.from(img.inlineData.data, "base64");
  const candDir = resolve(CAND, a.dir, a.id, `c${n}`);
  mkdirSync(candDir, { recursive: true });
  const masterPath = resolve(candDir, `${a.id}-master.png`);
  writeFileSync(masterPath, buf);
  return {
    candidate: n, masterPath: masterPath.replace(ROOT + "/", ""), bytes: buf.length,
    startedAt: started, finishedAt: new Date().toISOString(), status: "generated",
  };
}

async function main() {
  mkdirSync(resolve(CAND, "metadata"), { recursive: true });
  const apiKey = loadApiKey();
  if (!apiKey) {
    console.error("[generate-p0-pilot] GEMINI_API_KEY missing (env or .env.local). Aborting — no generation run.");
    process.exit(1);
  }
  console.log(`[generate-p0-pilot] model=${MODEL}, ${ASSETS.length} assets × ${CANDIDATES} candidates (synchronous)`);
  const results = [];
  for (const a of ASSETS) {
    const asset = {
      id: a.id, kind: a.kind, tier: a.tier ?? null, model: MODEL, aspectRatio: a.aspectRatio,
      masterResolution: a.master, imageSize: a.imageSize, deliverMaxKB: a.deliverMaxKB,
      transparency: a.transparency, trimToAspect: a.trimToAspect ?? null,
      editableSurface: a.editableSurface ?? null, prompt: buildPrompt(a), candidates: [],
    };
    for (let n = 1; n <= CANDIDATES; n++) {
      process.stdout.write(`  • ${a.id} c${n} … `);
      try {
        const c = await generateCandidate(a, n, apiKey);
        asset.candidates.push(c);
        console.log(`ok (${(c.bytes / 1024).toFixed(0)} KB)`);
      } catch (err) {
        asset.candidates.push({ candidate: n, status: "failed", error: String(err.message || err) });
        console.log(`FAILED: ${String(err.message || err).slice(0, 120)}`);
      }
    }
    writeFileSync(resolve(CAND, "metadata", `${a.id}.json`), JSON.stringify(asset, null, 2));
    results.push(asset);
  }
  const manifest = { model: MODEL, candidatesPerAsset: CANDIDATES, generatedAt: new Date().toISOString(), results };
  writeFileSync(resolve(CAND, "metadata", "manifest.json"), JSON.stringify(manifest, null, 2));
  const ok = results.reduce((s, a) => s + a.candidates.filter((c) => c.status === "generated").length, 0);
  console.log(`[generate-p0-pilot] done: ${ok}/${results.length * CANDIDATES} candidates generated.`);
  console.log("[generate-p0-pilot] next: python3 scripts/process-validate-p0.py");
}

// Run only when invoked directly (so confirm-p0.mjs can import without a network run).
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((e) => {
    console.error("[generate-p0-pilot] fatal:", e.message || e);
    process.exit(1);
  });
}
