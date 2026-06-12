"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Compass, Plus } from "lucide-react";
import { bazaars, HOUSES_PER_VILLAGE } from "@/lib/data";

// ── Hex grid geometry (pointy-top, axial coordinates) ──────────
const TILE_W = 150;
const TILE_H = 173;
const COL = 150; // horizontal centre-to-centre for neighbours
const ROW = 130; // vertical centre-to-centre between rows
const BOARD_W = 760;
const BOARD_H = 720;
const BOARD_CX = 380;
const BOARD_CY = 330;

const HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

function axialToPixel(q: number, r: number) {
  return { x: BOARD_CX + COL * (q + r / 2), y: BOARD_CY + ROW * r };
}

// The six pointy-top neighbours of any hex.
const NEIGHBORS = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
] as const;

const occupied = new Set(bazaars.map((b) => `${b.hex.q},${b.hex.r}`));

// Empty plots ringing the town — they make the world feel expandable.
const frontier = (() => {
  const seen = new Set<string>();
  const cells: { q: number; r: number }[] = [];
  for (const b of bazaars) {
    for (const [dq, dr] of NEIGHBORS) {
      const q = b.hex.q + dq;
      const r = b.hex.r + dr;
      const key = `${q},${r}`;
      if (occupied.has(key) || seen.has(key)) continue;
      seen.add(key);
      cells.push({ q, r });
    }
  }
  return cells;
})();

// Roads between adjacent villages, deduped.
const roads = (() => {
  const seen = new Set<string>();
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const a of bazaars) {
    for (const b of bazaars) {
      if (a.id >= b.id) continue;
      const adjacent = NEIGHBORS.some(([dq, dr]) => a.hex.q + dq === b.hex.q && a.hex.r + dr === b.hex.r);
      if (!adjacent) continue;
      const key = [a.id, b.id].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      const pa = axialToPixel(a.hex.q, a.hex.r);
      const pb = axialToPixel(b.hex.q, b.hex.r);
      lines.push({ x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y });
    }
  }
  return lines;
})();

/** A tiny rooftop cluster standing in for a whole neighbourhood. */
function VillageMotif({ accent, lit }: { accent: string; lit: number }) {
  const roofs = [
    { x: -22, h: 20 }, { x: -2, h: 26 }, { x: 18, h: 18 },
  ];
  return (
    <svg viewBox="-40 -34 80 46" className="h-12 w-20" aria-hidden="true">
      {roofs.map((roof, i) => (
        <g key={i} transform={`translate(${roof.x} 0)`}>
          <rect x={-7} y={-roof.h} width={14} height={roof.h} rx={1.5} fill="#f3e4c4" stroke={accent} strokeOpacity={0.25} strokeWidth={0.6} />
          <polygon points={`-10,${-roof.h} 0,${-roof.h - 9} 10,${-roof.h}`} fill={accent} />
          <rect x={-2.5} y={-roof.h + 5} width={5} height={5} rx={1} fill={i < lit ? "#ffc55c" : "#cbbb9b"} />
        </g>
      ))}
    </svg>
  );
}

