"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import {
  DEFAULT_PROJECTION_CONFIG,
  projectItem,
  applyInertia,
  clampVelocity,
  clamp,
  type ProjectionConfig,
  type VillageWorldItem,
  type Camera,
  type Vec2,
} from "@/lib/village-projection";

// use-curved-world — the movable camera over a virtual 2D world, driven with
// native Pointer Events + requestAnimationFrame. It projects every world item
// with lib/village-projection and writes transform/opacity/z-index STRAIGHT to
// the DOM each frame (refs, not React state) so dragging never triggers a React
// render. Blur is only applied when the world comes to rest (transform+opacity
// only while moving — the mobile-perf rule). Shared by the /village-projection-lab
// prototype and the real Village scene.

const TAP_THRESHOLD = 6; // px of travel below which a pointer-up counts as a tap

export type CurvedWorldHandlers = {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onWheel: (e: React.WheelEvent) => void;
};

export type CurvedWorld = {
  /** Attach to the clipped viewport element (measured for width/height). */
  rootRef: React.RefObject<HTMLDivElement | null>;
  /** Ref callback for each item's positioner element, keyed by item id. */
  register: (id: string) => (el: HTMLElement | null) => void;
  handlers: CurvedWorldHandlers;
  /** Measured viewport, updated on resize (React state — low frequency). */
  viewport: { width: number; height: number };
  /** The merged, live config (for drawing the ground curve to match). */
  config: ProjectionConfig;
  /** Read the current camera (for debug overlays). */
  getCamera: () => Camera;
  /** Smoothly glide the camera so a world point sits centre-front. */
  centerOn: (worldX: number, worldY: number, onArrive?: () => void) => void;
  /** Instantly place the camera (e.g. re-centre when the home house loads). */
  jumpTo: (camera: Camera) => void;
  /** True if the last gesture was a drag (so a trailing click should be eaten). */
  suppressTapRef: React.MutableRefObject<boolean>;
  /** Force a re-projection (e.g. after items or config change). */
  reproject: () => void;
};

