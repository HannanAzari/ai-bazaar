"use client";

import { useEffect, useRef } from "react";
import type { Village, VillageHouse } from "@/lib/nest-village";
import { houseInitial } from "@/lib/nest-house";
import type { SkyTheme, WeatherTheme } from "@/lib/nest-atmosphere";
import { HouseExterior } from "@/components/nest/village/house-exterior";
import { SceneBackdrop } from "@/components/nest/village/scene-backdrop";
import { VillageTerrain } from "@/components/nest/village/village-terrain";

// M19.1 — the Village, now with a sky (time of day + weather) and a cinematic camera:
// tapping a house zooms the board toward it while the neighborhood softens, then the
// arrival panel appears. The world "descends" into place on mount (nest-arrive).
export function VillageScene({
  village,
  onSelect,
  sky,
  wx,
  zoomingId = null,
}: {
  village: Village;
  onSelect: (house: VillageHouse) => void;
  sky: SkyTheme;
  wx: WeatherTheme;
  /** When set, the board zooms toward this house (camera push into the arrival). */
  zoomingId?: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Settle the camera on the heart of the village.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = village.center.x - el.clientWidth / 2;
    el.scrollTop = village.center.y - el.clientHeight / 2.4;
  }, [village]);

  const nodeSize = village.hexSize * 1.35;
  const zoomHouse = zoomingId ? village.houses.find((h) => h.id === zoomingId) : null;
  const origin = zoomHouse
    ? { x: (zoomHouse.x / village.width) * 100, y: (zoomHouse.y / village.height) * 100 }
    : { x: 50, y: 50 };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <SceneBackdrop sky={sky} wx={wx} birds className="absolute inset-0" />

      <div ref={scrollRef} className={`relative h-full w-full overflow-auto overscroll-contain [scrollbar-width:none] ${zoomHouse ? "pointer-events-none" : ""}`}>
        <div
          className="nest-arrive relative transition-[transform,filter,opacity] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            width: village.width,
            height: village.height,
            transform: zoomHouse ? "scale(1.85)" : "scale(1)",
            transformOrigin: `${origin.x}% ${origin.y}%`,
            filter: zoomHouse ? "blur(2px) brightness(0.85)" : "none",
            opacity: zoomHouse ? 0.55 : 1,
          }}
        >
          {/* the ground the village sits on — grass valley, road, greenery */}
          <VillageTerrain village={village} sky={sky} wx={wx} />

          {[...village.houses]
            .sort((a, b) => a.y - b.y) // back-to-front so nearer houses overlap
            .map((house) => {
              // Perspective: lower houses read as closer (bigger + fully lit), upper
              // houses as further (smaller + a touch hazier). Grows from the base.
              const depth = house.y / village.height;
              const scale = 0.74 + depth * 0.5;
              const nodeOpacity = 0.82 + depth * 0.18;
              return (
              <button
                key={house.id}
                onClick={() => onSelect(house)}
                className="group absolute flex flex-col items-center"
                style={{ left: house.x, top: house.y, width: nodeSize, transform: `translate(-50%, -100%) scale(${scale})`, transformOrigin: "50% 100%", opacity: nodeOpacity, zIndex: Math.round(house.y) }}
                aria-label={`${house.name}${house.isReal ? " (creator)" : ""}`}
              >
                <HouseExterior house={house} className="w-full" interactive glow={sky.glow} night={sky.night} />
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
              );
            })}
        </div>
      </div>

      {/* gentle vignette so the edges feel like the outskirts */}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_80px_30px_rgba(90,62,38,0.18)]" />
    </div>
  );
}
