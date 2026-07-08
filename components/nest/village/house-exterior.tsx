"use client";

import { useId } from "react";
import { houseFeatures, type DoorType, type GardenDecor, type House, type HouseStyle, type WindowShape } from "@/lib/nest-house";

// M19.1 — a cozy, front-facing house drawn as SVG, now with its own identity (roof
// shape · window shape · door type · garden · mailbox) and alive with the time of day
// (windows glow stronger at night, smoke when someone's home, a tree that sways).
// Every variation is derived from the House seed — same creator ⇒ same home, forever;
// no Math.random → hydration-safe. Scales to fill its container.

export function HouseExterior({
  house,
  className = "",
  interactive = false,
  glow = 0.5,
  night = false,
}: {
  house: Pick<House, "style" | "seed" | "online">;
  className?: string;
  /** Adds hover lift + pointer cursor (village nodes). */
  interactive?: boolean;
  /** Window/lantern glow strength (0–1.2), from the sky theme. */
  glow?: number;
  /** Night boosts the glow and lights even "out" houses' porch light. */
  night?: boolean;
}) {
  const s = house.style;
  const f = houseFeatures(house.seed);
  const uid = useId().replace(/:/g, "");
  const lit = house.online || night;
  const g = Math.min(1.2, glow + (house.online ? 0.2 : 0));

  const windowFill = lit ? s.glow : "#efe4c8";
  const smoke = house.online && f.chimney;

  return (
    <svg
      viewBox="0 0 120 120"
      className={`${className} ${interactive ? "cursor-pointer transition-transform duration-300 will-change-transform group-hover:-translate-y-1.5 group-active:translate-y-0" : ""}`}
      role="img"
      aria-hidden
    >
      <defs>
        <radialGradient id={`glow-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={s.glow} stopOpacity={lit ? 0.6 + g * 0.4 : 0} />
          <stop offset="100%" stopColor={s.glow} stopOpacity="0" />
        </radialGradient>
        <filter id={`sh-${uid}`} x="-20%" y="-40%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>

      {/* soft contact shadow so the house sits ON the ground, not floating */}
      <ellipse cx="61" cy="108" rx="43" ry="7" fill="#241811" opacity="0.17" filter={`url(#sh-${uid})`} />

      {/* garden patch */}
      <ellipse cx="60" cy="106" rx="46" ry="10" fill={s.ground} />
      <ellipse cx="60" cy="104" rx="46" ry="9" fill={s.ground} opacity="0.65" />

      {/* tree (sways) + mailbox flank the house */}
      <g className="nest-sway" style={{ transformOrigin: `${f.treeSide === -1 ? 16 : 104}px 98px` }}>
        <Tree x={f.treeSide === -1 ? 16 : 104} style={s} />
      </g>
      {f.mailbox ? <Mailbox x={f.treeSide === -1 ? 100 : 20} style={s} lit={lit} /> : null}

      {/* warm glow spilling onto the ground when lit */}
      {lit ? <ellipse cx="60" cy="99" rx="34" ry="12" fill={`url(#glow-${uid})`} /> : null}

      {/* chimney + smoke (behind the roof) */}
      {f.chimney ? (
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
      {f.roof === "gable" ? (
        <path d="M24 54 L60 30 L96 54 Z" fill={s.roof} />
      ) : (
        <path d="M26 54 L40 34 H80 L94 54 Z" fill={s.roof} />
      )}
      <path d="M96 54 L60 30 L60 34 L92 55 Z" fill={s.roofShade} opacity="0.85" />

      {/* door + optional porch awning */}
      <Door type={f.door} style={s} lit={lit} />
      {f.porch ? <Porch style={s} /> : null}

      {/* windows */}
      {f.windowCount === 2 ? (
        <>
          <Window x={38} y={62} fill={windowFill} trim={s.trim} shape={f.windowShape} lit={lit} />
          <Window x={71} y={62} fill={windowFill} trim={s.trim} shape={f.windowShape} lit={lit} />
        </>
      ) : (
        <Window x={71} y={62} fill={windowFill} trim={s.trim} shape={f.windowShape} lit={lit} big />
      )}

      {/* garden decoration */}
      <Garden decor={f.garden} style={s} lit={lit} />

      {/* a little front fence / hedge (frontmost) */}
      {f.fence !== "none" ? <Fence kind={f.fence} style={s} /> : null}
    </svg>
  );
}

function Porch({ style }: { style: HouseStyle }) {
  return (
    <g>
      <rect x="47" y="65" width="26" height="4" rx="1.5" fill={style.roofShade} />
      <rect x="47" y="64" width="26" height="2" rx="1" fill={style.roof} />
      <rect x="48.5" y="69" width="2" height="29" rx="1" fill={style.trim} opacity="0.7" />
      <rect x="69.5" y="69" width="2" height="29" rx="1" fill={style.trim} opacity="0.7" />
    </g>
  );
}

function Fence({ kind, style }: { kind: "picket" | "hedge" | "stone"; style: HouseStyle }) {
  const xs = [22, 30, 38, 82, 90, 98]; // skip the centre so the path/door stays open
  if (kind === "hedge") {
    return (
      <g>
        {[20, 30, 40, 80, 90, 100].map((x) => (
          <circle key={x} cx={x} cy={100} r="4.5" fill={style.ground} />
        ))}
      </g>
    );
  }
  if (kind === "stone") {
    return (
      <g>
        {xs.map((x) => (
          <rect key={x} x={x - 3} y={98} width="6" height="5" rx="1.5" fill="#b7a888" stroke="#9c8d6d" strokeWidth="0.5" />
        ))}
      </g>
    );
  }
  // picket
  return (
    <g>
      <line x1="18" y1="100" x2="42" y2="100" stroke={style.trim} strokeWidth="1.4" opacity="0.75" />
      <line x1="78" y1="100" x2="102" y2="100" stroke={style.trim} strokeWidth="1.4" opacity="0.75" />
      {[20, 26, 32, 38, 80, 86, 92, 98].map((x) => (
        <rect key={x} x={x - 1} y={96} width="2" height="8" rx="1" fill="#efe6cf" stroke={style.trim} strokeWidth="0.5" />
      ))}
    </g>
  );
}

function Door({ type, style, lit }: { type: DoorType; style: HouseStyle; lit: boolean }) {
  const common = { fill: style.door } as const;
  const path =
    type === "arch"
      ? "M53 98 v-16 a7 7 0 0 1 14 0 v16 Z"
      : type === "square"
        ? "M54 72 h12 v26 h-12 Z"
        : "M53 78 a7 7 0 0 1 14 0 v20 h-14 Z"; // round
  return (
    <>
      <path d={path} {...common} />
      <path d={path} fill="none" stroke={style.trim} strokeWidth="1.4" opacity="0.5" />
      <circle cx="64" cy="86" r="1.3" fill={style.glow} />
      {lit ? <rect x="55" y="94" width="10" height="4" rx="2" fill={style.glow} opacity="0.6" /> : null}
    </>
  );
}

function Window({ x, y, fill, trim, shape, lit, big }: { x: number; y: number; fill: string; trim: string; shape: WindowShape; lit: boolean; big?: boolean }) {
  const w = big ? 14 : 11;
  const h = big ? 13 : 11;
  const cx = x + w / 2;
  const cls = lit ? "nest-window-lit" : "";
  return (
    <g className={cls}>
      {shape === "round" ? (
        <path d={`M${x} ${y + h} v-${h - 5} a${w / 2} ${w / 2} 0 0 1 ${w} 0 v${h - 5} Z`} fill={fill} stroke={trim} strokeWidth="1.6" />
      ) : shape === "arch" ? (
        <path d={`M${x} ${y + h} v-${h - 3} q0 -${w * 0.7} ${w / 2} -${w * 0.7} q${w / 2} 0 ${w / 2} ${w * 0.7} v${h - 3} Z`} fill={fill} stroke={trim} strokeWidth="1.6" />
      ) : (
        <rect x={x} y={y} width={w} height={h} rx="1.5" fill={fill} stroke={trim} strokeWidth="1.6" />
      )}
      <line x1={cx} y1={y + 0.5} x2={cx} y2={y + h} stroke={trim} strokeWidth="1.1" />
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

function Mailbox({ x, style, lit }: { x: number; style: HouseStyle; lit: boolean }) {
  return (
    <g>
      <rect x={x - 0.8} y={90} width="1.6" height="9" rx="0.8" fill={style.trim} opacity="0.85" />
      <rect x={x - 4} y={86} width="8" height="5.5" rx="2.2" fill={style.roof} />
      <rect x={x - 4} y={86} width="8" height="5.5" rx="2.2" fill="none" stroke={style.trim} strokeWidth="0.8" opacity="0.6" />
      {lit ? <circle cx={x + 2.4} cy={88.8} r="0.9" fill={style.glow} /> : null}
    </g>
  );
}

function Garden({ decor, style, lit }: { decor: GardenDecor; style: HouseStyle; lit: boolean }) {
  if (decor === "flowers") {
    const spots = [46, 52, 70, 76];
    const petals = [style.glow, "#e08f3f", "#d97e57", style.roof];
    return (
      <g>
        {spots.map((sx, i) => (
          <g key={sx}>
            <rect x={sx - 0.5} y={97} width="1" height="4" fill={style.ground} />
            <circle cx={sx} cy={96} r="1.8" fill={petals[i % petals.length]} />
            <circle cx={sx} cy={96} r="0.7" fill="#fff6da" />
          </g>
        ))}
      </g>
    );
  }
  if (decor === "bush") {
    return (
      <g>
        <circle cx="46" cy="98" r="4" fill={style.ground} />
        <circle cx="50" cy="99" r="3.2" fill={style.ground} opacity="0.85" />
        <circle cx="74" cy="98" r="3.6" fill={style.ground} />
      </g>
    );
  }
  if (decor === "lantern") {
    return (
      <g>
        <rect x="45.2" y="90" width="1.6" height="10" rx="0.8" fill={style.trim} opacity="0.85" />
        <circle cx="46" cy="89" r="2.6" fill={lit ? style.glow : "#efe4c8"} stroke={style.trim} strokeWidth="0.7" className={lit ? "nest-window-lit" : ""} />
        {lit ? <circle cx="46" cy="89" r="5" fill={style.glow} opacity="0.28" /> : null}
      </g>
    );
  }
  // path — stepping stones up to the door
  return (
    <g>
      <ellipse cx="60" cy="101" rx="5" ry="1.8" fill={style.wallShade} opacity="0.6" />
      <ellipse cx="60" cy="105" rx="6.5" ry="2" fill={style.wallShade} opacity="0.45" />
      <ellipse cx="54" cy="103" rx="2.6" ry="1.2" fill={style.wallShade} opacity="0.4" />
      <ellipse cx="66" cy="103" rx="2.6" ry="1.2" fill={style.wallShade} opacity="0.4" />
    </g>
  );
}