export function VillageWorld() {
  const viewport = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    // Centre on the cluster of villages, not the frontier-padded board, so the
    // top row clears the cartouche and empty plots stay at the edges.
    const ys = bazaars.map((b) => axialToPixel(b.hex.q, b.hex.r).y);
    const xs = bazaars.map((b) => axialToPixel(b.hex.q, b.hex.r).x);
    const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
    element.scrollLeft = Math.max(0, midX - element.clientWidth / 2);
    element.scrollTop = Math.max(0, midY - element.clientHeight / 2 + 40);
  }, []);

  return (
    <section className="map-meadow relative h-[calc(100dvh-3.5rem)] min-h-[640px] overflow-hidden">
      <div ref={viewport} className="hide-scrollbar size-full overflow-auto">
        <div className="relative mx-auto" style={{ width: BOARD_W, height: BOARD_H }}>
          {/* Roads between adjacent districts */}
          <svg className="pointer-events-none absolute inset-0" width={BOARD_W} height={BOARD_H} viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} aria-hidden="true">
            {roads.map((road, i) => (
              <g key={i}>
                <line x1={road.x1} y1={road.y1} x2={road.x2} y2={road.y2} stroke="#dcc290" strokeWidth={12} strokeLinecap="round" />
                <line x1={road.x1} y1={road.y1} x2={road.x2} y2={road.y2} stroke="#fffceb" strokeWidth={2} strokeLinecap="round" strokeDasharray="2 7" opacity={0.8} />
              </g>
            ))}
          </svg>

          {/* Frontier plots — the world keeps room to grow */}
          {frontier.map(({ q, r }) => {
            const { x, y } = axialToPixel(q, r);
            return (
              <div
                key={`f-${q}-${r}`}
                className="absolute grid place-items-center"
                style={{ left: x - TILE_W / 2, top: y - TILE_H / 2, width: TILE_W, height: TILE_H, clipPath: HEX_CLIP, background: "rgba(255,252,235,.28)" }}
                aria-hidden="true"
              >
                <span className="grid size-7 place-items-center rounded-full border border-dashed border-[#9c895f]/50 text-[#9c895f]/60">
                  <Plus size={14} />
                </span>
              </div>
            );
          })}

          {/* Village districts */}
          {bazaars.map((village) => {
            const { x, y } = axialToPixel(village.hex.q, village.hex.r);
            const open = HOUSES_PER_VILLAGE - village.claimed;
            return (
              <Link
                key={village.id}
                href={`/bazaar/${village.slug}`}
                className="group absolute block transition-transform duration-300 hover:z-20 hover:-translate-y-1.5 focus-visible:outline-none"
                style={{ left: x - TILE_W / 2, top: y - TILE_H / 2, width: TILE_W, height: TILE_H }}
                aria-label={`Enter ${village.name}, ${open} open houses`}
              >
                {/* Accent ring + soft fill, both hex-clipped */}
                <span className="absolute inset-0 shadow-[0_12px_30px_rgba(70,54,90,.22)] transition group-hover:shadow-[0_18px_40px_rgba(70,54,90,.3)]" style={{ clipPath: HEX_CLIP, background: village.accent }} />
                <span className="absolute inset-[5px]" style={{ clipPath: HEX_CLIP, background: `radial-gradient(circle at 50% 32%, ${village.soft} 0%, #e8dcbf 95%)` }} />
                <span className="absolute inset-[5px] opacity-0 transition group-focus-visible:opacity-100 group-hover:opacity-100" style={{ clipPath: HEX_CLIP, background: "rgba(255,255,255,.16)" }} />

                <span className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
                  <VillageMotif accent={village.accent} lit={Math.min(3, Math.round((village.claimed / HOUSES_PER_VILLAGE) * 3) + 1)} />
                  <span className="display mt-1 text-base leading-none drop-shadow-[0_1px_0_rgba(255,255,255,.7)]">{village.name}</span>
                  <span className="mt-1 rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.12em]" style={{ color: village.accent }}>
                    {open} open
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Cartouche */}
      <div className="pointer-events-none absolute left-4 top-4 z-30 max-w-[225px] rounded-3xl border border-white/60 bg-[#fff8e9]/85 p-4 shadow-lg backdrop-blur md:left-8 md:top-7 md:max-w-xs">
        <p className="eyebrow text-terracotta">The district map</p>
        <h1 className="display mt-1 text-3xl leading-none md:text-4xl">Ten districts. One growing world.</h1>
        <p className="mt-2 hidden text-xs leading-relaxed text-ink/55 md:block">Each hex is a village. Step into one, walk its circular street, and claim a little house. The frontier has room to grow.</p>
      </div>

      <div className="absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2.5 rounded-full border border-white/60 bg-[#fff9ec]/85 px-4 py-2 text-xs font-bold text-ink/55 shadow-lg backdrop-blur">
        <Compass size={15} className="text-teal" /> Drag to roam — tap a hex to enter that village
      </div>
    </section>
  );
}
