// ── Nestudio V2 — placement semantics + support rules + occupied zones (M7B.1)
//
// Advisory placement logic (NOT a physics engine): each asset has a placement mode
// (wall/floor/surface/foreground/architecture) and optional support rules (e.g. books
// need a surface). Templates may declare "occupied zones" — baked architecture such as
// a built-in niche or a window — so the editor can warn when a movable asset covers
// them. All checks are advisory: they inform; advanced authors may override. Pure.

import type { NestPlane, NormalizedRect } from "@/lib/nest-types";
import type { LivingNestAsset, LivingNestSlotType } from "@/lib/nest-visual-types";
import type { EditableNestObject } from "@/lib/nest-editor-types";
import { slotTypeForAsset } from "@/lib/nest-editor-policy";
import { visibleRect } from "@/lib/nest-visual-bounds";

export type AssetPlacementMode = "wall" | "floor" | "surface" | "foreground" | "architecture";

export interface AssetSupportRule {
  requiresSurface?: boolean;
  allowedSupportCategories?: string[];
  defaultSupportAssetId?: string;
}

const PLACEMENT_MODE: Partial<Record<LivingNestSlotType, AssetPlacementMode>> = {
  frame: "wall",
  media: "floor",
  sofa: "floor",
  table: "floor",
  rug: "floor",
  lamp: "floor",
  plant: "floor",
  avatar: "floor",
  side_table: "floor",
  speaker: "floor",
  shelf: "floor", // a freestanding bookshelf
  books: "surface",
};

const SUPPORT_RULES: Partial<Record<LivingNestSlotType, AssetSupportRule>> = {
  // Loose books should sit on a table / shelf / console, not float on the floor.
  books: { requiresSurface: true, allowedSupportCategories: ["furniture"], defaultSupportAssetId: "ast-coffee-table" },
};

export function placementModeForAsset(asset: LivingNestAsset | undefined): AssetPlacementMode {
  const st = asset ? slotTypeForAsset(asset) : undefined;
  return (st && PLACEMENT_MODE[st]) || "floor";
}

export function supportRuleForAsset(asset: LivingNestAsset | undefined): AssetSupportRule | undefined {
  const st = asset ? slotTypeForAsset(asset) : undefined;
  return st ? SUPPORT_RULES[st] : undefined;
}

/** Rectangle overlap as a fraction of the first rect's area. */
export function overlapFraction(a: NormalizedRect, b: NormalizedRect): number {
  const ix = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const inter = ix * iy;
  const area = a.width * a.height;
  return area > 0 ? inter / area : 0;
}

/**
 * Whether `obj` rests on a supporting object (its visible base sits on another
 * object's top band). Used to advise that loose books should be on a surface.
 */
export function hasSupportingSurface(
  obj: EditableNestObject,
  others: EditableNestObject[],
  assetsById: Record<string, LivingNestAsset>,
): boolean {
  const rule = supportRuleForAsset(assetsById[obj.assetId]);
  if (!rule?.requiresSurface) return true;
  const base = visibleRect(obj, obj.assetId);
  const baseY = base.y + base.height;
  for (const o of others) {
    if (o.instanceId === obj.instanceId || o.hidden) continue;
    const a = assetsById[o.assetId];
    if (rule.allowedSupportCategories && a && !rule.allowedSupportCategories.includes(a.category)) continue;
    const r = visibleRect(o, o.assetId);
    // base sits within the support's top band and overlaps horizontally
    const onTopBand = baseY >= r.y - 0.06 && baseY <= r.y + r.height * 0.5;
    const xOverlap = Math.min(base.x + base.width, r.x + r.width) - Math.max(base.x, r.x) > base.width * 0.3;
    if (onTopBand && xOverlap) return true;
  }
  return false;
}

// ── Occupied zones (baked architecture) ──────────────────────────────────────

export interface NestOccupiedZone {
  id: string;
  name: string;
  bounds: NormalizedRect;
  plane: NestPlane;
  purpose: "architecture" | "window" | "door" | "built_in_storage" | "reserved";
  advisoryOnly?: boolean;
}

/** Occupied zones baked into the Golden Living Nest background (advisory). */
export const GOLDEN_LIVING_NEST_OCCUPIED_ZONES: NestOccupiedZone[] = [
  { id: "zone-window", name: "Window", bounds: { x: 0.0, y: 0.06, width: 0.15, height: 0.55 }, plane: "left_sliver", purpose: "window", advisoryOnly: true },
  { id: "zone-niche", name: "Built-in niche", bounds: { x: 0.83, y: 0.08, width: 0.17, height: 0.55 }, plane: "right_sliver", purpose: "built_in_storage", advisoryOnly: true },
];

/** Occupied zones whose area an object's visible rect significantly overlaps. */
export function occupiedZoneConflicts(
  obj: EditableNestObject,
  zones: NestOccupiedZone[] = GOLDEN_LIVING_NEST_OCCUPIED_ZONES,
): NestOccupiedZone[] {
  const r = visibleRect(obj, obj.assetId);
  return zones.filter((z) => overlapFraction(z.bounds, r) > 0.25);
}

