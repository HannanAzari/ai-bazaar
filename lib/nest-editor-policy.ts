// ── Nestudio V2 — Nest Editor guardrails (M6) ───────────────────────────────
//
// Additive, pure policy layer that keeps editor edits visually safe: per-slot-type
// size limits, allowed planes, recommended defaults, plane bands (floor objects stay
// on the floor, wall objects stay on the wall), canvas clamping, and advisory
// warnings (tap target, outside safe area, placeholder art, overlap). Guardrails
// *inform*; only hard-invalid positions are prevented (clamped). No I/O, no React.

import type { EditableNestObject, EditorPlane } from "@/lib/nest-editor-types";
import type { LivingNestAsset, LivingNestSlotType } from "@/lib/nest-visual-types";
import { visibleRect, visualBoundsFor } from "@/lib/nest-visual-bounds";

/** Per-slot-type (or default) authoring guardrail. Sizes are normalized widths. */
export interface EditorGuardrail {
  allowedPlanes: EditorPlane[];
  minWidth: number;
  maxWidth: number;
  recommendedWidth: number;
  /** Default normalized box aspect (boxWidth / boxHeight) for a freshly added object. */
  boxAspect: number;
  /** Anchor position relative to the object box (0..1). */
  defaultAnchor: { x: number; y: number };
  defaultZ: number;
  contactShadow: boolean;
  /** Whether the object may be mirrored horizontally (default: true). */
  allowFlipX?: boolean;
  /** When flip is disabled, why — Advanced may override with this warning shown. */
  flipWarning?: string;
  /** Whether the object may be rotated (default: false — upright objects). */
  allowRotation?: boolean;
  /** Permitted rotation range in degrees (when allowRotation). */
  rotationRange?: { min: number; max: number };
}

/** Common angle snaps offered while rotating (degrees). */
export const ROTATION_SNAPS = [0, 5, -5, 15, -15, 30, -30, 45, -45, 90, -90, 180, -180] as const;

const FLOOR: EditorPlane[] = ["floor"];
const FLOOR_SIDES: EditorPlane[] = ["floor", "left_sliver", "right_sliver"];
const WALL: EditorPlane[] = ["front_wall"];

/** Guardrails keyed by living-room slot type. */
export const EDITOR_GUARDRAILS: Partial<Record<LivingNestSlotType, EditorGuardrail>> = {
  media: { allowedPlanes: FLOOR, minWidth: 0.3, maxWidth: 0.62, recommendedWidth: 0.482, boxAspect: 2.069, defaultAnchor: { x: 0.5, y: 1 }, defaultZ: 2, contactShadow: true, allowFlipX: true, allowRotation: false },
  frame: { allowedPlanes: WALL, minWidth: 0.08, maxWidth: 0.28, recommendedWidth: 0.157, boxAspect: 1.383, defaultAnchor: { x: 0.5, y: 0.5 }, defaultZ: 1, contactShadow: false, allowFlipX: true, allowRotation: true, rotationRange: { min: -180, max: 180 } },
  sofa: { allowedPlanes: FLOOR, minWidth: 0.4, maxWidth: 0.85, recommendedWidth: 0.678, boxAspect: 3.513, defaultAnchor: { x: 0.5, y: 1 }, defaultZ: 4, contactShadow: true, allowFlipX: true, allowRotation: false },
  table: { allowedPlanes: FLOOR, minWidth: 0.15, maxWidth: 0.4, recommendedWidth: 0.275, boxAspect: 2.523, defaultAnchor: { x: 0.5, y: 1 }, defaultZ: 5, contactShadow: true, allowFlipX: true, allowRotation: false },
  rug: { allowedPlanes: FLOOR, minWidth: 0.35, maxWidth: 0.85, recommendedWidth: 0.62, boxAspect: 3.543, defaultAnchor: { x: 0.5, y: 1 }, defaultZ: 0, contactShadow: false, allowFlipX: true, allowRotation: true, rotationRange: { min: -180, max: 180 } },
  lamp: { allowedPlanes: FLOOR_SIDES, minWidth: 0.08, maxWidth: 0.22, recommendedWidth: 0.155, boxAspect: 0.385, defaultAnchor: { x: 0.5, y: 1 }, defaultZ: 3, contactShadow: true, allowFlipX: true, allowRotation: false },
  plant: { allowedPlanes: FLOOR_SIDES, minWidth: 0.12, maxWidth: 0.34, recommendedWidth: 0.241, boxAspect: 0.956, defaultAnchor: { x: 0.5, y: 1 }, defaultZ: 3, contactShadow: true, allowFlipX: true, allowRotation: false },
  avatar: { allowedPlanes: ["floor", "foreground"], minWidth: 0.15, maxWidth: 0.34, recommendedWidth: 0.23, boxAspect: 0.548, defaultAnchor: { x: 0.5, y: 1 }, defaultZ: 6, contactShadow: true, allowFlipX: false, flipWarning: "Flipping mirrors clothing text, asymmetry and the light direction.", allowRotation: false },
  side_table: { allowedPlanes: FLOOR, minWidth: 0.1, maxWidth: 0.25, recommendedWidth: 0.17, boxAspect: 1.6, defaultAnchor: { x: 0.5, y: 1 }, defaultZ: 5, contactShadow: true, allowFlipX: true, allowRotation: false },
  speaker: { allowedPlanes: FLOOR_SIDES, minWidth: 0.06, maxWidth: 0.16, recommendedWidth: 0.1, boxAspect: 0.7, defaultAnchor: { x: 0.5, y: 1 }, defaultZ: 3, contactShadow: true, allowFlipX: true, allowRotation: false },
  // Bookshelf — upright furniture, no rotation; loose books / small decor rotate freely.
  shelf: { allowedPlanes: FLOOR, minWidth: 0.12, maxWidth: 0.3, recommendedWidth: 0.18, boxAspect: 0.357, defaultAnchor: { x: 0.5, y: 1 }, defaultZ: 3, contactShadow: true, allowFlipX: true, allowRotation: false },
  books: { allowedPlanes: ["floor", "foreground"], minWidth: 0.06, maxWidth: 0.18, recommendedWidth: 0.1, boxAspect: 1.748, defaultAnchor: { x: 0.5, y: 1 }, defaultZ: 5, contactShadow: false, allowFlipX: true, allowRotation: true, rotationRange: { min: -180, max: 180 } },
};

