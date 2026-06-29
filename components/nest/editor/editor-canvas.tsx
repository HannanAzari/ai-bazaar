"use client";

import { useRef, useState } from "react";
import { Lock } from "lucide-react";
import type { NestAmbiencePreset } from "@/lib/nest-types";
import type { LivingNestAsset } from "@/lib/nest-visual-types";
import { aspectRatioCss } from "@/lib/nest-render";
import type { EditableNestDocument, EditableNestObject } from "@/lib/nest-editor-types";
import { moveObject, resizeObject } from "@/lib/nest-editor";

// The editor canvas (Edit mode). Renders the background + objects with the same
// scene principles as the Golden Living Nest stage (object-contain, bottom-anchored
// floor objects, contact shadows), plus editor chrome: selection outline + corner
// resize handles + anchor dot + label, an optional fine grid + guides, and Pointer
// Events for unified mouse/touch/stylus drag & resize. It commits ONE document per
// gesture (at pointer-up) so undo/redo gets one entry per drag — never hundreds.

type Props = {
  doc: EditableNestDocument;
  assetsById: Record<string, LivingNestAsset>;
  ambience?: NestAmbiencePreset;
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
  onCommit: (next: EditableNestDocument) => void;
  showGrid: boolean;
  snap: boolean;
  gridCols?: number;
  gridRows?: number;
};

type Drag =
  | { kind: "move"; id: string; startNX: number; startNY: number }
  | { kind: "resize"; id: string; dirX: number; startNX: number };

const pctOf = (n: number) => `${+(n * 100).toFixed(3)}%`;
const snapTo = (v: number, step: number) => Math.round(v / step) * step;

