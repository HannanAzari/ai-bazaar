// ── Nest editor — contextual toolbar placement (M7C.9) ──────────────────────
//
// The selected-object action bar must never cover the resize/rotation handles — on small
// assets (a frame, a stack of books) the bar previously sat right on top of the rotation
// handle. This picks a side (above / below the VISIBLE selection rect) with collision
// avoidance, and returns the pixel offset the bar must sit from that edge so it clears the
// handles. Pure + deterministic so it can be unit-tested without a DOM.
//
// Geometry (all px, within the scene box):
//   • the rotation handle sits ABOVE the visible top by `rotateClearancePx`
//     (connector gap + the ~44px handle);
//   • corner resize handles straddle each edge (~half a handle);
//   • the bar itself is ~`barHeightPx` tall and wants a small `gapPx` breathing room.

export interface ToolbarPlacementInput {
  /** Visible selection rect top edge, in px within the scene. */
  topPx: number;
  /** Visible selection rect bottom edge, in px within the scene. */
  bottomPx: number;
  /** Scene height in px. */
  sceneHeightPx: number;
  /** Whether a rotation handle is shown above the selection (rotatable + unlocked). */
  hasRotateHandle: boolean;
  barHeightPx?: number;
  gapPx?: number;
  /** Space the rotation handle + connector occupy above the visible top. */
  rotateClearancePx?: number;
  /** Half a corner handle — the bar keeps this clear below the bottom edge. */
  cornerClearancePx?: number;
}

export interface ToolbarPlacement {
  side: "above" | "below";
  /** Distance (px) the bar sits from the chosen edge (outward). */
  offsetPx: number;
}

export function contextToolbarPlacement(input: ToolbarPlacementInput): ToolbarPlacement {
  const barHeightPx = input.barHeightPx ?? 44;
  const gapPx = input.gapPx ?? 8;
  const rotateClearancePx = input.rotateClearancePx ?? 70; // 26 gap + 44 handle
  const cornerClearancePx = input.cornerClearancePx ?? 22;

  // Room the bar needs above (clearing the rotation handle when present) and below.
  const aboveOffset = input.hasRotateHandle ? rotateClearancePx + gapPx : gapPx;
  const neededAbove = aboveOffset + barHeightPx;
  const belowOffset = cornerClearancePx + gapPx;
  const neededBelow = belowOffset + barHeightPx;

  const spaceAbove = input.topPx;
  const spaceBelow = Math.max(0, input.sceneHeightPx - input.bottomPx);

  // Prefer above (the historical default) when it fits without covering the handle; else
  // drop below when there is room; else fall back to whichever side has more space.
  if (spaceAbove >= neededAbove) return { side: "above", offsetPx: aboveOffset };
  if (spaceBelow >= neededBelow) return { side: "below", offsetPx: belowOffset };
  return spaceBelow > spaceAbove
    ? { side: "below", offsetPx: belowOffset }
    : { side: "above", offsetPx: aboveOffset };
}
