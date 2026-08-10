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

  // ── M24 · AN EXPLICIT BOX IS REPLAYED VERBATIM ─────────────────────────────
  //
  // This is the fix for "the published Nest doesn't match what I made".
  //
  // The editor canvas draws each object from its explicit box (`x, y, width, height`).
  // But `editableObjectsToPlacements` used to persist only `scale` — derived from width —
  // and DISCARD height outright. Replay then RE-DERIVED height from the asset catalogue's
  // aspect ratio and re-anchored the object with `y = p.y - h`. So:
  //
  //   • any object whose height wasn't exactly (w / catalogueRatio) × 0.75 was resized,
  //   • and because the top is computed from the height, it also MOVED vertically,
  //   • and an asset the catalogue couldn't resolve fell back to 1:1 — maximum drift.
  //
  // The creator approved a box; we now store that box and render it back unchanged. When
  // `w` and `h` are both present, `x, y` are the box TOP-LEFT (the same contract overlays
  // have always used), so assets and overlays finally share one geometry.
  //
  // Rows written before M24 have `w`/`h` NULL and keep the legacy base-centre derivation
  // below — no backfill, no migration, and no change to what is already published.
  if (p.w != null && p.h != null) {
    return {
      x: clamp01(p.x),
      y: clamp01(p.y),
      w: clamp(p.w, 0.02, 1),
      h: clamp(p.h, 0.02, 1),
      rotation,
      zIndex,
      flipX,
    };
  }

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

  // ── Legacy path: pre-M24 placements that only ever stored `scale` ──────────
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

/** True when this placement carries the creator's approved box and needs no derivation. */
export function hasExplicitBox(p: NestPlacement): boolean {
  return p.w != null && p.h != null;
}

/**
 * The CSS transform for a box. THE one transform contract — identical string in the editor
 * and every preview.
 *
 * M26-F §2 widened the parameter so an `EditableNestObject` (whose `rotation`/`flipX` are
 * optional) satisfies it directly. It did not before, which is the small friction that let
 * four separate hand-built copies of this string grow in the first place — and they drifted:
 * the editor's copy was being overwritten by a CSS animation while the preview's was not.
 */
export function boxTransform(box: { rotation?: number; flipX?: boolean }): string | undefined {
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
