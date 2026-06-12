import { deriveHouseSpec, mixHex, shade, tint, type HouseLod, type HouseSpec, type HouseState } from "./spec";

/**
 * One house, three levels of detail, drawn with a single light source
 * (sun top-left, cool plum shadows bottom-right). Pure function of its
 * props — safe in server and client components.
 *
 * ViewBox is 240×300; the building sits on a ground line at y=270 and is
 * horizontally centred, so consumers only need to size and position the svg.
 */

const CX = 120;
const BASE = 270;
const OVERHANG = 14;

type HouseProps = {
  seed: string;
  accent?: string;
  state?: HouseState;
  lod?: HouseLod;
  name?: string;
  className?: string;
};

function Roof({ spec, detail }: { spec: HouseSpec; detail: number }) {
  const { wallW, wallH, roof, colors } = spec;
  const x1 = CX - wallW / 2 - OVERHANG;
  const x2 = CX + wallW / 2 + OVERHANG;
  const wallTop = BASE - wallH;
  const roofH = Math.min(100, Math.max(64, wallH * 0.85));
  const apexY = wallTop - roofH;

  if (roof === "round") {
    const rx = (x2 - x1) / 2;
    const ry = roofH * 0.82;
    return (
      <g>
        <path d={`M ${x1} ${wallTop} A ${rx} ${ry} 0 0 1 ${x2} ${wallTop} Z`} fill={colors.roof} />
        {/* Soft shading wraps around the dome instead of a hard seam */}
        <path d={`M ${x1} ${wallTop} A ${rx} ${ry} 0 0 1 ${x2} ${wallTop} Z`} fill="url(#lh-domeshade)" />
        {/* Ridge highlight along the lit side */}
        <path d={`M ${x1 + 10} ${wallTop - ry * 0.45} A ${rx * 0.82} ${ry * 0.86} 0 0 1 ${CX + rx * 0.3} ${wallTop - ry * 0.94}`} fill="none" stroke={colors.roofRidge} strokeWidth={3} strokeLinecap="round" opacity={0.7} />
        {detail >= 1 && (
          <path d={`M ${x1 + 14} ${wallTop - 6} A ${rx * 0.86} ${ry * 0.8} 0 0 1 ${x2 - 14} ${wallTop - 6}`} fill="none" stroke={colors.roofShade} strokeWidth={1.4} opacity={0.5} />
        )}
        <rect x={x1} y={wallTop - 3} width={x2 - x1} height={6} rx={3} fill={shade(colors.roof, 0.3)} />
      </g>
    );
  }

  if (roof === "hip" || roof === "dutch") {
    const r = wallW * (roof === "hip" ? 0.16 : 0.22);
    const topY = roof === "hip" ? apexY : wallTop - roofH * 0.55;
    return (
      <g>
        <polygon points={`${x1},${wallTop} ${CX - r},${topY} ${CX},${topY} ${CX},${wallTop}`} fill={colors.roof} />
        <polygon points={`${CX},${topY} ${CX + r},${topY} ${x2},${wallTop} ${CX},${wallTop}`} fill={colors.roofShade} />
        {roof === "dutch" && (
          <>
            <polygon points={`${CX - r - 5},${topY + 1} ${CX},${apexY} ${CX},${topY + 1}`} fill={tint(colors.roof, 0.12)} />
            <polygon points={`${CX},${apexY} ${CX + r + 5},${topY + 1} ${CX},${topY + 1}`} fill={shade(colors.roofShade, 0.08)} />
          </>
        )}
        <line x1={CX - r} y1={topY - 1} x2={CX + r} y2={topY - 1} stroke={colors.roofRidge} strokeWidth={3} strokeLinecap="round" opacity={0.75} />
        {detail >= 1 && (
          <line x1={(x1 + CX - r) / 2 + 4} y1={(wallTop + topY) / 2} x2={CX + (x2 - CX) * 0.55} y2={(wallTop + topY) / 2} stroke={colors.roofShade} strokeWidth={1.4} opacity={0.45} />
        )}
        <rect x={x1} y={wallTop - 3} width={x2 - x1} height={6} rx={3} fill={shade(colors.roof, 0.3)} />
      </g>
    );
  }

  // Gable — lit left slope, shaded right slope, highlight on the lit edge
  return (
    <g>
      <polygon points={`${x1},${wallTop} ${CX},${apexY} ${CX},${wallTop}`} fill={colors.roof} />
      <polygon points={`${CX},${apexY} ${x2},${wallTop} ${CX},${wallTop}`} fill={colors.roofShade} />
      <line x1={x1 + 3} y1={wallTop - 2} x2={CX} y2={apexY - 1} stroke={colors.roofRidge} strokeWidth={3} strokeLinecap="round" opacity={0.75} />
      {detail >= 1 && (
        <>
          {/* Texture chords stay inside the triangle: width tracks height fraction */}
          <line x1={CX - (CX - x1) * 0.42} y1={apexY + roofH * 0.45} x2={CX + (x2 - CX) * 0.42} y2={apexY + roofH * 0.45} stroke={shade(colors.roof, 0.22)} strokeWidth={1.4} opacity={0.5} />
          <line x1={CX - (CX - x1) * 0.7} y1={apexY + roofH * 0.75} x2={CX + (x2 - CX) * 0.7} y2={apexY + roofH * 0.75} stroke={shade(colors.roof, 0.22)} strokeWidth={1.4} opacity={0.5} />
        </>
      )}
      <rect x={x1} y={wallTop - 3} width={x2 - x1} height={6} rx={3} fill={shade(colors.roof, 0.3)} />
    </g>
  );
}

