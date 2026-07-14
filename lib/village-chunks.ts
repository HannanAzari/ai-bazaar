/**
 * village-chunks.ts
 * -----------------------------------------------------------------------------
 * The chunk-based world engine for the Rolling Village. The world is NOT randomly
 * generated — it is assembled from a small set of hand-authored, reusable terrain
 * CHUNKS. Each chunk is a designed little scene (a residential row, a park, a
 * crossroads…) with FIXED house plots and rule-placed decor. Chunks stream in as
 * the camera moves and connect seamlessly: the rolling ground and the road ribbon
 * are continuous global functions (see lib/village-street), so a chunk only places
 * CONTENT — you never see a boundary.
 *
 * "Roads define plots; plots define houses" — every house sits at an authored
 * offset beside the road, so villages read as intentional, never scattered.
 *
 * Determinism: a chunk's content is a pure function of its integer index (and a
 * per-band salt), so exploring back and forth is perfectly stable, and chunks may
 * mirror for variety without the repetition ever looking obvious.
 */

import { hash01 } from "./village-street";

export type BandId = "far" | "mid" | "near";

export type DecorKind = "tree" | "bush" | "flower" | "lamp" | "mailbox" | "fence" | "rock";

/** A house plot inside a chunk, authored as a fraction across the chunk. */
export type PlotSpec = { dx: number; hueSeed: number };

/** Decor inside a chunk. `dy` is a signed fraction of the band's slope depth:
 *  negative = uphill / behind the houses, positive = downhill / in front. */
export type DecorSpec = { dx: number; kind: DecorKind; dy: number };

/** A vertical lane linking the road up to a plot (crossroads / square). */
export type ConnectorSpec = { dx: number };

export type ChunkTemplate = {
  id: string;
  type: "residential" | "forestEdge" | "meadow" | "crossroads" | "hilltop" | "park" | "square";
  /** Which bands this template suits (near = dense village, far = quiet country). */
  bands: BandId[];
  plots: PlotSpec[];
  decor: DecorSpec[];
  connectors?: ConnectorSpec[];
};

export const CHUNK_WIDTH = 1000;

