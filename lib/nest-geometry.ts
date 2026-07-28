import { resolveAsset } from "@/lib/nest-production-library";
import type { NestPlacement } from "@/lib/nest-document-types";

// ── M23A · THE canonical placement geometry ──────────────────────────────────
//
// One function turns a saved NestPlacement into the box the room renders. The editor canvas
// and NestPreview (Profile cards, Home, Explore, full Nest view) BOTH use it, so a Nest can
// no longer look different depending on where you meet it.
//
// Before this existed there were two independent formulas:
//   editor  (nest-editor-bridge): width = scale * 0.5      clamp [0.06, 0.7]
//   preview (nest-preview):       width = scale * 55 %     clamp [8%, 60%]
// …a ~10% systematic size error on every object, plus a different height source and no
// overlay support at all. The editor's model is the creator's intent, so it is the canon.

/** The normalized box a placement occupies on the scene (all values 0..1, top-left origin). */
export type PlacementBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  zIndex: number;
  flipX: boolean;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clamp01 = (v: number) => clamp(v, 0, 1);

/** The scene's aspect (3:4 portrait) — used to convert a pixel aspect into a box height. */
export const SCENE_ASPECT = 0.75;

/** Object width from `scale`. The editor's rule, and now everyone's. */
export function widthFromScale(scale?: number): number {
  return clamp((scale ?? 0.4) * 0.5, 0.06, 0.7);
}

/** Inverse of `widthFromScale` — used when saving editor boxes back to placements. */
export function scaleFromWidth(width?: number): number {
  return clamp((width ?? 0.2) / 0.5, 0.05, 1.4);
}

/**
 * Canonical geometry for one placement.
 *
 * Two shapes exist and they anchor differently — this is the single place that knows it:
 *  • overlay  → `x,y` is the box TOP-LEFT and `w,h` are the box itself.
 *  • asset    → `x,y` is the BASE CENTRE (feet on the floor); the box is derived from
 *               `scale` and the asset's visual aspect, then offset up/left.
 */
export function placementBox(p: NestPlacement, index = 0): PlacementBox {
  const rotation = p.rotation ?? 0;
  const zIndex = p.zIndex ?? index + 1;
  const flipX = p.flipX ?? false;

  if (p.overlay) {
    return {
      x: clamp01(p.x),
      y: clamp01(p.y),
      w: clamp(p.w ?? 0.3, 0.02, 1),
      h: clamp(p.h ?? 0.12, 0.02, 1),
      rotation,
      zIndex,
      flipX,
    };
  }

  const prod = resolveAsset(p.assetId);
  const [aw, ah] = (prod?.visualBounds?.aspect ?? "1:1").split(":").map(Number);
  const ratio = aw && ah ? aw / ah : 1; // pixel w/h
  const w = widthFromScale(p.scale);
  const h = clamp((w / ratio) * SCENE_ASPECT, 0.04, 0.95);
  return {
    x: clamp01(p.x - w / 2), // base centre → box left
    y: clamp01(p.y - h), // base line → box top
    w,
    h,
    rotation,
    zIndex,
    flipX,
  };
}

/** The CSS transform for a box. Identical string in the editor and every preview. */
export function boxTransform(box: Pick<PlacementBox, "rotation" | "flipX">): string | undefined {
  const parts: string[] = [];
  if (box.rotation) parts.push(`rotate(${box.rotation}deg)`);
  if (box.flipX) parts.push("scaleX(-1)");
  return parts.length ? parts.join(" ") : undefined;
}

/** Ready-to-spread inline style for a placement, in percentages of the scene. */
export function placementStyle(p: NestPlacement, index = 0): React.CSSProperties {
  const b = placementBox(p, index);
  return {
    left: `${b.x * 100}%`,
    top: `${b.y * 100}%`,
    width: `${b.w * 100}%`,
    height: `${b.h * 100}%`,
    zIndex: b.zIndex,
    transform: boxTransform(b),
    transformOrigin: "center",
  };
}

/** Placements in paint order (stable: z-index, then original order). */
export function inPaintOrder(placements: NestPlacement[]): NestPlacement[] {
  return placements
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (a.p.zIndex ?? a.i + 1) - (b.p.zIndex ?? b.i + 1) || a.i - b.i)
    .map(({ p }) => p);
}
