#!/usr/bin/env node
// ── Nestudio Camera DNA Lock — P0 validation generation ─────────────────────
//
// Generates the camera-DNA validation pack: 5 personality backgrounds + 10 objects,
// 3 candidates each (45 synchronous calls), all authored to the LOCKED camera DNA
// (docs/nestudio-camera-dna-lock.md). Kept separate from the M9 P0 pipeline —
// outputs under public/nests/camera-dna-v1/candidates/.
//
//   node scripts/generate-camera-validation.mjs
//
// Env: GEMINI_API_KEY from process.env → .env.local fallback. Never printed/logged
// (x-goog-api-key header). Model gemini-3.1-flash-image. Synchronous (no Batch).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CAND = resolve(ROOT, "public/nests/camera-dna-v1/candidates");
const MODEL = "gemini-3.1-flash-image";
const CANDIDATES = 3;

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

// ── The LOCKED camera DNA (docs/nestudio-camera-dna-lock.md) ──────────────────
const CAMERA =
  "LOCKED Nestudio camera DNA — an Animal Crossing–inspired life-simulation camera: camera at " +
  "~180cm standing human viewpoint, downward tilt 8-12 degrees (target 10), slightly elevated " +
  "front-facing perspective with visible top surfaces, ~35-40mm (no wide-angle distortion), " +
  "centered, subtle natural convergence. Portrait 3:4 framing.";

const STYLE =
  "Cozy stylized life-simulation game render, in the visual language of Animal Crossing / The Sims: " +
  "clean rounded forms, soft warm game lighting, believable but stylized materials, gentle ambient " +
  "occlusion. Premium, explorable, mobile-readable game world. NOT architectural photography, NOT " +
  "catalogue/ecommerce photography, NOT an interior-design render.";

const BG_FRAME =
  "This is a GAME ENVIRONMENT STAGE, not an interior render. Composition: the back wall fills ~70% of " +
  "the frame width with ~15% of each side wall visible, and a clear USABLE PLACEMENT ZONE in the " +
  "centre. Personality comes from ARCHITECTURE — materials, lighting, windows, trim, feature walls, " +
  "arches, integrated shelving — NOT from furniture. Keep furniture MINIMAL (ideally none baked in); " +
  "no large furniture pieces, nothing blocking the central placement space, no decorative clutter. " +
  "Opaque background.";

const OBJ_FRAME =
  "Render ONE life-sim game object only, isolated and centered, fully in frame, on a FLAT PLAIN SOLID " +
  "pure-white background for a clean cut-out — no room, no floor, no wall, no other props, and NO " +
  "cast/contact/floor shadow. Use the SAME camera as the environment backgrounds: ~180cm height, ~10 " +
  "degree downward tilt, same horizon, same upper-left light direction. Slightly visible top surfaces " +
  "required. Mobile-readable silhouette.";

const NEGATIVE =
  "Forbidden (reject): catalogue photography, ecommerce product listing, straight front orthographic " +
  "view, eye-level furniture photo, dramatic architectural photography, wide-angle/fisheye distortion, " +
  "strong cinematic perspective, isometric, dutch tilt, harsh gloss, blown-out highlights, lens flare, " +
  "checkerboard pattern, text, watermark, logo, UI, clutter, deformed, extra objects.";

// Exact suffixes to append verbatim (docs/nestudio-camera-dna-lock.md §5).
const BG_SUFFIX =
  "Nintendo Animal Crossing camera language, cozy life simulation game environment, slightly elevated " +
  "viewpoint, 10 degree downward camera tilt, visible top surfaces, mobile game readability, consistent " +
  "game world perspective, environment stage for object placement, not architectural photography, not " +
  "catalogue photography.";

const OBJ_SUFFIX =
  "Render as a life simulation game asset using the exact same camera height and downward tilt as the " +
  "environment backgrounds. Slightly visible top surfaces required. Must feel like an object naturally " +
  "existing inside Animal Crossing or The Sims rather than an ecommerce product listing.";