function Chimney({ spec, lit, detail }: { spec: HouseSpec; lit: boolean; detail: number }) {
  const { wallW, wallH, chimney } = spec;
  if (chimney === "none" || spec.roof === "round") return null;
  const wallTop = BASE - wallH;
  const roofH = Math.min(100, Math.max(64, wallH * 0.85));
  const cx = chimney === "left" ? CX - wallW * 0.26 : CX + wallW * 0.26;
  // Roof surface height at the chimney's x position
  const f = Math.abs(cx - CX) / (wallW / 2 + OVERHANG);
  const surfaceY = spec.roof === "gable" ? wallTop - roofH * (1 - f) : wallTop - roofH * 0.72;
  return (
    <g>
      <rect x={cx - 7} y={surfaceY - 24} width={14} height={30} fill={shade("#9c6f50", 0.12)} />
      <rect x={cx - 9} y={surfaceY - 29} width={18} height={6} rx={1.5} fill={shade("#9c6f50", 0.3)} />
      {lit && detail >= 1 && (
        <g>
          <circle className="h-smoke" cx={cx} cy={surfaceY - 36} r={5} fill="#fff" opacity={0.5} />
          <circle className="h-smoke" cx={cx + 3} cy={surfaceY - 38} r={4} fill="#e8e0d4" opacity={0.45} />
          <circle className="h-smoke" cx={cx - 3} cy={surfaceY - 34} r={3.4} fill="#fff" opacity={0.4} />
        </g>
      )}
    </g>
  );
}

function Window({ spec, cx, cy, lit, detail, small = false }: { spec: HouseSpec; cx: number; cy: number; lit: boolean; detail: number; small?: boolean }) {
  const { colors, windowShape, shutters } = spec;
  const round = windowShape === "round";
  const w = small ? 18 : round ? 26 : 26;
  const h = small ? 20 : round ? 26 : 32;
  const rx = windowShape === "arched" ? w / 2 : windowShape === "round" ? w / 2 + 3 : 3;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const glass = lit ? "url(#lh-glow)" : "url(#lh-glass)";
  return (
    <g>
      {lit && detail >= 1 && <ellipse className="h-bloom" cx={cx} cy={cy} rx={w * 1.7} ry={h * 1.3} fill="url(#lh-bloom)" />}
      <rect x={x - 3.5} y={y - 3.5} width={w + 7} height={h + 7} rx={rx} fill={colors.trim} />
      <rect x={x} y={y} width={w} height={h} rx={Math.max(0, rx - 3)} fill={glass} />
      <line x1={cx} y1={y + 2} x2={cx} y2={y + h - 2} stroke="#fff" strokeWidth={1.2} opacity={0.55} />
      <line x1={x + 2} y1={cy} x2={x + w - 2} y2={cy} stroke="#fff" strokeWidth={1.2} opacity={0.55} />
      {!round && <rect x={x - 6} y={y + h + 3.5} width={w + 12} height={4} rx={2} fill={colors.trimDark} opacity={0.85} />}
      {detail >= 2 && shutters && !small && (
        <>
          <rect x={x - 14} y={y - 1} width={9} height={h + 2} rx={2} fill={colors.shutter} />
          <rect x={x + w + 5} y={y - 1} width={9} height={h + 2} rx={2} fill={colors.shutter} />
        </>
      )}
    </g>
  );
}

function Lantern({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <line x1={x} y1={y - 12} x2={x} y2={y - 5} stroke="#5c3e26" strokeWidth={2} />
      <circle cx={x} cy={y} r={10} fill="url(#lh-bloom)" />
      <circle cx={x} cy={y} r={4.5} fill="url(#lh-glow)" stroke="#8a6a30" strokeWidth={1.4} />
    </g>
  );
}

