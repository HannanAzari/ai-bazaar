"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import {
  DEFAULT_SURFACE_CONFIG,
  projectSurface,
  applyInertia,
  clampVelocity,
  clamp,
  type SurfaceConfig,
  type SurfaceCamera,
  type SurfacePoint,
  type ProjectedSurfacePoint,
  type Vec2,
} from "@/lib/village-surface";

// use-village-globe — the movable camera over the ONE shared village surface.
// Horizontal drag rotates longitude; vertical drag tilts the camera onto the cap.
// Every registered object is projected with lib/village-surface each frame and its
// transform/opacity/z written STRAIGHT to the DOM (refs, not React state) — and
// crucially HIDDEN when it rotates onto the back hemisphere (occluded by the
// earth), never left faintly floating in the sky. A per-frame callback lets the
// caller redraw surface features (roads, paths) with the same projection.

const TAP_THRESHOLD = 6;

export type GlobeItem = SurfacePoint & { id: string };

export type VillageGlobe = {
  rootRef: React.RefObject<HTMLDivElement | null>;
  register: (id: string) => (el: HTMLElement | null) => void;
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
    onWheel: (e: React.WheelEvent) => void;
  };
  viewport: { width: number; height: number };
  config: SurfaceConfig;
  getCamera: () => SurfaceCamera;
  /** Project any surface point with the CURRENT camera + viewport (for roads). */
  projectPoint: (longitude: number, latitude: number) => ProjectedSurfacePoint;
  /** Register a callback run after every projection pass (redraw surface features). */
  setOnFrame: (cb: (() => void) | null) => void;
  /** Glide the camera so a longitude faces front. */
  centerOn: (longitude: number, onArrive?: () => void) => void;
  suppressTapRef: React.MutableRefObject<boolean>;
};

