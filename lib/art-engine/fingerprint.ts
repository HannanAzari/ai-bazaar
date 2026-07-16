/**
 * lib/art-engine/fingerprint.ts — measure the Nestudio visual language from pixels.
 *
 * The Art Engine's Phase 1: instead of *guessing* the style, we MEASURE it from the
 * official asset library, then hold generated assets to the same numbers. These are
 * the quantities that most separate "handcrafted" from "AI-generated": palette,
 * saturation, colour temperature, matte-vs-gloss, edge softness, framing, painterly
 * shading, and the absence of pure black/white.
 *
 * PURE — operates on raw RGBA (an ImageData-like {data,width,height}); no DOM.
 * Canonical rules it quantifies live in docs/design/RENDERING_DNA.md.
 */

export type RGB = [number, number, number];

export type StyleFingerprint = {
  /** mean HSL saturation of the object, 0..1 (Nestudio is calm, never fully saturated). */
  saturation: number;
  /** colour temperature skew (R-B), -1..1 (warm light → slightly positive). */
  warmth: number;
  /** mean lightness 0..1. */
  value: number;
  /** 1 - specular-highlight fraction, 0..1 (matte = high; gloss = low). */
  matteness: number;
  /** soft feathered edge presence, 0..1 (hand-painted soft edges = high; sticker = low). */
  edgeSoftness: number;
  /** foreground alpha coverage 0..1 (framing / proportion). */
  coverage: number;
  /** painterly shading — normalized luminance stdev 0..1 (flat = low). */
  contrast: number;
  /** 1 - (pure-white/black fraction), 0..1 (Nestudio forbids pure white/black → high). */
  purity: number;
  /** dominant colours (top buckets), for palette distance. */
  palette: RGB[];
};

export type PixelSource = { data: Uint8ClampedArray | number[]; width: number; height: number };

const FG = 128; // alpha threshold for "object"

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let s = 0;
  if (d !== 0) s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [(h * 60 + 360) % 360, s, l];
}

/** Compute the style fingerprint of one asset. */
export function computeFingerprint(src: PixelSource): StyleFingerprint {
  const { data, width: w, height: h } = src;
  let fg = 0, partialEdge = 0, edgeCandidates = 0;
  let sumSat = 0, sumWarm = 0, sumVal = 0, sumLum = 0, sumLum2 = 0;
  let specular = 0, pure = 0;
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();

  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3];
    if (a > 8 && a < 248) edgeCandidates++;
    if (a > 40 && a < 220) partialEdge++;
    if (a < FG) continue;
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    fg++;
    const [, s, l] = rgbToHsl(r, g, b);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    sumSat += s; sumVal += l; sumWarm += (r - b) / 255; sumLum += lum; sumLum2 += lum * lum;
    // specular highlight: very bright + low saturation (a gloss tell)
    if (l > 0.85 && s < 0.15) specular++;
    // pure white / black
    if ((r > 250 && g > 250 && b > 250) || (r < 6 && g < 6 && b < 6)) pure++;
    // palette bucket (4 levels per channel)
    const key = ((r >> 6) << 4) | ((g >> 6) << 2) | (b >> 6);
    const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bin.n++; bin.r += r; bin.g += g; bin.b += b;
    bins.set(key, bin);
  }

  if (fg === 0) {
    return { saturation: 0, warmth: 0, value: 0, matteness: 1, edgeSoftness: 0, coverage: 0, contrast: 0, purity: 1, palette: [] };
  }

  const meanLum = sumLum / fg;
  const variance = Math.max(0, sumLum2 / fg - meanLum * meanLum);
  const palette = Array.from(bins.values())
    .sort((a, b) => b.n - a.n)
    .slice(0, 5)
    .map((c) => [Math.round(c.r / c.n), Math.round(c.g / c.n), Math.round(c.b / c.n)] as RGB);

  return {
    saturation: sumSat / fg,
    warmth: sumWarm / fg,
    value: sumVal / fg,
    matteness: 1 - specular / fg,
    edgeSoftness: edgeCandidates === 0 ? 0 : Math.min(1, partialEdge / Math.max(1, edgeCandidates)),
    coverage: fg / (w * h),
    contrast: Math.min(1, Math.sqrt(variance) * 3),
    purity: 1 - pure / fg,
    palette,
  };
}

