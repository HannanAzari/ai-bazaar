"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  allowedSnaps,
  nextSnap,
  resolveDragRelease,
  sheetTransition,
  sheetTranslatePct,
  shouldDismiss,
  visibleFraction,
  type BottomSheetSnapPoint,
  type VisibleOverrides,
} from "@/lib/nest-bottom-sheet";

export type { BottomSheetSnapPoint } from "@/lib/nest-bottom-sheet";

// ── Nestudio V2 — reusable native-style bottom sheet (M7B.2) ────────────────
//
// One bottom-sheet foundation for the Assets drawer, the Connect drawer, the layer
// picker, and future Focus-Area drawers — so they share native-feeling behaviour
// instead of three bespoke overlays. Snap points: collapsed / half / expanded. The
// sheet is a single tall surface translated DOWN to reveal the chosen fraction, so
// snap changes are pure GPU transforms (smooth, spring-like) and the content stays
// MOUNTED across snaps (unsaved form input is never lost). Drag or tap the handle to
// change snap; swipe down from collapsed (when dismissible) closes; tap-outside
// dismisses (optional scrim); Escape closes; focus is restored on close; body scroll
// is locked behind the sheet; reduced-motion disables the spring. No new dependencies.

export interface MobileBottomSheetProps {
  open: boolean;
  snap: BottomSheetSnapPoint;
  onSnapChange: (snap: BottomSheetSnapPoint) => void;
  onClose: () => void;
  /** Tap-outside / swipe-down-from-collapsed closes the sheet. */
  dismissible?: boolean;
  /** Which snaps to allow (subset of collapsed/half/expanded). Default: all. */
  snapPoints?: BottomSheetSnapPoint[];
  /** Outside layer: a dim "scrim", an invisible tap-catcher, or "none" (canvas stays live). */
  backdrop?: "scrim" | "transparent" | "none";
  /** Accessible dialog label. */
  label: string;
  /** Force reduced motion (otherwise detected from prefers-reduced-motion). */
  reducedMotion?: boolean;
  /** Sticky header (handle sits above it); not part of the scroll area. */
  header?: React.ReactNode;
  /** Scrollable body. */
  children: React.ReactNode;
  /** Optional per-snap visible fractions override. */
  visible?: VisibleOverrides;
  className?: string;
  /** Explicit stacking (M7C.5 layer model). Overrides the default z-10/z-0 so the drawer
   *  can sit ABOVE canvas authoring overlays. Defaults preserve prior behaviour. */
  sheetZIndex?: number;
  backdropZIndex?: number;
}

export function MobileBottomSheet({
  open,
  snap,
  onSnapChange,
  onClose,
  dismissible = true,
  snapPoints,
  backdrop = "transparent",
  label,
  reducedMotion,
  header,
  children,
  visible,
  className = "",
  sheetZIndex,
  backdropZIndex,
}: MobileBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [dragPx, setDragPx] = useState(0); // live drag offset (px), 0 when idle
  const dragging = useRef<{ startY: number; startSnap: BottomSheetSnapPoint } | null>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const [prefersReduced, setPrefersReduced] = useState(false);
  // The sheet sizes to its positioned parent (the canvas area), so the mode bar below
  // stays visible. Measured in px for drag math; fractions are of THIS height.
  const [parentH, setParentH] = useState(0);

  const allowed = allowedSnaps(snapPoints ?? ["collapsed", "half", "expanded"]);

  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const parent = sheetRef.current?.offsetParent as HTMLElement | null;
      setParentH(parent?.clientHeight ?? (typeof window !== "undefined" ? window.innerHeight : 800));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open]);

  // Detect prefers-reduced-motion (overridable by prop).
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setPrefersReduced(m.matches);
    apply();
    m.addEventListener?.("change", apply);
    return () => m.removeEventListener?.("change", apply);
  }, []);
  const noMotion = reducedMotion ?? prefersReduced;

  // Lock page scroll behind an open sheet; restore on close.
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Focus management: focus the sheet on open, restore the prior focus on close.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (open) {
      restoreFocus.current = (document.activeElement as HTMLElement) ?? null;
      // Defer so the element is in the DOM.
      const id = window.setTimeout(() => sheetRef.current?.focus({ preventScroll: true }), 0);
      return () => window.clearTimeout(id);
    }
    restoreFocus.current?.focus?.({ preventScroll: true });
  }, [open]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && shouldDismiss("escape", dismissible)) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, dismissible]);

  const cycleSnap = useCallback(() => {
    onSnapChange(nextSnap(snap, allowed));
  }, [allowed, snap, onSnapChange]);

  const endDrag = useCallback(
    (totalDy: number) => {
      const start = dragging.current?.startSnap ?? snap;
      const res = resolveDragRelease({ startSnap: start, dragPx: totalDy, parentH, allowed, dismissible, visible });
      if (res.close) onClose();
      else if (res.snap !== snap) onSnapChange(res.snap);
    },
    [allowed, snap, dismissible, onClose, onSnapChange, parentH, visible],
  );

  function onHandlePointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragging.current = { startY: e.clientY, startSnap: snap };
    setDragPx(0);
  }
  function onHandlePointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    // Allow dragging down freely; resist dragging above the expanded position.
    const dy = e.clientY - dragging.current.startY;
    setDragPx(dy);
  }
  function onHandlePointerUp(e: React.PointerEvent) {
    if (!dragging.current) return;
    const dy = e.clientY - dragging.current.startY;
    const wasDrag = Math.abs(dy) > 6;
    dragging.current = null;
    setDragPx(0);
    if (wasDrag) endDrag(dy);
    else cycleSnap();
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  }

  if (!open) return null;

  const sheetFrac = visibleFraction("expanded", visible); // sheet height as a fraction of the parent
  const translatePct = sheetTranslatePct(snap, dragPx, parentH, visible);

  return (
    <>
      {backdrop !== "none" ? (
        <button
          type="button"
          aria-label="Close"
          tabIndex={-1}
          onClick={() => shouldDismiss("backdrop", dismissible) && onClose()}
          className={`absolute inset-0 z-0 ${backdrop === "scrim" ? "bg-ink/30" : "bg-transparent"} ${noMotion ? "" : "transition-opacity"}`}
          style={{ cursor: dismissible ? "pointer" : "default", zIndex: backdropZIndex }}
        />
      ) : null}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal={backdrop === "scrim"}
        aria-label={label}
        aria-labelledby={header ? undefined : titleId}
        tabIndex={-1}
        className={`absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-3xl border-t border-ink/10 bg-parchment shadow-[0_-8px_24px_rgba(70,54,90,.16)] outline-none ${className}`}
        style={{
          height: `${Math.round(sheetFrac * 100)}%`,
          transform: `translateY(${translatePct.toFixed(2)}%)`,
          transition: sheetTransition(noMotion, Boolean(dragging.current)),
          paddingBottom: "env(safe-area-inset-bottom)",
          touchAction: "none",
          zIndex: sheetZIndex,
        }}
      >
        {/* Grab handle (drag to change snap, tap to cycle) */}
        <div
          className="shrink-0 cursor-grab touch-none pt-2 active:cursor-grabbing"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
          role="button"
          aria-label="Drag to resize, tap to expand"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              cycleSnap();
            }
          }}
        >
          <span className="mx-auto block h-1.5 w-10 rounded-full bg-ink/20" />
        </div>
        {header ? <div className="shrink-0">{header}</div> : <span id={titleId} className="sr-only">{label}</span>}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" style={{ touchAction: "pan-y" }}>
          {children}
        </div>
      </div>
    </>
  );
}
