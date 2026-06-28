// Asset transparency gate (permanent Asset Factory ingestion check).
//
// Validates that **object** assets ship with real alpha transparency (so they
// composite onto a Nest background as cut-out objects, not opaque tiles), while
// **background** assets are allowed to be opaque. Produces an approved/rejected
// report and exits non-zero if any object asset is opaque — so it can run as a
// gate in CI / pre-commit / the Asset Factory pipeline.
//
//   node scripts/validate-asset-transparency.mjs            # default: only assets
//                                                           # referenced by the fixture
//   node scripts/validate-asset-transparency.mjs --all      # every PNG in the art dir
//   node scripts/validate-asset-transparency.mjs --all <dir>
//
// Reports are written to metadata/reports/. Does NOT modify art, the renderer,
// slot positions, or interactions — it only inspects pixels and reports.

import sharp from "sharp";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

// ── Rules ────────────────────────────────────────────────────────────────────
const FIXTURE = "lib/fixtures/golden-nest.ts";
const REPORT_DIR = "metadata/reports";
// In --all mode, an asset is a BACKGROUND (opaque allowed) if its filename matches
// this; anything else is an OBJECT. In fixture mode the kind comes from the
// fixture role instead (template background vs assigned asset image).
const BACKGROUND_RE = /(^|[-_])(background|bg|backdrop|template|shell|scene)([-_.]|$)/i;
// Minimum share of pixels that must be (semi-)transparent for an object to pass.
const MIN_TRANSPARENT_PCT = 1.0;
// Alpha at/above this counts as "opaque" for the transparent-pixel tally.
const OPAQUE_ALPHA = 250;

// ── Fixture parsing ──────────────────────────────────────────────────────────
// The fixture builds image URLs from a single `ART` root + per-asset `art` stems
// (and one `backgroundImageUrl`). We read the file as text and reconstruct those
// URLs so the gate validates exactly what the renderer loads — no TS build needed.
async function readFixtureTargets() {
  const src = await readFile(FIXTURE, "utf8");

  const artRoot = src.match(/\bART\s*=\s*["'`]([^"'`]+)["'`]/)?.[1];
  if (!artRoot) throw new Error(`Could not find ART root in ${FIXTURE}`);

  const resolve = (raw) => raw.replaceAll("${ART}", artRoot);

  // Template background (opaque allowed).
  const bgRaw = src.match(/backgroundImageUrl:\s*[`"']([^`"']+)[`"']/)?.[1];
  if (!bgRaw) throw new Error(`Could not find backgroundImageUrl in ${FIXTURE}`);
  const backgroundUrl = resolve(bgRaw);

  // Assigned asset images (objects). Each asset() call carries an `art` stem that
  // the helper turns into `${ART}/<stem>.png`.
  const stems = [...src.matchAll(/\bart:\s*["']([^"']+)["']/g)].map((m) => m[1]);
  const objectUrls = stems.map((s) => `${artRoot}/${s}.png`);

  const targets = [
    { url: backgroundUrl, kind: "background" },
    ...objectUrls.map((url) => ({ url, kind: "object" })),
  ];
  // De-dupe by url (keep first kind seen).
  const seen = new Set();
  const unique = targets.filter((t) => (seen.has(t.url) ? false : seen.add(t.url)));
  return { artRoot, targets: unique };
}

