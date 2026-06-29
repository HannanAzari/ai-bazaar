// ── Nestudio V2 — Nest Editor guardrails (M6) ───────────────────────────────
//
// Additive, pure policy layer that keeps editor edits visually safe: per-slot-type
// size limits, allowed planes, recommended defaults, plane bands (floor objects stay
// on the floor, wall objects stay on the wall), canvas clamping, and advisory
// warnings (tap target, outside safe area, placeholder art, overlap). Guardrails
// *inform*; only hard-invalid positions are prevented (clamped). No I/O, no React.

import type { EditableNestObject, EditorPlane } from "@/lib/nest-editor-types";
import type { LivingNestAsset, LivingNestSlotType } from "@/lib/nest-visual-types";

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
}

const FLOOR: EditorPlane[] = ["floor"];
const FLOOR_SIDES: EditorPlane[] = ["floor", "left_sliver", "right_sliver"];
const WALL: EditorPlane[] = ["front_wall"];

/** Guardrails keyed by living-room slot type. */
export const EDITOR_GUARDRAILS: Partial<Record<LivingNestSlotType, EditorGuardrail>> = {
  media: { allowedPlanes: FLOOR, minWidth: 0.3, maxWidth: 0.62, recommendedWidth: 0.482, boxAspect: 2.069, defaultAnchor: { x: 0.5, y: 1 }, defaultZ: 2, contactShadow: true },
  frame: { allowedPlanes: WALL, minWidth: 0.08, maxWidth: 0.28, recommendedWidth: 0.157, boxAspect: 1.383, defaultAnchor: { x: 0.5, y: 0.5 }, defaultZ: 1, contactShadow: false },
  sofa: { allowedPlanes: FLOOR, minWidth: 0.4, maxWidth: 0.85, recommendedWidth: 0.678, boxAspect: 3.513, defaultAnchor: { x: 0.5, y: 1 }, defaultZ: 4, contactShadow: true },
  table: { allowedPlanes: FLOOR, minWidth: 0.15, maxWidth: 0.4, recommendedWidth: 0.275, boxAspect: 2.523, defaultAnchor: { x: 0.5, y: 1 }, defaultZ: 5, contactShadow: true },
  rug: { allowedPlanes: FLOOR, minWidth: 0.35, maxWidth: 0.85, recommendedWidth: 0.62, boxAspect: 3.543, defaultAnchor: { x: 0.5, y: 1 }, defaultZ: 0, contactShadow: false },
  lamp: { allowedPlanes: FLOOR_SIDES, minWidth: 0.08, maxWidth: 0.22, recommendedWidth: 0.155, boxAspect: 0.385, defaultAnchor: { x: 0.5, y: 1 }, defaultZ: 3, contactShadow: true },
  plant: { allowedPlanes: FLOOR_SIDES, minWidth: 0.12, maxWidth: 0.34, recommendedWidth: 0.241, boxAspect: 0.956, defaultAnchor: { x: 0.5, y: 1 }, defaultZ: 3, contactShadow: true },
  avatar: { allowedPlanes: ["floor", "foreground"], minWidth: 0.15, maxWidth: 0.34, recommendedWidth: 0.23, boxAspect: 0.548, defaultAnchor: { x: 0.5, y: 1 }, defaultZ: 6, contactShadow: true },
  side_table: { allowedPlanes: FLOOR, minWidth: 0.1, maxWidth: 0.25, recommendedWidth: 0.17, boxAspect: 1.6, defaultAnchor: { x: 0.5, y: 1 }, defaultZ: 5, contactShadow: true },
  speaker: { allowedPlanes: FLOOR_SIDES, minWidth: 0.06, maxWidth: 0.16, recommendedWidth: 0.1, boxAspect: 0.7, defaultAnchor: { x: 0.5, y: 1 }, defaultZ: 3, contactShadow: true },
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
};

/** The advisory safe area (normalized). Objects fully outside it warn. */
export const EDITOR_SAFE_AREA = { x: 0.0, y: 0.02, width: 1.0, height: 0.96 };

/** Minimum comfortable tap target (normalized) ≈ 44px on a phone-width scene. */
export const MIN_TAP_TARGET = { width: 0.09, height: 0.06 };

/** The base-anchor Y band each plane allows (keeps floor on the floor, wall on wall). */
export function planeBand(plane: EditorPlane): { minY: number; maxY: number } {
  switch (plane) {
    case "front_wall":
      return { minY: 0.06, maxY: 0.6 };
    case "left_sliver":
    case "right_sliver":
      return { minY: 0.1, maxY: 0.78 };
    case "floor":
    case "foreground":
      return { minY: 0.63, maxY: 0.99 };
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
export function clampObject(obj: EditableNestObject, g: EditorGuardrail = DEFAULT_GUARDRAIL): EditableNestObject {
  const rel = anchorRel(obj);
  // Size first (proportional callers pass already-sized boxes; clamp width into range).
  let width = clamp(obj.width, g.minWidth, g.maxWidth);
  // Preserve aspect when width is clamped.
  const aspect = obj.width > 0 ? obj.height / obj.width : obj.height;
  let height = width * aspect;
  if (height > 1) {
    height = 1;
    width = obj.height > 0 ? height / aspect : width;
  }

  const x = clamp(obj.x, 0, 1 - width);
  let y = clamp(obj.y, 0, 1 - height);

  // Plane band on the base anchor.
  const band = planeBand(obj.plane);
  const anchorY = y + height * rel.y;
  const clampedAnchorY = clamp(anchorY, band.minY, band.maxY);
  if (clampedAnchorY !== anchorY) {
    y = clamp(clampedAnchorY - height * rel.y, 0, 1 - height);
  }

  const anchor = { x: x + width * rel.x, y: y + height * rel.y };
  return { ...obj, x, y, width, height, anchor };
}

export interface EditorWarning {
  instanceId: string;
  kind: "tap-target" | "outside-safe-area" | "placeholder" | "overlap" | "plane";
  message: string;
}

/** Advisory (non-blocking) warnings for a document. Deterministic, pure. */
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
    if (o.width < MIN_TAP_TARGET.width || o.height < MIN_TAP_TARGET.height) {
      out.push({ instanceId: o.instanceId, kind: "tap-target", message: "smaller than the comfortable tap target" });
    }
    const sa = EDITOR_SAFE_AREA;
    const outside = o.x + o.width < sa.x || o.x > sa.x + sa.width || o.y + o.height < sa.y || o.y > sa.y + sa.height;
    if (outside) out.push({ instanceId: o.instanceId, kind: "outside-safe-area", message: "outside the safe area" });
    const g = guardrailForAsset(asset);
    if (!g.allowedPlanes.includes(o.plane)) {
      out.push({ instanceId: o.instanceId, kind: "plane", message: `unusual plane "${o.plane}" for this object` });
    }
  }
  return out;
}