/** Distance between two colours, 0..1 (normalized Euclidean in RGB). */
export function colorDist(a: RGB, b: RGB): number {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db) / (255 * Math.sqrt(3));
}

/** Palette distance: mean nearest-colour distance from a→b, 0..1. */
export function paletteDistance(a: RGB[], b: RGB[]): number {
  if (a.length === 0 || b.length === 0) return 1;
  let sum = 0;
  for (const ca of a) {
    let best = 1;
    for (const cb of b) best = Math.min(best, colorDist(ca, cb));
    sum += best;
  }
  return sum / a.length;
}

/** The measured style target: the mean PLUS the natural tolerance of each dimension,
 *  derived from the official library's own spread. Calibrating tolerances from the
 *  real variance is what lets official assets score high while AI tells score low. */
export type StyleDimKey = "saturation" | "warmth" | "value" | "matteness" | "edgeSoftness" | "coverage" | "contrast" | "purity";
export type StyleProfile = { mean: StyleFingerprint; tol: Record<StyleDimKey, number> };

/** [min, max] tolerance clamps per dimension (some dimensions naturally vary more). */
const TOL_BOUNDS: Record<StyleDimKey, [number, number]> = {
  saturation: [0.14, 0.45],
  warmth: [0.1, 0.32],
  value: [0.14, 0.38],
  matteness: [0.12, 0.4], // official matteness varies widely by render (cream sofa vs dark TV)
  edgeSoftness: [0.15, 0.5],
  coverage: [0.2, 0.7], // officials are tightly cropped; framing varies a lot
  contrast: [0.12, 0.4],
  purity: [0.08, 0.28], // official highlights read as bright low-sat pixels
};

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Build a profile: mean + tolerance = clamp(k·std) per dimension. */
export function buildProfile(list: StyleFingerprint[], k = 2.5): StyleProfile {
  const mean = averageFingerprints(list);
  const std = (sel: (f: StyleFingerprint) => number): number => {
    const m = sel(mean);
    const v = list.reduce((s, f) => s + (sel(f) - m) ** 2, 0) / Math.max(1, list.length);
    return Math.sqrt(v);
  };
  const sel: Record<StyleDimKey, (f: StyleFingerprint) => number> = {
    saturation: (f) => f.saturation, warmth: (f) => f.warmth, value: (f) => f.value,
    matteness: (f) => f.matteness, edgeSoftness: (f) => f.edgeSoftness, coverage: (f) => f.coverage,
    contrast: (f) => f.contrast, purity: (f) => f.purity,
  };
  const tol = {} as Record<StyleDimKey, number>;
  (Object.keys(TOL_BOUNDS) as StyleDimKey[]).forEach((key) => {
    tol[key] = clamp(k * std(sel[key]), TOL_BOUNDS[key][0], TOL_BOUNDS[key][1]);
  });
  return { mean, tol };
}

/** Average several fingerprints into a reference (palette = union of the strongest). */
export function averageFingerprints(list: StyleFingerprint[]): StyleFingerprint {
  if (list.length === 0) throw new Error("no fingerprints to average");
  const mean = (sel: (f: StyleFingerprint) => number) => list.reduce((s, f) => s + sel(f), 0) / list.length;
  const palette = list.flatMap((f) => f.palette).slice(0, 12);
  return {
    saturation: mean((f) => f.saturation),
    warmth: mean((f) => f.warmth),
    value: mean((f) => f.value),
    matteness: mean((f) => f.matteness),
    edgeSoftness: mean((f) => f.edgeSoftness),
    coverage: mean((f) => f.coverage),
    contrast: mean((f) => f.contrast),
    purity: mean((f) => f.purity),
    palette,
  };
}