// ── Assets ────────────────────────────────────────────────────────────────────
// Backgrounds: personality spaces with deliberate MATERIAL DIVERSITY (not all timber).
const BACKGROUNDS = [
  {
    id: "bg-creator-loft", name: "Creator Loft",
    subject:
      "A Creator Loft personality space: polished concrete floor, one exposed-brick feature wall and " +
      "acoustic wall panels, large industrial window with soft daylight plus warm accent lamps, a calm " +
      "premium creative studio mood.",
  },
  {
    id: "bg-writer-nook", name: "Writer Nook",
    subject:
      "A Writer's Nook personality space: warm walnut timber floor, bookshelves integrated into the side " +
      "walls, framed literature quotes on the back wall, soft warm lamp lighting, a calm cozy premium " +
      "atmosphere with a quiet scholarly mood.",
  },
  {
    id: "bg-gamer-cave", name: "Gamer Cave",
    subject:
      "A Gamer Cave personality space: dark carpet or gym-rubber floor, dark acoustic panel walls with " +
      "subtle RGB gaming light strips glowing along the edges, moody low ambient light with cool blue and " +
      "magenta accents, premium and immersive (still tasteful, not neon-overloaded).",
  },
  {
    id: "bg-minimal-zen", name: "Minimal Zen",
    subject:
      "A Minimal Zen personality space: light stone-tile or tatami floor, smooth pale plaster walls with a " +
      "single timber-slat feature wall, very soft natural daylight, extremely calm minimal premium " +
      "atmosphere, generous negative space.",
  },
  {
    id: "bg-outdoor-balcony", name: "Outdoor Balcony",
    subject:
      "An Outdoor Balcony personality space: warm outdoor timber decking floor, a glass sliding-door back " +
      "wall of the apartment, low side railings with planters and greenery, open sky with a warm sunset " +
      "beyond, cozy premium outdoor-lounge mood.",
  },
];

// Objects: orientation per the lock (top-surface vs mostly-frontal) + material variety.
const OBJECTS = [
  { id: "obj-tv-console", name: "TV media console", aspect: "16:10", top: "top surface of the console clearly visible (slightly from above)",
    subject: "a low TV media console with a wide flat TV on top; matte dark or walnut console, the TV screen an EMPTY warm-dark matte panel (no content); one tasteful accent." },
  { id: "obj-boucle-sofa", name: "Bouclé sofa", aspect: "16:9", top: "mostly frontal, slight top of the cushions visible",
    subject: "a cozy cream bouclé two-seater sofa, plump rounded cushions, soft premium fabric, subtle wood or matte-metal feet." },
  { id: "obj-coffee-table", name: "Coffee table", aspect: "3:2", top: "clearly visible top surface",
    subject: "a low coffee table with a clean empty top surface; a premium material such as marble or oak with slim legs. Nothing on the table." },
  { id: "obj-desk", name: "Desk", aspect: "3:2", top: "clearly visible top surface",
    subject: "a writing/work desk with a clean EMPTY top surface; premium walnut or matte-white top, simple legs. No laptop, no clutter." },
  { id: "obj-office-chair", name: "Office chair", aspect: "3:4", top: "mostly frontal, slight top of the seat visible",
    subject: "a modern office chair, soft fabric or mesh back and seat, matte base on castors, one tasteful accent colour." },
  { id: "obj-bookshelf", name: "Bookshelf", aspect: "1:2", top: "mostly frontal",
    subject: "a tall bookshelf, mostly-empty open shelves with only a few structural books, premium oak or matte-black metal frame." },
  { id: "obj-picture-frame", name: "Picture frame", aspect: "3:4", top: "frontal (wall-mounted)",
    subject: "a single picture frame with an EMPTY warm cream mat inside (no photo, no image), premium slim frame, one accent edge." },
  { id: "obj-floor-plant", name: "Floor plant", aspect: "3:5", top: "mostly frontal",
    subject: "a leafy indoor floor plant (soft rounded foliage, not photoreal leaves) in a premium ceramic or woven pot." },
  { id: "obj-rug", name: "Rug", aspect: "3:2", top: "rendered from above (slightly elevated) with the rug's VISIBLE THICKNESS/pile edge shown, foreshortened as lying flat on the floor at the 10 degree camera angle",
    subject: "a soft area rug lying flat with a visible soft thickness at its edge, warm woven texture with a simple tasteful pattern, one gentle accent." },
  { id: "obj-table-lamp", name: "Table lamp", aspect: "3:5", top: "mostly frontal",
    subject: "a table lamp with a soft rounded matte shade and a premium ceramic or matte-brass base, a warm glow (glow on the shade only, no cast light pool)." },
];

function bgPrompt(a) {
  return [CAMERA, STYLE, BG_FRAME, `Scene: ${a.subject}`, NEGATIVE, BG_SUFFIX].join("\n\n");
}
function objPrompt(a) {
  return [CAMERA, STYLE, OBJ_FRAME, `Asset: ${a.name} — ${a.subject} Orientation: ${a.top}.`, NEGATIVE, OBJ_SUFFIX].join("\n\n");
}

