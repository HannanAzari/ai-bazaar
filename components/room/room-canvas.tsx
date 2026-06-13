"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Armchair } from "lucide-react";
import { RoomObjectView } from "@/components/room/room-object";
import { MIN_OBJECT_SIZE, findZone, moveObjectTo, objectCenter, resizeObject } from "@/lib/room-schema";
import { roomBackground } from "@/lib/room-visuals";
import type { Room, RoomObject } from "@/lib/types";
import { cn } from "@/lib/utils";

// Reuses the existing room shell (wallpaper / floorboards / window beam / lamp
// from globals.css) so the look is consistent — Room Engine only changes which
// objects sit on it and how big it is. In "editor" mode the canvas also owns
// pointer interaction: free drag (mouse + touch), corner resize, and a
// selection marquee for multi-select.

type EditorProps = {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  /** A drag/resize is about to begin — snapshot the current room for undo. */
  onInteractionStart: () => void;
  /** Live room update during a drag/resize (no history push). */
  onLiveChange: (room: Room) => void;
  /** Pointer released after a real move/resize — commit to history + analytics. */
  onCommit: (kind: "moved" | "resized") => void;
};

type Drag =
  | { kind: "move"; startX: number; startY: number; centers: Record<string, { x: number; y: number }>; moved: boolean }
  | { kind: "resize"; objectId: string; cx: number; cy: number; scale: number; changed: boolean }
  | { kind: "marquee"; startX: number; startY: number; additive: boolean; moved: boolean }
  | null;

const DRAG_THRESHOLD = 4; // px before a press counts as a drag, not a click

