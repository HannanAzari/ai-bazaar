// ── Nestudio V2 — bottom-sheet snap math (M7B.2) ────────────────────────────
//
// The pure, framework-free decision logic behind the reusable mobile bottom sheet:
// the snap points, their visible fractions, where a drag release lands (or whether it
// closes), the transform offset for a snap, and the transition string (respecting
// reduced motion). Kept out of the component so it is deterministic + unit-tested
// without a DOM. No React, no I/O, no randomness.

export type BottomSheetSnapPoint = "collapsed" | "half" | "expanded";

/** Canonical low→high order. */
export const BOTTOM_SHEET_SNAP_POINTS: BottomSheetSnapPoint[] = ["collapsed", "half", "expanded"];

/** Visible fraction of the parent at each snap (rest is translated off-screen). */
export const SNAP_VISIBLE_FRACTION: Record<BottomSheetSnapPoint, number> = {
  collapsed: 0.18,
  half: 0.52,
  expanded: 0.9,
};

export type VisibleOverrides = Partial<Record<BottomSheetSnapPoint, number>>;

export function visibleFraction(s: BottomSheetSnapPoint, overrides?: VisibleOverrides): number {
  return overrides?.[s] ?? SNAP_VISIBLE_FRACTION[s];
}

/** The allowed snaps in canonical order (filtered to the requested subset). */
export function allowedSnaps(points: BottomSheetSnapPoint[]): BottomSheetSnapPoint[] {
  return BOTTOM_SHEET_SNAP_POINTS.filter((s) => points.includes(s));
}

/** Step to the next snap (toward expanded), wrapping back to the lowest. */
export function nextSnap(current: BottomSheetSnapPoint, allowed: BottomSheetSnapPoint[]): BottomSheetSnapPoint {
  const i = allowed.indexOf(current);
  return allowed[(i + 1) % allowed.length];
}

export interface DragReleaseArgs {
  startSnap: BottomSheetSnapPoint;
  /** Total drag in px (positive = dragged down). */
  dragPx: number;
  /** The sheet's parent height in px. */
  parentH: number;
  allowed: BottomSheetSnapPoint[];
  dismissible: boolean;
  /** Fraction of parentH a downward drag from the lowest snap must exceed to close. */
  closeThreshold?: number;
  visible?: VisibleOverrides;
}

export type DragRelease = { close: true } | { close: false; snap: BottomSheetSnapPoint };

/**
 * Resolve where a drag release lands: the nearest allowed snap by visible fraction, or
 * a close when swiped hard down from the lowest snap (and dismissible). Deterministic.
 */
export function resolveDragRelease(args: DragReleaseArgs): DragRelease {
  const { startSnap, dragPx, parentH, allowed, dismissible, visible } = args;
  const closeThreshold = args.closeThreshold ?? 0.12;
  const h = parentH > 0 ? parentH : 800;
  if (dismissible && startSnap === allowed[0] && dragPx > h * closeThreshold) {
    return { close: true };
  }
  const releasedVisiblePx = visibleFraction(startSnap, visible) * h - dragPx;
  let best = allowed[0];
  let bestD = Infinity;
  for (const s of allowed) {
    const d = Math.abs(visibleFraction(s, visible) * h - releasedVisiblePx);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return { close: false, snap: best };
}

/**
 * translateY as a percentage of the SHEET's own height for a snap + live drag. The sheet
 * height equals the expanded visible fraction of the parent; the hidden portion is what
 * we translate down.
 */
export function sheetTranslatePct(snap: BottomSheetSnapPoint, dragPx: number, parentH: number, visible?: VisibleOverrides): number {
  const h = parentH > 0 ? parentH : 800;
  const sheetFrac = visibleFraction("expanded", visible);
  if (sheetFrac <= 0) return 0;
  const hiddenPx = Math.max(0, Math.min(sheetFrac * h, (sheetFrac - visibleFraction(snap, visible)) * h + dragPx));
  return (hiddenPx / (sheetFrac * h)) * 100;
}

/** The CSS transition: none while dragging or under reduced motion; a spring otherwise. */
export function sheetTransition(reducedMotion: boolean, dragging: boolean): string {
  return reducedMotion || dragging ? "none" : "transform 320ms cubic-bezier(.22,1,.36,1)";
}

/**
 * Dismissal policy. Escape always closes; an outside (backdrop) tap closes only when the
 * sheet is dismissible. Encoded purely so the component's handlers are unit-testable.
 */
export function shouldDismiss(trigger: "backdrop" | "escape", dismissible: boolean): boolean {
  return trigger === "escape" ? true : dismissible;
}
