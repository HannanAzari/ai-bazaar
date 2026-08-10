"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Lock, RotateCw } from "lucide-react";
import { sceneToScreen, type Camera } from "@/lib/nest-camera";
import { rotatedAabb, toolbarPlacement } from "@/lib/nest-editor-chrome";
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
// This is the real thing: the chrome is a SIBLING of the viewport, never a descendant of
// the transform. Its position is recomputed from `sceneToScreen()` on every camera frame,
// inside the camera's own rAF, and written straight to the DOM — so it tracks the object
// pixel-for-pixel while zooming and panning without a single React render.
//
// ── M26-P §2/§3 — lighter chrome, and a toolbar that stays on screen ─────────
//
// The heavy solid rectangle with four fat handles is replaced by a thin dashed outline
// that ROTATES with the object, plus two resize handles on opposite corners. Everything
// still lives in screen pixels, so nothing scales with the camera.
//
// The toolbar is positioned from the object's ROTATED screen bounds and clamped to the
// viewport, rather than riding inside the frame at a fixed offset — which is why it used
// to drift far from a rotated object and run off the edge of a phone.
//
// Nothing here is ever persisted. These are pixels on a screen, not facts about a Nest.

const HANDLE = 40; // touch target, constant at every zoom
const DOT = 13;
const ROTATE_GAP = 26;

export type SelectionRect = { x: number; y: number; width: number; height: number };

export function ScreenSpaceSelection({
  object,
  rect,
  subscribe,
  viewportRef,
  baseSizeRef,
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
  rotatable: boolean;
  /** A hidden or deleted object must not leave floating controls behind. */
  hidden?: boolean;
  /**
   * The contextual object toolbar. Positioned from the object's rotated SCREEN bounds and
   * clamped to the viewport — never from scene coordinates, and never inside the rotated
   * outline (it would tilt with the object and become unreadable).
   */
  toolbar?: ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef(object.rotation ?? 0);
  rotationRef.current = object.rotation ?? 0;

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
      const w = Math.max(0, br.x - tl.x);
      const h = Math.max(0, br.y - tl.y);
      el.style.left = `${tl.x - hr.left}px`;
      el.style.top = `${tl.y - hr.top}px`;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      // An object scrolled entirely out of view must not leave its handles floating.
      const off = br.x < vr.left || tl.x > vr.right || br.y < vr.top || tl.y > vr.bottom;
      el.style.visibility = off ? "hidden" : "visible";

      // ── §3 — the toolbar follows the object, and stays on the phone ────────
      const bar = barRef.current;
      if (!bar) return;
      // The object's ROTATED extent in viewport coordinates. A rotated object's real
      // bounds are wider than its box, and anchoring to the box is what let the bar
      // overlap a tilted object.
      const box = rotatedAabb({ left: tl.x, top: tl.y, width: w, height: h }, rotationRef.current);
      const place = toolbarPlacement(box, { width: bar.offsetWidth, height: bar.offsetHeight }, { width: window.innerWidth, height: window.innerHeight }, rotatable && !object.locked);
      bar.style.left = `${place.left - hr.left}px`;
      bar.style.top = `${place.top - hr.top}px`;
      bar.style.visibility = off ? "hidden" : "visible";
    });
  }, [subscribe, viewportRef, baseSizeRef, rect.x, rect.y, rect.width, rect.height, rotatable, object.locked, object.rotation]);

  if (hidden) return null;

  // The outline and its handles rotate WITH the object (§2). The toolbar deliberately does
  // not — a tilted toolbar is unreadable, and its text would be upside down past 90°.
  const spin = object.rotation ? { transform: `rotate(${object.rotation}deg)`, transformOrigin: "center" } : undefined;

  return (
    <>
      <div
        ref={frameRef}
        data-screen-selection=""
        className="pointer-events-none absolute"
        // No transform on THIS element: position and size are written in screen pixels,
        // which is what makes "handles never scale" true by construction.
        style={{ left: 0, top: 0, width: 0, height: 0 }}
      >
        <div className="absolute inset-0" style={spin}>
          {/* §2 — a thin dashed outline, not a heavy solid rectangle. */}
          <div
            className={`absolute inset-0 rounded-[10px] border ${object.locked ? "border-dashed border-terracotta/70" : "border-dashed border-cobalt/70"}`}
            style={{ borderWidth: 1.5, boxShadow: "0 0 0 1px rgba(255,255,255,.45)" }}
          />

          {object.locked ? (
            <span className="absolute right-1 top-1 rounded-full bg-terracotta/90 p-1 text-white">
              <Lock className="h-3 w-3" />
            </span>
          ) : (
            // §2 — TWO handles on opposite corners, not four. Two is enough to resize from
            // either end, and four turned a small object into a cluster of touch targets
            // with barely any object left between them.
            ([
              [0, 0, -1],
              [1, 1, 1],
            ] as const).map(([cx, cy, dirX]) => (
              <span
                key={`${cx}-${cy}`}
                data-resize-handle=""
                data-dir-x={dirX}
                className="pointer-events-auto absolute flex cursor-nwse-resize touch-none items-center justify-center"
                style={{
                  width: HANDLE,
                  height: HANDLE,
                  left: `calc(${cx * 100}% - ${HANDLE / 2}px)`,
                  top: `calc(${cy * 100}% - ${HANDLE / 2}px)`,
                }}
              >
                <span className="rounded-full border-[1.5px] border-cobalt bg-white shadow-sm" style={{ width: DOT, height: DOT }} />
              </span>
            ))
          )}

          {/* §2 — the precision rotate control stays, visually simplified: a hairline and a
              small ring rather than a heavy button. */}
          {rotatable && !object.locked ? (
            <>
              <span aria-hidden className="absolute bg-cobalt/35" style={{ left: "50%", top: -ROTATE_GAP, height: ROTATE_GAP, width: 1 }} />
              <button
                type="button"
                aria-label="Rotate"
                data-rotate-handle=""
                className="pointer-events-auto absolute flex cursor-grab touch-none items-center justify-center"
                style={{ width: 40, height: 40, left: "calc(50% - 20px)", top: -ROTATE_GAP - 40 }}
              >
                <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] border-cobalt/80 bg-white/95 shadow-sm">
                  <RotateCw className="h-3 w-3 text-cobalt" />
                </span>
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* §3 — a SIBLING of the frame, positioned in viewport pixels each camera frame and
          clamped so it can never leave the phone. It used to ride inside the frame at a
          fixed offset above it, which is why it drifted with rotation and ran off-screen. */}
      {toolbar ? (
        <div ref={barRef} data-object-toolbar="" data-editor-chrome="" className="pointer-events-none absolute left-0 top-0">
          {toolbar}
        </div>
      ) : null}
    </>
  );
}
