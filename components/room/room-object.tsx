"use client";

import type { CSSProperties } from "react";
import {
  Armchair,
  Award,
  BadgeCheck,
  BookOpen,
  CircleUserRound,
  Contact,
  DoorOpen,
  Frame,
  Images,
  Library,
  type LucideIcon,
  Monitor,
  MoveVertical,
  PencilRuler,
  Projector,
  Signpost,
  Sprout,
  Square,
  Store,
  Table,
} from "lucide-react";
import { actionLabels } from "@/lib/room-schema";
import { type ObjectVisual, objectVisual } from "@/lib/room-visuals";
import { getAsset } from "@/lib/assets";
import { galleryImages, productCard } from "@/lib/room-actions";
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
  "ast-stairs": MoveVertical,
  "ast-avatar-portrait": CircleUserRound,
  "ast-certificate": BadgeCheck,
  "ast-achievement-board": Award,
  "ast-projector": Projector,
  "ast-sign": Signpost,
  "ast-display-table": Table,
  "ast-business-card": Contact,
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

// ── Richer object sprite ──
// A CSS treatment per visual kind, framing the existing icon glyph in the warm
// palette. Each fills the object box (size-full) so hit area / resize handles /
// rotation stay correct.
function ObjectSprite({ kind, Icon, glyph, imageSrc }: { kind: ObjectVisual; Icon: LucideIcon; glyph: number; imageSrc?: string }) {
  const ink = "#5a3b22";
  const art = (
    <Icon size={glyph} className="relative text-[#5a3b22]" strokeWidth={1.75} />
  );

  switch (kind) {
    case "frame":
    case "portrait":
    case "certificate": {
      const round = kind === "portrait" ? "rounded-[45%]" : kind === "certificate" ? "rounded-md" : "rounded-[3px]";
      return (
        <div className="grid size-full place-items-center rounded-[5px] border-[5px] border-[#b07c4c] bg-[#8a5a36] p-[6%] shadow-[inset_0_0_0_2px_rgba(247,231,200,0.55)]">
          <div
            className={cn("relative grid size-full place-items-center overflow-hidden", round, "bg-gradient-to-br from-[#fbf0d6] to-[#ecd6ad]")}
            style={imageSrc ? ({ backgroundImage: `url(${imageSrc})`, backgroundSize: "cover", backgroundPosition: "center" } as CSSProperties) : undefined}
          >
            {!imageSrc && art}
            {kind === "certificate" && <span className="absolute bottom-1 right-1 size-3 rounded-full bg-terracotta ring-2 ring-[#f7e7c8]" aria-hidden="true" />}
          </div>
        </div>
      );
    }
    case "screen":
      return (
        <div className="grid size-full place-items-center rounded-xl border-[5px] border-[#23262e] bg-gradient-to-br from-[#2c313c] to-[#171a20] shadow-[inset_0_2px_10px_rgba(120,160,220,0.25)]">
          {imageSrc ? (
            <div className="size-full rounded-sm bg-cover bg-center" style={{ backgroundImage: `url(${imageSrc})` } as CSSProperties} />
          ) : (
            <Icon size={glyph} className="text-sky-200/90" strokeWidth={1.75} />
          )}
        </div>
      );
    case "shelf":
      return (
        <div className="relative grid size-full grid-rows-2 overflow-hidden rounded-md border-[3px] border-[#9c6f45] bg-gradient-to-b from-[#e7cda0] to-[#d2ab74]">
          <div className="grid place-items-center border-b-[3px] border-[#9c6f45]/70">{art}</div>
          <div className="border-b-[6px] border-[#9c6f45]/80" />
        </div>
      );
    case "desk":
      return (
        <div className="relative size-full">
          <div className="absolute inset-x-[8%] top-[10%] grid h-[46%] place-items-center rounded-md border-[3px] border-[#9c6f45] bg-[#f3e1bb] shadow-sm">{art}</div>
          <div className="absolute inset-x-0 top-[56%] h-[14%] rounded bg-gradient-to-b from-[#c79a68] to-[#a87b4d]" />
          <div className="absolute bottom-0 left-[14%] h-[30%] w-[8%] bg-[#9c6f45]" />
          <div className="absolute bottom-0 right-[14%] h-[30%] w-[8%] bg-[#9c6f45]" />
        </div>
      );
    case "card":
      return (
        <div className="grid size-full place-items-center rounded-lg border border-[#7c5436]/40 bg-gradient-to-br from-[#fff8e9] to-[#f1ddb4] p-[10%] shadow-[0_3px_8px_rgba(48,28,12,.2)]">
          <div className="grid size-full place-items-center rounded-md border border-dashed border-[#7c5436]/30">{art}</div>
        </div>
      );
    case "board":
      return (
        <div className="relative grid size-full place-items-center rounded-md border-[5px] border-[#8a5a36] bg-[#cdb088] shadow-inner">
          <span className="absolute left-[14%] top-[14%] size-[22%] -rotate-6 rounded-[2px] bg-[#fff8e9] shadow" aria-hidden="true" />
          <span className="absolute right-[14%] top-[18%] size-[20%] rotate-6 rounded-[2px] bg-[#f4dcaa] shadow" aria-hidden="true" />
          {art}
        </div>
      );
    case "door":
      return (
        <div className="relative mx-auto grid h-full w-[78%] place-items-center rounded-t-[42%] border-[4px] border-[#7c5436] bg-gradient-to-b from-[#b9824f] to-[#925f37] shadow-[inset_0_0_0_3px_rgba(247,231,200,0.35)]">
          <div className="absolute inset-x-[18%] top-[10%] h-[34%] rounded-t-[40%] border-2 border-[#f7e7c8]/45" />
          <div className="absolute inset-x-[18%] bottom-[10%] h-[34%] rounded border-2 border-[#f7e7c8]/35" />
          <span className="absolute right-[14%] top-1/2 size-[8%] -translate-y-1/2 rounded-full bg-[#f4dcaa] shadow" aria-hidden="true" />
        </div>
      );
    case "stairs":
      return (
        <div className="relative size-full overflow-hidden rounded-md border-[3px] border-[#9c6f45] bg-[#e7cda0]">
          <div className="absolute bottom-0 left-0 h-[36%] w-full bg-[#c79a68]" />
          <div className="absolute bottom-0 left-0 h-[62%] w-[68%] bg-[#cda472]" />
          <div className="absolute bottom-0 left-0 h-[88%] w-[38%] bg-[#d9b682]" />
          <div className="absolute inset-0 grid place-items-center"><Icon size={glyph * 0.8} className="text-[#5a3b22]/80" strokeWidth={1.75} /></div>
        </div>
      );
    case "plant":
      return (
        <div className="relative grid size-full place-items-end justify-center">
          <span className="absolute top-[6%] grid h-[58%] w-[64%] place-items-center rounded-[48%] bg-gradient-to-b from-[#8bb274] to-[#5f8a52]"><Sprout size={glyph * 0.9} className="text-[#2f4a2a]" /></span>
          <span className="h-[34%] w-[44%] rounded-b-md bg-gradient-to-b from-[#d08a5a] to-[#a85f36]" aria-hidden="true" />
        </div>
      );
    case "rug":
      return (
        <div className="grid size-full place-items-center rounded-[46%] border-[5px] border-[#b8757b] bg-gradient-to-br from-[#e2b2b2] to-[#caa0a0] shadow-inner">
          <div className="grid size-[62%] place-items-center rounded-[46%] border-2 border-[#fff8e9]/60">{art}</div>
        </div>
      );
    case "seat":
      return (
        <div className="relative size-full">
          <div className="absolute inset-x-[6%] top-[14%] h-[40%] rounded-t-xl bg-gradient-to-b from-[#e0bd92] to-[#c89a68]" />
          <div className="absolute inset-x-0 top-[46%] h-[40%] rounded-xl bg-gradient-to-b from-[#efd9b3] to-[#d9b682] shadow" />
          <div className="absolute bottom-[6%] left-0 h-[34%] w-[14%] rounded-l-xl bg-[#caa069]" />
          <div className="absolute bottom-[6%] right-0 h-[34%] w-[14%] rounded-r-xl bg-[#caa069]" />
          <div className="absolute inset-0 grid place-items-center"><Armchair size={glyph * 0.85} className="text-[#5a3b22]/70" /></div>
        </div>
      );
    default:
      // Generic parchment tile (keeps the original look for anything unmapped).
      return (
        <div className="object-shadow grid size-full place-items-center rounded-2xl border-[3px] border-[#f8e8c8]/80 bg-gradient-to-b from-[#efd9b3] to-[#d9b682] shadow-[0_8px_18px_rgba(48,28,12,.22)]" style={{ color: ink }}>
          {art}
        </div>
      );
  }
}

