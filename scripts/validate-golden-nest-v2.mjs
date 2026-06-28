// Phase-1 validation for the Golden Nest V2 candidate art pack.
//
// Inspects every `-v2` asset with sharp and reports: dimensions, hasAlpha, min
// alpha, % transparent pixels, and a heuristic check for a *baked* transparency
// checkerboard (a checkerboard pattern in OPAQUE pixels — i.e. it "looks
// transparent" in a viewer but has no real alpha). Background may be opaque;
// every other object must have genuine alpha transparency.
//
// Writes metadata/reports/golden-nest-v2-asset-validation.{json,md}. Does NOT
// modify, remove, or background-strip any art. Exits non-zero if any object fails.
//
//   node scripts/validate-golden-nest-v2.mjs

import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DIR = "public/nests/golden-nest-v1";
const REPORT_DIR = "metadata/reports";
const MIN_TRANSPARENT_PCT = 1.0;
const OPAQUE_ALPHA = 250;

const FILES = [
  ["background-v2.png", "background"],
  ["avatar-v2.png", "object"],
  ["tv-v2.png", "object"],
  ["desk-v2.png", "object"],
  ["bookshelf-v2.png", "object"],
  ["frame-v2.png", "object"],
  ["lamp-v2.png", "object"],
  ["plant-v2.png", "object"],
  ["books-v2.png", "object"],
];

async function inspect(path) {
  const meta = await sharp(path).metadata();
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const px = width * height;

  let transparent = 0;
  let alphaMin = 255;
  let grayish = 0;
  const toneHist = {}; // bucketed light-gray avg → count

  for (let i = 0, o = 0; i < px; i++, o += channels) {
    const r = data[o], g = data[o + 1], b = data[o + 2], a = data[o + 3];
    if (a < OPAQUE_ALPHA) transparent++;
    if (a < alphaMin) alphaMin = a;
    if (a >= OPAQUE_ALPHA) {
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), avg = (r + g + b) / 3;
      if (mx - mn < 10 && avg >= 170) {
        grayish++;
        const bucket = Math.round(avg / 4) * 4;
        toneHist[bucket] = (toneHist[bucket] || 0) + 1;
      }
    }
  }

  const transparentPct = +((transparent / px) * 100).toFixed(2);
  const grayishPct = +((grayish / px) * 100).toFixed(2);
  const tones = Object.entries(toneHist)
    .map(([k, v]) => [+k, v])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // Spatial alternation between the two dominant light-gray tones (checkerboard fingerprint).
  let altRows = 0, sampledRows = 0;
  if (tones.length >= 2 && Math.abs(tones[0][0] - tones[1][0]) >= 12) {
    const [t1, t2] = [tones[0][0], tones[1][0]];
    const near = (v, t) => Math.abs(v - t) <= 8;
    const step = Math.max(1, Math.floor(height / 40));
    for (let y = Math.floor(height * 0.1); y < height * 0.9; y += step) {
      sampledRows++;
      let last = 0, switches = 0, seen = 0;
      for (let x = 0; x < width; x += 2) {
        const o = (y * width + x) * channels;
        if (data[o + 3] < OPAQUE_ALPHA) continue;
        const r = data[o], g = data[o + 1], b = data[o + 2];
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), avg = (r + g + b) / 3;
        if (mx - mn >= 10 || avg < 170) continue;
        const cls = near(avg, t1) ? 1 : near(avg, t2) ? 2 : 0;
        if (!cls) continue;
        seen++;
        if (last && cls !== last) switches++;
        last = cls;
      }
      if (seen > 20 && switches >= 6) altRows++;
    }
  }

  const checkerboardSuspected =
    transparentPct < MIN_TRANSPARENT_PCT &&
    tones.length >= 2 &&
    Math.abs(tones[0][0] - tones[1][0]) >= 12 &&
    grayishPct > 15 &&
    altRows >= Math.max(3, sampledRows * 0.3);

  return {
    width,
    height,
    hasAlpha: Boolean(meta.hasAlpha),
    alphaMin,
    transparentPct,
    grayishPct,
    dominantGrayTones: tones.map((t) => t[0]),
    checkerboardSuspected,
  };
}

function decide(kind, info) {
  if (kind === "background") return { status: "approved", reason: "background — opaque allowed" };
  if (info.transparentPct >= MIN_TRANSPARENT_PCT)
    return { status: "approved", reason: `genuine alpha transparency (${info.transparentPct}% transparent pixels)` };
  if (info.checkerboardSuspected)
    return { status: "rejected", reason: "opaque with a BAKED checkerboard (no real alpha — a checkerboard is not transparency)" };
  return {
    status: "rejected",
    reason: info.hasAlpha
      ? "alpha channel present but fully opaque (no transparent pixels)"
      : "opaque (no alpha channel) — re-export with a real transparent background",
  };
}

