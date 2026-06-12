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

export function objectIcon(assetId: string): LucideIcon {
  return assetIcons[assetId] ?? Armchair;
}

export function RoomObjectView({
  object,
  anchor,
  mode,
  selected,
  onActivate,
  onSelect,
}: {
  object: RoomObjectModel;
  anchor: AnchorPoint | undefined;
  mode: "public" | "editor";
  selected?: boolean;
  onActivate?: () => void;
  onSelect?: () => void;
}) {
  const Icon = objectIcon(object.assetId);
  const left = ((anchor?.x ?? 0.5) + object.x) * 100;
  const top = ((anchor?.y ?? 0.5) + object.y) * 100;
  const interactive = mode === "public" ? object.actionType !== "none" : true;

  const label = (
    <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#7c5436]/30 bg-[#f4dcaa] px-2 py-0.5 text-[10px] font-bold text-[#5a3b22] shadow-sm">
      {object.label}
    </span>
  );

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${left}%`, top: `${top}%`, zIndex: object.zIndex, transform: `translate(-50%, -50%) rotate(${object.rotation}deg) scale(${object.scale})` }}
    >
      <button
        type="button"
        onClick={mode === "editor" ? onSelect : onActivate}
        disabled={mode === "public" && !interactive}
        aria-label={mode === "public" ? `${object.label}${object.actionType !== "none" ? ` — ${actionLabels[object.actionType]}` : ""}` : `Select ${object.label}`}
        className={cn(
          "object-shadow group relative grid size-16 place-items-center rounded-2xl border-[3px] border-[#f8e8c8]/80 bg-gradient-to-b from-[#efd9b3] to-[#d9b682] shadow-[0_8px_18px_rgba(48,28,12,.22)] transition",
          interactive && mode === "public" && "cursor-pointer hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(48,28,12,.3)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/60",
          object.hidden && "opacity-40",
          selected && "ring-4 ring-terracotta/70",
        )}
      >
        <Icon size={26} className="text-[#5a3b22]" />
        {mode === "public" && object.actionType !== "none" && (
          <span className="absolute -right-1.5 -top-1.5 size-3.5 rounded-full bg-terracotta ring-2 ring-[#fff7e6]" aria-hidden="true" />
        )}
        {label}
      </button>
    </div>
  );
}