export function RoomObjectView({
  object,
  anchor,
  mode,
  selected,
  showHandles,
  ownerName,
  onActivate,
  onSelect,
}: {
  object: RoomObjectModel;
  anchor: AnchorPoint | undefined;
  mode: "public" | "editor";
  selected?: boolean;
  /** Editor only: render corner resize handles (single-selection). */
  showHandles?: boolean;
  /** Public only: owner name shown in the hover/focus tooltip. */
  ownerName?: string;
  onActivate?: () => void;
  onSelect?: () => void;
}) {
  const Icon = objectIcon(object.assetId);
  const asset = getAsset(object.assetId);
  const visual = objectVisual(object.assetId, asset?.category);
  const left = ((anchor?.x ?? 0.5) + object.x) * 100;
  const top = ((anchor?.y ?? 0.5) + object.y) * 100;
  const interactive = mode === "public" ? object.actionType !== "none" : true;
  const tooltipText = object.actionData?.description?.trim() || object.actionData?.text?.trim()
    || (object.actionType !== "none" ? actionLabels[object.actionType] : "Just decoration");

  // Effective rendered box: base/explicit dimensions × the uniform scale.
  const scale = object.scale || 1;
  const boxW = (object.width ?? BASE_OBJECT_SIZE) * scale;
  const boxH = (object.height ?? BASE_OBJECT_SIZE) * scale;
  const glyph = Math.max(14, Math.min(boxW, boxH) * 0.4);

  // Show real artwork in frames/screens when the object carries an image.
  const imageSrc = visual === "frame"
    ? galleryImages(object.actionData)[0]?.src || (productCard(object.actionData)?.image)
    : undefined;

  const shellClass = cn(
    "group relative block size-full transition",
    interactive && mode === "public" && "cursor-pointer hover:-translate-y-1 focus-visible:outline-none focus-visible:rounded-2xl focus-visible:ring-4 focus-visible:ring-amber-400/60",
    object.hidden && "opacity-40",
    selected && "rounded-2xl ring-4 ring-terracotta/70",
    mode === "editor" && "cursor-grab active:cursor-grabbing",
  );

  const overlays = (
    <>
      {mode === "public" && object.actionType !== "none" && (
        <span className="pointer-events-none absolute -right-1.5 -top-1.5 z-20 size-3.5 rounded-full bg-terracotta ring-2 ring-[#fff7e6]" aria-hidden="true" />
      )}
      {/* Natural engraved nameplate at the object base (museum-placard style). */}
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 max-w-[150%] -translate-x-1/2 truncate rounded-[3px] border-b-2 border-[#7c5436]/50 bg-gradient-to-b from-[#f4dcaa] to-[#e7c98c] px-2 py-0.5 text-[10px] font-bold text-[#5a3b22] shadow-[0_2px_4px_rgba(48,28,12,.25)]">
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
          className={shellClass}
        >
          <ObjectSprite kind={visual} Icon={Icon} glyph={glyph} imageSrc={imageSrc} />
          {overlays}
          {/* Tooltip — title, description, owner — on hover / keyboard focus. */}
          <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-44 -translate-x-1/2 translate-y-1 rounded-2xl border border-[#7c5436]/25 bg-[#fff8e9] p-2.5 text-center opacity-0 shadow-lg transition duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
            <span className="block text-xs font-black leading-tight text-[#5a3b22]">{object.label}</span>
            <span className="mt-0.5 block text-[10px] leading-snug text-ink/55">{tooltipText}</span>
            {ownerName && <span className="mt-1 block text-[9px] font-bold uppercase tracking-wider text-terracotta">{ownerName}</span>}
          </span>
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
          className={shellClass}
        >
          <ObjectSprite kind={visual} Icon={Icon} glyph={glyph} imageSrc={imageSrc} />
          {overlays}
          {showHandles &&
            HANDLES.map((handle) => (
              <span
                key={handle.corner}
                data-resize-handle={handle.corner}
                className={cn("absolute z-20 size-3 rounded-full border-2 border-terracotta bg-white shadow", handle.className)}
              />
            ))}
        </div>
      )}
    </div>
  );
}
