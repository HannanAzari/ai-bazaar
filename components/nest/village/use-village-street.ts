"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import {
  visibleCellRange,
  applyInertia,
  clampVelocity,
  clamp,
  type Band,
  type Vec2,
} from "@/lib/village-street";

// use-village-street — the gliding camera over the endless rolling village.
// Horizontal movement is dominant and unbounded; vertical is a small, clamped
// look up/down so you can never get lost. Native Pointer Events + rAF inertia.
//
// Each parallax band is one DOM layer translated by `-cameraX * band.parallax`
// (GPU transform) every frame — so scrolling never triggers a React render. The
// only React state is the visible CELL WINDOW per band, and that updates just
// when the integer range actually shifts (a generous buffer keeps it rare), which
// is what makes the world stream endlessly without per-frame reconciliation.

const TAP_THRESHOLD = 7;
const BUFFER = 260; // px of off-screen cells kept mounted on each side

export type StreetWindow = { kMin: number; kMax: number };

export type VillageStreet = {
  rootRef: React.RefObject<HTMLDivElement | null>;
  registerLayer: (bandId: string) => (el: HTMLElement | null) => void;
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
    onWheel: (e: React.WheelEvent) => void;
  };
  viewport: { width: number; height: number };
  /** Visible inclusive cell range per band id (React state, low frequency). */
  windows: Record<string, StreetWindow>;
  getCamera: () => Vec2;
  /** Glide the camera so a world X sits near screen centre (tap-to-approach). */
  glideToX: (worldX: number, parallax: number) => void;
  suppressTapRef: React.MutableRefObject<boolean>;
};

