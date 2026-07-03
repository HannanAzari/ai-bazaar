"use client";

import { useEffect, useRef } from "react";
import type { Village, VillageHouse } from "@/lib/nest-village";
import { houseInitial } from "@/lib/nest-house";
import { HouseExterior } from "@/components/nest/village/house-exterior";
import { SceneBackdrop } from "@/components/nest/village/scene-backdrop";

// M19 — the Village: a hex neighborhood of houses you can pan around and tap to arrive
// at. The world "descends" into place on mount (nest-arrive), the sky sits still behind
// while the houses pan, and real creators wear a name plate so the village reads as a
// real place, not a grid of dummies.
export function VillageScene({ village, onSelect }: { village: Village; onSelect: (house: VillageHouse) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Settle the camera on the heart of the village.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = village.center.x - el.clientWidth / 2;
    el.scrollTop = village.center.y - el.clientHeight / 2.4;
  }, [village]);

  const nodeSize = village.hexSize * 1.35;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <SceneBackdrop className="absolute inset-0" />

      <div ref={scrollRef} className="relative h-full w-full overflow-auto overscroll-contain [scrollbar-width:none]">
        <div className="nest-arrive relative" style={{ width: village.width, height: village.height }}>
          {/* soft village clearing under the houses */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 size-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#b7d195]/40 blur-2xl" />

          {[...village.houses]
            // paint back-to-front so nearer houses overlap farther ones
            .sort((a, b) => a.y - b.y)
            .map((house) => (
              <button
                key={house.id}
                onClick={() => onSelect(house)}
                className="group absolute flex flex-col items-center"
                style={{ left: house.x, top: house.y, width: nodeSize, transform: "translate(-50%, -86%)", zIndex: Math.round(house.y) }}
                aria-label={`${house.name}${house.isReal ? " (creator)" : ""}`}
              >
                <HouseExterior house={house} className="w-full" interactive />
                <span
                  className={`-mt-1 max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-bold shadow-soft ${
                    house.isReal ? "bg-terracotta text-parchment" : "bg-white/85 text-ink/60"
                  }`}
                >
                  {house.isReal && house.handle ? `@${house.handle}` : house.name}
                </span>
                {house.online ? (
                  <span className="absolute right-3 top-2 flex items-center gap-1 rounded-full bg-white/85 px-1.5 py-0.5 shadow-soft">
                    <span className="size-1.5 rounded-full bg-meadow-shade" />
                  </span>
                ) : null}
                {house.isReal ? (
                  <span className="absolute -top-1 left-2 grid size-5 place-items-center rounded-full bg-white text-[9px] font-black text-terracotta shadow-soft ring-1 ring-terracotta/30">
                    {houseInitial(house)}
                  </span>
                ) : null}
              </button>
            ))}
        </div>
      </div>

      {/* gentle vignette so the edges feel like the outskirts */}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_80px_30px_rgba(90,62,38,0.18)]" />
    </div>
  );
}