// ── Support-surface suggestions (M7B.2) ──────────────────────────────────────
//
// When an asset that needs a surface (loose books) floats, we don't just warn — we
// SUGGEST a compatible support nearby and offer one-tap placement. Ranking is
// deterministic so the same scene always proposes the same surface.

export interface SupportCandidate {
  instanceId: string;
  assetId: string;
  /** Fraction of the object's base that horizontally overlaps the support. */
  overlap: number;
  /** Vertical gap (normalized) between the object's base and the support's top. */
  distance: number;
  zIndex: number;
}

/**
 * Compatible support surfaces under/near an object's base, ranked deterministically:
 *   1. more horizontal overlap first,
 *   2. then nearer (smaller vertical gap to the support's top),
 *   3. then higher z (nearer the viewer),
 *   4. then instanceId ascending.
 * Only returns candidates when the object actually requires a surface. A support is in
 * scope when its top band sits at-or-below the object's base within a reach window and
 * the bases overlap horizontally. Pure.
 */
export function supportCandidates(
  obj: EditableNestObject,
  others: EditableNestObject[],
  assetsById: Record<string, LivingNestAsset>,
  reach = 0.22,
): SupportCandidate[] {
  const rule = supportRuleForAsset(assetsById[obj.assetId]);
  if (!rule?.requiresSurface) return [];
  const base = visibleRect(obj, obj.assetId);
  const baseY = base.y + base.height;
  const baseCenterX = base.x + base.width / 2;
  const out: SupportCandidate[] = [];
  for (const o of others) {
    if (o.instanceId === obj.instanceId || o.hidden) continue;
    const a = assetsById[o.assetId];
    if (rule.allowedSupportCategories && a && !rule.allowedSupportCategories.includes(a.category)) continue;
    const r = visibleRect(o, o.assetId);
    // The support's top must be near the object's base (within reach, slightly above or below).
    const gap = r.y - baseY; // >0: support top below base (object floating above it)
    if (gap < -r.height * 0.5 || gap > reach) continue;
    const xOverlapPx = Math.min(base.x + base.width, r.x + r.width) - Math.max(base.x, r.x);
    if (xOverlapPx <= 0) {
      // Allow a near-miss if the support is horizontally close (creator can still drop on it).
      const near = Math.abs(baseCenterX - (r.x + r.width / 2)) <= r.width * 0.75 + base.width;
      if (!near) continue;
    }
    const overlap = base.width > 0 ? Math.max(0, xOverlapPx) / base.width : 0;
    out.push({ instanceId: o.instanceId, assetId: o.assetId, overlap, distance: Math.abs(gap), zIndex: o.zIndex });
  }
  out.sort(
    (p, q) =>
      q.overlap - p.overlap ||
      p.distance - q.distance ||
      q.zIndex - p.zIndex ||
      (p.instanceId < q.instanceId ? -1 : p.instanceId > q.instanceId ? 1 : 0),
  );
  return out;
}

/**
 * The normalized (dx, dy) to move `obj` so its visible base sits centred on the top of
 * `support`. Deterministic; the caller applies it through `moveObject` so clamping +
 * history stay consistent. Returns {0,0} when either asset is missing.
 */
export function anchorDeltaForSupport(
  obj: EditableNestObject,
  support: EditableNestObject,
): { dx: number; dy: number } {
  const base = visibleRect(obj, obj.assetId);
  const top = visibleRect(support, support.assetId);
  const dx = top.x + top.width / 2 - (base.x + base.width / 2);
  const dy = top.y - (base.y + base.height);
  return { dx: +dx.toFixed(4), dy: +dy.toFixed(4) };
}

export interface PlacementWarning {
  instanceId: string;
  kind: "support" | "occupied-zone";
  message: string;
}

/** Advisory placement warnings (support surface + occupied zones). Pure, deterministic. */
export function placementWarnings(
  objects: EditableNestObject[],
  assetsById: Record<string, LivingNestAsset>,
  zones: NestOccupiedZone[] = GOLDEN_LIVING_NEST_OCCUPIED_ZONES,
): PlacementWarning[] {
  const out: PlacementWarning[] = [];
  for (const o of objects) {
    if (o.hidden) continue;
    const asset = assetsById[o.assetId];
    if (supportRuleForAsset(asset)?.requiresSurface && !hasSupportingSurface(o, objects, assetsById)) {
      out.push({ instanceId: o.instanceId, kind: "support", message: `${asset?.name ?? o.assetId} should sit on a surface (table or shelf)` });
    }
    for (const z of occupiedZoneConflicts(o, zones)) {
      out.push({ instanceId: o.instanceId, kind: "occupied-zone", message: `overlaps the ${z.name.toLowerCase()}` });
    }
  }
  return out;
}