export function useVillageStreet({
  bands,
  yRange = 46,
  sensitivityY = 0.45,
  friction = 0.93,
  maxVelocity = 55,
  disabled = false,
}: {
  bands: Band[];
  /** Max vertical pan (px) — vertical is deliberately limited. */
  yRange?: number;
  sensitivityY?: number;
  friction?: number;
  maxVelocity?: number;
  disabled?: boolean;
}): VillageStreet {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const layers = useRef<Map<string, HTMLElement>>(new Map());
  const bandsRef = useRef<Band[]>(bands);
  bandsRef.current = bands;

  const cameraRef = useRef<Vec2>({ x: 0, y: 0 });
  const velocityRef = useRef<Vec2>({ x: 0, y: 0 });
  const viewportRef = useRef({ width: 390, height: 780 });
  const [viewport, setViewport] = useState({ width: 390, height: 780 });

  const [windows, setWindows] = useState<Record<string, StreetWindow>>({});
  const windowsRef = useRef<Record<string, StreetWindow>>({});
  windowsRef.current = windows;

  const rafRef = useRef<number | null>(null);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const suppressTapRef = useRef(false);

  const reduceMotion = useRef(false);
  useEffect(() => {
    reduceMotion.current =
      typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // ── Per-frame: translate each band layer (GPU) + re-window if the integer
  //    visible cell range shifted. No React render for the transforms. ──
  const applyCamera = useCallback(() => {
    const cam = cameraRef.current;
    const vp = viewportRef.current;
    const camYNorm = yRange > 0 ? clamp(cam.y / yRange, -1, 1) : 0;
    for (const band of bandsRef.current) {
      const el = layers.current.get(band.id);
      if (el) {
        // Gentle depth: bands drift vertically at different rates and scale a hair
        // with camera.y, so dragging up "walks forward" into the village. Kept
        // subtle — no exaggerated perspective.
        const ty = cam.y * (1 + (band.depthLift ?? 0));
        const sc = 1 + camYNorm * (band.depthGain ?? 0);
        el.style.transform = `translate3d(${(-cam.x * band.parallax).toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${sc.toFixed(4)})`;
      }
    }
    // Re-window: only setState when a range actually changed.
    let changed = false;
    const next: Record<string, StreetWindow> = { ...windowsRef.current };
    for (const band of bandsRef.current) {
      const r = visibleCellRange(cam.x, band, vp.width, BUFFER);
      const cur = windowsRef.current[band.id];
      if (!cur || cur.kMin !== r.kMin || cur.kMax !== r.kMax) {
        next[band.id] = r;
        changed = true;
      }
    }
    if (changed) {
      windowsRef.current = next;
      setWindows(next);
    }
  }, [yRange]);

  const stopInertia = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  // Coalesce interaction into one rAF.
  const dirty = useRef(false);
  const schedule = useCallback(() => {
    if (dirty.current) return;
    dirty.current = true;
    requestAnimationFrame(() => {
      dirty.current = false;
      applyCamera();
    });
  }, [applyCamera]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth || 390;
      const h = el.clientHeight || 780;
      viewportRef.current = { width: w, height: h };
      setViewport({ width: w, height: h });
      applyCamera();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [applyCamera]);

  useEffect(() => {
    applyCamera();
  }, [bands, applyCamera]);

  useEffect(() => () => stopInertia(), [stopInertia]);

  const gesture = useRef({ active: false, sx: 0, sy: 0, cx: 0, cy: 0, lx: 0, ly: 0, lt: 0, travel: 0 });

  const clampY = useCallback((y: number) => clamp(y, -yRange, yRange), [yRange]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (disabledRef.current) return;
    stopInertia();
    suppressTapRef.current = false;
    const g = gesture.current;
    g.active = true;
    g.sx = e.clientX; g.sy = e.clientY;
    g.cx = cameraRef.current.x; g.cy = cameraRef.current.y;
    g.lx = e.clientX; g.ly = e.clientY; g.lt = performance.now();
    g.travel = 0;
    velocityRef.current = { x: 0, y: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [stopInertia]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g.active) return;
    const dx = e.clientX - g.sx;
    const dy = e.clientY - g.sy;
    g.travel = Math.max(g.travel, Math.hypot(dx, dy));
    if (g.travel > TAP_THRESHOLD) suppressTapRef.current = true;

    // Horizontal follows the finger 1:1; vertical is damped + clamped.
    cameraRef.current = { x: g.cx - dx, y: clampY(g.cy - dy * sensitivityY) };

    const now = performance.now();
    const dt = Math.max(1, now - g.lt);
    velocityRef.current = {
      x: (-(e.clientX - g.lx) * 16) / dt,
      y: (-(e.clientY - g.ly) * sensitivityY * 16) / dt,
    };
    g.lx = e.clientX; g.ly = e.clientY; g.lt = now;
    schedule();
  }, [clampY, schedule, sensitivityY]);

  const endDrag = useCallback(() => {
    const g = gesture.current;
    if (!g.active) return;
    g.active = false;
    if (reduceMotion.current) { applyCamera(); return; }
    let v = clampVelocity(velocityRef.current, maxVelocity);
    const glide = () => {
      v = applyInertia(v, friction);
      cameraRef.current = { x: cameraRef.current.x + v.x, y: clampY(cameraRef.current.y + v.y) };
      applyCamera();
      if (Math.hypot(v.x, v.y) < 0.12) { rafRef.current = null; return; }
      rafRef.current = requestAnimationFrame(glide);
    };
    if (Math.hypot(v.x, v.y) > 0.3) rafRef.current = requestAnimationFrame(glide);
    else applyCamera();
  }, [applyCamera, clampY, friction, maxVelocity]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    endDrag();
    void e;
  }, [endDrag]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (disabledRef.current) return;
    stopInertia();
    cameraRef.current = {
      x: cameraRef.current.x + e.deltaX + e.deltaY * 0.4, // wheel scrolls the street
      y: cameraRef.current.y,
    };
    schedule();
  }, [schedule, stopInertia]);

  const registerLayer = useCallback((bandId: string) => (el: HTMLElement | null) => {
    if (el) {
      el.style.willChange = "transform";
      el.style.transformOrigin = "50% 100%"; // scale from the ground, not the top
      layers.current.set(bandId, el);
    } else {
      layers.current.delete(bandId);
    }
  }, []);

  const glideToX = useCallback((worldX: number, parallax: number) => {
    stopInertia();
    if (reduceMotion.current) {
      cameraRef.current = { ...cameraRef.current, x: worldX / parallax - viewportRef.current.width / 2 };
      applyCamera();
      return;
    }
    const from = cameraRef.current.x;
    const target = worldX / parallax - viewportRef.current.width / 2;
    const startT = performance.now();
    const dur = 460;
    const step = () => {
      const t = Math.min(1, (performance.now() - startT) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      cameraRef.current = { ...cameraRef.current, x: from + (target - from) * e };
      applyCamera();
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else rafRef.current = null;
    };
    rafRef.current = requestAnimationFrame(step);
  }, [applyCamera, stopInertia]);

  return {
    rootRef,
    registerLayer,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: endDrag,
      onWheel,
    },
    viewport,
    windows,
    getCamera: () => cameraRef.current,
    glideToX,
    suppressTapRef,
  };
}
