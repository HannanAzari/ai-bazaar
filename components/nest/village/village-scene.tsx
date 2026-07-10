"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Village, VillageHouse } from "@/lib/nest-village";
import { houseInitial } from "@/lib/nest-house";
import type { SkyTheme, WeatherTheme } from "@/lib/nest-atmosphere";
import { HouseExterior } from "@/components/nest/village/house-exterior";
import { SceneBackdrop } from "@/components/nest/village/scene-backdrop";
import { useCurvedWorld } from "@/components/nest/village/use-curved-world";
import {
  DEFAULT_PROJECTION_CONFIG,
  projectItem,
  type VillageWorldItem,
} from "@/lib/village-projection";

// ── Village scene — pseudo-3D curved world ────────────────────────────────────
// The village is a virtual 2D world you move a camera over (drag any direction:
// left/right/up/down/diagonal, with fling inertia). Each house owns stable world
// coordinates; lib/village-projection curves them onto the screen so the centre
// reads closest, the sides fall away around the limb, and houses wrap round the
// world as you pan. Camera + projection are driven imperatively (refs + rAF, no
// per-frame React render) by useCurvedWorld. Pure CSS/SVG — no Three.js, no libs.

// Deterministic 0..1 hash from a seed (no Math.random → stable, hydration-safe).
function rnd(seed: number, salt: number): number {
  let h = Math.imul(seed + 1, 374761393) + Math.imul(salt, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const CFG = DEFAULT_PROJECTION_CONFIG;

// Give every house stable world coordinates. Houses spread evenly around the
// world's width (with per-seed jitter) and scatter across the depth axis so they
// never line up in flat rows. The first real creator anchors where the camera
// opens, so you arrive looking at a real neighbour.
function layout(village: Village) {
  const houses = village.houses;
  const n = Math.max(1, houses.length);
  const placed = houses.map((house, i) => {
    const jitterX = (rnd(house.seed, 2) - 0.5) * (CFG.WORLD_WIDTH / n) * 0.7;
    const worldX = (i / n) * CFG.WORLD_WIDTH + jitterX;
    // Depth spread across roughly the front two-thirds of the world's depth.
    const worldY = -CFG.WORLD_HEIGHT * 0.24 + rnd(house.seed, 5) * CFG.WORLD_HEIGHT * 0.58;
    const item: VillageWorldItem = { id: house.id, worldX, worldY, kind: "house" };
    return { house, item };
  });
  const home = placed.find((p) => p.house.isReal) ?? placed[0];
  const initialCamera = home
    ? { x: home.item.worldX, y: home.item.worldY - CFG.WORLD_HEIGHT * 0.16 }
    : { x: 0, y: 0 };
  return { placed, initialCamera };
}

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
  const { placed, initialCamera } = useMemo(() => layout(village), [village]);
  const items = useMemo(() => placed.map((p) => p.item), [placed]);

  const world = useCurvedWorld({
    items,
    initialCamera,
    disabled: !!zoomingId, // freeze the camera during the arrival zoom
  });

  // Houses load async (discovery), so re-centre on the lead creator when it first
  // resolves — but only when the home actually changes, never mid-drag every render.
  const homeId = placed.find((p) => p.house.isReal)?.house.id ?? placed[0]?.house.id ?? null;
  const homeRef = useRef<string | null>(null);
  useEffect(() => {
    if (homeId && homeRef.current !== homeId) {
      homeRef.current = homeId;
      world.jumpTo(initialCamera);
    }
  }, [homeId, initialCamera, world]);

  const { width: vw, height: vh } = world.viewport;
  const horizonY = vh * CFG.horizonYFraction;

  // Arrival zoom: push the camera visually toward the tapped house by scaling the
  // whole world layer about that house's current on-screen point (gestures are
  // frozen while this runs, so the camera is stable enough to read once).
  const zoomItem = zoomingId ? placed.find((p) => p.house.id === zoomingId)?.item : null;
  const origin = zoomItem ? projectItem(zoomItem, world.getCamera(), { width: vw, height: vh }, CFG) : null;

  // Ground silhouette matched to the projection: the horizon band is pushed down
  // by horizontalCurve * relativeX², so sample that same parabola across the width.
  const groundPath = useMemo(() => {
    if (vw <= 0) return "";
    const centerX = vw / 2;
    const compAtHorizon = CFG.horizonCompression + (1 - CFG.horizonCompression) * 0.5;
    const denom = CFG.horizontalScale * compAtHorizon || 1;
    const pts: string[] = [];
    const N = 24;
    for (let i = 0; i <= N; i++) {
      const sx = (i / N) * vw;
      const relX = (sx - centerX) / denom;
      const y = horizonY + CFG.horizontalCurve * relX * relX;
      pts.push(`${i === 0 ? "M" : "L"}${sx.toFixed(1)},${y.toFixed(1)}`);
    }
    return `${pts.join(" ")} L${vw},${vh} L0,${vh} Z`;
  }, [vw, vh, horizonY]);

  const grass = sky.night
    ? { top: "#31513a", mid: "#24402e", bottom: "#182a1f" }
    : { top: "#8db956", mid: "#6ba045", bottom: "#4c7d38" };

  return (
    <div
      ref={world.rootRef}
      className="relative h-full w-full touch-none select-none overflow-hidden"
      {...world.handlers}
    >
      {/* the living sky — fills the whole viewport; the ground sits over its lower half */}
      <SceneBackdrop sky={sky} wx={wx} birds className="absolute inset-0" />

      {/* world layer — scaled toward the tapped house during the arrival zoom */}
      <div
        className="absolute inset-0 transition-[transform,filter] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          transform: origin ? "scale(1.85)" : "scale(1)",
          transformOrigin: origin
            ? `${((origin.screenX / (vw || 1)) * 100).toFixed(1)}% ${((origin.screenY / (vh || 1)) * 100).toFixed(1)}%`
            : "50% 82%",
          filter: origin ? "blur(1.5px) brightness(0.92)" : "none",
        }}
      >
        {/* curved ground — a convex globe limb matched to the house projection */}
        {vw > 0 ? (
          <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="villGrass" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={grass.top} />
                <stop offset="0.45" stopColor={grass.mid} />
                <stop offset="1" stopColor={grass.bottom} />
              </linearGradient>
            </defs>
            <path d={groundPath} fill="url(#villGrass)" />
          </svg>
        ) : null}

        {/* soft rim light along the top of the limb + a warm/cool time wash */}
        <div className="pointer-events-none absolute inset-x-0" style={{ top: horizonY - 10, height: 60, background: "radial-gradient(120% 100% at 50% 100%, rgba(255,255,255,0.20), transparent 70%)" }} />
        <div className="pointer-events-none absolute inset-0" style={{ background: sky.wash }} />

        {/* the houses — each a positioner element the camera projects imperatively */}
        {placed.map(({ house }) => (
          <button
            key={house.id}
            ref={world.register(house.id)}
            data-world-id={house.id}
            onClickCapture={(e) => {
              // Eat the click if this pointer-up was really a drag/fling.
              if (world.suppressTapRef.current) {
                e.stopPropagation();
                world.suppressTapRef.current = false;
              }
            }}
            onClick={() => onSelect(house)}
            className="group"
            style={{ width: 92 }}
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

        {/* limb shading — soft depth pooling at the base so it reads as a planet surface */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: vh * (1 - CFG.horizonYFraction), boxShadow: "inset 0 -44px 60px -24px rgba(30,20,14,0.55)" }} />
      </div>

      {/* a hint you can roam the world (fades once you arrive somewhere) */}
      {!zoomingId ? (
        <div className="pointer-events-none absolute inset-x-0 z-10 flex justify-center" style={{ top: horizonY - 34 }}>
          <span className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-bold text-ink/55 shadow-soft backdrop-blur">‹ drag to explore ›</span>
        </div>
      ) : null}

      {/* gentle vignette so the edges feel like the outskirts */}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_80px_30px_rgba(90,62,38,0.16)]" />
    </div>
  );
}
