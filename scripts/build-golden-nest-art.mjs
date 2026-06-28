// Build the Golden Nest v1 art pack (M3).
//
// Authors hand-drawn, DNA-following SVGs and rasterizes them to PNGs under
// public/nests/golden-nest-v1/. These are DESIGNED PLACEHOLDERS (hand-authored
// vector art) — not AI-generated, not photoreal — that follow ADR-028 (front-facing
// cinematic, 3:4 stage box) and the Nestudio Visual DNA (warm, rounded, matte,
// transparent PNGs, warm key from upper-left / cool-plum shadow, one accent each).
//
// To upgrade to final art, drop real PNGs over the same filenames (see
// docs/golden-nest-renderer.md) — no code change needed. Regenerate placeholders:
//   node scripts/build-golden-nest-art.mjs   (Node 20 + sharp)

import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const OUT = "public/nests/golden-nest-v1";

// ── Nestudio DNA palette ─────────────────────────────────────────────────────
const C = {
  parchment: "#f2e4c4",
  parchmentLight: "#faf1dc",
  plaster: "#e6cfa9", // warm studio wall
  plasterHi: "#f0dfbc",
  wallShade: "#d9c098", // raked side wall (cooler/darker)
  plum: "#46365a", // cool-plum shadow
  ink: "#38291d",
  inkSoft: "#6b5847",
  oak: "#b07a47",
  oakDark: "#8a5c3b",
  oakDeep: "#5c3e26",
  warm: "#fff6e0",
  dusk: "#f6d8a8",
  lantern: "#ffc55c",
  ember: "#e08f3f",
  // accents
  sage: "#8aa17a",
  caramel: "#c98a4b",
  terracotta: "#a65b3f",
  teal: "#5d93ac",
  emerald: "#4e7a52",
  skin: "#e8c39a",
};
C.floor = "#c79a63";

const xml = (s) => `<?xml version="1.0" encoding="UTF-8"?>` + s;

// Soft self-shadow (down-right, plum tint — agrees with the upper-left key light).
const softShadow = (id) => `
  <filter id="${id}" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="6" dy="10" stdDeviation="12" flood-color="${C.plum}" flood-opacity="0.22"/>
  </filter>`;

