// ── Nestudio V2 — minimum interaction targets (M7B.2) ───────────────────────
//
// Separates an object's VISUAL size from its INTERACTION target size. A tiny asset
// (a stack of books, a small decor item) must stay easy to tap, and the resize /
// rotate handles must meet a practical mobile touch size — all WITHOUT changing the
// rendered art. The policy is authored in CSS pixels (the unit touch ergonomics are
// specified in); pure helpers convert a px target into the editor's normalized 0..1
// space against the live scene rect, so hit-testing and tests stay viewport-aware
// but deterministic. No React/DOM, no I/O, no randomness.

/** Touch-target sizes in CSS pixels (Apple HIG / Material both land near 44px). */
export interface EditorTouchTargetPolicy {
  /** Minimum tappable footprint for a placed object (invisible padding around art). */
  minimumObjectTapPx: number;
  /** Minimum touch size of a corner resize handle. */
  minimumResizeHandlePx: number;
  /** Minimum touch size of the rotate handle. */
  minimumRotateHandlePx: number;
  /** Constant gap (px) the rotate handle sits ABOVE the selection frame. */
  rotateHandleGapPx: number;
}

/** The default policy. 44px is the comfortable minimum; handles are generous. */
export const EDITOR_TOUCH_TARGETS: EditorTouchTargetPolicy = {
  minimumObjectTapPx: 44,
  minimumResizeHandlePx: 32,
  minimumRotateHandlePx: 36,
  rotateHandleGapPx: 26,
};

/** A scene's pixel size, used to convert px targets ↔ normalized units. */
export interface SceneSize {
  width: number;
  height: number;
}

/**
 * Convert a px length to normalized units along an axis. Falls back to a small,
 * non-zero default when the scene has not been measured yet (SSR / first paint), so a
 * pre-layout hit-test never collapses the padding to zero.
 */
export function pxToNormalized(px: number, sceneLength: number): number {
  if (!Number.isFinite(sceneLength) || sceneLength <= 0) return 0;
  return px / sceneLength;
}

/**
 * The minimum object tap target as a normalized width/height for a given scene size.
 * When the scene is unmeasured, a conservative normalized fallback (≈ a phone-width
 * scene) keeps tiny objects selectable.
 */
export function minObjectTapNormalized(
  scene: SceneSize | undefined,
  policy: EditorTouchTargetPolicy = EDITOR_TOUCH_TARGETS,
): { width: number; height: number } {
  // Fallback normalized footprint ≈ 44px on a ~390px-wide / ~520px-tall 3:4 scene.
  const fallback = { width: 0.112, height: 0.085 };
  if (!scene || scene.width <= 0 || scene.height <= 0) return fallback;
  return {
    width: pxToNormalized(policy.minimumObjectTapPx, scene.width),
    height: pxToNormalized(policy.minimumObjectTapPx, scene.height),
  };
}
