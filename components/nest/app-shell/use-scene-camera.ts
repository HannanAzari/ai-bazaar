"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CAMERA_DOUBLE_TAP_SCALE,
  CAMERA_MAX_SCALE,
  cameraTransform,
  clampOffset,
  distance,
  doubleTapCamera,
  IDENTITY_CAMERA,
  isIdentityCamera,
  isTap,
  midpoint,
  panBy,
  zoomAround,
  type Camera,
} from "@/lib/nest-camera";

// ── M25 §P1/§P9 — the gesture layer ──────────────────────────────────────────
//
// Pinch, pan, double-tap and tap-vs-drag, driven ENTIRELY through refs.
//
// This is the performance decision of the sprint, so it is worth being explicit: the
// camera is never React state during a gesture. A pinch fires ~60 pointermove events per
// second, and putting the transform in `useState` would re-render the whole scene — every
// object, every image — on each one. Instead the transform is written straight to the
// stage element's `style.transform` inside a rAF, and React learns about it only when the
// gesture ends (and then only so the reset control can appear).
//
// The scene subtree therefore does not re-render at all while a finger is down.

type Options = {
  /** Called when a completed gesture was a TAP, in viewport coordinates. */
  onTap?: (point: { x: number; y: number }) => void;
  /** Disable all gesture handling (cards, thumbnails). */
  enabled?: boolean;
  /**
   * M25B §P1 — whether a ONE-FINGER drag starting here may pan the camera.
   *
   * The editor needs this and the visitor does not. In Arrange mode a one-finger drag on
   * an asset must MOVE THAT ASSET, while the same drag on empty room must pan; two-finger
   * pinch must zoom in both cases without disturbing the asset. Returning false here
   * declines only the single-finger pan — the pointer is still tracked, so a second finger
   * still starts a pinch from an accurate baseline.
   *
   * Default: pan anywhere (the visitor runtime, where nothing is draggable).
   */
  canPanFrom?: (target: EventTarget | null) => boolean;
  /**
   * M26-S2 §2 — the host's gesture arbiter, and the reason there is now ONE owner.
   *
   * Before this the editor ran a second, independent set of React pointer handlers on the
   * scene while this hook ran native ones on the viewport ancestor. Both saw every event
   * and each decided for itself, every frame, so nothing could actually guarantee a single
   * owner — the camera pinched on two fingers no matter what the canvas had decided, which
   * is precisely why the two-finger object transform could never work.
   *
   * Now this hook is the only thing listening. It asks the arbiter once, at the first
   * pointer-down, who owns the session; if the host claims it, the camera stands completely
   * down until the last finger lifts, and vice versa. Neither can change family mid-gesture
   * because nobody is left to re-decide.
   */
  arbiter?: GestureArbiter;
};

/**
 * The host's side of the one-owner contract. All three are called with the live pointer
 * set in viewport-client coordinates.
 */
export type GestureArbiter = {
  /**
   * A pointer went down. Return true to claim the whole session for the host.
   *
   * Called for EVERY pointer-down, so the host can upgrade its own subtype (a second finger
   * on an object it is already dragging becomes a transform). The return value is only ever
   * honoured for the FIRST pointer — after that the family is locked.
   */
  down: (e: PointerEvent, points: { x: number; y: number }[]) => boolean;
  move: (points: { x: number; y: number }[]) => void;
  /** The last pointer lifted. `tapped` is true when the session never passed the drag slop. */
  up: (tapped: boolean) => void;
};

export type SceneCamera = {
  /** Attach to the element that CLIPS the scene (the viewport). */
  viewportRef: React.RefObject<HTMLDivElement | null>;
  /** Attach to the element that MOVES (the stage). */
  stageRef: React.RefObject<HTMLDivElement | null>;
  /** True while the camera is not at rest — drives the reset control. */
  zoomed: boolean;
  /** True while a finger is actually panning — suppresses hover affordances. */
  panning: boolean;
  reset: () => void;
  /** The current camera. Read-only snapshot; do not use it for per-frame work. */
  read: () => Camera;
  /** Restore a camera (used to put a visitor back where they were after a modal). */
  restore: (cam: Camera) => void;
  /**
   * M26A §3 — subscribe to EVERY camera frame.
   *
   * Screen-space chrome (handles, the object toolbar) lives outside the transform, so it
   * has to be repositioned as the camera moves — but it must not cause a React render per
   * frame either. Subscribers are called inside the same rAF that writes the transform,
   * and are expected to write to the DOM directly.
   *
   * Returns an unsubscribe function.
   */
  subscribe: (fn: (cam: Camera) => void) => () => void;
};