// ── Background: the front-facing cinematic stage (3:4, 1080×1440) ────────────
function background() {
  const W = 1080;
  const H = 1440;
  const seam = 893; // floor seam ≈ 0.62
  const lx = 132; // left wall inner edge
  const rx = 948; // right wall inner edge
  // floor planks (gentle near-vertical, slight fan — no strong perspective)
  let planks = "";
  for (let i = 0; i <= 10; i++) {
    const x = (W / 10) * i;
    const top = lerp(x, 0, W, x * 0.04 + 10, -x * 0.0 + 10); // subtle
    const bx = lerp(x, 0, W, x * 0.12 - 60, x * 0.92 + 60);
    planks += `<line x1="${x}" y1="${seam}" x2="${bx}" y2="${H}" stroke="${C.oakDeep}" stroke-opacity="0.12" stroke-width="3"/>`;
    void top;
  }
  return xml(`
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.plasterHi}"/>
      <stop offset="1" stop-color="${C.plaster}"/>
    </linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#d8ab6f"/>
      <stop offset="1" stop-color="#b9844f"/>
    </linearGradient>
    <linearGradient id="sliverL" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#c9b186"/>
      <stop offset="1" stop-color="${C.wallShade}"/>
    </linearGradient>
    <linearGradient id="sliverR" x1="1" y1="0" x2="0" y2="0">
      <stop offset="0" stop-color="#c9b186"/>
      <stop offset="1" stop-color="${C.wallShade}"/>
    </linearGradient>
    <radialGradient id="key" cx="0.28" cy="0.16" r="0.9">
      <stop offset="0" stop-color="${C.warm}" stop-opacity="0.85"/>
      <stop offset="0.5" stop-color="${C.warm}" stop-opacity="0.18"/>
      <stop offset="1" stop-color="${C.warm}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vig" cx="0.82" cy="0.92" r="0.8">
      <stop offset="0" stop-color="${C.plum}" stop-opacity="0.16"/>
      <stop offset="1" stop-color="${C.plum}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="win" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.warm}" stop-opacity="0.9"/>
      <stop offset="1" stop-color="${C.dusk}" stop-opacity="0.5"/>
    </linearGradient>
  </defs>

  <!-- front wall -->
  <rect x="0" y="0" width="${W}" height="${seam}" fill="url(#wall)"/>

  <!-- left wall sliver (raked) -->
  <polygon points="0,52 ${lx},0 ${lx},${seam} 0,${seam + 46}" fill="url(#sliverL)"/>
  <!-- right wall sliver (raked) -->
  <polygon points="${rx},0 ${W},52 ${W},${seam + 46} ${rx},${seam}" fill="url(#sliverR)"/>

  <!-- soft window light on the front wall (upper-left) -->
  <rect x="196" y="150" width="232" height="300" rx="20" fill="url(#win)" opacity="0.7"/>
  <rect x="196" y="150" width="232" height="300" rx="20" fill="none" stroke="${C.oak}" stroke-opacity="0.25" stroke-width="10"/>
  <line x1="312" y1="150" x2="312" y2="450" stroke="${C.oak}" stroke-opacity="0.22" stroke-width="8"/>
  <line x1="196" y1="300" x2="428" y2="300" stroke="${C.oak}" stroke-opacity="0.22" stroke-width="8"/>

  <!-- picture rail + baseboard (oak) -->
  <rect x="${lx}" y="150" width="${rx - lx}" height="8" fill="${C.oak}" opacity="0.35"/>
  <rect x="0" y="${seam - 14}" width="${W}" height="20" fill="${C.oakDark}" opacity="0.55"/>

  <!-- floor -->
  <rect x="0" y="${seam}" width="${W}" height="${H - seam}" fill="url(#floor)"/>
  ${planks}
  <rect x="0" y="${seam}" width="${W}" height="36" fill="${C.warm}" opacity="0.12"/>

  <!-- light + shadow grade -->
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#key)"/>
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#vig)"/>
</svg>`);
}

function lerp(v, a, b, c, d) {
  const t = (v - a) / (b - a || 1);
  return c + (d - c) * t;
}

// ── Assets (transparent, front-facing, matte, one accent, UL light) ──────────

function matteGrad(id, light, dark) {
  return `<linearGradient id="${id}" x1="0.2" y1="0.1" x2="0.8" y2="1">
    <stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient>`;
}

function tv() {
  return assetSvg(600, 440, `
    ${matteGrad("scr", "#3a3550", "#211b2b")}
    ${matteGrad("bez", "#6b4a2f", "#46301d")}
    <rect x="40" y="40" width="520" height="320" rx="34" fill="url(#bez)"/>
    <rect x="66" y="66" width="468" height="248" rx="20" fill="url(#scr)"/>
    <path d="M86 300 L260 86 L150 86 L86 200 Z" fill="${C.warm}" opacity="0.06"/>
    <ellipse cx="170" cy="120" rx="120" ry="40" fill="${C.warm}" opacity="0.10"/>
    <rect x="250" y="372" width="100" height="14" rx="7" fill="${C.oakDark}"/>
    <rect x="210" y="384" width="180" height="12" rx="6" fill="${C.oakDeep}"/>
  `);
}

function frame() {
  return assetSvg(400, 360, `
    ${matteGrad("frm", C.oak, C.oakDeep)}
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.dusk}"/><stop offset="1" stop-color="${C.parchmentLight}"/></linearGradient>
    <rect x="30" y="30" width="340" height="300" rx="26" fill="url(#frm)"/>
    <rect x="58" y="58" width="284" height="244" rx="14" fill="url(#sky)"/>
    <path d="M58 250 q90 -70 150 -10 q60 50 134 6 v56 h-284 Z" fill="${C.sage}" opacity="0.85"/>
    <path d="M58 270 q120 -36 284 -8 v40 h-284 Z" fill="${C.emerald}" opacity="0.8"/>
    <circle cx="120" cy="120" r="26" fill="${C.lantern}" opacity="0.9"/>
    <rect x="30" y="30" width="340" height="300" rx="26" fill="${C.warm}" opacity="0.06"/>
  `);
}

