// ── Nestudio V2 — reusable asset calibration package (M7B.2) ────────────────
//
// One calibration record per approved library asset:
//
//     author once → approve once → reuse in every Nest
//
// Calibration is the asset's *intrinsic* authoring metadata — visual-content bounds,
// the ground-contact point, default scale/rotation, placement + support rules,
// rotation/flip policy, predefined hotspots, a selection priority and a production
// status. It belongs to the ASSET (its pixels), never to one creator's placement, so
// a single corrected record (e.g. the bookshelf shelf hotspots) propagates to every
// instance with no per-Nest re-authoring.
//
// This module is the consolidated READ PATH. To avoid two sources of truth, the
// geometric/policy fields are assembled from the existing pure data
// (`nest-visual-bounds`, `nest-placement`, `nest-editor-policy`, `nest-hotspot-catalog`);
// the NEW intrinsic fields (selection priority, production status, explicit default
// scale) live here. Everything is serializable JSON — no functions, no DOM. Validation
// rejects malformed metadata; a missing asset falls back to a safe default. No image
// auto-analysis (deferred); values are authored, not measured at runtime.

import type { NormalizedVisualBounds } from "@/lib/nest-visual-bounds";
import { validateVisualBounds, visualMetaFor, FULL_VISUAL_BOUNDS } from "@/lib/nest-visual-bounds";
import type { AssetPlacementMode, AssetSupportRule } from "@/lib/nest-placement";
import { placementModeForAsset, supportRuleForAsset } from "@/lib/nest-placement";
import { guardrailForAsset } from "@/lib/nest-editor-policy";
import type { NestAssetHotspot } from "@/lib/nest-hotspot-types";
import { validateHotspots } from "@/lib/nest-hotspots";
import { predefinedHotspotsForInstance } from "@/lib/nest-hotspot-catalog";
import type { LivingNestAsset } from "@/lib/nest-visual-types";

/** Rotation allowance for an asset (mirrors the guardrail, as serializable data). */
export interface AssetRotationPolicy {
  allowed: boolean;
  min?: number;
  max?: number;
}

/** Horizontal-flip allowance for an asset (with the override warning, as data). */
export interface AssetFlipPolicy {
  allowed: boolean;
  /** Why flip is restricted; an Advanced override shows this. */
  warning?: string;
}

export type AssetProductionStatus = "placeholder" | "approved" | "premium";

/**
 * The complete calibration record for one library asset. Authored once and reused by
 * every Nest instance. All fields are optional so a partial record still validates and
 * the safe fallback fills the rest.
 */
export interface NestAssetCalibration {
  assetId: string;

  visualBounds?: NormalizedVisualBounds;
  groundContactPoint?: { x: number; y: number };

  defaultScale?: number;
  defaultRotation?: number;

  placementMode?: AssetPlacementMode;
  supportRule?: AssetSupportRule;

  rotationPolicy?: AssetRotationPolicy;
  flipPolicy?: AssetFlipPolicy;

  predefinedHotspots?: NestAssetHotspot[];

  /** Higher = a small/foreground item that should win selection ties (books, decor). */
  selectionPriority?: number;
  productionStatus?: AssetProductionStatus;
}

// ── Intrinsic, asset-specific metadata authored here (the NEW data) ───────────
//
// Keyed by asset id. Approved cut-outs are "approved"; the tracked SVG stand-ins are
// "placeholder"; "premium" is reserved for a future authored tier. Selection priority
// nudges small/decor items above the large furniture they rest on in the layer picker.

const PRODUCTION_STATUS: Record<string, AssetProductionStatus> = {
  "ast-tv": "approved",
  "ast-framed-photo": "approved",
  "ast-floor-lamp": "approved",
  "ast-side-plant": "approved",
  "ast-avatar": "approved",
  "ast-desk": "approved",
  "ast-bookshelf": "approved",
  "ast-stacked-books": "approved",
  "ast-sofa": "placeholder",
  "ast-coffee-table": "placeholder",
  "ast-rug": "placeholder",
};

const SELECTION_PRIORITY: Record<string, number> = {
  // Small things that sit on top of larger things should be easy to grab first.
  "ast-stacked-books": 30,
  "ast-framed-photo": 20,
  "ast-side-plant": 12,
  "ast-floor-lamp": 12,
  "ast-avatar": 10,
  // Large supports default low so an item on them is preferred.
  "ast-coffee-table": 4,
  "ast-desk": 4,
  "ast-bookshelf": 4,
  "ast-sofa": 2,
  "ast-tv": 2,
  "ast-rug": 0,
};

export const DEFAULT_SELECTION_PRIORITY = 6;

/** Production status for an asset id (defaults to placeholder for unknown art). */
export function productionStatusFor(assetId: string): AssetProductionStatus {
  return PRODUCTION_STATUS[assetId] ?? "placeholder";
}

