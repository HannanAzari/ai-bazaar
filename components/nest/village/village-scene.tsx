"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Village, VillageHouse } from "@/lib/nest-village";
import { houseInitial } from "@/lib/nest-house";
import type { SkyTheme, WeatherTheme } from "@/lib/nest-atmosphere";
import { HouseExterior } from "@/components/nest/village/house-exterior";
import { SceneBackdrop } from "@/components/nest/village/scene-backdrop";
import { VillageTerrain } from "@/components/nest/village/village-terrain";

// Beta Polish Final — the Village now sits on a curved little world. The sky (sun/moon,
// birds, weather) fills the upper half; the ground is a soft globe-limb dome across the
// lower half. Houses ride gently curved lanes (front row closer + larger, back rows
// smaller + hazier) on a strip you orbit left↔right — houses drift off one edge as
// others emerge. It's 2.5D CSS/SVG (no 3D, no Three.js, no new libs): the convex clipped
// horizon + curved lanes + limb shading read as a small planet without a real sphere.

// Lanes across the dome (near → far). y is a fraction of the dome height.
const LANES = [
  { y: 0.84, scale: 1.06, op: 1 },    // front — closest, biggest, fully lit
  { y: 0.63, scale: 0.9, op: 0.94 },  // middle
  { y: 0.45, scale: 0.74, op: 0.84 }, // back — furthest, small, a touch hazier
];

// Sensible first-paint fallback (a phone) so SSR + first client render match; a layout
// effect measures the real viewport straight after mount.
const FALLBACK = { vw: 390, vh: 720 };

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
  /** When set, the world zooms toward this house (camera push into the arrival). */
  zoomingId?: string | null;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState(FALLBACK);

  // Measure the viewport (and keep it current on resize/orientation change).
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setVp({ vw: el.clientWidth || FALLBACK.vw, vh: el.clientHeight || FALLBACK.vh });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nodeSize = village.hexSize * 1.35;

  // Lay the houses onto curved lanes on a wide, orbitable strip. Real creators come first
  // in the village, so they take the leading columns near where the camera settles.
  const { laid, stripW, domeH, firstRealX } = useMemo(() => {
    const domeH = Math.round(vp.vh * 0.56);
    const colGap = village.hexSize * 1.95;
    const padX = Math.max(vp.vw * 0.5, village.hexSize * 2.6);

    const laid = village.houses.map((h, i) => {
      const lane = i % LANES.length;
      const col = Math.floor(i / LANES.length);
      const L = LANES[lane];
      const sx = padX + (col + lane * 0.34) * colGap;
      // A gentle rise/fall per column so lanes curve like a horizon (not a straight row).
      const wave = Math.cos(col * 0.8 + lane * 1.7) * domeH * 0.035;
      const sy = domeH * L.y + wave;
      return { ...h, sx, sy, scale: L.scale, op: L.op };
    });

    const lastCol = Math.floor((village.houses.length - 1) / LANES.length);
    const stripW = padX * 2 + (lastCol + (LANES.length - 1) * 0.34) * colGap;
    const firstRealX = (laid.find((h) => h.isReal) ?? laid[0])?.sx ?? stripW / 2;
    return { laid, stripW, domeH, firstRealX };
  }, [village, vp]);

  // Settle the orbit on the first real creator's house.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, firstRealX - el.clientWidth / 2);
  }, [firstRealX, stripW]);

  // A synthetic village so VillageTerrain paints grass/road/greenery across the strip,
  // relit by the same sky + weather (Beta Polish 2 realism, now on the dome).
  const domeVillage: Village = useMemo(
    () => ({
      ...village,
      houses: laid.map((h) => ({ ...h, x: h.sx, y: h.sy })),
      width: stripW,
      height: domeH,
      center: { x: firstRealX, y: domeH * 0.5 },
    }),
    [village, laid, stripW, domeH, firstRealX],
  );

  const zoomHouse = zoomingId ? laid.find((h) => h.id === zoomingId) : null;
  const origin = zoomHouse
    ? { x: (zoomHouse.sx / stripW) * 100, y: (zoomHouse.sy / domeH) * 100 }
    : { x: 50, y: 78 };

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden">
      {/* the living sky — fills the whole viewport; the dome sits over its lower half */}
      <SceneBackdrop sky={sky} wx={wx} birds className="absolute inset-0" />

      {/* the curved ground — a soft globe limb across the lower half of the screen */}
      <div
        className="absolute inset-x-0 bottom-0 overflow-hidden"
        style={{
          height: domeH,
          borderTopLeftRadius: "50% 46px",
          borderTopRightRadius: "50% 46px",
        }}
      >
        <div
          ref={scrollRef}
          className={`h-full w-full overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] ${zoomHouse ? "pointer-events-none" : ""}`}
        >
          <div
            className="nest-arrive relative transition-[transform,filter,opacity] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              width: stripW,
              height: domeH,
              transform: zoomHouse ? "scale(1.85)" : "scale(1)",
              transformOrigin: `${origin.x}% ${origin.y}%`,
              filter: zoomHouse ? "blur(2px) brightness(0.85)" : "none",
              opacity: zoomHouse ? 0.55 : 1,
            }}
          >
            {/* grass valley, road + greenery, relit by the sky */}
            <VillageTerrain village={domeVillage} sky={sky} wx={wx} />

            {[...laid]
              .sort((a, b) => a.sy - b.sy) // back-to-front so nearer houses overlap
              .map((house) => (
                <button
                  key={house.id}
                  onClick={() => onSelect(house)}
                  className="group absolute"
                  style={{
                    left: house.sx,
                    top: house.sy,
                    width: nodeSize,
                    transform: `translate(-50%, -100%) scale(${house.scale})`,
                    transformOrigin: "50% 100%",
                    opacity: house.op,
                    zIndex: Math.round(house.sy),
                  }}
                  aria-label={`${house.name}${house.isReal ? " (creator)" : ""}`}
                >
                  {/* barely-there float so the village feels alive (staggered per house) */}
                  <div className="nest-float-map relative flex flex-col items-center" style={{ animationDelay: `${(house.seed % 60) / 10}s` }}>
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
                  </div>
                </button>
              ))}
          </div>
        </div>

        {/* limb shading — a soft light along the top curve + depth pooling at the base,
            so the ground reads as the surface of a small planet (pure overlay, no motion). */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(150%_120%_at_50%_-10%,rgba(255,255,255,0.14),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_-44px_60px_-24px_rgba(40,24,17,0.5)]" />
      </div>

      {/* gentle vignette so the edges feel like the outskirts */}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_80px_30px_rgba(90,62,38,0.16)]" />
    </div>
  );
}
