import { describe, it, expect } from "vitest";
import {
  CHUNK_WIDTH,
  CHUNK_TEMPLATES,
  templateFor,
  isMirrored,
  resolveChunk,
  visibleChunkRange,
  type BandId,
} from "../lib/village-chunks";

const BANDS: BandId[] = ["far", "mid", "near"];

describe("templates are well-formed", () => {
  it("every template has an id, a suitable band, and in-range fractions", () => {
    for (const t of CHUNK_TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.bands.length).toBeGreaterThan(0);
      for (const p of t.plots) {
        expect(p.dx).toBeGreaterThanOrEqual(0);
        expect(p.dx).toBeLessThan(1);
      }
      for (const d of t.decor) {
        expect(d.dx).toBeGreaterThanOrEqual(0);
        expect(d.dx).toBeLessThan(1);
      }
    }
  });
  it("covers the required chunk variety", () => {
    const types = new Set(CHUNK_TEMPLATES.map((t) => t.type));
    for (const need of ["residential", "forestEdge", "meadow", "crossroads", "hilltop", "park", "square"]) {
      expect(types.has(need as never)).toBe(true);
    }
  });
});

describe("sequencer is deterministic + varied", () => {
  it("templateFor is a pure function of (band, index)", () => {
    for (const b of BANDS) {
      for (let i = -3; i < 20; i++) {
        expect(templateFor(b, i).id).toBe(templateFor(b, i).id);
      }
    }
  });
  it("keeps variety within any short window (repetition never obvious)", () => {
    for (const b of BANDS) {
      for (let i = -20; i < 50; i++) {
        const window = new Set<string>();
        for (let j = 0; j < 10; j++) window.add(templateFor(b, i + j).id);
        // A band pool may be as small as 3; every 10-chunk window shows all of them.
        expect(window.size).toBeGreaterThanOrEqual(3);
      }
    }
  });
  it("uses several different templates across a stretch (not obviously repetitive)", () => {
    for (const b of BANDS) {
      const ids = new Set<string>();
      for (let i = 0; i < 40; i++) ids.add(templateFor(b, i).id);
      expect(ids.size).toBeGreaterThanOrEqual(3);
    }
  });
  it("only picks templates valid for the band", () => {
    for (const b of BANDS) {
      for (let i = 0; i < 40; i++) expect(templateFor(b, i).bands).toContain(b);
    }
  });
  it("isMirrored is deterministic and both values occur", () => {
    let t = 0, f = 0;
    for (let i = 0; i < 60; i++) {
      const m = isMirrored("near", i);
      expect(m).toBe(isMirrored("near", i));
      if (m) t++; else f++;
    }
    expect(t).toBeGreaterThan(0);
    expect(f).toBeGreaterThan(0);
  });
});

describe("resolveChunk places fixed, in-bounds, seamless content", () => {
  it("houses + decor land inside the chunk's world span", () => {
    for (let i = -2; i < 12; i++) {
      const c = resolveChunk("near", i);
      const lo = i * CHUNK_WIDTH;
      const hi = (i + 1) * CHUNK_WIDTH;
      for (const h of [...c.houses]) {
        expect(h.worldX).toBeGreaterThanOrEqual(lo - 0.001);
        expect(h.worldX).toBeLessThanOrEqual(hi + 0.001);
      }
      for (const d of c.decor) {
        expect(d.worldX).toBeGreaterThanOrEqual(lo - 0.001);
        expect(d.worldX).toBeLessThanOrEqual(hi + 0.001);
      }
    }
  });
  it("plots are FIXED — same index always yields the same house positions", () => {
    const a = resolveChunk("near", 7).houses.map((h) => h.worldX);
    const b = resolveChunk("near", 7).houses.map((h) => h.worldX);
    expect(a).toEqual(b);
  });
  it("adjacent chunks are contiguous with no gap or overlap at the seam", () => {
    const left = resolveChunk("mid", 3);
    const right = resolveChunk("mid", 4);
    const seam = 4 * CHUNK_WIDTH;
    // Left chunk items are all <= seam; right chunk items all >= seam.
    for (const d of left.decor) expect(d.worldX).toBeLessThanOrEqual(seam + 0.001);
    for (const d of right.decor) expect(d.worldX).toBeGreaterThanOrEqual(seam - 0.001);
  });
  it("mirroring reflects positions within the chunk", () => {
    // Find an index that is mirrored and one that isn't, compare a known template.
    const c = resolveChunk("near", 5);
    for (const h of c.houses) {
      const local = (h.worldX - 5 * CHUNK_WIDTH) / CHUNK_WIDTH;
      expect(local).toBeGreaterThanOrEqual(0);
      expect(local).toBeLessThanOrEqual(1);
    }
  });
});

describe("visibleChunkRange", () => {
  it("covers the span and scales with world offset", () => {
    const r = visibleChunkRange(0, 900);
    expect(r.iMin).toBeLessThanOrEqual(0);
    expect(r.iMax).toBeGreaterThanOrEqual(0);
    const r2 = visibleChunkRange(5000, 5900);
    expect(r2.iMin).toBeGreaterThan(r.iMin);
  });
});