async function main() {
  const results = [];
  for (const [file, kind] of FILES) {
    try {
      const info = await inspect(join(DIR, file));
      results.push({ file, kind, ...info, ...decide(kind, info) });
    } catch (err) {
      results.push({ file, kind, status: "rejected", reason: `unreadable / missing: ${err.message}` });
    }
  }

  const summary = {
    total: results.length,
    approved: results.filter((r) => r.status === "approved").length,
    rejected: results.filter((r) => r.status === "rejected").length,
    objectsApproved: results.filter((r) => r.kind === "object" && r.status === "approved").length,
    objectsRejected: results.filter((r) => r.kind === "object" && r.status === "rejected").length,
  };

  const report = {
    gate: "golden-nest-v2-asset-validation",
    phase: "Phase 1 — validate V2 candidates",
    generatedAt: new Date().toISOString(),
    directory: DIR,
    rules: {
      minTransparentPct: MIN_TRANSPARENT_PCT,
      opaqueAlphaThreshold: OPAQUE_ALPHA,
      policy: "background may be opaque; every other object must have genuine alpha transparency; a baked checkerboard is NOT transparency",
    },
    summary,
    results,
  };

  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(join(REPORT_DIR, "golden-nest-v2-asset-validation.json"), JSON.stringify(report, null, 2) + "\n");
  await writeFile(join(REPORT_DIR, "golden-nest-v2-asset-validation.md"), renderMd(report));

  console.log("\nGolden Nest V2 — Phase 1 asset validation");
  for (const r of results) {
    const mark = r.status === "approved" ? "✓" : "✗";
    console.log(
      `  ${mark} ${r.file.padEnd(16)} [${(r.kind || "").padEnd(10)}] ` +
        `${(r.width ?? "?") + "x" + (r.height ?? "?")}`.padEnd(11) +
        ` alpha=${r.hasAlpha ? "Y" : "N"} minA=${String(r.alphaMin ?? "-").padEnd(3)} transp=${String(r.transparentPct ?? "-").padStart(5)}% ` +
        `checker=${r.checkerboardSuspected ? "YES" : "no"}  ${r.status.toUpperCase()} — ${r.reason}`,
    );
  }
  console.log(`\n  objects: ${summary.objectsApproved} approved · ${summary.objectsRejected} rejected (of ${summary.total - 1})`);
  console.log(`  report: ${join(REPORT_DIR, "golden-nest-v2-asset-validation.json")}\n`);

  process.exit(summary.objectsRejected > 0 ? 1 : 0);
}

function renderMd(report) {
  const rows = report.results
    .map(
      (r) =>
        `| ${r.status === "approved" ? "✅" : "❌"} | \`${r.file}\` | ${r.kind} | ${r.width ?? "—"}×${r.height ?? "—"} | ${
          r.hasAlpha ? "yes" : "no"
        } | ${r.alphaMin ?? "—"} | ${r.transparentPct == null ? "—" : r.transparentPct + "%"} | ${
          r.checkerboardSuspected ? "**YES**" : "no"
        } | ${r.reason} |`,
    )
    .join("\n");
  return `# Golden Nest V2 — Asset Validation (Phase 1)

> ${report.phase} · generated ${report.generatedAt} · dir \`${report.directory}\`
>
> Policy: **background** may be opaque; **every other object must have genuine alpha transparency**.
> A visible checkerboard is **not** proof of transparency — a checkerboard baked into opaque pixels
> is rejected. Object passes at ≥ ${report.rules.minTransparentPct}% transparent pixels (alpha < ${report.rules.opaqueAlphaThreshold}).

**Summary:** ${report.summary.approved} approved · ${report.summary.rejected} rejected ·
objects ${report.summary.objectsApproved} approved / ${report.summary.objectsRejected} rejected.

| Status | File | Kind | Size | Alpha ch. | Min α | Transparent | Checkerboard baked? | Reason |
|---|---|---|---|---|---|---|---|---|
${rows}

${
  report.summary.objectsRejected > 0
    ? `**${report.summary.objectsRejected} object asset(s) rejected.** Per the sprint rules the fixture must NOT be switched to rejected files. Re-export the rejected objects with a *real* transparent background (genuine alpha, not a baked checkerboard), keep the same \`-v2\` filenames, and re-run this validation.`
    : "**All object assets passed** — safe to compose V2."
}
`;
}

main();