function Door({ spec, state, detail }: { spec: HouseSpec; state: HouseState; detail: number }) {
  const { wallW, wallH, door, colors } = spec;
  const doorH = Math.max(44, wallH * 0.56);
  const doorCx = CX + wallW * 0.24;
  const bottom = BASE - 4;

  if (door === "round") {
    const r = doorH * 0.46;
    const cy = bottom - r;
    return (
      <g>
        {state === "open" && detail >= 1 && <circle className="h-doorglow" cx={doorCx} cy={cy} r={r + 10} fill="url(#lh-bloom)" />}
        <circle cx={doorCx} cy={cy} r={r + 5} fill={shade(colors.wall, 0.3)} />
        <circle cx={doorCx} cy={cy} r={r + 3} fill={colors.trimDark} />
        <circle cx={doorCx} cy={cy} r={r} fill={colors.door} />
        <circle cx={doorCx} cy={cy} r={r * 0.45} fill="none" stroke={shade(colors.door, 0.2)} strokeWidth={1.5} opacity={0.6} />
        <circle cx={doorCx} cy={cy} r={2.6} fill="#e8c06a" />
        <rect x={doorCx - r - 8} y={bottom} width={2 * r + 16} height={5} rx={2.5} fill="#a18b6b" />
        {state === "owned" && detail >= 1 && <Lantern x={doorCx - r - 13} y={cy - r * 0.3} />}
      </g>
    );
  }

  const doorW = doorH * 0.6;
  const top = bottom - doorH;
  // Three nested arches: recess shadow → timber frame → door leaf
  const arch = (inset: number) => {
    const x = doorCx - doorW / 2 + inset;
    const w = doorW - inset * 2;
    const r = door === "arched" ? w / 2 : Math.max(2, 4 - inset);
    const t = top + inset;
    return `M ${x} ${bottom} L ${x} ${t + r} A ${r} ${r} 0 0 1 ${x + w} ${t + r} L ${x + w} ${bottom} Z`;
  };
  const dx = doorCx - doorW / 2;
  return (
    <g>
      {state === "open" && detail >= 1 && <ellipse className="h-doorglow" cx={doorCx} cy={bottom - doorH / 2} rx={doorW + 14} ry={doorH * 0.8} fill="url(#lh-bloom)" />}
      <path d={arch(-5)} fill={shade(colors.wall, 0.3)} />
      <path d={arch(-2)} fill={colors.trimDark} />
      <path d={arch(2)} fill={colors.door} />
      {door === "plank" && detail >= 1 && (
        <>
          <line x1={doorCx - doorW * 0.18} y1={top + 8} x2={doorCx - doorW * 0.18} y2={bottom - 4} stroke={shade(colors.door, 0.25)} strokeWidth={1.3} opacity={0.7} />
          <line x1={doorCx + doorW * 0.18} y1={top + 8} x2={doorCx + doorW * 0.18} y2={bottom - 4} stroke={shade(colors.door, 0.25)} strokeWidth={1.3} opacity={0.7} />
        </>
      )}
      <circle cx={doorCx + doorW * 0.26} cy={bottom - doorH * 0.42} r={2.4} fill="#e8c06a" />
      <rect x={dx - 9} y={bottom} width={doorW + 18} height={5} rx={2.5} fill="#a18b6b" />
      {state === "owned" && detail >= 1 && <Lantern x={dx - 13} y={top + doorH * 0.3} />}
    </g>
  );
}