export function useCurvedWorld({
  items,
  config: configPatch,
  onTap,
  disabled = false,
  initialCamera,
}: {
  items: VillageWorldItem[];
  config?: Partial<ProjectionConfig>;
  onTap?: (id: string) => void;
  /** When true, gestures are ignored (e.g. during an arrival zoom). */
  disabled?: boolean;
  /** Where the camera opens (world coords). Applied once on first mount. */
  initialCamera?: Camera;
}): CurvedWorld {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const elements = useRef<Map<string, HTMLElement>>(new Map());
  const itemsRef = useRef<VillageWorldItem[]>(items);
  itemsRef.current = items;

  // Merge caller overrides onto the defaults; memoized so identity is stable
  // per distinct patch (sliders in the lab produce new patches → new config).
  const config = useMemo<ProjectionConfig>(
    () => ({ ...DEFAULT_PROJECTION_CONFIG, ...configPatch }),
    [configPatch],
  );
  const configRef = useRef(config);
  configRef.current = config;

  const cameraRef = useRef<Camera>(initialCamera ? { ...initialCamera } : { x: 0, y: 0 });
  const velocityRef = useRef<Vec2>({ x: 0, y: 0 });
  const viewportRef = useRef({ width: 390, height: 720 });
  const [viewport, setViewport] = useState({ width: 390, height: 720 });

  const rafRef = useRef<number | null>(null);
  const dragging = useRef(false);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const suppressTapRef = useRef(false);

  const reduceMotion = useRef(false);
  useEffect(() => {
    reduceMotion.current =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // ── Vertical camera bound: keep drag within the world's depth so you can't
  // wander off into empty space (horizontal wraps forever, vertical is finite).
  const clampCameraY = useCallback((y: number) => {
    const half = configRef.current.WORLD_HEIGHT / 2;
    return clamp(y, -half * 0.6, half * 0.6);
  }, []);

  // ── The imperative projection pass. Writes to the DOM; no React render. ──
  const project = useCallback((moving: boolean) => {
    const vp = viewportRef.current;
    const cam = cameraRef.current;
    const cfg = configRef.current;
    const map = elements.current;
    for (const item of itemsRef.current) {
      const el = map.get(item.id);
      if (!el) continue;
      const p = projectItem(item, cam, vp, cfg);
      if (!p.visible) {
        el.style.visibility = "hidden";
        continue;
      }
      el.style.visibility = "visible";
      // Pure transform anchoring: bottom-centre of the element lands on the
      // projected ground point. calc(px - 50%/100%) uses the element's own box,
      // so scale (origin bottom-centre) keeps the contact point fixed.
      el.style.transform = `translate3d(calc(${p.screenX.toFixed(2)}px - 50%), calc(${p.screenY.toFixed(2)}px - 100%), 0) scale(${p.scale.toFixed(3)})`;
      el.style.opacity = p.opacity.toFixed(3);
      el.style.zIndex = String(p.zIndex);
      // Blur only when at rest — transform+opacity only while moving.
      el.style.filter = moving || p.blur < 0.2 ? "none" : `blur(${p.blur.toFixed(1)}px)`;
    }
  }, []);

  // Coalesce interaction updates into a single rAF so several pointermove
  // events in a frame produce one projection.
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

  // ── Measure the viewport (and keep current on resize/orientation). ──
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth || 390;
      const h = el.clientHeight || 720;
      viewportRef.current = { width: w, height: h };
      setViewport({ width: w, height: h });
      project(false);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [project]);

  // Re-project when the item set or config changes.
  const reproject = useCallback(() => project(false), [project]);
  useEffect(() => {
    reproject();
  }, [items, config, reproject]);

  useEffect(() => () => stopInertia(), [stopInertia]);

  // ── Gesture state ──
  const gesture = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startCamX: 0,
    startCamY: 0,
    lastX: 0,
    lastY: 0,
    lastT: 0,
    travel: 0,
  });

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabledRef.current) return;
      stopInertia();
      suppressTapRef.current = false; // fresh gesture — never eat this tap
      const g = gesture.current;
      g.active = true;
      g.startX = e.clientX;
      g.startY = e.clientY;
      g.startCamX = cameraRef.current.x;
      g.startCamY = cameraRef.current.y;
      g.lastX = e.clientX;
      g.lastY = e.clientY;
      g.lastT = performance.now();
      g.travel = 0;
      velocityRef.current = { x: 0, y: 0 };
      dragging.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [stopInertia],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const g = gesture.current;
      if (!g.active) return;
      const cfg = configRef.current;
      const dx = e.clientX - g.startX; // since gesture start
      const dy = e.clientY - g.startY;
      g.travel = Math.max(g.travel, Math.hypot(dx, dy));
      if (g.travel > TAP_THRESHOLD) suppressTapRef.current = true;

      // Camera moves OPPOSITE the finger (world follows the drag).
      cameraRef.current = {
        x: g.startCamX - dx * cfg.sensitivity,
        y: clampCameraY(g.startCamY - dy * cfg.sensitivity),
      };

      // Instantaneous velocity for the fling (world-units per frame ≈ per 16ms).
      const now = performance.now();
      const dt = Math.max(1, now - g.lastT);
      velocityRef.current = {
        x: (-(e.clientX - g.lastX) * cfg.sensitivity * 16) / dt,
        y: (-(e.clientY - g.lastY) * cfg.sensitivity * 16) / dt,
      };
      g.lastX = e.clientX;
      g.lastY = e.clientY;
      g.lastT = now;

      scheduleProject();
    },
    [clampCameraY, scheduleProject],
  );

  const endDrag = useCallback(() => {
    const g = gesture.current;
    if (!g.active) return;
    g.active = false;
    dragging.current = false;
    if (reduceMotion.current) {
      project(false);
      return;
    }
    // Fling: coast with friction, damping to rest, then a final blurred pass.
    let v = clampVelocity(velocityRef.current, configRef.current.maxVelocity);
    const spin = () => {
      v = applyInertia(v, configRef.current.friction);
      cameraRef.current = {
        x: cameraRef.current.x + v.x,
        y: clampCameraY(cameraRef.current.y + v.y),
      };
      project(true);
      if (Math.hypot(v.x, v.y) < 0.15) {
        rafRef.current = null;
        project(false); // settle: re-apply depth blur
        return;
      }
      rafRef.current = requestAnimationFrame(spin);
    };
    if (Math.hypot(v.x, v.y) > 0.4) {
      rafRef.current = requestAnimationFrame(spin);
    } else {
      project(false);
    }
  }, [clampCameraY, project]);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (disabledRef.current) return;
      stopInertia();
      const cfg = configRef.current;
      cameraRef.current = {
        x: cameraRef.current.x + e.deltaX * cfg.sensitivity,
        y: clampCameraY(cameraRef.current.y + e.deltaY * cfg.sensitivity),
      };
      scheduleProject();
    },
    [clampCameraY, scheduleProject, stopInertia],
  );

  // Tap → optional callback. The house's own onClick fires; endDrag already set
  // suppressTapRef if it was really a drag. We expose onTap for the lab's
  // "center on tap"; integration wires taps through the house button instead.
  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const wasTap = gesture.current.travel <= TAP_THRESHOLD;
      endDrag();
      if (wasTap && onTap) {
        // Hit-test: find the nearest registered element under the pointer.
        const target = (e.target as HTMLElement)?.closest?.("[data-world-id]");
        const id = target?.getAttribute("data-world-id");
        if (id) onTap(id);
      }
    },
    [endDrag, onTap],
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

  const jumpTo = useCallback(
    (camera: Camera) => {
      stopInertia();
      cameraRef.current = { x: camera.x, y: clampCameraY(camera.y) };
      velocityRef.current = { x: 0, y: 0 };
      project(false);
    },
    [clampCameraY, project, stopInertia],
  );

  // ── Smooth glide the camera so a world point comes to centre-front. ──
  const centerOn = useCallback(
    (worldX: number, worldY: number, onArrive?: () => void) => {
      stopInertia();
      const cfg = configRef.current;
      // Aim slightly in front of centre (positive Y = foreground) so the target
      // grows toward the viewer.
      const targetY = clampCameraY(worldY - cfg.WORLD_HEIGHT * 0.12);
      const half = cfg.WORLD_WIDTH / 2;
      // Shortest wrapped path in X so we never spin the long way round.
      const start = cameraRef.current;
      const dxWrap = ((((worldX - start.x + half) % cfg.WORLD_WIDTH) + cfg.WORLD_WIDTH) % cfg.WORLD_WIDTH) - half;
      const targetX = start.x + dxWrap;
      if (reduceMotion.current) {
        cameraRef.current = { x: targetX, y: targetY };
        project(false);
        onArrive?.();
        return;
      }
      const startT = performance.now();
      const dur = 420;
      const from = { ...start };
      const step = () => {
        const t = Math.min(1, (performance.now() - startT) / dur);
        const e = 1 - Math.pow(1 - t, 3); // ease-out cubic
        cameraRef.current = {
          x: from.x + (targetX - from.x) * e,
          y: from.y + (targetY - from.y) * e,
        };
        project(t < 1);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = null;
          onArrive?.();
        }
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [clampCameraY, project, stopInertia],
  );

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
    centerOn,
    jumpTo,
    suppressTapRef,
    reproject,
  };
}