/** Fallback guardrail for any unlisted slot type. */
export const DEFAULT_GUARDRAIL: EditorGuardrail = {
  allowedPlanes: ["front_wall", "left_sliver", "right_sliver", "floor", "foreground"],
  minWidth: 0.06,
  maxWidth: 0.9,
  recommendedWidth: 0.2,
  boxAspect: 1.0,
  defaultAnchor: { x: 0.5, y: 1 },
  defaultZ: 3,
  contactShadow: false,
  allowFlipX: true,
  allowRotation: false,
};

/** The advisory safe area (normalized). Objects fully outside it warn. */
export const EDITOR_SAFE_AREA = { x: 0.0, y: 0.02, width: 1.0, height: 0.96 };

/** Minimum comfortable tap target (normalized) ≈ 44px on a phone-width scene. */
export const MIN_TAP_TARGET = { width: 0.09, height: 0.06 };

/** The visible-base Y band each plane allows. Widened (M7B.1) so floor objects can
 * approach the room edges/corners; applied to the asset's *visible* base. */
export function planeBand(plane: EditorPlane): { minY: number; maxY: number } {
  switch (plane) {
    case "front_wall":
      return { minY: 0.05, maxY: 0.62 };
    case "left_sliver":
    case "right_sliver":
      return { minY: 0.08, maxY: 0.92 };
    case "floor":
    case "foreground":
      return { minY: 0.55, maxY: 1.0 };
  }
}

/** The slot type that best describes an asset (its first declared compatible type). */
export function slotTypeForAsset(asset: LivingNestAsset): LivingNestSlotType | undefined {
  return asset.compatibleSlotTypes[0];
}