export function useVillageGlobe({
  items,
  config: configPatch,
  onTap,
  disabled = false,
}: {
  items: GlobeItem[];
  config?: Partial<SurfaceConfig>;
  onTap?: (id: string) => void;
  disabled?: boolean;
}): VillageGlobe {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const elements = useRef<Map<string, HTMLElement>>(new Map());
  const itemsRef = useRef<GlobeItem[]>(items);
  itemsRef.current = items;

  const config = useMemo<SurfaceConfig>(
    () => ({ ...DEFAULT_SURFACE_CONFIG, ...configPatch }),
    [configPatch],
  );
  const configRef = useRef(config);
  configRef.current = config;

  const cameraRef = useRef<SurfaceCamera>({ longitude: 0, tilt: 0 });
  const velocityRef = useRef<Vec2>({ x: 0, y: 0 });
  const viewportRef = useRef({ width: 390, height: 780 });
  const [viewport, setViewport] = useState({ width: 390, height: 780 });

  const rafRef = useRef<number | null>(null);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const suppressTapRef = useRef(false);
  const onFrameRef = useRef<(() => void) | null>(null);

  const reduceMotion = useRef(false);
  useEffect(() => {
    reduceMotion.current =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const clampTilt = useCallback(
    (t: number) => clamp(t, configRef.current.tiltMin - configRef.current.tilt, configRef.current.tiltMax - configRef.current.tilt),
    [],
  );

  const projectPoint = useCallback(
    (longitude: number, latitude: number) =>
      projectSurface({ longitude, latitude }, cameraRef.current, viewportRef.current, configRef.current),
    [],
  );

  // ── Imperative projection pass. Writes to the DOM; no React render. ──
  const project = useCallback((moving: boolean) => {
    const vp = viewportRef.current;
    const cam = cameraRef.current;
    const cfg = configRef.current;
    const map = elements.current;
    for (const item of itemsRef.current) {
      const el = map.get(item.id);
      if (!el) continue;
      const p = projectSurface(item, cam, vp, cfg);
      if (!p.visible) {
        // Rotated onto the back hemisphere → occluded by the earth. Hide it.
        el.style.visibility = "hidden";
        continue;
      }
      el.style.visibility = "visible";
      el.style.transform = `translate3d(calc(${p.x.toFixed(2)}px - 50%), calc(${p.y.toFixed(2)}px - 100%), 0) scale(${p.scale.toFixed(3)})`;
      el.style.opacity = p.opacity.toFixed(3);
      el.style.zIndex = String(p.zIndex);
      el.style.filter = moving || p.blur < 0.2 ? "none" : `blur(${p.blur.toFixed(1)}px)`;
    }
    onFrameRef.current?.();
  }, []);

  const dirty = useRef(false);
  const scheduleProject = useCallback(() => {
    if (dirty.current) return;
    dirty.current = true;
    requestAnimationFrame(() => {
      dirty.current = false;
      project(true);
    });
  }, [project]);

  const stopInertia = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth || 390;
      const h = el.clientHeight || 780;
      viewportRef.current = { width: w, height: h };
      setViewport({ width: w, height: h });
      project(false);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [project]);

  useEffect(() => {
    project(false);
  }, [items, config, project]);

  useEffect(() => () => stopInertia(), [stopInertia]);

  const gesture = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startLon: 0,
    startTilt: 0,
    lastX: 0,
    lastY: 0,
    lastT: 0,
    travel: 0,
  });

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabledRef.current) return;
      stopInertia();
      suppressTapRef.current = false;
      const g = gesture.current;
      g.active = true;
      g.startX = e.clientX;
      g.startY = e.clientY;
      g.startLon = cameraRef.current.longitude;
      g.startTilt = cameraRef.current.tilt;
      g.lastX = e.clientX;
      g.lastY = e.clientY;
      g.lastT = performance.now();
      g.travel = 0;
      velocityRef.current = { x: 0, y: 0 };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [stopInertia],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const g = gesture.current;
      if (!g.active) return;
      const cfg = configRef.current;
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      g.travel = Math.max(g.travel, Math.hypot(dx, dy));
      if (g.travel > TAP_THRESHOLD) suppressTapRef.current = true;

      // Drag right → world rotates so surface follows the finger (longitude down).
      cameraRef.current = {
        longitude: g.startLon - dx * cfg.sensitivityLon,
        tilt: clampTilt(g.startTilt + dy * cfg.sensitivityTilt),
      };

      const now = performance.now();
      const dt = Math.max(1, now - g.lastT);
      velocityRef.current = {
        x: (-(e.clientX - g.lastX) * cfg.sensitivityLon * 16) / dt,
        y: ((e.clientY - g.lastY) * cfg.sensitivityTilt * 16) / dt,
      };
      g.lastX = e.clientX;
      g.lastY = e.clientY;
      g.lastT = now;

      scheduleProject();
    },
    [clampTilt, scheduleProject],
  );

  const endDrag = useCallback(() => {
    const g = gesture.current;
    if (!g.active) return;
    g.active = false;
    if (reduceMotion.current) {
      project(false);
      return;
    }
    let v = clampVelocity(velocityRef.current, configRef.current.maxVelocity);
    const spin = () => {
      v = applyInertia(v, configRef.current.friction);
      cameraRef.current = {
        longitude: cameraRef.current.longitude + v.x,
        tilt: clampTilt(cameraRef.current.tilt + v.y),
      };
      project(true);
      if (Math.hypot(v.x, v.y) < 0.0004) {
        rafRef.current = null;
        project(false);
        return;
      }
      rafRef.current = requestAnimationFrame(spin);
    };
    if (Math.hypot(v.x, v.y) > 0.001) {
      rafRef.current = requestAnimationFrame(spin);
    } else {
      project(false);
    }
  }, [clampTilt, project]);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const wasTap = gesture.current.travel <= TAP_THRESHOLD;
      endDrag();
      if (wasTap && onTap) {
        const target = (e.target as HTMLElement)?.closest?.("[data-world-id]");
        const id = target?.getAttribute("data-world-id");
        if (id) onTap(id);
      }
    },
    [endDrag, onTap],
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (disabledRef.current) return;
      stopInertia();
      const cfg = configRef.current;
      cameraRef.current = {
        longitude: cameraRef.current.longitude + e.deltaX * cfg.sensitivityLon,
        tilt: clampTilt(cameraRef.current.tilt + e.deltaY * cfg.sensitivityTilt),
      };
      scheduleProject();
    },
    [clampTilt, scheduleProject, stopInertia],
  );

  const register = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) {
        el.style.willChange = "transform, opacity";
        el.style.position = "absolute";
        el.style.left = "0";
        el.style.top = "0";
        el.style.transformOrigin = "50% 100%";
        elements.current.set(id, el);
      } else {
        elements.current.delete(id);
      }
    },
    [],
  );

  const centerOn = useCallback(
    (longitude: number, onArrive?: () => void) => {
      stopInertia();
      const start = cameraRef.current.longitude;
      // Shortest wrapped path.
      const TAU = Math.PI * 2;
      const d = ((longitude - start + Math.PI) % TAU + TAU) % TAU - Math.PI;
      const targetLon = start + d;
      if (reduceMotion.current) {
        cameraRef.current = { ...cameraRef.current, longitude: targetLon };
        project(false);
        onArrive?.();
        return;
      }
      const startT = performance.now();
      const dur = 420;
      const from = cameraRef.current.longitude;
      const step = () => {
        const t = Math.min(1, (performance.now() - startT) / dur);
        const e = 1 - Math.pow(1 - t, 3);
        cameraRef.current = { ...cameraRef.current, longitude: from + (targetLon - from) * e };
        project(t < 1);
        if (t < 1) rafRef.current = requestAnimationFrame(step);
        else {
          rafRef.current = null;
          onArrive?.();
        }
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [project, stopInertia],
  );

  const setOnFrame = useCallback((cb: (() => void) | null) => {
    onFrameRef.current = cb;
  }, []);

  return {
    rootRef,
    register,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: endDrag,
      onWheel,
    },
    viewport,
    config,
    getCamera: () => cameraRef.current,
    projectPoint,
    setOnFrame,
    centerOn,
    suppressTapRef,
  };
}
