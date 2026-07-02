// ── Nestudio V2 — overlap-aware hit testing + tap cycling (M7B.2) ────────────
//
// A deterministic selection engine for OVERLAPPING objects. Selecting a small asset
// resting on a larger one (books on a coffee table, decor on a shelf, the avatar over
// furniture) was impossible because the topmost paint always swallowed the pointer.
//
// This pure module answers two questions:
//   1. hitTestCandidates(point) → every selectable object under the pointer, ordered
//      topmost-first, using VISIBLE-content bounds (not the padded PNG box) expanded
//      to a minimum tap target so tiny art stays reachable.
//   2. nextSelection(prev, …) → which candidate to select on this tap, cycling through
//      the overlap stack on repeated taps near the same point and resetting cleanly.
//
// Deterministic: same inputs ⇒ same output. No Math.random, no Date.now, no I/O, no
// React. Rotation is handled by axis-aligned visible bounds (an approximation noted in
// the docs; consistent with the existing hotspot-drag math).

import type { EditableNestObject } from "@/lib/nest-editor-types";
import type { LivingNestAsset } from "@/lib/nest-visual-types";
import type { NormalizedRect } from "@/lib/nest-types";
import { visibleRect } from "@/lib/nest-visual-bounds";
import { minObjectTapNormalized, type SceneSize } from "@/lib/nest-editor-touch-targets";

/** One object that lies under the pointer, with the data used to order candidates. */
export interface HitTestCandidate {
  objectId: string;
  zIndex: number;
  /** Visible-content area (normalized²) — smaller wins ties so a tiny on-top item is first. */
  visibleArea: number;
  /** Distance (normalized) from the tap to the visible rect centre (0 if inside). */
  distanceToTap: number;
}

/** The state carried between taps to drive deterministic overlap cycling. */
export interface TapCycleState {
  point: { x: number; y: number };
  candidateIds: string[];
  activeIndex: number;
  timestamp: number;
}

export interface HitTestOptions {
  /** Live scene pixel size, to size the minimum tap target. */
  scene?: SceneSize;
  /** Override the minimum tap footprint (normalized). Defaults from the touch policy. */
  minTap?: { width: number; height: number };
  /** Exclude objects flagged this way (e.g. a future "selection disabled"). Hidden is always excluded. */
  isExcluded?: (o: EditableNestObject) => boolean;
}

/** A tap is "the same tap location" within this normalized distance. */
export const TAP_CYCLE_MOVE_THRESHOLD = 0.045;
/** Repeated taps stop cycling after this idle gap (ms). */
export const TAP_CYCLE_TIMEOUT_MS = 1600;

const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);

/** Expand a rect to at least (minW × minH), keeping its centre fixed. */
function padToMin(r: NormalizedRect, minW: number, minH: number): NormalizedRect {
  const width = Math.max(r.width, minW);
  const height = Math.max(r.height, minH);
  return { x: r.x + r.width / 2 - width / 2, y: r.y + r.height / 2 - height / 2, width, height };
}

function pointInRect(px: number, py: number, r: NormalizedRect): boolean {
  return px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height;
}

/**
 * Every selectable object whose padded visible rect contains the point, ordered
 * deterministically TOPMOST-FIRST:
 *   1. higher zIndex first (nearer the viewer),
 *   2. then smaller visible area (a small item on top of a big one wins),
 *   3. then nearer the tap,
 *   4. then instanceId ascending (stable final tiebreak).
 * Hidden objects (and anything `isExcluded`) never appear. Uses VISIBLE bounds, not the
 * transparent PNG box, then pads to the minimum tap target so tiny art is reachable.
 */
export function hitTestCandidates(
  objects: EditableNestObject[],
  assetsById: Record<string, LivingNestAsset>,
  point: { x: number; y: number },
  opts: HitTestOptions = {},
): HitTestCandidate[] {
  const min = opts.minTap ?? minObjectTapNormalized(opts.scene);
  const out: HitTestCandidate[] = [];
  for (const o of objects) {
    if (o.hidden) continue;
    if (opts.isExcluded?.(o)) continue;
    const vis = visibleRect(o, o.assetId);
    const padded = padToMin(vis, min.width, min.height);
    if (!pointInRect(point.x, point.y, padded)) continue;
    const cx = vis.x + vis.width / 2;
    const cy = vis.y + vis.height / 2;
    const inside = pointInRect(point.x, point.y, vis);
    out.push({
      objectId: o.instanceId,
      zIndex: o.zIndex,
      visibleArea: vis.width * vis.height,
      distanceToTap: inside ? 0 : dist(point.x, point.y, cx, cy),
    });
  }
  out.sort(
    (a, b) =>
      b.zIndex - a.zIndex ||
      a.visibleArea - b.visibleArea ||
      a.distanceToTap - b.distanceToTap ||
      (a.objectId < b.objectId ? -1 : a.objectId > b.objectId ? 1 : 0),
  );
  return out;
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export interface NextSelectionResult {
  /** The object to select now (undefined when nothing is under the pointer). */
  selectedId?: string;
  /** The cycle state to carry to the next tap (undefined when there are no candidates). */
  state?: TapCycleState;
  /** True when this tap advanced an existing cycle (vs. starting fresh). */
  cycled: boolean;
}

/**
 * Decide the selection for a tap, cycling through overlapping candidates on repeated
 * taps at (nearly) the same point. The cycle RESETS — starting again at the topmost
 * candidate — when any of these change:
 *   • the pointer moved past TAP_CYCLE_MOVE_THRESHOLD,
 *   • the candidate set changed (objects added/removed/reordered under the point),
 *   • TAP_CYCLE_TIMEOUT_MS elapsed since the last tap.
 * The caller also resets by passing `prev = undefined` (e.g. on a mode change).
 * Pure + deterministic; `now` is injected so there is no Date.now here.
 */
export function nextSelection(
  prev: TapCycleState | undefined,
  candidates: HitTestCandidate[],
  point: { x: number; y: number },
  now: number,
  opts: { moveThreshold?: number; timeoutMs?: number } = {},
): NextSelectionResult {
  const ids = candidates.map((c) => c.objectId);
  if (ids.length === 0) return { selectedId: undefined, state: undefined, cycled: false };

  const moveThreshold = opts.moveThreshold ?? TAP_CYCLE_MOVE_THRESHOLD;
  const timeoutMs = opts.timeoutMs ?? TAP_CYCLE_TIMEOUT_MS;

  const continues =
    !!prev &&
    now - prev.timestamp <= timeoutMs &&
    dist(point.x, point.y, prev.point.x, prev.point.y) <= moveThreshold &&
    sameIds(prev.candidateIds, ids);

  const activeIndex = continues ? (prev!.activeIndex + 1) % ids.length : 0;
  return {
    selectedId: ids[activeIndex],
    state: { point: { x: point.x, y: point.y }, candidateIds: ids, activeIndex, timestamp: now },
    cycled: continues,
  };
}

/** Convenience: the ordered candidate ids under a point (topmost first). */
export function candidateIdsAt(
  objects: EditableNestObject[],
  assetsById: Record<string, LivingNestAsset>,
  point: { x: number; y: number },
  opts: HitTestOptions = {},
): string[] {
  return hitTestCandidates(objects, assetsById, point, opts).map((c) => c.objectId);
}
