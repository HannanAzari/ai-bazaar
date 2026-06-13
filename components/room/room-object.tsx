"use client";

import {
  Armchair,
  BookOpen,
  DoorOpen,
  Frame,
  Images,
  Library,
  type LucideIcon,
  Monitor,
  PencilRuler,
  Sprout,
  Square,
  Store,
} from "lucide-react";
import { actionLabels } from "@/lib/room-schema";
import type { AnchorPoint, RoomObject as RoomObjectModel } from "@/lib/types";
import { cn } from "@/lib/utils";

// Icon per room-ready asset, so a bookshelf and a desk read differently even
// though they share a category. Falls back to a generic furniture icon.
const assetIcons: Record<string, LucideIcon> = {
  "ast-bookshelf": Library,
  "ast-painting": Frame,
  "ast-screen": Monitor,
  "ast-desk": PencilRuler,
  "ast-sofa": Armchair,
  "ast-rug": Square,
  "ast-plant": Sprout,
  "ast-product-shelf": Store,
  "ast-guestbook-table": BookOpen,
  "ast-photo-wall": Images,
  "ast-door": DoorOpen,
  "ast-stairs": Square,
};

/** Base object box side in canvas pixels when an object carries no explicit
 * width/height (rooms saved before V2, or freshly placed objects). */
export const BASE_OBJECT_SIZE = 64;

export function objectIcon(assetId: string): LucideIcon {
  return assetIcons[assetId] ?? Armchair;
}

const HANDLES = [
  { corner: "nw", className: "-left-1.5 -top-1.5 cursor-nwse-resize" },
  { corner: "ne", className: "-right-1.5 -top-1.5 cursor-nesw-resize" },
  { corner: "sw", className: "-left-1.5 -bottom-1.5 cursor-nesw-resize" },
  { corner: "se", className: "-right-1.5 -bottom-1.5 cursor-nwse-resize" },
] as const;

export function RoomObjectView({
  object,
  anchor,
  mode,
  selected,
  showHandles,
  onActivate,
  onSelect,
}: {
  object: RoomObjectModel;
  anchor: AnchorPoint | undefined;
  mode: "public" | "editor";
  selected?: boolean;
  /** Editor only: render corner resize handles (single-selection). */
  showHandles?: boolean;
  onActivate?: () => void;
  onSelect?: () => void;
}) {
  const Icon = objectIcon(object.assetId);
  const left = ((anchor?.x ?? 0.5) + object.x) * 100;
  const top = ((anchor?.y ?? 0.5) + object.y) * 100;
  const interactive = mode === "public" ? object.actionType !== "none" : true;

  // Effective rendered box: base/explicit dimensions × the uniform scale.
  const scale = object.scale || 1;
  const boxW = (object.width ?? BASE_OBJECT_SIZE) * scale;
  const boxH = (object.height ?? BASE_OBJECT_SIZE) * scale;
  const iconSize = Math.max(14, Math.min(boxW, boxH) * 0.42);

  const tileClass = cn(
    "object-shadow group relative grid size-full place-items-center rounded-2xl border-[3px] border-[#f8e8c8]/80 bg-gradient-to-b from-[#efd9b3] to-[#d9b682] shadow-[0_8px_18px_rgba(48,28,12,.22)] transition",
    interactive && mode === "public" && "cursor-pointer hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(48,28,12,.3)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/60",
    object.hidden && "opacity-40",
    selected && "ring-4 ring-terracotta/70",
  );

  const tileInner = (
    <>
      <Icon size={iconSize} className="text-[#5a3b22]" />
      {mode === "public" && object.actionType !== "none" && (
        <span className="absolute -right-1.5 -top-1.5 size-3.5 rounded-full bg-terracotta ring-2 ring-[#fff7e6]" aria-hidden="true" />
      )}
      <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#7c5436]/30 bg-[#f4dcaa] px-2 py-0.5 text-[10px] font-bold text-[#5a3b22] shadow-sm">
        {object.label}
      </span>
    </>
  );

  return (
    <div
      data-object-id={object.id}
      className={cn("absolute -translate-x-1/2 -translate-y-1/2", mode === "editor" && "touch-none select-none")}
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: boxW,
        height: boxH,
        zIndex: object.zIndex,
        transform: `translate(-50%, -50%) rotate(${object.rotation}deg)`,
      }}
    >
      {mode === "public" ? (
        <button
          type="button"
          onClick={onActivate}
          disabled={!interactive}
          aria-label={`${object.label}${object.actionType !== "none" ? ` — ${actionLabels[object.actionType]}` : ""}`}
          className={tileClass}
        >
          {tileInner}
        </button>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label={`Select ${object.label}`}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelect?.();
            }
          }}
          className={cn(tileClass, "cursor-grab active:cursor-grabbing")}
        >
          {tileInner}
          {showHandles &&
            HANDLES.map((handle) => (
              <span
                key={handle.corner}
                data-resize-handle={handle.corner}
                className={cn(
                  "absolute size-3 rounded-full border-2 border-terracotta bg-white shadow",
                  handle.className,
                )}
              />
            ))}
        </div>
      )}
    </div>
  );
}
