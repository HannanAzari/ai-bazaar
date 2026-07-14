/**
 * village-street.ts
 * -----------------------------------------------------------------------------
 * Pure helpers for the infinite rolling-hills village (Nestudio Village V2).
 *
 * NO React, NO DOM, NO Three.js, NO Canvas, NO projection math — just a gently
 * undulating side-on landscape that streams forever. The world is a set of
 * horizontal PARALLAX BANDS (far → near). Each band is a rolling hill line and a
 * row of evenly-spaced CELLS; a cell deterministically holds a house, a piece of
 * decor, or open countryside. Because everything is a pure function of an integer
 * cell index, scrolling back and forth is perfectly stable and the world never
 * ends and never repeats obviously.
 *
 * The rendering layer translates each band by `-cameraX * band.parallax` (GPU
 * transform) and only re-windows the visible cell range occasionally — so this
 * file has no notion of screen pixels beyond the ground curve.
 */

export type Vec2 = { x: number; y: number };

export type Band = {
  id: string;
  /** Horizontal parallax: 1 = moves with the camera, <1 = distant/slower. */
  parallax: number;
  /** Ground base Y (px, layer space) that the hill line oscillates around. */
  baseY: number;
  /** Hill amplitude in px. */
  amp: number;
  /** Spatial frequency of the primary hill wave. */
  freq: number;
  /** World px between cell centres on this band. */
  spacing: number;
  /** Item scale for this band (far bands smaller). */
  scale: number;
};

export type CellKind =
  | "house"
  | "tree"
  | "bush"
  | "flower"
  | "lamp"
  | "mailbox"
  | "fence"
  | "rock"
  | "empty";

export type Cell = {
  /** Integer cell index on the band (can be negative; the world is two-sided). */
  k: number;
  kind: CellKind;
  /** World X (px) of the item's ground anchor, jittered within the cell. */
  worldX: number;
  /** Ground Y (px, layer space) the item's base sits on. */
  groundY: number;
  /** 0..1 deterministic variant seed (hue, sprite pick, size wobble…). */
  variant: number;
};

/* ────────────────────────────────────────────────────────────────────────── */
/* Determinism                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/** Stable 32-bit integer hash → [0, 1). No Math.random; scroll-stable. */
export function hash01(n: number, salt = 0): number {
  let h = Math.imul((n | 0) + 1, 374761393) + Math.imul(salt + 1, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function clamp(v: number, min: number, max: number): number {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Rolling terrain                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Ground height at a world X for a band — two summed sine waves for a natural,
 * never-flat, never-repeating-looking roll. Continuous everywhere (so houses ride
 * the hills and roads follow them). Smaller Y = higher up the screen.
 */
export function hillY(worldX: number, band: Pick<Band, "baseY" | "amp" | "freq">): number {
  const primary = Math.sin(worldX * band.freq);
  const detail = Math.sin(worldX * band.freq * 2.37 + 1.7);
  return band.baseY - primary * band.amp - detail * band.amp * 0.34;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Cell content — houses, decor, and countryside                              */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * "Settlement density" at a cell — a slow wave over k so the village has dense
 * clustered stretches and sparser countryside between them (never uniform). In
 * [0,1]: high → likely a house, low → open country with light decor.
 */
export function settlement(k: number, bandSalt: number): number {
  const slow = 0.5 + 0.5 * Math.sin(k * 0.23 + bandSalt * 2.1);
  const jitter = hash01(k, bandSalt + 40) * 0.4 - 0.2;
  return clamp(slow + jitter, 0, 1);
}

const DECOR: CellKind[] = ["tree", "tree", "bush", "flower", "lamp", "mailbox", "fence", "rock", "bush", "tree"];

/**
 * What lives at cell `k` on a band. Deterministic. `houseBias` lifts or drops the
 * chance of a house (near bands host more houses; far bands more trees).
 */
export function cellContent(k: number, band: Band, bandSalt: number, houseBias = 0): Cell {
  const dens = settlement(k, bandSalt);
  const roll = hash01(k, bandSalt + 7);
  const jx = (hash01(k, bandSalt + 3) - 0.5) * band.spacing * 0.5;
  const worldX = k * band.spacing + jx;
  const groundY = hillY(worldX, band);
  const variant = hash01(k, bandSalt + 11);

  let kind: CellKind;
  if (roll < dens * 0.72 + houseBias) {
    kind = "house";
  } else if (roll < dens * 0.72 + houseBias + 0.24) {
    kind = "empty"; // breathing room right around dwellings and in open country
  } else {
    kind = DECOR[Math.floor(hash01(k, bandSalt + 19) * DECOR.length)];
  }

  return { k, kind, worldX, groundY, variant };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Streaming window                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Inclusive integer cell range visible (plus buffer) on a band for the current
 * camera. The band is drawn translated by -cameraX*parallax, so an item at
 * worldX shows at worldX - cameraX*parallax.
 */
export function visibleCellRange(
  cameraX: number,
  band: Band,
  viewportWidth: number,
  buffer: number,
): { kMin: number; kMax: number } {
  const left = cameraX * band.parallax - buffer;
  const right = cameraX * band.parallax + viewportWidth + buffer;
  return { kMin: Math.floor(left / band.spacing), kMax: Math.ceil(right / band.spacing) };
}

/** Build the cell list for a band across an inclusive k-range. */
export function bandCells(band: Band, bandSalt: number, kMin: number, kMax: number, houseBias = 0): Cell[] {
  const cells: Cell[] = [];
  for (let k = kMin; k <= kMax; k++) cells.push(cellContent(k, band, bandSalt, houseBias));
  return cells;
}

/**
 * SVG path `d` for a band's ground fill across a world X range, sampled from
 * hillY. Coordinates are ABSOLUTE world/layer space (the layer transform brings
 * them on-screen). `floorY` is the bottom the fill extends to.
 */
export function groundPath(band: Band, worldLeft: number, worldRight: number, floorY: number, step = 24): string {
  let d = `M ${worldLeft.toFixed(1)} ${floorY.toFixed(1)} `;
  d += `L ${worldLeft.toFixed(1)} ${hillY(worldLeft, band).toFixed(1)} `;
  for (let x = worldLeft; x <= worldRight; x += step) {
    d += `L ${x.toFixed(1)} ${hillY(x, band).toFixed(1)} `;
  }
  d += `L ${worldRight.toFixed(1)} ${hillY(worldRight, band).toFixed(1)} `;
  d += `L ${worldRight.toFixed(1)} ${floorY.toFixed(1)} Z`;
  return d;
}

/**
 * SVG path `d` for a road ribbon running along a band, offset `drop` px below the
 * hill line so it reads as a path lying on the ground.
 */
export function roadPath(band: Band, worldLeft: number, worldRight: number, drop: number, step = 20): string {
  let d = "";
  for (let x = worldLeft; x <= worldRight; x += step) {
    d += `${x === worldLeft ? "M" : "L"} ${x.toFixed(1)} ${(hillY(x, band) + drop).toFixed(1)} `;
  }
  return d.trim();
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Camera physics (pure)                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

export function applyInertia(velocity: Vec2, friction: number): Vec2 {
  return { x: velocity.x * friction, y: velocity.y * friction };
}

export function clampVelocity(v: Vec2, max: number): Vec2 {
  const mag = Math.hypot(v.x, v.y);
  if (mag <= max || mag === 0) return { x: v.x, y: v.y };
  const s = max / mag;
  return { x: v.x * s, y: v.y * s };
}
