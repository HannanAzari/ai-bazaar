"use client";

import { useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  ChevronUp,
  Copy,
  FlipHorizontal2,
  Layers,
  Lock,
  RotateCw,
  Trash2,
  Unlock,
} from "lucide-react";
import type { NestAmbiencePreset } from "@/lib/nest-types";
import type { LivingNestAsset } from "@/lib/nest-visual-types";
import { aspectRatioCss } from "@/lib/nest-render";
import type { EditableNestDocument, EditableNestObject } from "@/lib/nest-editor-types";
import { moveObject, resizeObject, rotateObject, type ReorderOp } from "@/lib/nest-editor";
import { canFlipX, canRotate, snapRotation } from "@/lib/nest-editor-policy";

// The mobile editor canvas (Arrange mode). Pointer Events drive a unified gesture
// model — one finger moves, two fingers pinch-resize + twist-rotate (when policy
// allows), with corner handles + a rotation handle as accessible fallbacks. The
// selected object gets a polished transform frame and a compact contextual action
// bar. A viewport zoom scales the authoring view only — never the placement data.
// `touch-action: none` stops page scroll/zoom inside the canvas. One history entry
// is committed per completed gesture (at the final pointer-up). Editor chrome lives
// only here — Preview renders via the real stage with no chrome.

type Props = {
  doc: EditableNestDocument;
  assetsById: Record<string, LivingNestAsset>;
  ambience?: NestAmbiencePreset;
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
  onCommit: (next: EditableNestDocument) => void;
  showGrid: boolean;
  snap: boolean;
  advanced: boolean;
  zoom: number;
  gridCols?: number;
  gridRows?: number;
  onDuplicate: () => void;
  onReorder: (op: ReorderOp) => void;
  onFlip: () => void;
  onToggleLock: () => void;
  onDelete: () => void;
};

type Gesture =
  | { kind: "move"; id: string; startNX: number; startNY: number }
  | { kind: "resize"; id: string; dirX: number; startNX: number; startW: number }
  | { kind: "rotate"; id: string; cx: number; cy: number; startAngle: number; startRot: number }
  | { kind: "pinch"; id: string; startDist: number; startW: number; startAngle: number; startRot: number };

type Pt = { x: number; y: number };

const pctOf = (n: number) => `${+(n * 100).toFixed(3)}%`;
const snapStep = (v: number, step: number) => Math.round(v / step) * step;
const angle = (a: Pt, b: Pt) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);
const transformOf = (o: EditableNestObject) =>
  `${o.rotation ? `rotate(${o.rotation}deg)` : ""}${o.flipX ? " scaleX(-1)" : ""}`.trim();

