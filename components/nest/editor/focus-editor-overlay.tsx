"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { NestFocusArea, NestFocusBounds } from "@/lib/nest-focus-types";
import { focusBoundsOf, moveRectInsideBounds, resizeRectWithLockedAspect } from "@/lib/nest-focus-scenes";
import { EDITOR_LAYERS } from "@/lib/nest-editor-layers";

// ── Fixed-ratio Focus editor overlay (M7C.4) ─────────────────────────────────
//
// Renders the Main scene's Focus Areas as fixed-ratio rectangles (each = `focusBounds`,
// a normalized square that matches the 3:4 Nest). The creator drags inside to MOVE
// (dimensions unchanged) and drags a corner to RESIZE (ratio LOCKED, opposite corner
// anchored). One gesture commits once (pointer-up) = one undo entry.
//
// REPAIR: the host is `pointer-events-none` — only the rectangles/handles capture
// pointers, so the rest of the editor canvas is NEVER blocked (the old full-canvas
// capture layer is gone). Selected rectangles sit above the canvas so they don't select
// assets beneath; non-selected ones are a subtle tap-to-select outline. Hidden in Preview.

type Box = { left: number; top: number; width: number; height: number };
type Gesture =
  | { kind: "move"; id: string; startNX: number; startNY: number; rect: NestFocusBounds }
  | { kind: "resize"; id: string; dirX: number; dirY: number; rect: NestFocusBounds };

export function FocusEditorOverlay({
  focusAreas,
  selectedId,
  onSelect,
  onCommit,
  advanced,
}: {
  focusAreas: NestFocusArea[];
  selectedId?: string;
  onSelect: (id?: string) => void;
  onCommit: (next: NestFocusArea[]) => void;
  advanced: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneElRef = useRef<HTMLElement | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const lastPt = useRef<{ nx: number; ny: number } | null>(null);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);

  function measure() {
    const host = hostRef.current;
    const scene = host?.parentElement?.querySelector(".editor-scene") as HTMLElement | null;
    sceneElRef.current = scene ?? null;
    if (host && scene) {
      const sr = scene.getBoundingClientRect();
      const hr = host.getBoundingClientRect();
      setBox({ left: sr.left - hr.left, top: sr.top - hr.top, width: sr.width, height: sr.height });
    }
  }
  useLayoutEffect(() => {
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusAreas.length]);
  useEffect(() => {
    const on = () => measure();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const toNorm = (clientX: number, clientY: number) => {
    const r = sceneElRef.current?.getBoundingClientRect();
    if (!r || r.width <= 0) return { nx: 0, ny: 0 };
    return { nx: (clientX - r.left) / r.width, ny: (clientY - r.top) / r.height };
  };

  function liveRect(fa: NestFocusArea): NestFocusBounds {
    const g = gestureRef.current;
    const p = lastPt.current;
    const rect = focusBoundsOf(fa);
    if (!g || !p || g.id !== fa.id) return rect;
    if (g.kind === "move") return moveRectInsideBounds(g.rect, p.nx - g.startNX, p.ny - g.startNY);
    return resizeRectWithLockedAspect(g.rect, { dirX: g.dirX, dirY: g.dirY }, { x: p.nx, y: p.ny });
  }

  function startMove(e: React.PointerEvent, fa: NestFocusArea) {
    onSelect(fa.id);
    if (fa.locked) return;
    e.preventDefault();
    e.stopPropagation();
    measure();
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* ok */ }
    const { nx, ny } = toNorm(e.clientX, e.clientY);
    gestureRef.current = { kind: "move", id: fa.id, startNX: nx, startNY: ny, rect: focusBoundsOf(fa) };
    lastPt.current = { nx, ny };
    rerender();
  }
  function startResize(e: React.PointerEvent, fa: NestFocusArea, dirX: number, dirY: number) {
    e.preventDefault();
    e.stopPropagation();
    measure();
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* ok */ }
    const { nx, ny } = toNorm(e.clientX, e.clientY);
    gestureRef.current = { kind: "resize", id: fa.id, dirX, dirY, rect: focusBoundsOf(fa) };
    lastPt.current = { nx, ny };
    rerender();
  }
  function onMove(e: React.PointerEvent) {
    if (!gestureRef.current) return;
    e.preventDefault();
    lastPt.current = toNorm(e.clientX, e.clientY);
    rerender();
  }
  function onUp() {
    const g = gestureRef.current;
    if (g) {
      const next = focusAreas.map((fa) => (fa.id === g.id ? { ...fa, focusBounds: liveRect(fa) } : fa));
      onCommit(next);
      gestureRef.current = null;
      lastPt.current = null;
      rerender();
    }
  }

  // The host does NOT capture pointers — only the rectangles do (repair). It sits at the
  // `focusRegions` layer (BELOW the bottom drawer), so handles never escape over the sheet.
  return (
    <div ref={hostRef} className="pointer-events-none absolute inset-0" style={{ zIndex: EDITOR_LAYERS.focusRegions }} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      {box ? (
        <div className="absolute" style={{ left: box.left, top: box.top, width: box.width, height: box.height }}>
          {focusAreas.map((fa) => {
            const r = liveRect(fa);
            const sel = fa.id === selectedId;
            const cls = !fa.enabled
              ? "border-2 border-dotted border-ink/35 bg-ink/[0.03]"
              : sel
                ? "border-2 border-cobalt bg-cobalt/10"
                : "border-2 border-dashed border-cobalt/50 bg-cobalt/[0.04]";
            return (
              <div key={fa.id} className="absolute" style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.width * 100}%`, height: `${r.height * 100}%` }}>
                <button
                  type="button"
                  onPointerDown={(e) => startMove(e, fa)}
                  aria-label={`Focus area ${fa.name}${sel ? " (selected)" : ""}`}
                  className={`pointer-events-auto absolute inset-0 touch-none rounded-[8px] ${sel ? "cursor-move" : "cursor-pointer"} ${cls}`}
                >
                  <span className={`pointer-events-none absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[8px] font-bold text-white ${fa.enabled ? "bg-cobalt" : "bg-ink/50"}`}>
                    {fa.name}{fa.locked ? " 🔒" : ""}
                  </span>
                  {advanced && sel ? (
                    <span className="pointer-events-none absolute bottom-0.5 left-1 font-mono text-[7px] text-cobalt/80">
                      {Math.round(r.x * 100)},{Math.round(r.y * 100)} · {Math.round(r.width * 100)}×{Math.round(r.height * 100)}
                    </span>
                  ) : null}
                </button>
                {sel && !fa.locked
                  ? ([
                      [0, 0, -1, -1],
                      [1, 0, 1, -1],
                      [0, 1, -1, 1],
                      [1, 1, 1, 1],
                    ] as const).map(([cx, cy, dx, dy]) => (
                      <span
                        key={`${cx}-${cy}`}
                        className="pointer-events-auto absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize touch-none items-center justify-center"
                        style={{ left: `${cx * 100}%`, top: `${cy * 100}%` }}
                        onPointerDown={(e) => startResize(e, fa, dx, dy)}
                      >
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-cobalt bg-white shadow" />
                      </span>
                    ))
                  : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