// Map a public URL ("/nests/.../x.png") to its file path ("public/nests/.../x.png").
const urlToPath = (url) => join("public", url.replace(/^\//, ""));

// ── Pixel inspection ─────────────────────────────────────────────────────────
async function inspect(filePath) {
  const meta = await sharp(filePath).metadata();
  // ensureAlpha() so opaque (RGB / no-alpha) images don't throw on extract; their
  // synthesized alpha is fully opaque, which correctly reads as "no transparency".
  const alpha = await sharp(filePath).ensureAlpha().extractChannel("alpha").raw().toBuffer();
  let transparent = 0;
  let alphaMin = 255;
  for (let i = 0; i < alpha.length; i++) {
    const a = alpha[i];
    if (a < OPAQUE_ALPHA) transparent++;
    if (a < alphaMin) alphaMin = a;
  }
  const transparentPct = alpha.length ? (transparent / alpha.length) * 100 : 0;
  return {
    width: meta.width,
    height: meta.height,
    hasAlphaChannel: Boolean(meta.hasAlpha),
    alphaMin,
    transparentPct: +transparentPct.toFixed(2),
  };
}

function decide(kind, info) {
  if (kind === "background") {
    return { status: "approved", reason: "background — opaque allowed" };
  }
  if (info.transparentPct >= MIN_TRANSPARENT_PCT) {
    return { status: "approved", reason: `object has alpha transparency (${info.transparentPct}% transparent pixels)` };
  }
  return {
    status: "rejected",
    reason: info.hasAlphaChannel
      ? "object has an alpha channel but it is fully opaque (no transparent pixels)"
      : "object is opaque (no alpha channel) — re-export with a transparent background",
  };
}

// ── Target collection (fixture vs --all) ─────────────────────────────────────
async function collectTargets(mode, dirArg) {
  if (mode === "all") {
    const { artRoot } = await readFixtureTargets().catch(() => ({ artRoot: "/nests/golden-nest-v1" }));
    const dir = dirArg || urlToPath(artRoot);
    const files = (await readdir(dir)).filter((f) => /\.png$/i.test(f)).sort();
    return { dir, items: files.map((file) => ({ file, kind: BACKGROUND_RE.test(file) ? "background" : "object" })) };
  }
  // fixture mode
  const { artRoot, targets } = await readFixtureTargets();
  const dir = urlToPath(artRoot);
  const items = targets
    .map((t) => ({ file: basename(t.url), kind: t.kind }))
    .sort((a, b) => a.file.localeCompare(b.file));
  return { dir, items };
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes("--all") ? "all" : "fixture";
  const dirArg = args.find((a) => !a.startsWith("--"));

  let dir, items;
  try {
    ({ dir, items } = await collectTargets(mode, dirArg));
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(2);
  }

  const results = [];
  for (const { file, kind } of items) {
    let info;
    try {
      info = await inspect(join(dir, file));
    } catch (err) {
      results.push({ file, kind, status: "rejected", reason: `unreadable / missing image: ${err.message}` });
      continue;
    }
    const { status, reason } = decide(kind, info);
    results.push({ file, kind, ...info, status, reason });
  }

  const summary = {
    total: results.length,
    approved: results.filter((r) => r.status === "approved").length,
    rejected: results.filter((r) => r.status === "rejected").length,
    objects: results.filter((r) => r.kind === "object").length,
    backgrounds: results.filter((r) => r.kind === "background").length,
  };

  const report = {
    gate: "asset-transparency",
    version: 2,
    mode, // "fixture" (default, referenced assets only) | "all"
    fixture: mode === "fixture" ? FIXTURE : null,
    generatedAt: new Date().toISOString(),
    directory: dir,
    rules: {
      backgroundDetection: mode === "fixture" ? "fixture role (template background vs assigned asset image)" : BACKGROUND_RE.source,
      minTransparentPct: MIN_TRANSPARENT_PCT,
      opaqueAlphaThreshold: OPAQUE_ALPHA,
      policy: "object assets must contain alpha transparency; background assets may be opaque",
    },
    summary,
    results,
  };

  await mkdir(REPORT_DIR, { recursive: true });
  const stem = `asset-transparency-${basename(dir)}`;
  const jsonPath = join(REPORT_DIR, `${stem}.json`);
  const mdPath = join(REPORT_DIR, `${stem}.md`);
  await writeFile(jsonPath, JSON.stringify(report, null, 2) + "\n");
  await writeFile(mdPath, renderMarkdown(report));

  // Console summary.
  console.log(`\nAsset transparency gate — ${dir} (mode: ${mode}${mode === "fixture" ? `, from ${FIXTURE}` : ""})`);
  for (const r of results) {
    const mark = r.status === "approved" ? "✓" : "✗";
    const pct = r.transparentPct == null ? "—" : `${r.transparentPct}%`;
    console.log(`  ${mark} ${r.file.padEnd(16)} [${r.kind.padEnd(10)}] transparent=${pct.padEnd(7)} ${r.status.toUpperCase()} — ${r.reason}`);
  }
  console.log(`\n  ${summary.approved} approved · ${summary.rejected} rejected · ${summary.total} total`);
  console.log(`  report: ${jsonPath}\n`);

  process.exit(summary.rejected > 0 ? 1 : 0);
}

function renderMarkdown(report) {
  const rows = report.results
    .map(
      (r) =>
        `| ${r.status === "approved" ? "✅" : "❌"} | \`${r.file}\` | ${r.kind} | ${r.width ?? "—"}×${r.height ?? "—"} | ${
          r.transparentPct == null ? "—" : r.transparentPct + "%"
        } | ${r.hasAlphaChannel ? "yes" : "no"} | ${r.reason} |`,
    )
    .join("\n");
  return `# Asset Transparency Report — \`${report.directory}\`

> Gate: **${report.gate}** · mode: **${report.mode}**${report.fixture ? ` (referenced by \`${report.fixture}\`)` : " (every PNG in the folder)"} · generated ${report.generatedAt}
>
> Policy: **object** assets must contain alpha transparency; **background** assets may be opaque.
> Object passes when ≥ ${report.rules.minTransparentPct}% of pixels are (semi-)transparent
> (alpha < ${report.rules.opaqueAlphaThreshold}). Background detection: ${report.rules.backgroundDetection}.

**Summary:** ${report.summary.approved} approved · ${report.summary.rejected} rejected ·
${report.summary.objects} objects · ${report.summary.backgrounds} background(s) · ${report.summary.total} total.

| Status | File | Kind | Size | Transparent | Alpha ch. | Reason |
|---|---|---|---|---|---|---|
${rows}

${report.summary.rejected > 0 ? `**${report.summary.rejected} asset(s) rejected.** Re-export the rejected object PNGs with a transparent background (same filenames) and re-run the gate.` : "**All assets passed.**"}
`;
}

main();