function bookshelf() {
  const spine = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}"/>`;
  return assetSvg(440, 560, `
    ${matteGrad("cab", C.oak, C.oakDeep)}
    <rect x="40" y="40" width="360" height="480" rx="26" fill="url(#cab)"/>
    <rect x="64" y="64" width="312" height="432" rx="14" fill="${C.oakDeep}" opacity="0.5"/>
    <rect x="60" y="210" width="320" height="14" fill="${C.oakDark}"/>
    <rect x="60" y="360" width="320" height="14" fill="${C.oakDark}"/>
    ${spine(82, 96, 30, 108, C.caramel)}${spine(116, 100, 26, 104, C.sage)}${spine(146, 92, 30, 112, C.terracotta)}${spine(180, 104, 24, 100, C.teal)}${spine(208, 96, 34, 108, "#9a6b3f")}
    ${spine(86, 246, 28, 104, C.sage)}${spine(118, 252, 30, 98, C.terracotta)}${spine(152, 244, 26, 106, C.caramel)}${spine(182, 250, 30, 100, C.emerald)}
    <rect x="250" y="250" width="120" height="100" rx="12" fill="${C.parchment}"/>
    <circle cx="300" cy="150" r="22" fill="${C.sage}"/><rect x="292" y="168" width="16" height="40" rx="6" fill="${C.oakDark}"/>
    <rect x="40" y="40" width="360" height="480" rx="26" fill="${C.warm}" opacity="0.05"/>
  `);
}

function books() {
  return assetSvg(300, 200, `
    ${matteGrad("b1", C.caramel, "#a06a32")}${matteGrad("b2", C.sage, "#6f855f")}${matteGrad("b3", C.terracotta, "#854330")}
    <rect x="40" y="128" width="220" height="40" rx="10" fill="url(#b1)"/>
    <rect x="38" y="132" width="220" height="10" rx="5" fill="${C.parchmentLight}" opacity="0.7"/>
    <rect x="56" y="86" width="190" height="40" rx="10" fill="url(#b2)"/>
    <rect x="54" y="90" width="190" height="10" rx="5" fill="${C.parchmentLight}" opacity="0.7"/>
    <rect x="74" y="46" width="160" height="40" rx="10" fill="url(#b3)"/>
    <rect x="72" y="50" width="160" height="10" rx="5" fill="${C.parchmentLight}" opacity="0.7"/>
  `);
}

function desk() {
  return assetSvg(600, 420, `
    ${matteGrad("top", C.oak, C.oakDark)}${matteGrad("leg", C.oakDark, C.oakDeep)}
    <rect x="60" y="150" width="480" height="48" rx="16" fill="url(#top)"/>
    <rect x="90" y="198" width="150" height="150" rx="12" fill="url(#leg)"/>
    <rect x="360" y="198" width="150" height="150" rx="12" fill="url(#leg)"/>
    <rect x="108" y="226" width="114" height="40" rx="8" fill="${C.oakDeep}" opacity="0.6"/>
    <circle cx="165" cy="246" r="6" fill="${C.lantern}"/>
    <rect x="250" y="120" width="120" height="34" rx="8" fill="${C.parchment}"/>
    <rect x="266" y="96" width="40" height="30" rx="6" fill="${C.teal}"/>
    <rect x="60" y="150" width="480" height="48" rx="16" fill="${C.warm}" opacity="0.08"/>
  `);
}

