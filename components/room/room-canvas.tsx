"use client";

import type { CSSProperties } from "react";
import { RoomObjectView } from "@/components/room/room-object";
import { findZone } from "@/lib/room-schema";
import type { Room, RoomObject } from "@/lib/types";

// Reuses the existing room shell (wallpaper / floorboards / window beam / lamp
// from globals.css) so the look is consistent — Room Engine only changes which
// objects sit on it and how big it is.
export function RoomCanvas({
  room,
  mode,
  selectedId,
  onSelect,
  onActivate,
}: {
  room: Room;
  mode: "public" | "editor";
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onActivate?: (object: RoomObject) => void;
}) {
  const objects = (mode === "public" ? room.objects.filter((o) => !o.hidden) : room.objects)
    .slice()
    .sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div className="grain shop-glow relative size-full overflow-hidden" style={{ "--room-wall": "#e6cfa9" } as CSSProperties}>
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

      {/* ── Placed objects ── */}
      {objects.map((object) => {
        const zone = findZone(room, object.zoneId);
        const anchor = zone?.anchors.find((a) => a.id === object.anchorId) ?? zone?.anchors[0];
        return (
          <RoomObjectView
            key={object.id}
            object={object}
            anchor={anchor}
            mode={mode}
            selected={mode === "editor" && selectedId === object.id}
            onActivate={() => onActivate?.(object)}
            onSelect={() => onSelect?.(object.id)}
          />
        );
      })}

      {objects.length === 0 && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-dashed border-ink/20 bg-white/70 px-6 py-4 text-center text-sm text-ink/55 shadow-lg backdrop-blur">
          This room is empty. {mode === "editor" ? "Add an object from the palette." : "Come back soon."}
        </div>
      )}
    </div>
  );
}