export const ASSETS = [
  ...BACKGROUNDS.map((a) => ({
    id: a.id, name: a.name, kind: "background", dir: "backgrounds",
    aspectRatio: "3:4", master: [1536, 2048], imageSize: "2K", deliverMaxKB: 400, transparency: false,
    prompt: bgPrompt(a),
  })),
  ...OBJECTS.map((a) => ({
    id: a.id, name: a.name, kind: "object", dir: "objects",
    aspectRatio: "1:1", master: [2048, 2048], imageSize: "2K", deliverMaxKB: 400, transparency: true,
    trimToAspect: a.aspect, prompt: objPrompt(a),
  })),
];

async function generateCandidate(a, n, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const body = {
    contents: [{ role: "user", parts: [{ text: a.prompt }] }],
    generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: a.aspectRatio, imageSize: a.imageSize } },
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
  return { candidate: n, masterPath: masterPath.replace(ROOT + "/", ""), bytes: buf.length, startedAt: started, finishedAt: new Date().toISOString(), status: "generated" };
}

// Re-generate ONLY the candidates that previously failed (transient errors), reusing
// the existing manifest — never overwrites successful candidates.
async function retryMissing(apiKey) {
  const manifestPath = resolve(CAND, "metadata", "manifest.json");
  if (!existsSync(manifestPath)) {
    console.error("[camera-validation] no manifest to retry. Run a full pass first.");
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const byId = new Map(ASSETS.map((a) => [a.id, a]));
  let fixed = 0, still = 0;
  for (const asset of manifest.results) {
    const spec = byId.get(asset.id);
    if (!spec) continue;
    for (let i = 0; i < asset.candidates.length; i++) {
      const c = asset.candidates[i];
      if (c.status === "generated") continue;
      process.stdout.write(`  ↻ ${asset.id} c${c.candidate} … `);
      try {
        asset.candidates[i] = await generateCandidate(spec, c.candidate, apiKey);
        fixed++;
        console.log(`ok (${(asset.candidates[i].bytes / 1024).toFixed(0)} KB)`);
      } catch (err) {
        asset.candidates[i] = { candidate: c.candidate, status: "failed", error: String(err.message || err) };
        still++;
        console.log(`FAILED: ${String(err.message || err).slice(0, 120)}`);
      }
    }
    writeFileSync(resolve(CAND, "metadata", `${asset.id}.json`), JSON.stringify(asset, null, 2));
  }
  manifest.generatedAt = new Date().toISOString();
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`[camera-validation] retry done: ${fixed} recovered, ${still} still failing.`);
}

async function main() {
  mkdirSync(resolve(CAND, "metadata"), { recursive: true });
  const apiKey = loadApiKey();
  if (!apiKey) {
    console.error("[camera-validation] GEMINI_API_KEY missing (env or .env.local). Aborting.");
    process.exit(1);
  }
  if (process.argv.includes("--retry-missing")) {
    console.log(`[camera-validation] retry-missing mode (model=${MODEL})`);
    await retryMissing(apiKey);
    return;
  }
  console.log(`[camera-validation] model=${MODEL}, ${ASSETS.length} assets × ${CANDIDATES} candidates (synchronous)`);
  const results = [];
  for (const a of ASSETS) {
    const asset = {
      id: a.id, name: a.name, kind: a.kind, model: MODEL, aspectRatio: a.aspectRatio,
      masterResolution: a.master, imageSize: a.imageSize, deliverMaxKB: a.deliverMaxKB,
      transparency: a.transparency, trimToAspect: a.trimToAspect ?? null, editableSurface: null,
      prompt: a.prompt, candidates: [],
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
  const manifest = { pack: "camera-dna-v1", model: MODEL, candidatesPerAsset: CANDIDATES, generatedAt: new Date().toISOString(), results };
  writeFileSync(resolve(CAND, "metadata", "manifest.json"), JSON.stringify(manifest, null, 2));
  const ok = results.reduce((s, a) => s + a.candidates.filter((c) => c.status === "generated").length, 0);
  console.log(`[camera-validation] done: ${ok}/${results.length * CANDIDATES} candidates generated.`);
  console.log("[camera-validation] next: python3 scripts/process-validate-camera.py");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((e) => { console.error("[camera-validation] fatal:", e.message || e); process.exit(1); });
}