/** Selection priority for an asset id (higher wins ties). */
export function selectionPriorityFor(assetId: string): number {
  return SELECTION_PRIORITY[assetId] ?? DEFAULT_SELECTION_PRIORITY;
}

// ── The safe fallback ─────────────────────────────────────────────────────────

/** A safe, minimal calibration used when an asset has no record. */
export const DEFAULT_CALIBRATION: Omit<NestAssetCalibration, "assetId"> = {
  visualBounds: FULL_VISUAL_BOUNDS,
  defaultRotation: 0,
  placementMode: "floor",
  rotationPolicy: { allowed: false },
  flipPolicy: { allowed: true },
  predefinedHotspots: [],
  selectionPriority: DEFAULT_SELECTION_PRIORITY,
  productionStatus: "placeholder",
};

/**
 * Assemble the consolidated calibration for an asset by reading the existing pure
 * sources plus the intrinsic metadata above. Single read path for editor helpers — no
 * asset-specific conditionals scattered through the canvas. Always returns a complete,
 * serializable record (safe even for an unknown asset).
 */
export function buildCalibration(asset: LivingNestAsset | undefined, assetId: string): NestAssetCalibration {
  if (!asset) {
    return { assetId, ...DEFAULT_CALIBRATION };
  }
  const g = guardrailForAsset(asset);
  const meta = visualMetaFor(assetId);
  return {
    assetId,
    visualBounds: meta?.visualBounds ?? FULL_VISUAL_BOUNDS,
    groundContactPoint: meta?.groundContactPoint,
    defaultScale: g.recommendedWidth,
    defaultRotation: 0,
    placementMode: placementModeForAsset(asset),
    supportRule: supportRuleForAsset(asset),
    rotationPolicy: { allowed: g.allowRotation === true, min: g.rotationRange?.min, max: g.rotationRange?.max },
    flipPolicy: { allowed: g.allowFlipX !== false, warning: g.flipWarning },
    predefinedHotspots: predefinedHotspotsForInstance(assetId, assetId),
    selectionPriority: selectionPriorityFor(assetId),
    productionStatus: productionStatusFor(assetId),
  };
}

/** Lookup helper from an assets-by-id map. */
export function calibrationFor(assetId: string, assetsById: Record<string, LivingNestAsset>): NestAssetCalibration {
  return buildCalibration(assetsById[assetId], assetId);
}

// ── Validation (rejects malformed metadata) ──────────────────────────────────

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const inUnit = (n: number): boolean => n >= -1e-6 && n <= 1 + 1e-6;

/** Validate one calibration record. Returns hard errors (empty ⇒ valid). Pure. */
export function validateCalibration(c: NestAssetCalibration | undefined): string[] {
  const errors: string[] = [];
  if (!c || typeof c !== "object") return ["calibration is not an object"];
  const at = `calibration${c.assetId ? ` (${c.assetId})` : ""}`;
  if (!c.assetId) errors.push(`${at}: missing assetId`);

  errors.push(...validateVisualBounds(c.visualBounds).map((e) => `${at}: ${e}`));

  if (c.groundContactPoint) {
    const { x, y } = c.groundContactPoint;
    if (!finite(x) || !finite(y) || !inUnit(x) || !inUnit(y)) errors.push(`${at}: groundContactPoint out of [0,1]`);
  }
  if (c.defaultScale != null && (!finite(c.defaultScale) || c.defaultScale <= 0)) {
    errors.push(`${at}: defaultScale must be > 0`);
  }
  if (c.defaultRotation != null && !finite(c.defaultRotation)) errors.push(`${at}: defaultRotation must be finite`);

  if (c.rotationPolicy) {
    const r = c.rotationPolicy;
    if (typeof r.allowed !== "boolean") errors.push(`${at}: rotationPolicy.allowed must be a boolean`);
    if (r.min != null && r.max != null && finite(r.min) && finite(r.max) && r.min > r.max) {
      errors.push(`${at}: rotationPolicy range is inverted`);
    }
  }
  if (c.flipPolicy && typeof c.flipPolicy.allowed !== "boolean") {
    errors.push(`${at}: flipPolicy.allowed must be a boolean`);
  }
  if (c.selectionPriority != null && !finite(c.selectionPriority)) {
    errors.push(`${at}: selectionPriority must be finite`);
  }
  if (c.productionStatus != null && !["placeholder", "approved", "premium"].includes(c.productionStatus)) {
    errors.push(`${at}: invalid productionStatus "${c.productionStatus}"`);
  }
  errors.push(...validateHotspots(c.predefinedHotspots).map((e) => `${at}: ${e}`));
  return errors;
}

/** Whether a calibration record is structurally valid. */
export function isValidCalibration(c: NestAssetCalibration | undefined): boolean {
  return validateCalibration(c).length === 0;
}
