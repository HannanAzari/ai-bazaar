"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { NestFocusArea } from "@/lib/nest-focus-types";
import { clampFocusBounds } from "@/lib/nest-focus-scenes";

// ── Focus-mode authoring overlay (M7C) ───────────────────────────────────────
//
// Renders the Main scene's Focus Areas over the editor canvas in a visually distinct
// Nestudio style (cobalt, vs teal hotspots) and lets a creator select / move / resize
// them. It measures the canvas's `.editor-scene` element so regions align exactly with
// the rendered scene, and works in scene-normalized 0..1 coordinates. One geometry
// gesture commits once (at pointer-up). Hidden in Preview; objects beneath are inert in
// Focus mode (this layer covers the scene). Commits a NEW focus-area array via onCommit.

type Box = { left: number; top: number; width: number; height: number };

type Gesture =
  | { kind: "move"; id: string; startNX: number; startNY: number; x0: number; y0: number }
  | { kind: "resize"; id: string; dirX: number; dirY: number; startNX: number; startNY: number; x0: number; y0: number; w0: number; h0: number };

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

  function liveAreas(): NestFocusArea[] {
    const g = gestureRef.current;
    const p = lastPt.current;
    if (!g || !p) return focusAreas;
    return focusAreas.map((fa) => {
      if (fa.id !== g.id) return fa;
      if (g.kind === "move") {
        return { ...fa, bounds: clampFocusBounds({ ...fa.bounds, x: g.x0 + (p.nx - g.startNX), y: g.y0 + (p.ny - g.startNY) }) };
      }
      const w = g.w0 + g.dirX * (p.nx - g.startNX) * (g.dirX === 0 ? 0 : 1);
      const h = g.h0 + g.dirY * (p.ny - g.startNY) * (g.dirY === 0 ? 0 : 1);
      const x = g.dirX < 0 ? g.x0 + (p.nx - g.startNX) : g.x0;
      const y = g.dirY < 0 ? g.y0 + (p.ny - g.startNY) : g.y0;
      return { ...fa, bounds: clampFocusBounds({ x, y, width: w, height: h }) };
    });
  }

  function startMove(e: React.PointerEvent, fa: NestFocusArea) {
    onSelect(fa.id);
    if (fa.locked) return;
    e.preventDefault();
    e.stopPropagation();
    measure();
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* ok */ }
    const { nx, ny } = toNorm(e.clientX, e.clientY);
    gestureRef.current = { kind: "move", id: fa.id, startNX: nx, startNY: ny, x0: fa.bounds.x, y0: fa.bounds.y };
    lastPt.current = { nx, ny };
    rerender();
  }
  function startResize(e: React.PointerEvent, fa: NestFocusArea, dirX: number, dirY: number) {
    e.preventDefault();
    e.stopPropagation();
    measure();
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* ok */ }
    const { nx, ny } = toNorm(e.clientX, e.clientY);
    gestureRef.current = { kind: "resize", id: fa.id, dirX, dirY, startNX: nx, startNY: ny, x0: fa.bounds.x, y0: fa.bounds.y, w0: fa.bounds.width, h0: fa.bounds.height };
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
    if (gestureRef.current) {
      onCommit(liveAreas());
      gestureRef.current = null;
      lastPt.current = null;
      rerender();
    }
  }

  const display = gestureRef.current ? liveAreas() : focusAreas;

  return (
    <div
      ref={hostRef}
      className="absolute inset-0 z-[40] touch-none"
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onSelect(undefined);
      }}
    >
      {box ? (
        <div className="absolute" style={{ left: box.left, top: box.top, width: box.width, height: box.height }}>
          {display.map((fa) => {
            const sel = fa.id === selectedId;
            const ellipse = fa.shape === "ellipse";
            const cls = !fa.enabled
              ? "border-2 border-dotted border-ink/35 bg-ink/[0.04]"
              : sel
                ? "border-2 border-cobalt bg-cobalt/15"
                : "border-2 border-dashed border-cobalt/55 bg-cobalt/[0.06]";
            return (
              <div key={fa.id} className="absolute" style={{ left: `${fa.bounds.x * 100}%`, top: `${fa.bounds.y * 100}%`, width: `${fa.bounds.width * 100}%`, height: `${fa.bounds.height * 100}%` }}>
                <button
                  type="button"
                  onPointerDown={(e) => startMove(e, fa)}
                  aria-label={`Focus area ${fa.name}${sel ? " (selected)" : ""}`}
                  className={`absolute inset-0 touch-none ${ellipse ? "rounded-full" : "rounded-[8px]"} ${cls}`}
                >
                  <span className={`absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[8px] font-bold text-white ${fa.enabled ? "bg-cobalt" : "bg-ink/50"}`}>
                    {fa.name}
                    {fa.locked ? " 🔒" : ""}
                  </span>
                  {advanced && sel ? (
                    <span className="absolute bottom-0.5 left-1 text-[7px] font-mono text-cobalt/80">
                      {Math.round(fa.bounds.x * 100)},{Math.round(fa.bounds.y * 100)} · {Math.round(fa.bounds.width * 100)}×{Math.round(fa.bounds.height * 100)}
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
                      <span key={`${cx}-${cy}`} className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize touch-none items-center justify-center" style={{ left: `${cx * 100}%`, top: `${cy * 100}%` }} onPointerDown={(e) => startResize(e, fa, dx, dy)}>
                        <span className="h-3 w-3 rounded-full border-2 border-cobalt bg-white shadow" />
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
