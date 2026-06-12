"use client";

import { CalendarClock, ExternalLink, Images, Mail, PlayCircle, ShoppingBag, X } from "lucide-react";
import { actionLabels } from "@/lib/room-schema";
import type { RoomObject } from "@/lib/types";

// V1 placeholders for richer object actions. Link/guestbook/collection are
// handled by the page (open URL / drawer); the rest show a simple panel.
const icons = {
  video: PlayCircle,
  product: ShoppingBag,
  booking: CalendarClock,
  contact: Mail,
  gallery: Images,
} as const;

type PanelAction = keyof typeof icons;

export function ObjectActionModal({ object, onClose }: { object: RoomObject; onClose: () => void }) {
  const Icon = icons[object.actionType as PanelAction] ?? Images;
  const url = object.actionData?.url;

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-ink/40 p-5 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-md rounded-[2rem] border border-white/70 bg-[#fff8e9] p-7 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <button onClick={onClose} className="absolute right-5 top-5 grid size-9 place-items-center rounded-full bg-white" aria-label="Close">
          <X size={17} />
        </button>
        <span className="grid size-12 place-items-center rounded-2xl bg-terracotta/10 text-terracotta"><Icon size={24} /></span>
        <p className="eyebrow mt-4 text-terracotta">{actionLabels[object.actionType]}</p>
        <h2 className="display mt-1 text-3xl">{object.label}</h2>
        {object.actionData?.text && <p className="mt-3 text-sm leading-relaxed text-ink/60">{object.actionData.text}</p>}
        <p className="mt-3 rounded-2xl border border-dashed border-ink/15 bg-white/50 p-4 text-sm text-ink/55">
          This is a placeholder for the {actionLabels[object.actionType].toLowerCase()} experience. Rich {object.actionType} panels arrive in a later sprint.
        </p>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#9a4a30]">
            Open link <ExternalLink size={15} />
          </a>
        )}
      </div>
    </div>
  );
}