export function RoomCanvas({
  room,
  mode,
  editor,
  ownerName,
  onActivate,
}: {
  room: Room;
  mode: "public" | "editor";
  editor?: EditorProps;
  /** Public only: owner name for object tooltips. */
  ownerName?: string;
  onActivate?: (object: RoomObject) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const dragRef = useRef<Drag>(null);
  const roomRef = useRef(room);
  roomRef.current = room;
  const background = roomBackground(room.background);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const objects = (mode === "public" ? room.objects.filter((o) => !o.hidden) : room.objects)
    .slice()
    .sort((a, b) => a.zIndex - b.zIndex);

  const selectedIds = editor?.selectedIds ?? [];

  // ── Editor pointer interaction ──
  const localPx = (event: PointerEvent) => {
    const rect = rectRef.current!;
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const norm = (event: PointerEvent) => {
    const rect = rectRef.current!;
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  };
  const capture = (pointerId: number) => {
    try {
      containerRef.current?.setPointerCapture(pointerId);
    } catch {
      /* invalid/synthetic pointer id — drag still tracked via container handlers */
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (mode !== "editor" || !editor) return;
    rectRef.current = containerRef.current!.getBoundingClientRect();
    const target = event.target as HTMLElement;
    const handleEl = target.closest("[data-resize-handle]");
    const objectEl = target.closest("[data-object-id]") as HTMLElement | null;

    // Resize handle on the (single) selected object.
    if (handleEl && objectEl) {
      const objectId = objectEl.dataset.objectId!;
      const object = roomRef.current.objects.find((o) => o.id === objectId);
      if (object) {
        const center = objectCenter(roomRef.current, object);
        const rect = rectRef.current!;
        dragRef.current = {
          kind: "resize",
          objectId,
          cx: center.x * rect.width,
          cy: center.y * rect.height,
          scale: object.scale || 1,
          changed: false,
        };
        editor.onInteractionStart();
        capture(event.pointerId);
      }
      return;
    }

    // Press on an object → select (shift toggles) and begin a move drag.
    if (objectEl) {
      const objectId = objectEl.dataset.objectId!;
      const additive = event.shiftKey;
      let next: string[];
      if (additive) {
        next = selectedIds.includes(objectId) ? selectedIds.filter((id) => id !== objectId) : [...selectedIds, objectId];
      } else {
        next = selectedIds.includes(objectId) ? selectedIds : [objectId];
      }
      editor.onSelectionChange(next);
      const start = norm(event);
      const centers: Record<string, { x: number; y: number }> = {};
      for (const id of next) {
        const obj = roomRef.current.objects.find((o) => o.id === id);
        if (obj) centers[id] = objectCenter(roomRef.current, obj);
      }
      dragRef.current = { kind: "move", startX: start.x, startY: start.y, centers, moved: false };
      editor.onInteractionStart();
      capture(event.pointerId);
      return;
    }

    // Press on empty room → start a selection marquee.
    const px = localPx(event);
    dragRef.current = { kind: "marquee", startX: px.x, startY: px.y, additive: event.shiftKey, moved: false };
    setMarquee({ x: px.x, y: px.y, w: 0, h: 0 });
    capture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !editor) return;

    if (drag.kind === "move") {
      const cur = norm(event);
      const rect = rectRef.current!;
      if (!drag.moved && Math.hypot((cur.x - drag.startX) * rect.width, (cur.y - drag.startY) * rect.height) < DRAG_THRESHOLD) return;
      drag.moved = true;
      const dx = cur.x - drag.startX;
      const dy = cur.y - drag.startY;
      let next = roomRef.current;
      for (const [id, c] of Object.entries(drag.centers)) {
        next = moveObjectTo(next, id, c.x + dx, c.y + dy);
      }
      editor.onLiveChange(next);
      return;
    }

    if (drag.kind === "resize") {
      const px = localPx(event);
      const effW = Math.max(MIN_OBJECT_SIZE, Math.abs(px.x - drag.cx) * 2);
      const effH = Math.max(MIN_OBJECT_SIZE, Math.abs(px.y - drag.cy) * 2);
      drag.changed = true;
      editor.onLiveChange(resizeObject(roomRef.current, drag.objectId, { width: effW / drag.scale, height: effH / drag.scale }));
      return;
    }

    if (drag.kind === "marquee") {
      const px = localPx(event);
      if (Math.hypot(px.x - drag.startX, px.y - drag.startY) >= DRAG_THRESHOLD) drag.moved = true;
      setMarquee({
        x: Math.min(px.x, drag.startX),
        y: Math.min(px.y, drag.startY),
        w: Math.abs(px.x - drag.startX),
        h: Math.abs(px.y - drag.startY),
      });
    }
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    try {
      containerRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      /* pointer already released */
    }
    if (!drag || !editor) return;

    if (drag.kind === "move" && drag.moved) editor.onCommit("moved");
    else if (drag.kind === "resize" && drag.changed) editor.onCommit("resized");
    else if (drag.kind === "marquee") {
      const rect = rectRef.current!;
      if (!drag.moved) {
        // A plain click on empty room clears the selection.
        if (!drag.additive) editor.onSelectionChange([]);
      } else {
        const m = {
          x0: Math.min(drag.startX, event.clientX - rect.left),
          y0: Math.min(drag.startY, event.clientY - rect.top),
          x1: Math.max(drag.startX, event.clientX - rect.left),
          y1: Math.max(drag.startY, event.clientY - rect.top),
        };
        const hit = roomRef.current.objects.filter((o) => {
          const c = objectCenter(roomRef.current, o);
          const px = c.x * rect.width;
          const py = c.y * rect.height;
          return px >= m.x0 && px <= m.x1 && py >= m.y0 && py <= m.y1;
        }).map((o) => o.id);
        const next = drag.additive ? Array.from(new Set([...selectedIds, ...hit])) : hit;
        editor.onSelectionChange(next);
      }
    }
    setMarquee(null);
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={cn("grain shop-glow relative size-full overflow-hidden", mode === "editor" && "touch-none")}
      style={{ "--room-wall": background.wall } as CSSProperties}
    >
      {/* ── Shared room shell ── */}
      <div className="room-wallpaper pointer-events-none absolute inset-x-0 top-0 h-[64%]" />
      <div className="pointer-events-none absolute inset-x-0 top-[60%] h-[4%] border-y-2 border-[#9c6f45]/40 bg-[#c79a68]" />
      <div className="room-floorboards pointer-events-none absolute inset-x-0 bottom-0 h-[38%] [transform:perspective(900px)_rotateX(16deg)] [transform-origin:top]" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[13%] bg-gradient-to-r from-[#7e5435]/45 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[13%] bg-gradient-to-l from-[#7e5435]/45 to-transparent" />

      {/* Window on the back wall */}
      <div className="pointer-events-none absolute left-1/2 top-[6%] h-[30%] w-[22%] -translate-x-1/2 rounded-t-full border-[10px] border-[#b07c4c] bg-gradient-to-b from-sky-200 via-sky-100 to-amber-100 shadow-[inset_0_4px_12px_rgba(40,25,10,.25)]">
        <div className="absolute inset-x-4 bottom-0 h-1/2 bg-teal/40 [clip-path:polygon(0_45%,20%_20%,40%_50%,60%_12%,100%_55%,100%_100%,0_100%)]" />
        <div className="absolute left-1/2 top-3 h-3/4 w-px bg-white/70" />
      </div>
      <div className="window-beam pointer-events-none absolute left-[32%] top-[10%] h-[52%] w-[34%] [clip-path:polygon(28%_0,72%_0,100%_100%,0_100%)]" />
      <div className="lamp-glow pointer-events-none absolute right-[10%] top-[6%] h-[36%] w-[32%]" />

      {/* Background-variant mood tint (existing shell, recoloured) */}
      <div className="pointer-events-none absolute inset-0" style={{ background: background.tint }} aria-hidden="true" />

      {/* ── Placed objects ── */}
      {objects.map((object) => {
        const zone = findZone(room, object.zoneId);
        const anchor = zone?.anchors.find((a) => a.id === object.anchorId) ?? zone?.anchors[0];
        const isSelected = mode === "editor" && selectedIds.includes(object.id);
        return (
          <RoomObjectView
            key={object.id}
            object={object}
            anchor={anchor}
            mode={mode}
            selected={isSelected}
            showHandles={isSelected && selectedIds.length === 1}
            ownerName={ownerName}
            onActivate={() => onActivate?.(object)}
            onSelect={() => editor?.onSelectionChange([object.id])}
          />
        );
      })}

      {/* Selection marquee */}
      {marquee && (
        <div
          className="pointer-events-none absolute z-50 rounded border-2 border-dashed border-terracotta bg-terracotta/10"
          style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
        />
      )}

      {objects.length === 0 && (
        <div className="pointer-events-none absolute left-1/2 top-[46%] flex max-w-[80%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 text-center">
          <span className="grid size-16 place-items-center rounded-full border border-[#7c5436]/25 bg-[#fff8e9]/85 text-terracotta shadow-soft backdrop-blur">
            <Armchair size={28} strokeWidth={1.6} />
          </span>
          <p className="rounded-2xl border border-white/60 bg-[#fff8e9]/85 px-5 py-3 shadow-soft backdrop-blur">
            <span className="display block text-lg text-[#5a3b22]">{mode === "editor" ? "An empty room, ready to furnish" : "Nothing here yet"}</span>
            <span className="mt-0.5 block text-xs font-bold text-ink/45">{mode === "editor" ? "Add an object, apply a template, or pick a preset room." : "This room is still being arranged — check back soon."}</span>
          </p>
        </div>
      )}
    </div>
  );
}