export function House({ seed, accent = "#a65b3f", state = "open", lod = "street", name, className }: HouseProps) {
  const spec = deriveHouseSpec(seed, accent);
  const detail = lod === "street" ? 2 : lod === "card" ? 1 : 0;
  const lit = state === "lived" || state === "owned";
  const { wallW, wallH, colors } = spec;
  const wallX = CX - wallW / 2;
  const wallTop = BASE - wallH;
  // Unclaimed houses sit quietly: plaster muted toward stone
  const wall = state === "open" ? mixHex(colors.wall, "#c7b393", 0.4) : colors.wall;
  const twoRows = wallH > 90;
  const roofH = Math.min(100, Math.max(64, wallH * 0.85));

  return (
    <svg viewBox="0 0 240 300" className={className} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="lh-glow" cx="50%" cy="42%" r="65%">
          <stop offset="0%" stopColor="#ffe2a0" />
          <stop offset="100%" stopColor="#f0a94e" />
        </radialGradient>
        <linearGradient id="lh-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c8d8de" />
          <stop offset="100%" stopColor="#93aab4" />
        </linearGradient>
        <radialGradient id="lh-bloom">
          <stop offset="0%" stopColor="#ffc55c" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ffc55c" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="lh-shadow">
          <stop offset="0%" stopColor="#46365a" stopOpacity="0.3" />
          <stop offset="70%" stopColor="#46365a" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#46365a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lh-eave" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#46365a" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#46365a" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lh-domeshade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff6e0" stopOpacity="0.16" />
          <stop offset="45%" stopColor="#46365a" stopOpacity="0" />
          <stop offset="100%" stopColor="#46365a" stopOpacity="0.32" />
        </linearGradient>
      </defs>

      {/* Contact shadow grounds the building */}
      <ellipse cx={CX + 6} cy={BASE + 8} rx={wallW / 2 + OVERHANG + 10} ry={11} fill="url(#lh-shadow)" />

      {/* Wall: lit face + shaded right edge + eaves shadow */}
      <rect x={wallX} y={wallTop} width={wallW} height={wallH} fill={wall} />
      <rect x={wallX + wallW * 0.8} y={wallTop} width={wallW * 0.2} height={wallH} fill={spec.colors.wallShade} opacity={state === "open" ? 0.5 : 1} />
      <rect x={wallX} y={wallTop} width={wallW} height={10} fill="url(#lh-eave)" />

      {/* Stone plinth */}
      {detail >= 1 && <rect x={wallX - 3} y={BASE - 9} width={wallW + 6} height={11} rx={2} fill="#b3a284" />}

      {/* Half-timber beams on pale walls */}
      {detail >= 2 && spec.halfTimber && (
        <g stroke={colors.trimDark} strokeWidth={3.5} opacity={0.35} strokeLinecap="round">
          <line x1={CX - wallW * 0.34} y1={wallTop + 8} x2={CX - wallW * 0.34} y2={BASE - 10} />
          <line x1={CX + wallW * 0.05} y1={wallTop + 8} x2={CX + wallW * 0.05} y2={BASE - 10} />
          <line x1={wallX + 4} y1={wallTop + wallH * 0.42} x2={wallX + wallW - 4} y2={wallTop + wallH * 0.42} />
        </g>
      )}

      <Roof spec={spec} detail={detail} />
      {detail >= 1 && <Chimney spec={spec} lit={lit} detail={detail} />}

      {/* Dormer window poking out of the roof */}
      {detail >= 2 && spec.dormer && (
        <g>
          <rect x={CX - 17} y={wallTop - roofH * 0.46} width={34} height={28} fill={wall} />
          <polygon points={`${CX - 21},${wallTop - roofH * 0.46} ${CX},${wallTop - roofH * 0.46 - 16} ${CX + 21},${wallTop - roofH * 0.46}`} fill={colors.roofShade} />
          <Window spec={spec} cx={CX} cy={wallTop - roofH * 0.46 + 14} lit={lit} detail={1} small />
        </g>
      )}

      {/* Windows: door sits right of centre, windows balance left/top */}
      {lod === "map" ? (
        <rect x={CX - 8} y={wallTop + wallH * 0.3} width={16} height={18} rx={3} fill={lit ? "#ffc55c" : "#93aab4"} />
      ) : twoRows ? (
        <>
          <Window spec={spec} cx={CX - wallW * 0.24} cy={wallTop + wallH * 0.26} lit={lit} detail={detail} />
          <Window spec={spec} cx={CX + wallW * 0.24} cy={wallTop + wallH * 0.26} lit={lit} detail={detail} />
          <Window spec={spec} cx={CX - wallW * 0.24} cy={wallTop + wallH * 0.68} lit={lit} detail={detail} />
        </>
      ) : (
        <Window spec={spec} cx={CX - wallW * 0.23} cy={wallTop + wallH * 0.48} lit={lit} detail={detail} />
      )}

      {lod !== "map" && <Door spec={spec} state={state} detail={detail} />}

      {/* Name on a garden signpost by the front corner (never collides with windows) */}
      {detail >= 2 && name && (() => {
        const label = name.length > 18 ? `${name.slice(0, 17)}…` : name;
        const boardW = Math.min(104, label.length * 5.4 + 18);
        const signX = Math.max(boardW / 2 + 6, wallX + 2);
        return (
          <g transform={`rotate(-2 ${signX} ${BASE - 22})`}>
            <line x1={signX} y1={BASE + 4} x2={signX} y2={BASE - 26} stroke={colors.trimDark} strokeWidth={3} strokeLinecap="round" />
            <rect x={signX - boardW / 2} y={BASE - 40} width={boardW} height={17} rx={2.5} fill="#f2dfae" stroke={colors.trimDark} strokeOpacity={0.6} />
            <text
              x={signX}
              y={BASE - 28}
              textAnchor="middle"
              fontSize={9.5}
              fontWeight={600}
              fill="#5a3b22"
              style={{ fontFamily: "var(--font-display), Georgia, serif" }}
            >
              {label}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}