function plant() {
  const leaf = (cx, cy, rx, ry, rot, fill) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" transform="rotate(${rot} ${cx} ${cy})"/>`;
  return assetSvg(340, 560, `
    ${matteGrad("pot", C.caramel, C.terracotta)}
    ${leaf(150, 150, 54, 120, -28, C.emerald)}${leaf(200, 160, 50, 120, 26, C.sage)}
    ${leaf(120, 210, 46, 110, -8, C.sage)}${leaf(220, 210, 44, 112, 14, C.emerald)}
    ${leaf(170, 130, 40, 130, 2, "#5f8a5a")}
    <path d="M96 360 L244 360 L224 500 Q170 520 116 500 Z" fill="url(#pot)"/>
    <rect x="92" y="344" width="156" height="34" rx="14" fill="${C.caramel}"/>
    <path d="M96 360 L244 360 L240 384 L100 384 Z" fill="${C.warm}" opacity="0.12"/>
  `);
}

function lamp() {
  return assetSvg(280, 760, `
    ${matteGrad("shade", "#ffe9b8", C.lantern)}
    <radialGradient id="glow" cx="0.5" cy="0.4" r="0.7"><stop offset="0" stop-color="${C.warm}" stop-opacity="0.9"/><stop offset="1" stop-color="${C.warm}" stop-opacity="0"/></radialGradient>
    <ellipse cx="140" cy="360" rx="240" ry="240" fill="url(#glow)"/>
    <path d="M70 60 L210 60 L186 210 L94 210 Z" fill="url(#shade)"/>
    <rect x="70" y="56" width="140" height="14" rx="7" fill="${C.ember}"/>
    <rect x="132" y="210" width="16" height="430" rx="8" fill="${C.oakDark}"/>
    <ellipse cx="140" cy="660" rx="80" ry="22" fill="${C.oakDeep}"/>
    <ellipse cx="140" cy="652" rx="80" ry="20" fill="${C.oak}"/>
  `);
}

function avatar() {
  return assetSvg(420, 640, `
    ${matteGrad("body", C.caramel, "#a86c34")}${matteGrad("hair", C.oakDark, C.oakDeep)}
    <path d="M96 620 Q96 430 210 430 Q324 430 324 620 Z" fill="url(#body)"/>
    <rect x="150" y="392" width="120" height="70" rx="30" fill="${C.skin}"/>
    <circle cx="210" cy="300" r="118" fill="${C.skin}"/>
    <path d="M100 300 Q104 168 210 168 Q316 168 320 300 Q300 232 210 232 Q120 232 100 300 Z" fill="url(#hair)"/>
    <circle cx="172" cy="300" r="11" fill="${C.ink}"/>
    <circle cx="250" cy="300" r="11" fill="${C.ink}"/>
    <path d="M180 342 Q210 366 240 342" stroke="${C.ink}" stroke-width="9" fill="none" stroke-linecap="round"/>
    <circle cx="150" cy="330" r="16" fill="${C.terracotta}" opacity="0.28"/>
    <circle cx="270" cy="330" r="16" fill="${C.terracotta}" opacity="0.28"/>
    <path d="M96 620 Q96 430 210 430 L210 620 Z" fill="${C.warm}" opacity="0.06"/>
  `);
}

function assetSvg(w, h, body) {
  return xml(`
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>${softShadow("sh")}</defs>
  <g filter="url(#sh)">${body}</g>
</svg>`);
}

// ── Emit ─────────────────────────────────────────────────────────────────────
const PIECES = {
  background: background(),
  tv: tv(),
  frame: frame(),
  bookshelf: bookshelf(),
  books: books(),
  desk: desk(),
  plant: plant(),
  lamp: lamp(),
  avatar: avatar(),
};

await mkdir(OUT, { recursive: true });
for (const [name, svg] of Object.entries(PIECES)) {
  await sharp(Buffer.from(svg), { density: 144 }).png().toFile(`${OUT}/${name}.png`);
  console.log(`wrote ${OUT}/${name}.png`);
}
console.log("Golden Nest art pack built.");