export function useSceneCamera({ onTap, enabled = true, canPanFrom, arbiter }: Options = {}): SceneCamera {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const cam = useRef<Camera>(IDENTITY_CAMERA);
  const frame = useRef<number | null>(null);
  const subscribers = useRef(new Set<(c: Camera) => void>());

  // `zoomed` is the ONLY thing that reaches React, and only on gesture end.
  const [zoomed, setZoomed] = useState(false);
  const [panning, setPanning] = useState(false);

  // `onTap` changes identity whenever the host re-renders (it closes over object state).
  // Keeping it in a ref is what lets the listener effect below depend on NOTHING that
  // changes at runtime — see the note on that effect for why that matters.
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;
  const canPanFromRef = useRef(canPanFrom);
  canPanFromRef.current = canPanFrom;
  const arbiterRef = useRef(arbiter);
  arbiterRef.current = arbiter;
  const panningRef = useRef(false);

  const viewport = useCallback(() => {
    const el = viewportRef.current;
    return el ? { width: el.clientWidth, height: el.clientHeight } : { width: 0, height: 0 };
  }, []);

  /** Write the camera to the DOM. Coalesced into one rAF so a burst of moves paints once. */
  const paint = useCallback(() => {
    if (frame.current != null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const el = stageRef.current;
      if (el) el.style.transform = cameraTransform(cam.current);
      // Screen-space chrome repositions in the SAME frame as the room, so a handle never
      // lags a pixel behind the object it belongs to.
      subscribers.current.forEach((fn) => fn(cam.current));
    });
  }, []);

  // Cancel any in-flight frame on unmount ONLY. This used to live in the listener
  // effect's cleanup, where it was a latch bug: `setZoomed` re-rendered the host, the
  // listener effect re-ran, its cleanup cancelled the pending frame — and left
  // `frame.current` non-null, so `paint()` early-returned forever and the camera silently
  // stopped moving after the very first gesture. Caught by measuring the DOM, not by
  // reading the code.
  useEffect(
    () => () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
      frame.current = null;
    },
    [],
  );

  const apply = useCallback(
    (next: Camera, animate = false) => {
      cam.current = next;
      const el = stageRef.current;
      if (el) {
        // A settled camera animates; a live gesture must not, or it lags the finger.
        el.style.transition = animate ? "transform 320ms cubic-bezier(.32,.72,0,1)" : "none";
        if (animate) {
          el.style.transform = cameraTransform(next);
          subscribers.current.forEach((fn) => fn(next));
        } else paint();
      }
      setZoomed(!isIdentityCamera(next));
    },
    [paint],
  );

  const reset = useCallback(() => apply(IDENTITY_CAMERA, true), [apply]);
  const subscribe = useCallback((fn: (c: Camera) => void) => {
    subscribers.current.add(fn);
    fn(cam.current); // seed immediately, so chrome is correct before the first gesture
    return () => {
      subscribers.current.delete(fn);
    };
  }, []);
  const read = useCallback(() => cam.current, []);
  const restore = useCallback((c: Camera) => apply(clampOffset(c, viewport()), false), [apply, viewport]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !enabled) return;

    // Pointer state. All of it lives in closures/refs — none of it is React state.
    const points = new Map<number, { x: number; y: number }>();
    let start: { x: number; y: number; t: number } | null = null;
    let last: { x: number; y: number } | null = null;
    let maxDist = 0;
    let pinchStart: { dist: number; scale: number } | null = null;
    let lastTapAt = 0;
    let lastTapPoint = { x: 0, y: 0 };
    let moved = false;
    /** Decided once on pointerdown: may a one-finger drag from here pan the camera? */
    let panAllowed = true;
    /**
     * M26-S2 §2 — THE one-owner latch.
     *
     * Set by the arbiter at the FIRST pointer-down and never reconsidered until every
     * finger has lifted. While true the camera does nothing at all: no pan, no pinch, no
     * tap, no double-tap. While false the arbiter is never driven.
     */
    let hostOwns = false;

    /** Viewport coordinates relative to the viewport CENTRE (what the camera maths wants). */
    const focalOf = (p: { x: number; y: number }) => {
      const r = el.getBoundingClientRect();
      return { x: p.x - (r.left + r.width / 2), y: p.y - (r.top + r.height / 2) };
    };

    const onPointerDown = (e: PointerEvent) => {
      // ── M26-S1 §6 — THE MIRROR BUG ────────────────────────────────────────
      //
      // Never claim a pointer that begins on editor chrome.
      //
      // Screen-space chrome (the object toolbar, Reset view) renders INSIDE the viewport,
      // so a tap on Mirror bubbles here. This handler then called
      // `viewport.setPointerCapture(pointerId)` — and pointer capture RETARGETS every
      // later event for that pointer, including `pointerup`, to the viewport. With no
      // pointerup on the button, the browser never synthesises `click`, so `onClick`
      // never ran. Mirror, Duplicate, Layer, Connect, Lock and Delete were all dead to a
      // finger.
      //
      // It looked fine in tests because a programmatic `.click()` bypasses the pointer
      // pipeline entirely. Only a real tap reproduces it — which is why the founder saw it
      // on a phone and the suite did not.
      //
      // The Reset button and the runtime's controls each carried their own
      // `stopPropagation`; the object toolbar never did. Fixing it centrally means a new
      // control cannot forget.
      if (e.target instanceof Element && e.target.closest("[data-editor-chrome]")) return;

      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pts = Array.from(points.values());

      // Ask the arbiter on every down so the host can upgrade its OWN subtype — but only
      // the first pointer's answer decides the family (§2).
      const claimed = arbiterRef.current?.down(e, pts) ?? false;
      if (points.size === 1) {
        hostOwns = claimed;
        start = { x: e.clientX, y: e.clientY, t: e.timeStamp };
        last = { x: e.clientX, y: e.clientY };
        maxDist = 0;
        moved = false;
        // Decided at DOWN, not at move: once a finger is on an asset the answer must not
        // change mid-drag, or the asset would start moving and the camera finish the job.
        panAllowed = canPanFromRef.current ? canPanFromRef.current(e.target) : true;
      } else if (points.size === 2) {
        // ── M27B-3A1 — a host may HAND BACK the session when a second finger lands ──
        //
        // The family is still decided by the first pointer; this is the one narrow case
        // where the host can decline to continue. It exists because a two-finger pinch
        // beginning inside a small media aperture used to be swallowed: media had claimed
        // the session at the first finger, so the camera never took a pinch baseline and
        // the room would not zoom.
        //
        // A host that still wants the gesture (the editor's object transform) returns true
        // here exactly as before and keeps it — so object drag → two-finger transform is
        // untouched, and the camera still cannot steal an object mid-drag.
        if (hostOwns && !claimed) hostOwns = false;
        if (!hostOwns) {
          const [a, b] = pts;
          pinchStart = { dist: distance(a, b), scale: cam.current.scale };
        }
      }
      // Capture so a finger that leaves the element still delivers move/up.
      //
      // Both capture calls are guarded: `setPointerCapture`/`releasePointerCapture` throw
      // NotFoundError when the pointer is already gone, and an exception here would abort
      // the handler BEFORE the tap is classified — silently losing the visitor's tap.
      // Capture is an optimisation; the gesture must survive without it.
      try {
        el.setPointerCapture?.(e.pointerId);
      } catch {
        /* no capture available — move/up still arrive while the finger is over the element */
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!points.has(e.pointerId)) return;
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (start) maxDist = Math.max(maxDist, distance(start, { x: e.clientX, y: e.clientY }));

      // §2 — the host owns this session. The camera contributes nothing, so an object drag
      // or transform can never move the room by a single pixel.
      if (hostOwns) {
        arbiterRef.current?.move(Array.from(points.values()));
        if (maxDist > 4) moved = true;
        e.preventDefault();
        return;
      }

      if (points.size >= 2 && pinchStart) {
        const [a, b] = Array.from(points.values());
        const d = distance(a, b);
        if (pinchStart.dist > 0) {
          const next = pinchStart.scale * (d / pinchStart.dist);
          apply(zoomAround(cam.current, next, focalOf(midpoint(a, b)), viewport()));
        }
        moved = true;
        // Stop Safari's own pinch-zoom and page scroll taking the gesture.
        e.preventDefault();
        return;
      }

      if (points.size === 1 && start && last) {
        const dx = e.clientX - last.x;
        const dy = e.clientY - last.y;
        // ONE-FINGER PAN ONLY WHILE ZOOMED. At 1× a drag must stay a page gesture, or the
        // feed can no longer be scrolled with a finger that starts on a room.
        if (panAllowed && cam.current.scale > 1.001) {
          apply(panBy(cam.current, dx, dy, viewport()));
          if (maxDist > 4) {
            moved = true;
            if (!panningRef.current) {
              panningRef.current = true;
              setPanning(true);
            }
          }
          e.preventDefault();
        }
        last = { x: e.clientX, y: e.clientY };
      }
    };

    const endGesture = (e: PointerEvent) => {
      points.delete(e.pointerId);
      try {
        el.releasePointerCapture?.(e.pointerId);
      } catch {
        /* never let releasing capture swallow the tap below */
      }

      if (points.size < 2) pinchStart = null;
      if (points.size > 0) return; // still mid-gesture

      const wasPanning = moved;
      if (panningRef.current) {
        panningRef.current = false;
        setPanning(false);
      }

      // Every session ends at the arbiter, whoever owned it — the host has bookkeeping to
      // clear either way, and `up` is a no-op when it armed nothing.
      const wasTap = !moved && start != null && isTap(start, { x: e.clientX, y: e.clientY, t: e.timeStamp }, maxDist);
      arbiterRef.current?.up(wasTap);

      // §2 — the host had the whole session, so the camera's own tap and double-tap paths
      // are skipped entirely: a tap that began on an object is the object's business, and
      // double-tap-to-zoom must never fire on top of an edit.
      if (hostOwns) {
        hostOwns = false;
        start = null;
        last = null;
        maxDist = 0;
        moved = false;
        return;
      }

      if (start && isTap(start, { x: e.clientX, y: e.clientY, t: e.timeStamp }, maxDist) && !wasPanning) {
        const now = e.timeStamp;
        const p = { x: e.clientX, y: e.clientY };
        // Double tap: two taps close in time AND in space.
        if (now - lastTapAt < 300 && distance(p, lastTapPoint) < 40) {
          lastTapAt = 0;
          apply(doubleTapCamera(cam.current, focalOf(p), viewport()), true);
        } else {
          lastTapAt = now;
          lastTapPoint = p;
          onTapRef.current?.(p);
        }
      }
      start = null;
      last = null;
      maxDist = 0;
      moved = false;
    };

    // `passive: false` is required — a passive listener cannot preventDefault, and without
    // that Safari runs its own page zoom on top of ours.
    const opts = { passive: false } as AddEventListenerOptions;
    el.addEventListener("pointerdown", onPointerDown, opts);
    el.addEventListener("pointermove", onPointerMove, opts);
    el.addEventListener("pointerup", endGesture, opts);
    el.addEventListener("pointercancel", endGesture, opts);

    // Safari fires these for its own pinch; swallowing them stops the PAGE zooming while
    // the visitor is zooming the room.
    const swallow = (e: Event) => e.preventDefault();
    el.addEventListener("gesturestart", swallow, opts);
    el.addEventListener("gesturechange", swallow, opts);

    // Trackpad / mouse wheel zoom, so the bench and desktop are usable too.
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && Math.abs(e.deltaY) < 2) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY / 300);
      apply(zoomAround(cam.current, cam.current.scale * factor, focalOf({ x: e.clientX, y: e.clientY }), viewport()));
    };
    el.addEventListener("wheel", onWheel, opts);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown, opts);
      el.removeEventListener("pointermove", onPointerMove, opts);
      el.removeEventListener("pointerup", endGesture, opts);
      el.removeEventListener("pointercancel", endGesture, opts);
      el.removeEventListener("gesturestart", swallow, opts);
      el.removeEventListener("gesturechange", swallow, opts);
      el.removeEventListener("wheel", onWheel, opts);
    };
    // Deliberately depends only on `enabled` and three stable callbacks. Anything that
    // changes per render (the tap handler, the panning flag) is read through a ref, so the
    // listeners are attached ONCE and a re-render can never tear down a live gesture.
  }, [enabled, apply, viewport]);

  return { viewportRef, stageRef, zoomed, panning, reset, read, restore, subscribe };
}

export { CAMERA_MAX_SCALE, CAMERA_DOUBLE_TAP_SCALE };