/** The guardrail for an asset (by slot type), falling back to the default. */
export function guardrailForAsset(asset: LivingNestAsset | undefined): EditorGuardrail {
  const st = asset ? slotTypeForAsset(asset) : undefined;
  return (st && EDITOR_GUARDRAILS[st]) || DEFAULT_GUARDRAIL;
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

export type FlipStatus = "unavailable" | "available" | "warning";

/**
 * Flip availability for an asset. `allowOverride` (Advanced/template-author) permits a
 * policy-disabled flip *with a warning* (e.g. the real-person avatar).
 */
export function flipStatus(asset: LivingNestAsset | undefined, allowOverride = false): FlipStatus {
  const g = guardrailForAsset(asset);
  if (g.allowFlipX === true) return "available";
  if (g.allowFlipX === false && g.flipWarning && allowOverride) return "warning";
  return "unavailable";
}

/** The warning shown when a flip-restricted asset is overridden. */
export function flipWarningFor(asset: LivingNestAsset | undefined): string | undefined {
  return guardrailForAsset(asset).flipWarning;
}

/** Whether an asset may be mirrored horizontally (Advanced may override with a warning). */
export function canFlipX(asset: LivingNestAsset | undefined, allowOverride = false): boolean {
  return flipStatus(asset, allowOverride) !== "unavailable";
}

/** Whether an asset may be rotated (default false). */
export function canRotate(asset: LivingNestAsset | undefined): boolean {
  return guardrailForAsset(asset).allowRotation === true;
}

/** Clamp a rotation (deg) into the asset's permitted range; 0 when rotation is off. */
export function clampRotation(asset: LivingNestAsset | undefined, deg: number): number {
  const g = guardrailForAsset(asset);
  if (g.allowRotation !== true) return 0;
  const r = g.rotationRange ?? { min: -180, max: 180 };
  return clamp(deg, r.min, r.max);
}

/** Snap an angle to the nearest common snap within `tol` degrees, else return it. */
export function snapRotation(deg: number, tol = 5): number {
  let best = deg;
  let bestD = tol;
  for (const s of ROTATION_SNAPS) {
    const d = Math.abs(deg - s);
    if (d <= bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

/** The anchor's position relative to its box (0..1), robust to a degenerate box. */
function anchorRel(obj: EditableNestObject): { x: number; y: number } {
  const rx = obj.width > 0 ? (obj.anchor.x - obj.x) / obj.width : 0.5;
  const ry = obj.height > 0 ? (obj.anchor.y - obj.y) / obj.height : 1;
  return { x: clamp(rx, 0, 1), y: clamp(ry, 0, 1) };
}

/**
 * Clamp an object so its box stays on-canvas AND its base anchor stays within the
 * plane band. Pure — returns a new object; never mutates. This is the hard guardrail
 * the move/resize operations route through.
 */
/** Soft margin: the asset's transparent padding may sit off-canvas; its visible art
 * is kept on-screen. This is the HARD boundary (only prevents fully-off placement). */
export const CANVAS_MARGIN = 0.05;

export function clampObject(obj: EditableNestObject, g: EditorGuardrail = DEFAULT_GUARDRAIL): EditableNestObject {
  const rel = anchorRel(obj);
  // Size first (proportional callers pass already-sized boxes; clamp width into range).
  let width = clamp(obj.width, g.minWidth, g.maxWidth);
  const aspect = obj.width > 0 ? obj.height / obj.width : obj.height;
  let height = width * aspect;
  if (height > 1) {
    height = 1;
    width = obj.height > 0 ? height / aspect : width;
  }

  // Use the asset's VISIBLE content rect for boundary checks, so a padded PNG (avatar,
  // thin lamp, bookshelf) can push its transparent padding off-canvas and reach corners.
  const vb = visualBoundsFor(obj.assetId);
  const vW = width * vb.width;
  const vH = height * vb.height;
  const M = CANVAS_MARGIN;

  // X: keep the visible rect within [-M, 1+M].
  let x = obj.x;
  const visX = clamp(x + vb.x * width, -M, Math.max(-M, 1 + M - vW));
  x += visX - (x + vb.x * width);

  // Y: plane band on the visible base, then keep the visible rect on-canvas.
  let y = obj.y;
  const band = planeBand(obj.plane);
  const visBase = y + vb.y * height + vH;
  const clampedBase = clamp(visBase, band.minY, band.maxY);
  y += clampedBase - visBase;
  const visTop = y + vb.y * height;
  const clampedTop = clamp(visTop, -M, Math.max(-M, 1 + M - vH));
  y += clampedTop - visTop;

  const anchor = { x: x + width * rel.x, y: y + height * rel.y };
  return { ...obj, x, y, width, height, anchor };
}

export interface EditorWarning {
  instanceId: string;
  kind: "tap-target" | "boundary" | "placeholder" | "overlap" | "plane";
  message: string;
}

/** Advisory (non-blocking) warnings for a document, using VISIBLE content bounds so
 * padded PNGs don't falsely warn. Deterministic, pure. */
export function editorWarnings(
  objects: EditableNestObject[],
  assetsById: Record<string, LivingNestAsset>,
): EditorWarning[] {
  const out: EditorWarning[] = [];
  for (const o of objects) {
    if (o.hidden) continue;
    const asset = assetsById[o.assetId];
    if (asset?.placeholder) {
      out.push({ instanceId: o.instanceId, kind: "placeholder", message: `${asset.name} is placeholder art (not production-ready)` });
    }
    const vis = visibleRect(o, o.assetId);
    if (vis.width < MIN_TAP_TARGET.width || vis.height < MIN_TAP_TARGET.height) {
      out.push({ instanceId: o.instanceId, kind: "tap-target", message: "smaller than the comfortable tap target" });
    }
    // Soft boundary: warn only when the visible art noticeably crosses the canvas edge.
    const off =
      vis.x < -0.01 || vis.y < -0.01 || vis.x + vis.width > 1.01 || vis.y + vis.height > 1.01;
    if (off) out.push({ instanceId: o.instanceId, kind: "boundary", message: "near the edge of the room" });
    const g = guardrailForAsset(asset);
    if (!g.allowedPlanes.includes(o.plane)) {
      out.push({ instanceId: o.instanceId, kind: "plane", message: `unusual plane "${o.plane}" for this object` });
    }
  }
  return out;
}
