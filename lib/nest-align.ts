// ── Nestudio V2 — smart alignment guides (M7B.1) ────────────────────────────
//
// Pure, deterministic alignment helper that replaces the permanent grid. While an
// object is dragged, it computes transient guides (canvas centre/thirds, floor seam,
// and edge/centre alignment with other objects) and an optional snap offset, using
// the moving object's VISIBLE rect so padded PNGs align by their art. Guides are
// computed per-gesture and discarded on release. No randomness; same input ⇒ same
// output. Threshold is in normalized units and is viewport-independent.

import type { NormalizedRect } from "@/lib/nest-types";

export interface AlignTarget {
  /** A reference rect to align against (another object's visible rect). */
  rect: NormalizedRect;
}

export interface AlignGuide {
  axis: "x" | "y";
  /** Normalized position of the guide line (0..1). */
  pos: number;
  kind: "canvas-center" | "canvas-third" | "floor-seam" | "edge" | "center";
}

export interface AlignResult {
  guides: AlignGuide[];
  /** Snap delta to apply to the moving rect's top-left, if any. */
  snap: { dx: number; dy: number };
}

export const ALIGN_THRESHOLD = 0.012;
const FLOOR_SEAM = 0.62;

const near = (a: number, b: number, t: number) => Math.abs(a - b) <= t;

/**
 * Compute alignment guides + a snap offset for a moving rect against the canvas and
 * other objects. `enabled=false` returns guides for feedback but no snap (so a
 * modifier can temporarily disable snapping mid-gesture).
 */
export function computeAlignment(
  moving: NormalizedRect,
  others: AlignTarget[],
  opts: { threshold?: number; enabled?: boolean } = {},
): AlignResult {
  const t = opts.threshold ?? ALIGN_THRESHOLD;
  const enabled = opts.enabled !== false;
  const guides: AlignGuide[] = [];

  const mx = { left: moving.x, center: moving.x + moving.width / 2, right: moving.x + moving.width };
  const my = { top: moving.y, center: moving.y + moving.height / 2, bottom: moving.y + moving.height };

  // Track the best (smallest-distance) snap per axis for determinism.
  let bestX: { d: number; delta: number } | null = null;
  let bestY: { d: number; delta: number } | null = null;
  const considerX = (movingVal: number, target: number, kind: AlignGuide["kind"]) => {
    if (!near(movingVal, target, t)) return;
    guides.push({ axis: "x", pos: target, kind });
    const delta = target - movingVal;
    const d = Math.abs(delta);
    if (!bestX || d < bestX.d) bestX = { d, delta };
  };
  const considerY = (movingVal: number, target: number, kind: AlignGuide["kind"]) => {
    if (!near(movingVal, target, t)) return;
    guides.push({ axis: "y", pos: target, kind });
    const delta = target - movingVal;
    const d = Math.abs(delta);
    if (!bestY || d < bestY.d) bestY = { d, delta };
  };

  // Canvas centre + thirds (x) and centre + floor seam (y).
  considerX(mx.center, 0.5, "canvas-center");
  considerX(mx.center, 1 / 3, "canvas-third");
  considerX(mx.center, 2 / 3, "canvas-third");
  considerY(my.center, 0.5, "canvas-center");
  considerY(my.bottom, FLOOR_SEAM, "floor-seam");

  // Edge + centre alignment with other objects (sorted for deterministic guide order).
  const sorted = [...others].sort((a, b) => a.rect.x - b.rect.x || a.rect.y - b.rect.y);
  for (const o of sorted) {
    const ox = { left: o.rect.x, center: o.rect.x + o.rect.width / 2, right: o.rect.x + o.rect.width };
    const oy = { top: o.rect.y, center: o.rect.y + o.rect.height / 2, bottom: o.rect.y + o.rect.height };
    considerX(mx.left, ox.left, "edge");
    considerX(mx.right, ox.right, "edge");
    considerX(mx.center, ox.center, "center");
    considerY(my.top, oy.top, "edge");
    considerY(my.bottom, oy.bottom, "edge");
    considerY(my.center, oy.center, "center");
  }

  const snap = { dx: enabled && bestX ? (bestX as { delta: number }).delta : 0, dy: enabled && bestY ? (bestY as { delta: number }).delta : 0 };
  return { guides, snap };
}