export function EditorCanvas(props: Props) {
  const { doc, assetsById, ambience, selectedId, onSelect, onCommit, showGrid, snap, advanced, zoom, gridCols = 24, gridRows = 32 } = props;
  const sceneRef = useRef<HTMLDivElement>(null);
  const pointers = useRef<Map<number, Pt>>(new Map());
  const gestureRef = useRef<Gesture | null>(null);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const [layerOpen, setLayerOpen] = useState(false);

  const toNorm = (clientX: number, clientY: number) => {
    const r = sceneRef.current!.getBoundingClientRect();
    return { nx: (clientX - r.left) / r.width, ny: (clientY - r.top) / r.height };
  };

  // Live (preview) document while a gesture is active; never commits history.
  const liveDoc: EditableNestDocument = (() => {
    const g = gestureRef.current;
    if (!g) return doc;
    const pts = Array.from(pointers.current.values());
    if (g.kind === "move" && pts[0]) {
      const { nx, ny } = toNorm(pts[0].x, pts[0].y);
      const o0 = doc.objects.find((o) => o.instanceId === g.id)!;
      let dx = nx - g.startNX;
      let dy = ny - g.startNY;
      if (snap) {
        dx = snapStep(o0.x + dx, 1 / gridCols) - o0.x;
        dy = snapStep(o0.y + dy, 1 / gridRows) - o0.y;
      }
      return moveObject(doc, g.id, dx, dy, assetsById);
    }
    if (g.kind === "resize" && pts[0]) {
      const { nx } = toNorm(pts[0].x, pts[0].y);
      let w = g.startW + g.dirX * (nx - g.startNX) * 2;
      if (snap) w = snapStep(w, 1 / gridCols);
      return resizeObject(doc, g.id, w, assetsById);
    }
    if (g.kind === "rotate" && pts[0]) {
      const { nx, ny } = toNorm(pts[0].x, pts[0].y);
      let rot = g.startRot + (angle({ x: g.cx, y: g.cy }, { x: nx, y: ny }) - g.startAngle);
      if (snap) rot = snapRotation(rot, 6);
      return rotateObject(doc, g.id, rot, assetsById);
    }
    if (g.kind === "pinch" && pts[0] && pts[1]) {
      const scale = g.startDist > 0 ? dist(pts[0], pts[1]) / g.startDist : 1;
      let next = resizeObject(doc, g.id, g.startW * scale, assetsById);
      let rot = g.startRot + (angle(pts[0], pts[1]) - g.startAngle);
      if (snap) rot = snapRotation(rot, 6);
      next = rotateObject(next, g.id, rot, assetsById);
      return next;
    }
    return doc;
  })();

  const objects = [...liveDoc.objects].sort((a, b) => a.zIndex - b.zIndex);
  const selected = selectedId ? liveDoc.objects.find((o) => o.instanceId === selectedId) : undefined;
  const selectedAsset = selected ? assetsById[selected.assetId] : undefined;

  function capture(e: React.PointerEvent) {
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* capture unavailable — gesture still works */
    }
  }
  function commit() {
    if (gestureRef.current) {
      onCommit(liveDoc);
      gestureRef.current = null;
      rerender();
    }
  }

  function onObjectDown(e: React.PointerEvent, o: EditableNestObject) {
    onSelect(o.instanceId);
    setLayerOpen(false);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (o.locked) return;
    e.preventDefault();
    capture(e);
    const pts = Array.from(pointers.current.values());
    if (pts.length >= 2) {
      gestureRef.current = { kind: "pinch", id: o.instanceId, startDist: dist(pts[0], pts[1]), startW: o.width, startAngle: angle(pts[0], pts[1]), startRot: o.rotation ?? 0 };
    } else {
      const { nx, ny } = toNorm(e.clientX, e.clientY);
      gestureRef.current = { kind: "move", id: o.instanceId, startNX: nx, startNY: ny };
    }
    rerender();
  }

  function onHandleDown(e: React.PointerEvent, o: EditableNestObject, kind: "resize" | "rotate", dirX = 1) {
    e.preventDefault();
    e.stopPropagation();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    capture(e);
    if (kind === "resize") {
      const { nx } = toNorm(e.clientX, e.clientY);
      gestureRef.current = { kind: "resize", id: o.instanceId, dirX, startNX: nx, startW: o.width };
    } else {
      const cx = o.x + o.width / 2;
      const cy = o.y + o.height / 2;
      const { nx, ny } = toNorm(e.clientX, e.clientY);
      gestureRef.current = { kind: "rotate", id: o.instanceId, cx, cy, startAngle: angle({ x: cx, y: cy }, { x: nx, y: ny }), startRot: o.rotation ?? 0 };
    }
    rerender();
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gestureRef.current;
    if (!g) return;
    e.preventDefault();
    const pts = Array.from(pointers.current.values());
    if (g.kind === "move" && pts.length >= 2) {
      const o = doc.objects.find((x) => x.instanceId === g.id)!;
      gestureRef.current = { kind: "pinch", id: g.id, startDist: dist(pts[0], pts[1]), startW: o.width, startAngle: angle(pts[0], pts[1]), startRot: o.rotation ?? 0 };
    }
    rerender();
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (gestureRef.current && pointers.current.size === 0) commit();
    else rerender();
  }

  const barAbove = selected ? selected.y > 0.16 : true;

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden p-2">
      <style>{CANVAS_CSS}</style>
      <div className="relative" style={{ height: `${Math.round(zoom * 100)}%`, aspectRatio: aspectRatioCss(doc.aspectRatio as "3:4"), maxWidth: "96%", maxHeight: "100%" }}>
        <div
          ref={sceneRef}
          className="editor-scene absolute inset-0 touch-none select-none overflow-hidden rounded-[24px] border border-ink/10 shadow-xl"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.bg === "1") {
              onSelect(undefined);
              setLayerOpen(false);
            }
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={doc.backgroundImageUrl} alt="" data-bg="1" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
          {ambience ? <div className="pointer-events-none absolute inset-0 mix-blend-soft-light" style={{ backgroundColor: ambience.tint, opacity: Math.min(0.45, ambience.intensity) }} aria-hidden /> : null}
          {showGrid ? <GridGuides cols={gridCols} rows={gridRows} /> : null}

          {objects.map((o) => {
            if (o.hidden) return null;
            const asset = assetsById[o.assetId];
            const floor = o.plane === "floor" || o.plane === "foreground";
            const t = transformOf(o);
            return (
              <button
                key={o.instanceId}
                type="button"
                className="editor-piece absolute touch-none"
                style={{ left: pctOf(o.x), top: pctOf(o.y), width: pctOf(o.width), height: pctOf(o.height), zIndex: o.zIndex, transform: t || undefined, transformOrigin: "center" }}
                onPointerDown={(e) => onObjectDown(e, o)}
                aria-label={`${asset?.name ?? o.assetId}${o.locked ? " (locked)" : ""}`}
              >
                {o.contactShadow ? <div className="editor-contact-shadow" aria-hidden /> : null}
                {asset?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.imageUrl} alt="" draggable={false} className={`pointer-events-none h-full w-full object-contain ${floor ? "object-bottom" : "object-center"}`} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded border border-terracotta/50 bg-terracotta/10 text-[9px] font-bold text-ink/60">{o.assetId}</div>
                )}
              </button>
            );
          })}

          {selected && !selected.hidden ? <TransformFrame o={selected} asset={selectedAsset} advanced={advanced} onHandleDown={onHandleDown} /> : null}
        </div>

        {/* Contextual action bar — outside the clipped scene so it is never cut off */}
        {selected && !selected.hidden ? (
          <ContextBar o={selected} asset={selectedAsset} above={barAbove} layerOpen={layerOpen} setLayerOpen={setLayerOpen} onDuplicate={props.onDuplicate} onReorder={props.onReorder} onFlip={props.onFlip} onToggleLock={props.onToggleLock} onDelete={props.onDelete} />
        ) : null}
      </div>
    </div>
  );
}

