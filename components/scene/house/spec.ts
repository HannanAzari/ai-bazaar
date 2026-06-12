// Deterministic house specification.
// Every visual trait derives from a stable seed string (village id + slot),
// so a house always looks the same — across pages, and across SSR/client
// renders (no Math.random, no Date).

export type HouseLod = "street" | "card" | "map";
export type HouseState = "open" | "lived" | "owned";

export type HouseSpec = {
  wallW: number;
  wallH: number;
  roof: "gable" | "hip" | "round" | "dutch";
  dormer: boolean;
  windowShape: "arched" | "round" | "square";
  shutters: boolean;
  chimney: "left" | "right" | "none";
  halfTimber: boolean;
  door: "round" | "arched" | "plank";
  colors: {
    wall: string;
    wallShade: string;
    roof: string;
    roofShade: string;
    roofRidge: string;
    trim: string;
    trimDark: string;
    door: string;
    shutter: string;
  };
};

/** FNV-1a — small, stable string hash. */
export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Pick an index in [0, n) from the seed; different salts give independent picks. */
function pick(seed: number, salt: number, n: number): number {
  let x = (seed ^ Math.imul(salt + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) % n;
}

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const c = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function mixHex(a: string, b: string, t: number): string {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  return rgbToHex([ra[0] + (rb[0] - ra[0]) * t, ra[1] + (rb[1] - ra[1]) * t, ra[2] + (rb[2] - ra[2]) * t]);
}

const COOL_SHADOW = "#46365a";
const WARM_LIGHT = "#fff6e0";

/** Shade toward cool plum — the "warm light, cool shadow" signature. */
export function shade(hex: string, t: number): string {
  return mixHex(hex, COOL_SHADOW, t);
}

/** Tint toward warm white. */
export function tint(hex: string, t: number): string {
  return mixHex(hex, WARM_LIGHT, t);
}

const ROOF_BASES = ["#a65b3f", "#5b6b73", "#c9a35c", "#6b7f4f"]; // terracotta, slate, thatch, green shingle
const PLASTER = "#f0dfbc";
const TIMBER = "#8a5c3b";
const TIMBER_DARK = "#5c3e26";

export function deriveHouseSpec(seedInput: string, accent = "#a65b3f"): HouseSpec {
  const h = hashSeed(seedInput);

  const wallW = [148, 164, 180][pick(h, 1, 3)];
  const wallH = [80, 98, 118][pick(h, 2, 3)];
  const roof = (["gable", "hip", "round", "dutch"] as const)[pick(h, 3, 4)];
  const roofBase = ROOF_BASES[pick(h, 4, 4)];

  // Wall: plaster tinted by the village accent at varying strength, or whitewash
  const wallMix = [0, 0.12, 0.24, 0.38][pick(h, 5, 4)];
  const wall = wallMix === 0 ? tint(PLASTER, 0.4) : mixHex(PLASTER, accent, wallMix);

  // Round (hobbit) roofs always get a round door; round doors carry the accent
  const door = roof === "round" ? "round" : (["arched", "plank", "round", "arched"] as const)[pick(h, 6, 4)];
  const doorColor = door === "round" ? shade(mixHex(accent, TIMBER, 0.25), 0.08) : [TIMBER, TIMBER_DARK, shade(mixHex(accent, TIMBER, 0.5), 0.15)][pick(h, 7, 3)];

  return {
    wallW,
    wallH,
    roof,
    dormer: wallH === 98 && (roof === "gable" || roof === "hip") && pick(h, 8, 2) === 0,
    windowShape: (["arched", "round", "square"] as const)[pick(h, 9, 3)],
    shutters: pick(h, 10, 3) !== 0,
    chimney: roof === "round" ? "none" : (["left", "right", "right", "none"] as const)[pick(h, 11, 4)],
    halfTimber: wallMix <= 0.12 && pick(h, 12, 3) === 0,
    door,
    colors: {
      wall,
      wallShade: shade(wall, 0.14),
      roof: roofBase,
      roofShade: shade(roofBase, 0.18),
      roofRidge: tint(roofBase, 0.3),
      trim: TIMBER,
      trimDark: TIMBER_DARK,
      door: doorColor,
      shutter: shade(mixHex(accent, TIMBER, 0.4), 0.2),
    },
  };
}
