"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Lock, RotateCw } from "lucide-react";
import { sceneToScreen, type Camera } from "@/lib/nest-camera";
import type { EditableNestObject } from "@/lib/nest-editor-types";

// ── M26A-completion §2 — chrome in REAL screen space ─────────────────────────
//
// The selection frame, resize handles and rotation handle used to render inside the
// element the camera transforms. Two consequences, both bad:
//
//   • they SCALED with the room — at 5× a 40px touch target became 200px and covered the
//     object it was resizing;
//   • they were CLIPPED by the scene's `overflow-hidden`, so a handle on an object near
//     the edge simply vanished.
//
// M26A's first pass counter-scaled them with a CSS variable. That fixed the size but left
// them inside the transform, so the clipping remained and the architecture still had
// chrome living in world space.
//
// This is the real thing: the chrome is a SIBLING of the viewport, never a descendant of
// the transform. Its position is recomputed from `sceneToScreen()` on every camera frame,
// inside the camera's own rAF, and written straight to the DOM — so it tracks the object
// pixel-for-pixel while zooming and panning without a single React render.
//
// Nothing here is ever persisted. These are pixels on a screen, not facts about a Nest.

const HANDLE = 40; // touch target, constant at every zoom
const DOT = 14;
const ROTATE_GAP = 28;

export type SelectionRect = { x: number; y: number; width: number; height: number };

export function ScreenSpaceSelection({
  object,
  rect,
  subscribe,
  viewportRef,
  baseSizeRef,
  onHandleDown,
  rotatable,
  hidden,
  toolbar,
}: {
  object: EditableNestObject;
  /** The object's VISIBLE rectangle in canonical scene coordinates (0..1). */
  rect: SelectionRect;
  /** The camera's per-frame subscription. */
  subscribe: (fn: (cam: Camera) => void) => () => void;
  viewportRef: React.RefObject<HTMLElement | null>;
  /** The UNTRANSFORMED stage size, needed by sceneToScreen. */
  baseSizeRef: React.RefObject<{ width: number; height: number }>;
  onHandleDown: (e: React.PointerEvent, o: EditableNestObject, kind: "resize" | "rotate", dirX?: number) => void;
  rotatable: boolean;
  /** A hidden or deleted object must not leave floating controls behind. */
  hidden?: boolean;
  /**
   * The contextual object toolbar. It rides INSIDE this frame so it inherits the frame's
   * screen-pixel positioning — which is the only way it can track the object while zooming
   * and keep a constant size. Anchored above the frame, flipping below when there is no
   * room, and clamped to stay on screen.
   */
  toolbar?: ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    return subscribe((cam) => {
      const el = frameRef.current;
      const base = baseSizeRef.current;
      if (!el || !base) return;
      const vr = vp.getBoundingClientRect();
      const r = { left: vr.left, top: vr.top, width: vr.width, height: vr.height };
      // Project the object's two opposite corners; the frame is whatever they span. Doing
      // it from corners (rather than centre + size × scale) keeps it correct under a pan
      // as well as a zoom, with one code path.
      const tl = sceneToScreen({ nx: rect.x, ny: rect.y }, cam, r, base);
      const br = sceneToScreen({ nx: rect.x + rect.width, ny: rect.y + rect.height }, cam, r, base);
      // Positioned relative to the STAGE, so subtract the stage's own origin.
      const host = el.offsetParent as HTMLElement | null;
      const hr = host?.getBoundingClientRect() ?? { left: 0, top: 0 };
      el.style.left = `${tl.x - hr.left}px`;
      el.style.top = `${tl.y - hr.top}px`;
      el.style.width = `${Math.max(0, br.x - tl.x)}px`;
      el.style.height = `${Math.max(0, br.y - tl.y)}px`;
      // An object scrolled entirely out of view must not leave its handles floating.
      const off = br.x < vr.left || tl.x > vr.right || br.y < vr.top || tl.y > vr.bottom;
      el.style.visibility = off ? "hidden" : "visible";
    });
  }, [subscribe, viewportRef, baseSizeRef, rect.x, rect.y, rect.width, rect.height]);

  if (hidden) return null;

  return (
    <div
      ref={frameRef}
      data-screen-selection=""
      className="pointer-events-none absolute"
      // No transform of any kind: position and size are written in screen pixels. That is
      // what makes "handles never scale" true by construction rather than by cancellation.
      style={{ left: 0, top: 0, width: 0, height: 0 }}
    >
      <div
        className={`absolute inset-0 rounded-[10px] ${object.locked ? "border-2 border-dashed border-terracotta/80" : "border-2 border-cobalt"}`}
        style={{ boxShadow: "0 0 0 1px rgba(255,255,255,.7), 0 1px 6px rgba(70,54,90,.25)" }}
      />

      {object.locked ? (
        <span className="absolute right-1 top-1 rounded-full bg-terracotta/90 p-1 text-white">
          <Lock className="h-3 w-3" />
        </span>
      ) : (
        ([
          [0, 0, -1],
          [1, 0, 1],
          [0, 1, -1],
          [1, 1, 1],
        ] as const).map(([cx, cy, dirX]) => (
          <span
            key={`${cx}-${cy}`}
            data-resize-handle=""
            onPointerDown={(e) => onHandleDown(e, object, "resize", dirX)}
            className="pointer-events-auto absolute flex cursor-nwse-resize touch-none items-center justify-center"
            style={{
              width: HANDLE,
              height: HANDLE,
              left: `calc(${cx * 100}% - ${HANDLE / 2}px)`,
              top: `calc(${cy * 100}% - ${HANDLE / 2}px)`,
            }}
          >
            <span className="rounded-full border-2 border-cobalt bg-white shadow" style={{ width: DOT, height: DOT }} />
          </span>
        ))
      )}

      {toolbar ? (
        <div
          data-object-toolbar=""
          className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 justify-center"
          // A constant pixel gap, never a percentage of the frame — a percentage collapses
          // onto a tiny object and balloons on a big one.
          style={{ bottom: "calc(100% + 14px)" }}
        >
          {toolbar}
        </div>
      ) : null}

      {rotatable && !object.locked ? (
        <>
          <span
            aria-hidden
            className="absolute bg-cobalt/60"
            style={{ left: "50%", top: -ROTATE_GAP, height: ROTATE_GAP, width: 1 }}
          />
          <button
            type="button"
            aria-label="Rotate"
            data-rotate-handle=""
            onPointerDown={(e) => onHandleDown(e, object, "rotate")}
            className="pointer-events-auto absolute flex cursor-grab touch-none items-center justify-center"
            style={{ width: 44, height: 44, left: "calc(50% - 22px)", top: -ROTATE_GAP - 44 }}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-cobalt bg-white shadow">
              <RotateCw className="h-3 w-3 text-cobalt" />
            </span>
          </button>
        </>
      ) : null}
    </div>
  );
}