/* ────────────────────────────────────────────────────────────────────────── */
/* Hand-authored templates                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

// Decor rules applied throughout: trees sit behind houses (dy<0) or beside the
// road; flowers cluster near a house entrance (same dx, dy>0); bushes soften the
// gaps; lamps + mailboxes line the road.
export const CHUNK_TEMPLATES: ChunkTemplate[] = [
  {
    id: "res-row", type: "residential", bands: ["near", "mid"],
    plots: [{ dx: 0.16, hueSeed: 0.1 }, { dx: 0.5, hueSeed: 0.55 }, { dx: 0.84, hueSeed: 0.8 }],
    decor: [
      { dx: 0.16, kind: "tree", dy: -0.55 }, { dx: 0.2, kind: "flower", dy: 0.22 },
      { dx: 0.5, kind: "flower", dy: 0.22 }, { dx: 0.54, kind: "mailbox", dy: 0.34 },
      { dx: 0.84, kind: "tree", dy: -0.5 }, { dx: 0.8, kind: "flower", dy: 0.22 },
      { dx: 0.33, kind: "lamp", dy: 0.42 }, { dx: 0.67, kind: "lamp", dy: 0.42 },
      { dx: 0.08, kind: "bush", dy: 0.3 }, { dx: 0.95, kind: "bush", dy: 0.3 },
    ],
  },
  {
    id: "res-pair", type: "residential", bands: ["near", "mid"],
    plots: [{ dx: 0.28, hueSeed: 0.35 }, { dx: 0.72, hueSeed: 0.68 }],
    decor: [
      { dx: 0.28, kind: "flower", dy: 0.22 }, { dx: 0.24, kind: "tree", dy: -0.5 },
      { dx: 0.72, kind: "mailbox", dy: 0.32 }, { dx: 0.78, kind: "tree", dy: -0.5 },
      { dx: 0.5, kind: "bush", dy: 0.28 }, { dx: 0.5, kind: "lamp", dy: 0.44 },
      { dx: 0.1, kind: "rock", dy: 0.36 }, { dx: 0.9, kind: "flower", dy: 0.2 },
    ],
  },
  {
    id: "crossroads", type: "crossroads", bands: ["near", "mid"],
    plots: [{ dx: 0.14, hueSeed: 0.2 }, { dx: 0.86, hueSeed: 0.9 }],
    connectors: [{ dx: 0.5 }],
    decor: [
      { dx: 0.44, kind: "lamp", dy: 0.5 }, { dx: 0.56, kind: "lamp", dy: 0.5 },
      { dx: 0.14, kind: "tree", dy: -0.5 }, { dx: 0.86, kind: "tree", dy: -0.5 },
      { dx: 0.5, kind: "flower", dy: 0.18 }, { dx: 0.3, kind: "bush", dy: 0.3 }, { dx: 0.7, kind: "bush", dy: 0.3 },
    ],
  },
  {
    id: "square", type: "square", bands: ["near"],
    plots: [{ dx: 0.2, hueSeed: 0.05 }, { dx: 0.4, hueSeed: 0.3 }, { dx: 0.6, hueSeed: 0.62 }, { dx: 0.8, hueSeed: 0.85 }],
    connectors: [{ dx: 0.5 }],
    decor: [
      { dx: 0.5, kind: "lamp", dy: 0.55 }, { dx: 0.35, kind: "flower", dy: 0.25 }, { dx: 0.65, kind: "flower", dy: 0.25 },
      { dx: 0.28, kind: "bush", dy: 0.3 }, { dx: 0.72, kind: "bush", dy: 0.3 },
      { dx: 0.2, kind: "mailbox", dy: 0.34 }, { dx: 0.8, kind: "mailbox", dy: 0.34 },
    ],
  },
  {
    id: "forest-edge", type: "forestEdge", bands: ["far", "mid"],
    plots: [{ dx: 0.5, hueSeed: 0.45 }],
    decor: [
      { dx: 0.1, kind: "tree", dy: -0.2 }, { dx: 0.24, kind: "tree", dy: 0.1 }, { dx: 0.38, kind: "tree", dy: -0.4 },
      { dx: 0.5, kind: "flower", dy: 0.22 }, { dx: 0.66, kind: "tree", dy: 0.15 }, { dx: 0.8, kind: "tree", dy: -0.3 },
      { dx: 0.92, kind: "bush", dy: 0.3 }, { dx: 0.16, kind: "bush", dy: 0.34 },
    ],
  },
  {
    id: "meadow", type: "meadow", bands: ["far", "mid", "near"],
    plots: [],
    decor: [
      { dx: 0.12, kind: "flower", dy: 0.2 }, { dx: 0.3, kind: "bush", dy: 0.34 }, { dx: 0.45, kind: "tree", dy: -0.25 },
      { dx: 0.6, kind: "flower", dy: 0.28 }, { dx: 0.74, kind: "bush", dy: 0.2 }, { dx: 0.88, kind: "flower", dy: 0.24 },
      { dx: 0.5, kind: "rock", dy: 0.4 },
    ],
  },
  {
    id: "hilltop", type: "hilltop", bands: ["far", "mid"],
    plots: [{ dx: 0.4, hueSeed: 0.5 }, { dx: 0.6, hueSeed: 0.75 }],
    decor: [
      { dx: 0.2, kind: "tree", dy: -0.4 }, { dx: 0.8, kind: "tree", dy: -0.4 },
      { dx: 0.5, kind: "fence", dy: 0.2 }, { dx: 0.4, kind: "flower", dy: 0.2 }, { dx: 0.6, kind: "flower", dy: 0.2 },
      { dx: 0.1, kind: "bush", dy: 0.3 },
    ],
  },
  {
    id: "park", type: "park", bands: ["near", "mid"],
    plots: [],
    connectors: [{ dx: 0.5 }],
    decor: [
      { dx: 0.18, kind: "tree", dy: -0.3 }, { dx: 0.32, kind: "tree", dy: 0.1 }, { dx: 0.5, kind: "tree", dy: -0.45 },
      { dx: 0.68, kind: "tree", dy: 0.12 }, { dx: 0.82, kind: "tree", dy: -0.28 },
      { dx: 0.3, kind: "lamp", dy: 0.46 }, { dx: 0.7, kind: "lamp", dy: 0.46 },
      { dx: 0.5, kind: "fence", dy: 0.3 }, { dx: 0.4, kind: "flower", dy: 0.24 }, { dx: 0.6, kind: "bush", dy: 0.26 },
    ],
  },
];

// Per-band pools — near hosts dense villages, far hosts quiet country. Ordered so
// the common cases are picked most, but every band gets variety.
const BAND_POOLS: Record<BandId, ChunkTemplate[]> = {
  near: CHUNK_TEMPLATES.filter((t) => t.bands.includes("near")),
  mid: CHUNK_TEMPLATES.filter((t) => t.bands.includes("mid")),
  far: CHUNK_TEMPLATES.filter((t) => t.bands.includes("far")),
};

/* ────────────────────────────────────────────────────────────────────────── */
/* Sequencer                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

const BAND_SALT: Record<BandId, number> = { far: 101, mid: 211, near: 331 };

/**
 * Which template a band shows at a chunk index. Deterministic; mixes the index so
 * consecutive chunks rarely match. A best-effort bump steers away from the two
 * preceding picks so a template never lands three-in-a-row and repetition never
 * looks obvious (mirroring adds further variety).
 */