function TransformFrame({ o, asset, advanced, onHandleDown }: { o: EditableNestObject; asset?: LivingNestAsset; advanced: boolean; onHandleDown: (e: React.PointerEvent, o: EditableNestObject, kind: "resize" | "rotate", dirX?: number) => void }) {
  const t = transformOf(o);
  const rotatable = canRotate(asset) && !o.locked;
  const anchorLeft = ((o.anchor.x - o.x) / o.width) * 100;
  const anchorTop = ((o.anchor.y - o.y) / o.height) * 100;
  return (
    <div className="pointer-events-none absolute z-[500]" style={{ left: pctOf(o.x), top: pctOf(o.y), width: pctOf(o.width), height: pctOf(o.height), transform: t || undefined, transformOrigin: "center" }}>
      <div className={`absolute inset-0 rounded-[10px] ${o.locked ? "border-2 border-dashed border-terracotta/80" : "border-[2px] border-cobalt"}`} style={{ boxShadow: "0 0 0 1px rgba(255,255,255,.7), 0 1px 6px rgba(70,54,90,.25)" }} />
      {!o.locked
        ? ([
            [0, 0, -1],
            [1, 0, 1],
            [0, 1, -1],
            [1, 1, 1],
          ] as const).map(([cx, cy, dirX]) => (
            <span key={`${cx}-${cy}`} className="pointer-events-auto absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize touch-none items-center justify-center" style={{ left: `${cx * 100}%`, top: `${cy * 100}%` }} onPointerDown={(e) => onHandleDown(e, o, "resize", dirX)}>
              <span className="h-3.5 w-3.5 rounded-full border-2 border-cobalt bg-white shadow" />
            </span>
          ))
        : (
            <span className="absolute right-1 top-1 rounded-full bg-terracotta/90 p-1 text-white"><Lock className="h-3 w-3" /></span>
          )}
      {rotatable ? (
        <span className="pointer-events-auto absolute left-1/2 flex h-9 w-9 -translate-x-1/2 cursor-grab touch-none items-center justify-center" style={{ top: "-16%" }} onPointerDown={(e) => onHandleDown(e, o, "rotate")}>
          <span className="absolute left-1/2 top-full h-[14%] w-px -translate-x-1/2 bg-cobalt/70" />
          <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-cobalt bg-white shadow"><RotateCw className="h-3 w-3 text-cobalt" /></span>
        </span>
      ) : null}
      {advanced ? <span className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-saffron ring-2 ring-white" style={{ left: `${anchorLeft}%`, top: `${anchorTop}%` }} /> : null}
    </div>
  );
}

function ContextBar({ o, asset, above, layerOpen, setLayerOpen, onDuplicate, onReorder, onFlip, onToggleLock, onDelete }: { o: EditableNestObject; asset?: LivingNestAsset; above: boolean; layerOpen: boolean; setLayerOpen: (v: boolean) => void; onDuplicate: () => void; onReorder: (op: ReorderOp) => void; onFlip: () => void; onToggleLock: () => void; onDelete: () => void }) {
  const cx = (o.x + o.width / 2) * 100;
  const flippable = canFlipX(asset);
  const pos: React.CSSProperties = { left: `${Math.min(80, Math.max(20, cx))}%` };
  if (above) {
    pos.top = `calc(${o.y * 100}% - 8px)`;
    pos.transform = "translate(-50%, -100%)";
  } else {
    pos.top = `calc(${(o.y + o.height) * 100}% + 8px)`;
    pos.transform = "translate(-50%, 0)";
  }
  return (
    <div className="pointer-events-none absolute z-[600] flex justify-center" style={pos}>
      <div className="pointer-events-auto relative flex items-center gap-0.5 rounded-full border border-ink/10 bg-parchment/95 p-1 shadow-lg backdrop-blur">
        <CtxBtn label="Duplicate" onClick={onDuplicate}><Copy className="h-4 w-4" /></CtxBtn>
        <CtxBtn label="Layer" onClick={() => setLayerOpen(!layerOpen)} active={layerOpen}><Layers className="h-4 w-4" /></CtxBtn>
        {flippable ? <CtxBtn label="Flip" onClick={onFlip}><FlipHorizontal2 className="h-4 w-4" /></CtxBtn> : null}
        <CtxBtn label={o.locked ? "Unlock" : "Lock"} onClick={onToggleLock} active={o.locked}>{o.locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}</CtxBtn>
        <CtxBtn label="Delete" danger onClick={onDelete}><Trash2 className="h-4 w-4" /></CtxBtn>
        {layerOpen ? (
          <div className="absolute left-1/2 top-full mt-1 flex -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-ink/10 bg-parchment shadow-lg">
            <LayerItem label="Bring to front" onClick={() => { onReorder("front"); setLayerOpen(false); }}><ArrowUpToLine className="h-3.5 w-3.5" /></LayerItem>
            <LayerItem label="Bring forward" onClick={() => { onReorder("forward"); setLayerOpen(false); }}><ChevronUp className="h-3.5 w-3.5" /></LayerItem>
            <LayerItem label="Send backward" onClick={() => { onReorder("backward"); setLayerOpen(false); }}><ChevronDown className="h-3.5 w-3.5" /></LayerItem>
            <LayerItem label="Send to back" onClick={() => { onReorder("back"); setLayerOpen(false); }}><ArrowDownToLine className="h-3.5 w-3.5" /></LayerItem>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CtxBtn({ label, onClick, children, active, danger }: { label: string; onClick: () => void; children: React.ReactNode; active?: boolean; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={`flex h-9 w-9 items-center justify-center rounded-full transition ${danger ? "text-terracotta hover:bg-terracotta/10" : active ? "bg-cobalt/15 text-cobalt" : "text-ink/70 hover:bg-ink/5"}`}>
      {children}
    </button>
  );
}

function LayerItem({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-2 whitespace-nowrap px-3 py-2 text-left text-xs font-bold text-ink/75 hover:bg-ink/5">
      {children} {label}
    </button>
  );
}

function GridGuides({ cols, rows }: { cols: number; rows: number }) {
  const v = Array.from({ length: cols - 1 }, (_, i) => ((i + 1) / cols) * 100);
  const h = Array.from({ length: rows - 1 }, (_, i) => ((i + 1) / rows) * 100);
  return (
    <div className="pointer-events-none absolute inset-0 z-[400]" aria-hidden>
      {v.map((x) => (<span key={`v${x}`} className="absolute top-0 h-full w-px bg-ink/5" style={{ left: `${x}%` }} />))}
      {h.map((y) => (<span key={`h${y}`} className="absolute left-0 w-full border-t border-ink/5" style={{ top: `${y}%` }} />))}
      <span className="absolute top-0 h-full w-px bg-cobalt/25" style={{ left: "50%" }} />
      {[33.333, 66.667].map((x) => (<span key={`t${x}`} className="absolute top-0 h-full w-px bg-cobalt/12" style={{ left: `${x}%` }} />))}
      {[33.333, 66.667].map((y) => (<span key={`th${y}`} className="absolute left-0 w-full border-t border-cobalt/12" style={{ top: `${y}%` }} />))}
      <span className="absolute left-0 w-full border-t-2 border-dashed border-terracotta/40" style={{ top: "62%" }} />
    </div>
  );
}

const CANVAS_CSS = `
.editor-scene { background: linear-gradient(180deg, #efe2c4 0%, #e7d3ad 62%, #d8c096 100%); touch-action: none; }
.editor-piece { cursor: grab; }
.editor-piece:active { cursor: grabbing; }
.editor-contact-shadow { position:absolute; left:50%; bottom:0; width:72%; aspect-ratio:6 / 1; transform:translate(-50%,34%); background:radial-gradient(50% 50% at 50% 50%, rgba(70,54,90,.30) 0%, rgba(70,54,90,.12) 55%, rgba(70,54,90,0) 75%); filter:blur(2px); pointer-events:none; }
`;
