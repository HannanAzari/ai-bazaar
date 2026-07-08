"use client";

import { useMemo } from "react";
import type { Village } from "@/lib/nest-village";
import type { SkyTheme, WeatherTheme } from "@/lib/nest-atmosphere";

// Beta Polish 2 — the ground the village sits ON, so houses stop looking like floating
// stickers. A rolling grass valley (re-lit by the time of day) with gentle elevation
// contours, a winding dirt road + walking paths, soft neighbourhood greens, and
// scattered trees / bushes / flowers / rocks placed organically around the houses.
// Everything is deterministic (seeded, no Math.random) so it's stable across renders.

// Deterministic 0..1 from an index — an *integer* hash (no Math.random, and no
// Math.sin: trig isn't bit-identical between the Node server and the browser, which
// caused SSR/client transform strings to differ → a hydration mismatch).
function rnd(i: number, salt = 1): number {
  let h = Math.imul(i + 1, 374761393) + Math.imul(salt, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

type Decor = { x: number; y: number; s: number; type: "tree" | "bush" | "flowers" | "rock"; seed: number };

export function VillageTerrain({ village, sky, wx }: { village: Village; sky: SkyTheme; wx: WeatherTheme }) {
  const W = village.width;
  const H = village.height;
  const horizonY = H * 0.16;
  const [far, mid, near] = sky.hills; // far = light (horizon) · near = dark (foreground)

  // Warm dirt road tints that read at any time of day (darkened by the wash on top).
  const roadFill = sky.night ? "#4a4436" : "#cbb489";
  const roadEdge = sky.night ? "#3a3529" : "#b39c72";
  const treeGreen = sky.night ? "#2c3a2f" : "#6e8a47";
  const treeShade = sky.night ? "#22302a" : "#5a7439";

  // A meandering main road down the valley + one branch (deterministic S-curves).
  const cx = village.center.x;
  const road = `M ${cx - W * 0.06} ${horizonY}
    C ${cx + W * 0.18} ${H * 0.34}, ${cx - W * 0.2} ${H * 0.55}, ${cx + W * 0.05} ${H * 0.74}
    S ${cx + W * 0.12} ${H * 1.02}, ${cx - W * 0.02} ${H * 1.08}`;
  const branch = `M ${cx + W * 0.02} ${H * 0.52} C ${cx + W * 0.24} ${H * 0.56}, ${cx + W * 0.3} ${H * 0.68}, ${cx + W * 0.42} ${H * 0.7}`;

  // Scatter greenery on a jittered grid, skipping anything too near a house or the road.
  const decor = useMemo<Decor[]>(() => {
    const out: Decor[] = [];
    const step = village.hexSize * 0.82;
    let i = 0;
    for (let gy = horizonY + step * 0.4; gy < H - step * 0.2; gy += step) {
      for (let gx = step * 0.3; gx < W; gx += step) {
        i += 1;
        const x = gx + (rnd(i, 1) - 0.5) * step * 0.8;
        const y = gy + (rnd(i, 2) - 0.5) * step * 0.8;
        if (y < horizonY + 6 || x < 6 || x > W - 6) continue;
        const nearHouse = village.houses.some((h) => Math.hypot(h.x - x, h.y - y) < village.hexSize * 0.86);
        if (nearHouse) continue;
        const r = rnd(i, 3);
        const type = r < 0.28 ? "tree" : r < 0.6 ? "bush" : r < 0.86 ? "flowers" : "rock";
        out.push({ x, y, type, s: 0.5 + (y / H) * 0.75, seed: Math.floor(rnd(i, 4) * 1e6) });
      }
    }
    return out.sort((a, b) => a.y - b.y).slice(0, 64);
  }, [village, H, horizonY, W]);

  const flowerPetals = ["#e8a23c", "#d97e57", "#ffc55c", "#c76e8a"];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="absolute inset-0" aria-hidden preserveAspectRatio="none">
      <defs>
        <linearGradient id="vt-grass" x1="0" y1={horizonY} x2="0" y2={H} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={far} />
          <stop offset="45%" stopColor={mid} />
          <stop offset="100%" stopColor={near} />
        </linearGradient>
        <radialGradient id="vt-green" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={far} stopOpacity="0.55" />
          <stop offset="100%" stopColor={far} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* grass valley below the horizon */}
      <rect x="0" y={horizonY} width={W} height={H - horizonY} fill="url(#vt-grass)" />

      {/* far hills at the horizon so the ground blends into the sky backdrop */}
      <path d={`M0 ${horizonY} Q ${W * 0.28} ${horizonY - 26} ${W * 0.52} ${horizonY - 6} T ${W} ${horizonY - 14} V ${horizonY + 40} H0 Z`} fill={far} opacity="0.9" />
      <path d={`M0 ${horizonY + 20} Q ${W * 0.4} ${horizonY - 4} ${W * 0.7} ${horizonY + 16} T ${W} ${horizonY + 10} V ${horizonY + 60} H0 Z`} fill={mid} opacity="0.7" />

      {/* rolling elevation contours (gentle rises across the valley) */}
      {[0.34, 0.5, 0.66, 0.82].map((t, k) => (
        <path
          key={t}
          d={`M0 ${H * t} Q ${W * (0.25 + rnd(k, 7) * 0.1)} ${H * t - 24 - k * 4} ${W * 0.5} ${H * t - 4} T ${W} ${H * t - 10} V ${H * (t + 0.12)} H0 Z`}
          fill={k % 2 === 0 ? mid : near}
          opacity={0.16}
        />
      ))}

      {/* soft neighbourhood greens under the house clusters */}
      {[[cx, village.center.y], [cx - W * 0.22, H * 0.42], [cx + W * 0.24, H * 0.6], [cx, H * 0.82]].map(([gx, gy], k) => (
        <ellipse key={k} cx={gx} cy={gy} rx={village.hexSize * 1.7} ry={village.hexSize * 1.15} fill="url(#vt-green)" />
      ))}

      {/* winding dirt road + a branch (edge, then lighter centre) */}
      <path d={road} fill="none" stroke={roadEdge} strokeWidth={village.hexSize * 0.42} strokeLinecap="round" opacity="0.9" />
      <path d={road} fill="none" stroke={roadFill} strokeWidth={village.hexSize * 0.3} strokeLinecap="round" />
      <path d={branch} fill="none" stroke={roadEdge} strokeWidth={village.hexSize * 0.26} strokeLinecap="round" opacity="0.85" />
      <path d={branch} fill="none" stroke={roadFill} strokeWidth={village.hexSize * 0.16} strokeLinecap="round" />

      {/* short walking paths from the road toward a few houses */}
      {village.houses.filter((h) => h.isReal).slice(0, 4).map((h) => (
        <line key={h.id} x1={h.x} y1={h.y} x2={cx + (h.x - cx) * 0.4} y2={h.y + (village.center.y - h.y) * 0.15} stroke={roadFill} strokeWidth={village.hexSize * 0.12} strokeLinecap="round" opacity="0.55" strokeDasharray={`1 ${village.hexSize * 0.14}`} />
      ))}

      {/* scattered greenery (organic, avoids houses) */}
      {decor.map((d, i) => (
        <g key={i} transform={`translate(${d.x} ${d.y}) scale(${d.s})`}>
          {/* contact shadow grounds every prop */}
          <ellipse cx="0" cy="1" rx="12" ry="3.4" fill="#241811" opacity="0.16" />
          {d.type === "tree" ? (
            <>
              <rect x="-2" y="-14" width="4" height="15" rx="2" fill={treeShade} />
              <circle cx="0" cy="-20" r="12" fill={treeGreen} />
              <circle cx="-7" cy="-15" r="8" fill={treeShade} />
              <circle cx="7" cy="-15" r="8" fill={treeGreen} />
            </>
          ) : d.type === "bush" ? (
            <>
              <circle cx="-5" cy="-4" r="6" fill={treeShade} />
              <circle cx="4" cy="-5" r="7" fill={treeGreen} />
              <circle cx="0" cy="-2" r="5" fill={treeGreen} />
            </>
          ) : d.type === "flowers" ? (
            <>
              {[-6, 0, 6].map((fx, k) => (
                <g key={fx}>
                  <rect x={fx - 0.5} y="-8" width="1" height="8" fill={treeShade} />
                  <circle cx={fx} cy="-9" r="2.4" fill={flowerPetals[(d.seed + k) % flowerPetals.length]} />
                  <circle cx={fx} cy="-9" r="0.9" fill="#fff6da" />
                </g>
              ))}
            </>
          ) : (
            <>
              <ellipse cx="0" cy="-2" rx="7" ry="4.5" fill={sky.night ? "#4a4a52" : "#a89e8c"} />
              <ellipse cx="-2" cy="-3.5" rx="3" ry="2" fill={sky.night ? "#5a5a62" : "#c2b8a4"} />
            </>
          )}
        </g>
      ))}

      {/* time-of-day + weather wash so the ground shares the sky's light */}
      {wx.overcast !== "rgba(255,255,255,0)" ? <rect x="0" y={horizonY} width={W} height={H} fill={wx.overcast} /> : null}
      <rect x="0" y={horizonY} width={W} height={H} fill={sky.wash} />
    </svg>
  );
}