export function EditorCanvas({
  doc,
  assetsById,
  ambience,
  selectedId,
  onSelect,
  onCommit,
  showGrid,
  snap,
  gridCols = 24,
  gridRows = 32,
}: Props) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [pointer, setPointer] = useState<{ nx: number; ny: number } | null>(null);

  const toNorm = (clientX: number, clientY: number) => {
    const r = sceneRef.current!.getBoundingClientRect();
    return { nx: (clientX - r.left) / r.width, ny: (clientY - r.top) / r.height };
  };

  // Compute the live preview document (during a drag) without committing history.
  const liveDoc: EditableNestDocument = (() => {
    if (!drag || !pointer) return doc;
    const o0 = doc.objects.find((o) => o.instanceId === drag.id);
    if (!o0) return doc;
    if (drag.kind === "move") {
      let dx = pointer.nx - drag.startNX;
      let dy = pointer.ny - drag.startNY;
      if (snap) {
        dx = snapTo(o0.x + dx, 1 / gridCols) - o0.x;
        dy = snapTo(o0.y + dy, 1 / gridRows) - o0.y;
      }
      return moveObject(doc, drag.id, dx, dy, assetsById);
    }
    // resize: width follows horizontal travel from the grabbed corner
    let newWidth = o0.width + drag.dirX * (pointer.nx - drag.startNX) * 2;
    if (snap) newWidth = snapTo(newWidth, 1 / gridCols);
    return resizeObject(doc, drag.id, newWidth, assetsById);
  })();

  const objects = [...liveDoc.objects].sort((a, b) => a.zIndex - b.zIndex);

  function capture(e: React.PointerEvent) {
    // Pointer capture keeps the gesture bound to the canvas even if the finger
    // leaves the element. It can throw for non-active pointers — never let that
    // break the drag.
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* capture unavailable — dragging still works without it */
    }
  }

  function startMove(e: React.PointerEvent, o: EditableNestObject) {
    onSelect(o.instanceId);
    if (o.locked) return;
    e.preventDefault();
    capture(e);
    const { nx, ny } = toNorm(e.clientX, e.clientY);
    setDrag({ kind: "move", id: o.instanceId, startNX: nx, startNY: ny });
    setPointer({ nx, ny });
  }

  function startResize(e: React.PointerEvent, o: EditableNestObject, dirX: number) {
    e.preventDefault();
    e.stopPropagation();
    capture(e);
    const { nx, ny } = toNorm(e.clientX, e.clientY);
    setDrag({ kind: "resize", id: o.instanceId, dirX, startNX: nx });
    setPointer({ nx, ny });
  }

  function onMove(e: React.PointerEvent) {
    if (!drag) return;
    e.preventDefault();
    setPointer(toNorm(e.clientX, e.clientY));
  }

  function endDrag() {
    if (drag) {
      onCommit(liveDoc);
      setDrag(null);
      setPointer(null);
    }
  }

  return (
    <div className="mx-auto w-full" style={{ maxWidth: "min(94vw, 460px)" }}>
      <style>{CANVAS_CSS}</style>
      <div
        ref={sceneRef}
        className="editor-scene relative touch-none select-none overflow-hidden rounded-[28px] border border-ink/10 shadow-xl"
        style={{ aspectRatio: aspectRatioCss(doc.aspectRatio as "3:4") }}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.bg === "1") onSelect(undefined);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={doc.backgroundImageUrl} alt="" data-bg="1" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
        {ambience ? (
          <div className="pointer-events-none absolute inset-0 mix-blend-soft-light" style={{ backgroundColor: ambience.tint, opacity: Math.min(0.5, ambience.intensity) }} aria-hidden />
        ) : null}

        {showGrid ? <GridGuides cols={gridCols} rows={gridRows} /> : null}

        {objects.map((o) => {
          const asset = assetsById[o.assetId];
          const floor = o.plane === "floor" || o.plane === "foreground";
          if (o.hidden) return null;
          return (
            <button
              key={o.instanceId}
              type="button"
              className="editor-piece absolute touch-none"
              style={{ left: pctOf(o.x), top: pctOf(o.y), width: pctOf(o.width), height: pctOf(o.height), zIndex: o.zIndex }}
              onPointerDown={(e) => startMove(e, o)}
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

        {/* Selection overlay (edit chrome) */}
        {objects.map((o) => {
          if (o.instanceId !== selectedId || o.hidden) return null;
          const asset = assetsById[o.assetId];
          const anchorLeft = ((o.anchor.x - o.x) / o.width) * 100;
          const anchorTop = ((o.anchor.y - o.y) / o.height) * 100;
          return (
            <div key={`sel-${o.instanceId}`} className="pointer-events-none absolute z-[500]" style={{ left: pctOf(o.x), top: pctOf(o.y), width: pctOf(o.width), height: pctOf(o.height) }}>
              <div className="absolute inset-0 rounded-[6px] border-2 border-cobalt/90" />
              {/* label */}
              <span className="absolute left-0 top-0 -translate-y-full whitespace-nowrap rounded-t bg-cobalt px-1.5 py-0.5 text-[9px] font-bold text-white">
                {asset?.name ?? o.assetId}
                {o.locked ? " · locked" : ""}
              </span>
              {/* anchor dot */}
              <span className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-saffron ring-2 ring-white" style={{ left: `${anchorLeft}%`, top: `${anchorTop}%` }} />
              {/* corner resize handles (proportional) */}
              {!o.locked
                ? ([
                    [0, 0, -1],
                    [1, 0, 1],
                    [0, 1, -1],
                    [1, 1, 1],
                  ] as const).map(([cx, cy, dirX]) => (
                    <span
                      key={`${cx}-${cy}`}
                      className="pointer-events-auto absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize touch-none rounded-sm border-2 border-cobalt bg-white"
                      style={{ left: `${cx * 100}%`, top: `${cy * 100}%` }}
                      onPointerDown={(e) => startResize(e, o, dirX)}
                    />
                  ))
                : (
                    <span className="absolute right-1 top-1 rounded bg-cobalt/90 p-0.5 text-white">
                      <Lock className="h-3 w-3" />
                    </span>
                  )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GridGuides({ cols, rows }: { cols: number; rows: number }) {
  const v = Array.from({ length: cols - 1 }, (_, i) => ((i + 1) / cols) * 100);
  const h = Array.from({ length: rows - 1 }, (_, i) => ((i + 1) / rows) * 100);
  return (
    <div className="pointer-events-none absolute inset-0 z-[400]" aria-hidden>
      {v.map((x) => (
        <span key={`v${x}`} className="absolute top-0 h-full w-px bg-ink/5" style={{ left: `${x}%` }} />
      ))}
      {h.map((y) => (
        <span key={`h${y}`} className="absolute left-0 w-full border-t border-ink/5" style={{ top: `${y}%` }} />
      ))}
      {/* centre + thirds + floor seam + safe area */}
      <span className="absolute top-0 h-full w-px bg-cobalt/25" style={{ left: "50%" }} />
      {[33.333, 66.667].map((x) => (
        <span key={`t${x}`} className="absolute top-0 h-full w-px bg-cobalt/15" style={{ left: `${x}%` }} />
      ))}
      {[33.333, 66.667].map((y) => (
        <span key={`th${y}`} className="absolute left-0 w-full border-t border-cobalt/15" style={{ top: `${y}%` }} />
      ))}
      <span className="absolute left-0 w-full border-t-2 border-dashed border-terracotta/40" style={{ top: "62%" }} />
      <span className="absolute border border-dashed border-meadow-shade/40" style={{ left: "0%", top: "2%", width: "100%", height: "96%" }} />
    </div>
  );
}

const CANVAS_CSS = `
.editor-scene { background: linear-gradient(180deg, #efe2c4 0%, #e7d3ad 62%, #d8c096 100%); }
.editor-piece { cursor: grab; }
.editor-piece:active { cursor: grabbing; }
.editor-contact-shadow { position:absolute; left:50%; bottom:0; width:72%; aspect-ratio:6 / 1; transform:translate(-50%,34%); background:radial-gradient(50% 50% at 50% 50%, rgba(70,54,90,.30) 0%, rgba(70,54,90,.12) 55%, rgba(70,54,90,0) 75%); filter:blur(2px); pointer-events:none; }
`;
