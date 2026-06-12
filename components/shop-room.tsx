import type { CSSProperties } from "react";
import { ArrowUpRight, Armchair, ImageIcon, Link2, Move, Sparkles, Type } from "lucide-react";
import type { Decoration, RoomZone } from "@/lib/types";
import { cn } from "@/lib/utils";

const icons = {
  text: Type,
  image: ImageIcon,
  "ai-image": Sparkles,
  link: Link2,
  furniture: Armchair,
};

const zoneLabels: Record<RoomZone, string> = {
  "left-wall": "Left wall",
  "back-wall": "Back wall",
  floor: "Floor",
  "right-wall": "Right wall",
};

/**
 * Decorations render as objects in the room rather than cards:
 * pictures hang in wooden frames, notes are pinned paper, links are
 * wooden plaques, furniture sits on the floor with a contact shadow.
 */
function RoomItem({ item, index, onWall }: { item: Decoration; index: number; onWall: boolean }) {
  const Icon = icons[item.type];
  const tilt = [-1.5, 1, -0.5, 1.5, -1][index % 5];

  // Pictures and AI art — framed canvas with a small brass title plate
  if (item.type === "ai-image" || item.type === "image") {
    return (
      <article className="group/item relative transition hover:-translate-y-1" style={{ transform: `rotate(${tilt}deg)` }}>
        {onWall && <span className="absolute -top-3 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-[#6b4a2e] shadow-sm" aria-hidden="true" />}
        <div className="rounded-md border-[7px] border-[#8a5a3b] bg-[#fdf6e6] p-1.5 shadow-[0_10px_22px_rgba(48,28,12,.3),inset_0_1px_0_rgba(255,255,255,.5)]">
          <div className={cn("relative flex min-h-24 items-end overflow-hidden rounded-sm bg-gradient-to-br p-2", item.palette ?? "from-amber-200 to-rose-200")}>
            <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:11px_11px]" />
            <Icon size={15} className="relative text-ink/45" />
          </div>
        </div>
        <p className="mx-auto -mt-1 w-fit max-w-full truncate rounded-sm border border-[#a9824c]/50 bg-[#e9c989] px-2 py-0.5 text-[9px] font-black text-[#5a3b22] shadow-sm">
          {item.title}
        </p>
        <p className="mt-1 line-clamp-2 px-1 text-center text-[10px] leading-snug text-ink/45">{item.content}</p>
      </article>
    );
  }

  // Furniture — sits in the room, not in a card
  if (item.type === "furniture") {
    return (
      <article className="group/item relative flex flex-col items-center pt-2 transition hover:-translate-y-1">
        <div className="object-shadow relative">
          <Armchair size={64} className="text-[#b3633f] drop-shadow-[0_4px_4px_rgba(48,28,12,.25)]" fill="#d98e57" strokeWidth={1.4} />
        </div>
        <p className="mt-2 max-w-full truncate text-[10px] font-black text-ink/55">{item.title}</p>
      </article>
    );
  }

  // Links — a little wooden plaque you could nail anywhere
  if (item.type === "link") {
    return (
      <article className="relative transition hover:-translate-y-1" style={{ transform: `rotate(${tilt}deg)` }}>
        {onWall && <span className="absolute -top-2.5 left-1/2 h-2.5 w-px -translate-x-1/2 bg-[#6b4a2e]/70" aria-hidden="true" />}
        <div className="rounded-lg border-2 border-[#7c5436]/60 bg-gradient-to-b from-[#e9c989] to-[#d8b06a] px-3 py-2.5 shadow-[0_8px_18px_rgba(48,28,12,.25),inset_0_1px_0_rgba(255,255,255,.55)]">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-xs font-black text-[#4a2f1a]">{item.title}</h3>
            <ArrowUpRight size={13} className="shrink-0 text-[#4a2f1a]/55" />
          </div>
          <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-[#4a2f1a]/65">{item.content}</p>
        </div>
      </article>
    );
  }

  // Notes — pinned paper with a strip of washi tape
  return (
    <article className="relative transition hover:-translate-y-1" style={{ transform: `rotate(${tilt}deg)` }}>
      <span className="absolute -top-1.5 left-1/2 z-10 h-3 w-9 -translate-x-1/2 rotate-2 bg-rosewater/90 shadow-sm" aria-hidden="true" />
      <div className="rounded-sm bg-[#fffbe9] p-3.5 shadow-[0_8px_18px_rgba(48,28,12,.2)]">
        <h3 className="display text-sm italic">{item.title}</h3>
        <p className="mt-1.5 line-clamp-3 text-[11px] leading-relaxed text-ink/55">{item.content}</p>
      </div>
    </article>
  );
}

function Zone({ zone, decorations, editable, active, onItemClick }: { zone: RoomZone; decorations: Decoration[]; editable: boolean; active: boolean; onItemClick?: (id: string) => void }) {
  const onWall = zone !== "floor";
  return (
    <div className={cn(
      "relative rounded-3xl border border-transparent p-2 transition",
      editable && "border-dashed border-ink/10",
      active && "border-terracotta/60 bg-terracotta/5 ring-4 ring-terracotta/10",
    )}>
      {editable && (
        <span className={cn("absolute left-3 top-3 z-20 rounded-full bg-white/75 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.12em] text-ink/35 shadow-sm backdrop-blur", active && "bg-terracotta text-white")}>
          {zoneLabels[zone]}
        </span>
      )}
      <div className={cn(
        "grid h-full gap-4",
        // Back-wall objects settle below the window; side walls hang from the top
        zone === "floor" && "grid-cols-2 content-end items-end sm:grid-cols-3",
        zone === "back-wall" && "content-end gap-5 px-4 pb-2",
        (zone === "left-wall" || zone === "right-wall") && "content-start gap-6 pt-8",
      )}>
        {decorations.map((item, index) =>
          onItemClick ? (
            <div key={item.id} onClick={() => onItemClick(item.id)} className="cursor-pointer">
              <RoomItem item={item} index={index} onWall={onWall} />
            </div>
          ) : (
            <RoomItem key={item.id} item={item} index={index} onWall={onWall} />
          ),
        )}
      </div>
    </div>
  );
}

export function ShopRoom({ decorations, editable = false, activeZone = "floor", onItemClick }: { decorations: Decoration[]; editable?: boolean; activeZone?: RoomZone; onItemClick?: (id: string) => void }) {
  const byZone = (zone: RoomZone) => decorations.filter((item) => (item.zone ?? "floor") === zone);

  return (
    <div
      className="grain shop-glow relative min-h-[690px] overflow-hidden rounded-[2.75rem] border-[10px] border-white/65 p-4 sm:min-h-[760px] sm:p-7"
      style={{ "--room-wall": "#e6cfa9" } as CSSProperties}
    >
      {/* ── Room shell: wallpapered back wall, angled side walls, wooden floor ── */}
      <div className="room-wallpaper pointer-events-none absolute inset-x-0 top-0 h-[66%]" />
      {/* Wainscoting strip where wall meets floor */}
      <div className="pointer-events-none absolute inset-x-0 top-[62%] h-[4%] border-y-2 border-[#9c6f45]/40 bg-[#c79a68]" />
      {/* Floorboards with a slight perspective */}
      <div className="room-floorboards pointer-events-none absolute inset-x-0 bottom-0 h-[34%] [transform:perspective(700px)_rotateX(16deg)] [transform-origin:top]" />
      {/* Rug in the middle of the floor */}
      <div className="pointer-events-none absolute bottom-[4%] left-1/2 h-[18%] w-[58%] -translate-x-1/2 rounded-[50%] border-[6px] border-[#a04a38]/55 bg-gradient-to-br from-[#c96a4e]/80 to-[#9c4434]/80 shadow-inner">
        <div className="absolute inset-3 rounded-[50%] border-2 border-dashed border-[#f3d9a8]/50" />
      </div>
      {/* Angled side walls in shadow */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[14%] bg-gradient-to-r from-[#7e5435]/45 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[14%] bg-gradient-to-l from-[#7e5435]/45 to-transparent" />

      {/* Window on the back wall with the village outside */}
      <div className="pointer-events-none absolute left-1/2 top-8 h-[34%] w-[26%] -translate-x-1/2 rounded-t-full border-[10px] border-[#b07c4c] bg-gradient-to-b from-sky-200 via-sky-100 to-amber-100 shadow-[inset_0_4px_12px_rgba(40,25,10,.25)]">
        <div className="absolute inset-x-4 bottom-0 h-1/2 bg-teal/40 [clip-path:polygon(0_45%,20%_20%,40%_50%,60%_12%,100%_55%,100%_100%,0_100%)]" />
        <div className="absolute left-1/2 top-3 h-3/4 w-px bg-white/70" />
        <div className="absolute left-3 right-3 top-1/2 h-px bg-white/70" />
      </div>
      {/* Sunlight falling in from the window */}
      <div className="window-beam pointer-events-none absolute left-[30%] top-[12%] h-[58%] w-[34%] [clip-path:polygon(28%_0,72%_0,100%_100%,0_100%)]" />

      {/* Hanging lamp with a warm breathing glow */}
      <div className="pointer-events-none absolute right-[18%] top-0 flex flex-col items-center" aria-hidden="true">
        <span className="block h-12 w-px bg-[#4a2f1a]/60" />
        <span className="-mt-px block h-7 w-12 rounded-b-full rounded-t-md bg-gradient-to-b from-[#b9583c] to-[#8f3f2a] shadow-md" />
        <span className="-mt-1 block size-3 rounded-full bg-amber-200 shadow-[0_0_16px_6px_rgba(255,200,100,.65)]" />
      </div>
      <div className="lamp-glow pointer-events-none absolute right-[8%] top-[8%] h-[40%] w-[34%] -translate-x-0" />

      {/* A quiet plant in the corner */}
      <div className="pointer-events-none absolute bottom-[6%] left-[4%] flex flex-col items-center" aria-hidden="true">
        <span className="block h-10 w-2 rounded-full bg-emerald-700/80 [transform:rotate(-8deg)]" />
        <span className="-mt-9 block h-9 w-2 rounded-full bg-emerald-600/80 [transform:rotate(10deg)]" />
        <span className="-mt-2 block h-7 w-9 rounded-b-xl rounded-t-sm bg-gradient-to-b from-[#c96a4e] to-[#9c4434] shadow-md" />
      </div>

      {editable && (
        <div className="absolute left-5 top-5 z-30 flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-2 text-[10px] font-black uppercase tracking-[.15em] text-ink/50 shadow-sm backdrop-blur">
          <Move size={13} /> Editing {zoneLabels[activeZone]}
        </div>
      )}

      <div className="relative z-10 grid min-h-[620px] grid-cols-[minmax(0,.72fr)_minmax(0,1.45fr)_minmax(0,.72fr)] grid-rows-[1fr_.8fr] gap-3 pt-14 sm:min-h-[690px]">
        <Zone zone="left-wall" decorations={byZone("left-wall")} editable={editable} active={editable && activeZone === "left-wall"} onItemClick={onItemClick} />
        <Zone zone="back-wall" decorations={byZone("back-wall")} editable={editable} active={editable && activeZone === "back-wall"} onItemClick={onItemClick} />
        <Zone zone="right-wall" decorations={byZone("right-wall")} editable={editable} active={editable && activeZone === "right-wall"} onItemClick={onItemClick} />
        <div className="col-span-3">
          <Zone zone="floor" decorations={byZone("floor")} editable={editable} active={editable && activeZone === "floor"} onItemClick={onItemClick} />
        </div>
      </div>

      {decorations.length === 0 && (
        <div className="absolute left-1/2 top-[54%] z-20 w-[min(88%,360px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-dashed border-ink/20 bg-white/75 p-7 text-center shadow-lg backdrop-blur">
          <Sparkles className="mx-auto text-terracotta" />
          <h3 className="mt-3 font-black">{editable ? "This room is ready for you" : "This place is still being decorated"}</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink/50">{editable ? "Choose a zone, then place your first item." : "Come back soon. Something lovely may be taking shape."}</p>
        </div>
      )}
    </div>
  );
}
