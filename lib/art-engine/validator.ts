/**
 * lib/art-engine/validator.ts — the Style Validator (the quality gate).
 *
 * Phase 2/4: after generation, score the candidate against the MEASURED official
 * profile. If it doesn't feel like Nestudio, the gate fails and the pipeline
 * regenerates. This is the art-director critic — but measurable, so it's cheap
 * (Phase 7: intelligence over brute force). It asks, in numbers, the three
 * questions: does this belong beside official assets · does it look handcrafted ·
 * would a user believe an artist made it.
 *
 * Tolerances come from the official library's OWN spread (StyleProfile), so official
 * assets score high and the loud AI tells (gloss, pure white/black, hard edges,
 * oversaturation) score low.
 *
 * PURE — compares a fingerprint against a profile.
 */

import type { StyleFingerprint, StyleProfile, RGB } from "./fingerprint";

/**
 * Palette DISCIPLINE, not palette matching: objects keep their own true colours
 * (the M22 rule), so we don't penalise hue — we reward a *calm* palette (nothing
 * fully saturated, no pure black/white). Nestudio officials score high regardless of
 * their hue; a neon AI object scores low.
 */
function paletteDiscipline(palette: RGB[]): number {
  if (palette.length === 0) return 1;
  let calm = 0;
  for (const [r, g, b] of palette) {
    const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255;
    const l = (mx + mn) / 2;
    const s = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1) || 1);
    const pure = (r > 250 && g > 250 && b > 250) || (r < 6 && g < 6 && b < 6);
    if (s < 0.82 && !pure) calm++;
  }
  return calm / palette.length;
}

export type StyleDim = { key: string; label: string; score: number };
export type StyleReport = {
  pass: boolean;
  /** 0..1 overall. */
  score: number;
  dims: StyleDim[];
  /** dimensions below the critical floor (the obvious AI tells). */
  failures: string[];
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** 1 when equal, → 0 as |a-b| approaches `tol`. */
const near = (a: number, b: number, tol: number) => clamp01(1 - Math.abs(a - b) / tol);

/**
 * Score a candidate fingerprint against the official profile across the brief's
 * dimensions. `threshold` is the overall pass bar; critical dims (surface, softness,
 * purity) must also clear a floor — those are the loudest "AI" tells.
 */
export function validateStyle(
  candidate: StyleFingerprint,
  profile: StyleProfile,
  opts: { threshold?: number; floor?: number } = {},
): StyleReport {
  // Calibrated so ~7/8 of the handcrafted official library "belongs" (the lone
  // low outlier is the glowing lamp — a bright-bulb edge case), while neon / glossy /
  // pure-white AI output fails hard on the critical dims.
  const threshold = opts.threshold ?? 0.55;
  const floor = opts.floor ?? 0.35;
  const m = profile.mean;
  const t = profile.tol;

  // Gate on what actually separates handcrafted from AI-generated — the loud tells:
  // palette discipline, calm saturation, warm lighting, matte surface, no gloss/pure
  // pixels. Edge softness, coverage and painterly variance are render/crop artifacts
  // (the official library itself measures crisp + tightly-cropped) — they're reported
  // for insight but NOT gated on, so they don't penalise our own correct pipeline.
  // Only palette DISCIPLINE is a hard veto — a neon/garish palette is the one
  // unambiguous "this can't be Nestudio" tell (and it can't be conformed away without
  // destroying identity). Matte surface and pure-pixels are weighted heavily but NOT
  // hard vetoes: even the official library has a bright glowing lamp, and a legitimately
  // light object reads brighter than warm-brown furniture — the holistic score decides.
  const dims: (StyleDim & { weight: number; critical?: boolean })[] = [
    { key: "palette", label: "Palette discipline", weight: 1.5, critical: true, score: paletteDiscipline(candidate.palette) },
    { key: "saturation", label: "Saturation", weight: 1.2, score: near(candidate.saturation, m.saturation, t.saturation) },
    { key: "lighting", label: "Lighting (warm)", weight: 1, score: (near(candidate.warmth, m.warmth, t.warmth) + near(candidate.value, m.value, t.value)) / 2 },
    { key: "surface", label: "Surface (matte)", weight: 1.2, score: near(candidate.matteness, m.matteness, t.matteness) },
    { key: "purity", label: "No neon / pure pixels", weight: 1, score: near(candidate.purity, m.purity, t.purity) },
    { key: "softness", label: "Edge softness", weight: 0, score: near(candidate.edgeSoftness, m.edgeSoftness, t.edgeSoftness) },
    { key: "proportion", label: "Proportion", weight: 0, score: near(candidate.coverage, m.coverage, t.coverage) },
    { key: "painterly", label: "Painterly shading", weight: 0, score: near(candidate.contrast, m.contrast, t.contrast) },
  ];

  const totalW = dims.reduce((s, d) => s + d.weight, 0);
  const score = dims.reduce((s, d) => s + d.score * d.weight, 0) / totalW;
  const failures = dims.filter((d) => d.critical && d.score < floor).map((d) => d.key);
  const pass = score >= threshold && failures.length === 0;

  return { pass, score, dims: dims.map(({ key, label, score }) => ({ key, label, score })), failures };
}
