// ── M19 — Village model ───────────────────────────────────────────────────────
//
// A Village is a small neighborhood of Houses laid out on a hexagonal grid. Real
// creators sit near the heart of the village; the rest is filled with generated
// neighbors so a brand-new Nestudio still feels like a lived-in place rather than
// an empty lot. Everything is **deterministic** (seed-driven, no Math.random /
// Date.now) so the village is stable across renders, reloads, and SSR.
//
// This is an emotional prototype, not infrastructure: no world coordinates, no
// server-side villages, no infinite map. Just "you arrive in a place."

import { deriveHouse, hashSeed, styleFor, type House } from "@/lib/nest-house";
import type { DiscoveryCreator } from "@/lib/nest-discovery";

// ── Hex geometry (pointy-top axial coords) ─────────────────────────────────────

export type Axial = { q: number; r: number };

/**
 * A spiral of `count` unique axial hex coordinates starting at the center (0,0)
 * and winding outward ring by ring — so index 0 is the middle of the village and
 * later indices are the outskirts.
 */
export function hexSpiral(count: number): Axial[] {
  const out: Axial[] = [{ q: 0, r: 0 }];
  // Axial directions, walked in order to trace each ring.
  const dirs: Axial[] = [
    { q: 1, r: 0 }, { q: 0, r: 1 }, { q: -1, r: 1 },
    { q: -1, r: 0 }, { q: 0, r: -1 }, { q: 1, r: -1 },
  ];
  let ring = 1;
  while (out.length < count) {
    // Step out to the start of this ring, then walk its six sides.
    let cell: Axial = { q: dirs[4].q * ring, r: dirs[4].r * ring };
    for (let side = 0; side < 6 && out.length < count; side++) {
      for (let step = 0; step < ring && out.length < count; step++) {
        out.push(cell);
        cell = { q: cell.q + dirs[side].q, r: cell.r + dirs[side].r };
      }
    }
    ring++;
  }
  return out.slice(0, count);
}

/** Pixel center of a hex, with a small deterministic jitter so it feels hand-placed. */
export function axialToPixel(a: Axial, size: number, seed: number): { x: number; y: number } {
  const x = size * Math.sqrt(3) * (a.q + a.r / 2);
  const y = size * 1.5 * a.r;
  // Jitter in [-0.16, +0.16] of a cell — enough to break the rigid grid, small
  // enough that houses never overlap. Derived from the seed → stable.
  const jx = ((seed % 33) / 33 - 0.5) * size * 0.32;
  const jy = (((seed >> 5) % 33) / 33 - 0.5) * size * 0.32;
  return { x: x + jx, y: y + jy };
}

// ── Generated neighbors ────────────────────────────────────────────────────────

const NEIGHBOR_NAMES = [
  "Juniper", "Bramble", "Clementine", "Sorrel", "Pippin", "Marigold", "Hazel",
  "Fennel", "Wren", "Cedar", "Poppy", "Thistle", "Rowan", "Saffron", "Aspen",
  "Willow", "Bracken", "Linden", "Maple", "Fig", "Olive", "Basil", "Nettle",
  "Clove", "Ivy",
];
const NEIGHBOR_PERSONAS = ["Creator", "Writer", "Gamer", "Minimalist", "Garden"];
const NEIGHBOR_BIOS = [
  "Tending a small, warm corner of the village.",
  "Come in — the kettle's usually on.",
  "Making quiet things, mostly after dark.",
  "A little garden, a little studio.",
  "Still decorating. Always decorating.",
  "Keeps the porch light on for wanderers.",
];

/** A deterministic generated neighbor for slot `index` (keeps the village alive). */
export function neighborHouse(index: number): House {
  const seed = hashSeed(`neighbor:${index}`);
  const name = NEIGHBOR_NAMES[index % NEIGHBOR_NAMES.length];
  const persona = NEIGHBOR_PERSONAS[seed % NEIGHBOR_PERSONAS.length];
  return {
    id: `n-${index}`,
    name,
    bio: NEIGHBOR_BIOS[seed % NEIGHBOR_BIOS.length],
    persona,
    style: styleFor(persona),
    seed,
    isReal: false,
    online: seed % 5 < 2,
    latestNestTitle: undefined,
  };
}

// ── Village assembly ───────────────────────────────────────────────────────────

export type VillageHouse = House & { axial: Axial; x: number; y: number };

export type Village = {
  houses: VillageHouse[];
  /** Board bounds (all house coords are shifted to be positive within these). */
  width: number;
  height: number;
  /** Pixel center of the village (the (0,0) hex) — where the camera settles. */
  center: { x: number; y: number };
  hexSize: number;
};

export type BuildVillageOptions = {
  /** Total houses in the village (real + generated). */
  targetCount?: number;
  /** Hex cell radius in px. */
  hexSize?: number;
  /** Padding around the outermost houses in px. */
  padding?: number;
};

/**
 * Lay real houses near the center, then fill outward with generated neighbors up
 * to `targetCount`. Positions are deterministic (spiral order + seeded jitter).
 */
export function buildVillage(realHouses: House[], opts: BuildVillageOptions = {}): Village {
  const targetCount = Math.max(opts.targetCount ?? 20, realHouses.length);
  const hexSize = opts.hexSize ?? 78;
  const padding = opts.padding ?? hexSize * 1.4;

  const houses: House[] = [];
  for (let i = 0; i < targetCount; i++) {
    houses.push(i < realHouses.length ? realHouses[i] : neighborHouse(i));
  }

  const cells = hexSpiral(targetCount);
  const placed = houses.map((h, i) => {
    const p = axialToPixel(cells[i], hexSize, h.seed);
    return { ...h, axial: cells[i], x: p.x, y: p.y };
  });

  // Shift everything positive and record the board size + where (0,0) lands.
  const xs = placed.map((h) => h.x);
  const ys = placed.map((h) => h.y);
  const minX = Math.min(...xs, 0);
  const minY = Math.min(...ys, 0);
  const offX = padding - minX;
  const offY = padding - minY;
  const shifted: VillageHouse[] = placed.map((h) => ({ ...h, x: h.x + offX, y: h.y + offY }));

  const width = Math.max(...shifted.map((h) => h.x)) + padding;
  const height = Math.max(...shifted.map((h) => h.y)) + padding;

  return { houses: shifted, width, height, center: { x: offX, y: offY }, hexSize };
}

/** Convenience: build a village directly from resolved discovery creators. */
export function villageFromCreators(
  creators: { creator: DiscoveryCreator; persona?: string; nestHref?: string; latestNestTitle?: string }[],
  opts?: BuildVillageOptions,
): Village {
  return buildVillage(creators.map(deriveHouse), opts);
}

// ── Navigation (next / previous house within the village) ──────────────────────

export function houseIndex(village: Village, id: string): number {
  return village.houses.findIndex((h) => h.id === id);
}

/** The next/previous house in the village, wrapping around. `dir` is +1 or -1. */
export function neighborOf(village: Village, id: string, dir: 1 | -1): VillageHouse | null {
  const n = village.houses.length;
  if (n === 0) return null;
  const i = houseIndex(village, id);
  if (i < 0) return village.houses[0];
  return village.houses[(i + dir + n) % n];
}
