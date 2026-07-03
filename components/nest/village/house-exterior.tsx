"use client";

import { useId } from "react";
import type { House, HouseStyle } from "@/lib/nest-house";

// M19 — a cozy, miniature, front-facing house drawn as SVG. Storybook, not metaverse:
// warm walls, a glowing window, a little garden, a wisp of smoke when someone's home.
// Every variation (window count, chimney, tree side, roof shape) is derived from the
// House seed, so a given creator always gets the *same* house — hydration-safe, no
// Math.random. Scales to fill its container; used both as a village node and, larger,
// as the house you arrive at.

type Bits = {
  windowCount: 1 | 2;
  chimney: boolean;
  treeSide: -1 | 1;
  gable: boolean;
  roundWindows: boolean;
};

function bitsFromSeed(seed: number): Bits {
  return {
    windowCount: ((seed % 2) + 1) as 1 | 2,
    chimney: ((seed >> 1) & 1) === 0,
    treeSide: ((seed >> 2) & 1) === 0 ? -1 : 1,
    gable: ((seed >> 3) & 1) === 0,
    roundWindows: ((seed >> 4) & 1) === 0,
  };
}

export function HouseExterior({
  house,
  className = "",
  interactive = false,
}: {
  house: Pick<House, "style" | "seed" | "online">;
  className?: string;
  /** Adds hover lift + pointer cursor (village nodes). */
  interactive?: boolean;
}) {
  const s = house.style;
  const bits = bitsFromSeed(house.seed);
  const uid = useId().replace(/:/g, "");
  const lit = house.online;

  const windowFill = lit ? s.glow : "#efe4c8";
  const smoke = lit && bits.chimney;

  return (
    <svg
      viewBox="0 0 120 120"
      className={`${className} ${interactive ? "cursor-pointer transition-transform duration-300 will-change-transform group-hover:-translate-y-1.5 group-active:translate-y-0" : ""}`}
      role="img"
      aria-hidden
    >
      <defs>
        <radialGradient id={`glow-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={s.glow} stopOpacity={lit ? 0.9 : 0} />
          <stop offset="100%" stopColor={s.glow} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* garden patch */}
      <ellipse cx="60" cy="106" rx="46" ry="10" fill={s.ground} />
      <ellipse cx="60" cy="104" rx="46" ry="9" fill={s.ground} opacity="0.65" />

      {/* tree / bush on one side */}
      <Tree x={bits.treeSide === -1 ? 16 : 104} style={s} />

      {/* warm glow spilling onto the ground when someone's home */}
      {lit ? <ellipse cx="60" cy="99" rx="34" ry="12" fill={`url(#glow-${uid})`} /> : null}

      {/* chimney + smoke (behind the roof) */}
      {bits.chimney ? (
        <>
          <rect x="76" y="30" width="9" height="18" rx="1.5" fill={s.roofShade} />
          {smoke ? (
            <g className="nest-smoke" style={{ transformOrigin: "80px 30px" }}>
              <circle cx="80" cy="24" r="3" fill="#fff" opacity="0.5" />
              <circle cx="83" cy="18" r="2.4" fill="#fff" opacity="0.35" />
              <circle cx="80" cy="13" r="1.9" fill="#fff" opacity="0.22" />
            </g>
          ) : null}
        </>
      ) : null}

      {/* body — front face + a shaded side sliver for shallow depth */}
      <rect x="30" y="52" width="60" height="46" rx="3" fill={s.wall} />
      <path d="M90 52 l8 5 v41 l-8 -4 Z" fill={s.wallShade} />

      {/* roof */}
      {bits.gable ? (
        <path d="M24 54 L60 30 L96 54 Z" fill={s.roof} />
      ) : (
        <path d="M26 54 L40 34 H80 L94 54 Z" fill={s.roof} />
      )}
      <path d="M96 54 L60 30 L60 34 L92 55 Z" fill={s.roofShade} opacity="0.85" />

      {/* door with a warm threshold when lit */}
      <rect x="53" y="72" width="14" height="26" rx="6" fill={s.door} />
      <rect x="53" y="72" width="14" height="26" rx="6" fill="none" stroke={s.trim} strokeWidth="1.4" opacity="0.5" />
      <circle cx="63.5" cy="86" r="1.3" fill={s.glow} />
      {lit ? <rect x="55" y="94" width="10" height="4" rx="2" fill={s.glow} opacity="0.6" /> : null}

      {/* windows */}
      {bits.windowCount === 2 ? (
        <>
          <Window x={38} y={62} fill={windowFill} trim={s.trim} round={bits.roundWindows} lit={lit} />
          <Window x={71} y={62} fill={windowFill} trim={s.trim} round={bits.roundWindows} lit={lit} />
        </>
      ) : (
        <Window x={71} y={62} fill={windowFill} trim={s.trim} round={bits.roundWindows} lit={lit} big />
      )}

      {/* stepping-stone path to the door */}
      <ellipse cx="60" cy="101" rx="5" ry="1.8" fill={s.wallShade} opacity="0.6" />
      <ellipse cx="60" cy="105" rx="6.5" ry="2" fill={s.wallShade} opacity="0.45" />
    </svg>
  );
}

function Window({ x, y, fill, trim, round, lit, big }: { x: number; y: number; fill: string; trim: string; round: boolean; lit: boolean; big?: boolean }) {
  const w = big ? 14 : 11;
  const h = big ? 13 : 11;
  const cx = x + w / 2;
  const cls = lit ? "nest-window-lit" : "";
  return (
    <g className={cls}>
      {round ? (
        <path d={`M${x} ${y + h} v-${h - 5} a${w / 2} ${w / 2} 0 0 1 ${w} 0 v${h - 5} Z`} fill={fill} stroke={trim} strokeWidth="1.6" />
      ) : (
        <rect x={x} y={y} width={w} height={h} rx="1.5" fill={fill} stroke={trim} strokeWidth="1.6" />
      )}
      <line x1={cx} y1={y + (round ? 1 : 0.5)} x2={cx} y2={y + h} stroke={trim} strokeWidth="1.1" />
      <line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} stroke={trim} strokeWidth="1.1" />
    </g>
  );
}

function Tree({ x, style }: { x: number; style: HouseStyle }) {
  return (
    <g>
      <rect x={x - 1.4} y={82} width="2.8" height="16" rx="1.4" fill={style.trim} opacity="0.8" />
      <circle cx={x} cy={80} r="10" fill={style.ground} />
      <circle cx={x - 5} cy={84} r="7" fill={style.ground} opacity="0.85" />
      <circle cx={x + 5} cy={84} r="7" fill={style.ground} opacity="0.85" />
    </g>
  );
}