export function templateFor(band: BandId, index: number): ChunkTemplate {
  const pool = BAND_POOLS[band];
  const salt = BAND_SALT[band];
  const P = pool.length;
  const pick = (i: number) => Math.floor(hash01(i, salt) * P) % P;
  let ti = pick(index);
  // On a collision with the previous chunk, rotate to one of the OTHER templates
  // (uniformly, via a second hash) — keeps the small band pools well mixed.
  if (ti === pick(index - 1)) ti = (ti + 1 + Math.floor(hash01(index, salt + 91) * (P - 1))) % P;
  return pool[ti];
}

/** Whether a band's chunk is mirrored (adds variety without new templates). */
export function isMirrored(band: BandId, index: number): boolean {
  return hash01(index, BAND_SALT[band] + 17) > 0.62;
}

export type ResolvedHouse = { id: string; worldX: number; hueSeed: number };
export type ResolvedDecor = { id: string; worldX: number; kind: DecorKind; dy: number };
export type ResolvedConnector = { id: string; worldX: number };
export type ResolvedChunk = {
  index: number;
  type: ChunkTemplate["type"];
  houses: ResolvedHouse[];
  decor: ResolvedDecor[];
  connectors: ResolvedConnector[];
};

/** Resolve one band's chunk at an index into absolute-world items. */
export function resolveChunk(band: BandId, index: number): ResolvedChunk {
  const t = templateFor(band, index);
  const mirror = isMirrored(band, index);
  const origin = index * CHUNK_WIDTH;
  const at = (dx: number) => origin + (mirror ? 1 - dx : dx) * CHUNK_WIDTH;
  return {
    index,
    type: t.type,
    houses: t.plots.map((p, i) => ({ id: `${band}-${index}-h${i}`, worldX: at(p.dx), hueSeed: p.hueSeed })),
    decor: t.decor.map((d, i) => ({ id: `${band}-${index}-d${i}`, worldX: at(d.dx), kind: d.kind, dy: d.dy })),
    connectors: (t.connectors ?? []).map((c, i) => ({ id: `${band}-${index}-c${i}`, worldX: at(c.dx) })),
  };
}

/** Inclusive chunk-index range covering a band's visible world span (+buffer). */
export function visibleChunkRange(worldLeft: number, worldRight: number): { iMin: number; iMax: number } {
  return { iMin: Math.floor(worldLeft / CHUNK_WIDTH), iMax: Math.ceil(worldRight / CHUNK_WIDTH) };
}
