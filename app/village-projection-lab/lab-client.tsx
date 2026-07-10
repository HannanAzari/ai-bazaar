"use client";

import { useMemo, useRef, useState } from "react";
import { useCurvedWorld } from "@/components/nest/village/use-curved-world";
import { SceneBackdrop } from "@/components/nest/village/scene-backdrop";
import { useAtmosphere } from "@/components/nest/village/use-atmosphere";
import { DEFAULT_PROJECTION_CONFIG, type ProjectionConfig, type VillageWorldItem } from "@/lib/village-projection";

// ── /village-projection-lab ──────────────────────────────────────────────────
// Isolated prototype for the pseudo-3D curved-world projection. 20 placeholder
// houses + light decor laid out in a virtual 2D world; a movable camera you drag
// in any direction (native pointer + rAF inertia, via useCurvedWorld). Live
// sliders tune every projection constant so the *feeling* can be dialed in before
// the real Village adopts it. Debug mode overlays world coords + a horizon guide.

// Deterministic 0..1 hash (no Math.random → stable positions, hydration-safe).
function rnd(i: number, salt = 1): number {
  let h = Math.imul(i + 1, 374761393) + Math.imul(salt, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const HOUSE_COUNT = 20;
const DECOR_COUNT = 18;

// Placeholder house palettes — enough variety to read as a village.
const HUES = [18, 32, 5, 200, 150, 275, 340, 45];

type LabItem = VillageWorldItem & { hue: number; label: string };

export function VillageProjectionLabClient() {
  const atmosphere = useAtmosphere();
  const [debug, setDebug] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);

  // Tunable constants (start from the module defaults).
  const [cfg, setCfg] = useState<ProjectionConfig>({ ...DEFAULT_PROJECTION_CONFIG });
  const set = (k: keyof ProjectionConfig) => (v: number) => setCfg((c) => ({ ...c, [k]: v }));

  // World layout: normalized X in [0,1) (respaced live as WORLD_WIDTH changes)
  // → worldX; worldY (depth) is fixed per seed so houses never line up in rows.
  const items = useMemo<LabItem[]>(() => {
    const houses: LabItem[] = Array.from({ length: HOUSE_COUNT }, (_, i) => {
      const nx = (i + rnd(i, 7) * 0.6) / HOUSE_COUNT; // even-ish with jitter
      const worldY = -cfg.WORLD_HEIGHT * 0.28 + rnd(i, 3) * cfg.WORLD_HEIGHT * 0.62;
      return {
        id: `house-${i}`,
        worldX: nx * cfg.WORLD_WIDTH,
        worldY,
        kind: "house" as const,
        hue: HUES[i % HUES.length],
        label: `H${i}`,
      };
    });
    const decor: LabItem[] = Array.from({ length: DECOR_COUNT }, (_, i) => {
      const nx = rnd(i, 11);
      const worldY = -cfg.WORLD_HEIGHT * 0.2 + rnd(i, 13) * cfg.WORLD_HEIGHT * 0.6;
      const kind = (["tree", "flower", "lamp"] as const)[i % 3];
      return {
        id: `decor-${i}`,
        worldX: nx * cfg.WORLD_WIDTH,
        worldY,
        kind,
        hue: 130,
        label: kind[0].toUpperCase(),
      };
    });
    return [...decor, ...houses];
  }, [cfg.WORLD_WIDTH, cfg.WORLD_HEIGHT]);

  const world = useCurvedWorld({
    items,
    config: cfg,
    onTap: (id) => {
      const it = items.find((x) => x.id === id);
      if (it) world.centerOn(it.worldX, it.worldY);
    },
  });

  const { width: vw, height: vh } = world.viewport;
  const horizonY = vh * cfg.horizonYFraction;

  // Ground silhouette that AGREES with the projection: the horizon band gets
  // pushed down by horizontalCurve * relativeX², so sample that same parabola
  // across the screen (invert screenX→relativeX at the horizon depth).
  const groundPath = useMemo(() => {
    const centerX = vw / 2;
    const compAtHorizon = cfg.horizonCompression + (1 - cfg.horizonCompression) * 0.5;
    const denom = cfg.horizontalScale * compAtHorizon || 1;
    const pts: string[] = [];
    const N = 24;
    for (let i = 0; i <= N; i++) {
      const sx = (i / N) * vw;
      const relX = (sx - centerX) / denom;
      const y = horizonY + cfg.horizontalCurve * relX * relX;
      pts.push(`${i === 0 ? "M" : "L"}${sx.toFixed(1)},${y.toFixed(1)}`);
    }
    return `${pts.join(" ")} L${vw},${vh} L0,${vh} Z`;
  }, [vw, vh, horizonY, cfg.horizontalCurve, cfg.horizonCompression, cfg.horizontalScale]);

  const night = atmosphere.sky.night;
  const grass = night
    ? { top: "#31513a", mid: "#24402e", bottom: "#182a1f" }
    : { top: "#8db956", mid: "#6ba045", bottom: "#4c7d38" };

  const camRef = useRef<HTMLSpanElement>(null);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-parchment">
      {/* clipped, fixed viewport — no page scroll drives the world */}
      <div
        ref={world.rootRef}
        className="absolute inset-0 touch-none select-none overflow-hidden"
        {...world.handlers}
      >
        {/* living sky (fills viewport; ground sits over the lower part) */}
        <SceneBackdrop sky={atmosphere.sky} wx={atmosphere.wx} birds className="absolute inset-0" />

        {/* curved ground — parabola matched to the projection */}
        {vw > 0 ? (
          <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="labGrass" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={grass.top} />
                <stop offset="0.45" stopColor={grass.mid} />
                <stop offset="1" stopColor={grass.bottom} />
              </linearGradient>
            </defs>
            <path d={groundPath} fill="url(#labGrass)" />
          </svg>
        ) : null}
        <div className="pointer-events-none absolute inset-0" style={{ background: atmosphere.sky.wash }} />

        {/* horizon guide (debug) */}
        {debug ? (
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-fuchsia-500/70" style={{ top: horizonY }}>
            <span className="absolute left-1 -top-4 rounded bg-fuchsia-600/80 px-1 text-[9px] font-bold text-white">horizon</span>
          </div>
        ) : null}

        {/* world items — one positioner element per item, driven imperatively */}
        {items.map((it) => (
          <div key={it.id} ref={world.register(it.id)} data-world-id={it.id}>
            {it.kind === "house" ? (
              <PlaceholderHouse hue={it.hue} night={night} label={debug ? it.label : undefined} coords={debug ? it : undefined} />
            ) : (
              <Decor kind={it.kind} night={night} />
            )}
          </div>
        ))}
      </div>

      {/* ── header ── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between p-3">
        <div className="pointer-events-auto rounded-xl bg-white/85 px-3 py-2 shadow-soft backdrop-blur">
          <p className="eyebrow text-terracotta">Prototype</p>
          <h1 className="display text-base leading-none">Projection Lab</h1>
          <p className="mt-1 text-[10px] text-ink/55">
            {atmosphere.sky.label} · {atmosphere.wx.label} · drag any direction
          </p>
        </div>
        <div className="pointer-events-auto flex flex-col items-end gap-1">
          <button onClick={() => setDebug((d) => !d)} className="rounded-full bg-white/85 px-3 py-1.5 text-xs font-bold text-ink/70 shadow-soft backdrop-blur">
            {debug ? "Debug ✓" : "Debug"}
          </button>
          <button onClick={() => setPanelOpen((p) => !p)} className="rounded-full bg-white/85 px-3 py-1.5 text-xs font-bold text-ink/70 shadow-soft backdrop-blur">
            {panelOpen ? "Hide sliders" : "Tune"}
          </button>
        </div>
      </div>

      {/* ── live camera readout (debug) ── */}
      {debug ? (
        <span
          ref={camRef}
          className="pointer-events-none absolute bottom-2 left-2 z-30 rounded bg-black/60 px-2 py-1 font-mono text-[10px] text-white"
        >
          {`items ${items.length} · vw ${Math.round(vw)}×${Math.round(vh)}`}
        </span>
      ) : null}

      {/* ── tuning panel ── */}
      {panelOpen ? (
        <div className="absolute inset-x-0 bottom-0 z-30 max-h-[46vh] overflow-y-auto rounded-t-2xl bg-white/92 p-3 shadow-lift backdrop-blur">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <Slider label="sensitivity" v={cfg.sensitivity} min={0.3} max={3} step={0.05} onChange={set("sensitivity")} />
            <Slider label="horizonY %" v={cfg.horizonYFraction} min={0.3} max={0.48} step={0.005} onChange={set("horizonYFraction")} />
            <Slider label="horizontalScale" v={cfg.horizontalScale} min={0.1} max={1.5} step={0.02} onChange={set("horizontalScale")} />
            <Slider label="verticalScale" v={cfg.verticalScale} min={0.2} max={2} step={0.02} onChange={set("verticalScale")} />
            <Slider label="horizontalCurve" v={cfg.horizontalCurve} min={0} max={0.0008} step={0.00001} onChange={set("horizontalCurve")} fmt={(n) => n.toExponential(1)} />
            <Slider label="depthCurve" v={cfg.depthCurve} min={0} max={0.0004} step={0.00001} onChange={set("depthCurve")} fmt={(n) => n.toExponential(1)} />
            <Slider label="depthScale" v={cfg.depthScale} min={0.0002} max={0.003} step={0.0001} onChange={set("depthScale")} fmt={(n) => n.toExponential(1)} />
            <Slider label="baseScale" v={cfg.baseScale} min={0.2} max={1} step={0.02} onChange={set("baseScale")} />
            <Slider label="maxScale" v={cfg.maxScale} min={0.8} max={2.4} step={0.05} onChange={set("maxScale")} />
            <Slider label="horizonCompress" v={cfg.horizonCompression} min={0.1} max={1} step={0.02} onChange={set("horizonCompression")} />
            <Slider label="visibilityRadius" v={cfg.visibilityRadius} min={300} max={1000} step={10} onChange={set("visibilityRadius")} fmt={(n) => String(Math.round(n))} />
            <Slider label="blurStrength" v={cfg.blurStrength} min={0} max={10} step={0.5} onChange={set("blurStrength")} />
            <Slider label="WORLD_WIDTH" v={cfg.WORLD_WIDTH} min={1200} max={4000} step={50} onChange={set("WORLD_WIDTH")} fmt={(n) => String(Math.round(n))} />
            <Slider label="friction" v={cfg.friction} min={0.8} max={0.98} step={0.005} onChange={set("friction")} />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button
              onClick={() => setCfg({ ...DEFAULT_PROJECTION_CONFIG })}
              className="rounded-full bg-ink/10 px-3 py-1 text-[11px] font-bold text-ink/70"
            >
              Reset
            </button>
            <button
              onClick={() => navigator.clipboard?.writeText(JSON.stringify(cfg, null, 2))}
              className="rounded-full bg-terracotta px-3 py-1 text-[11px] font-bold text-parchment"
            >
              Copy config JSON
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Slider({
  label,
  v,
  min,
  max,
  step,
  onChange,
  fmt,
}: {
  label: string;
  v: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt?: (n: number) => string;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="flex justify-between text-[10px] font-bold text-ink/60">
        <span>{label}</span>
        <span className="font-mono text-ink/45">{fmt ? fmt(v) : v.toFixed(2)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => onChange(parseFloat(e.target.value))} className="h-1.5 w-full accent-terracotta" />
    </label>
  );
}

// A lightweight house silhouette — enough to read depth/scale/overlap without
// pulling in the real art. Grounded with a soft shadow pad at its base.
function PlaceholderHouse({
  hue,
  night,
  label,
  coords,
}: {
  hue: number;
  night: boolean;
  label?: string;
  coords?: { worldX: number; worldY: number };
}) {
  const wall = `hsl(${hue} 45% ${night ? 42 : 66}%)`;
  const roof = `hsl(${hue} 50% ${night ? 28 : 42}%)`;
  const lit = night ? "#ffe9a8" : "#fff6da";
  return (
    <div className="relative flex flex-col items-center" style={{ width: 84 }}>
      <svg width="84" height="86" viewBox="0 0 84 86" aria-hidden>
        {/* ground shadow pad — scale-consistent, sells the grounding */}
        <ellipse cx="42" cy="82" rx="30" ry="6" fill="rgba(20,14,8,0.28)" />
        {/* body */}
        <rect x="16" y="40" width="52" height="38" rx="3" fill={wall} />
        {/* roof */}
        <path d="M10 42 L42 16 L74 42 Z" fill={roof} />
        {/* door */}
        <rect x="37" y="58" width="12" height="20" rx="2" fill={roof} />
        {/* windows */}
        <rect x="22" y="48" width="10" height="10" rx="1.5" fill={lit} />
        <rect x="52" y="48" width="10" height="10" rx="1.5" fill={lit} />
      </svg>
      {label ? (
        <span className="-mt-1 rounded-full bg-terracotta px-1.5 py-0.5 text-[9px] font-black text-parchment shadow-soft">
          {label}
        </span>
      ) : null}
      {coords ? (
        <span className="mt-0.5 rounded bg-black/55 px-1 font-mono text-[8px] text-white">
          {Math.round(coords.worldX)},{Math.round(coords.worldY)}
        </span>
      ) : null}
    </div>
  );
}

function Decor({ kind, night }: { kind: VillageWorldItem["kind"]; night: boolean }) {
  if (kind === "tree") {
    return (
      <svg width="40" height="52" viewBox="0 0 40 52" aria-hidden>
        <ellipse cx="20" cy="49" rx="12" ry="3" fill="rgba(20,14,8,0.25)" />
        <rect x="18" y="34" width="4" height="14" fill={night ? "#5b4327" : "#7a5a33"} />
        <circle cx="20" cy="24" r="16" fill={night ? "#2c4a32" : "#4f8a45"} />
      </svg>
    );
  }
  if (kind === "lamp") {
    return (
      <svg width="18" height="46" viewBox="0 0 18 46" aria-hidden>
        <ellipse cx="9" cy="44" rx="7" ry="2.5" fill="rgba(20,14,8,0.25)" />
        <rect x="7.5" y="12" width="3" height="32" fill={night ? "#3a3350" : "#6b6478"} />
        <circle cx="9" cy="9" r="6" fill={night ? "#ffe08a" : "#fff3c4"} />
      </svg>
    );
  }
  return (
    <svg width="22" height="24" viewBox="0 0 22 24" aria-hidden>
      <ellipse cx="11" cy="22" rx="8" ry="2" fill="rgba(20,14,8,0.2)" />
      <circle cx="11" cy="9" r="5" fill={night ? "#b06a86" : "#f191b0"} />
      <circle cx="6" cy="13" r="4" fill={night ? "#c08096" : "#f6a9c2"} />
      <circle cx="16" cy="13" r="4" fill={night ? "#c08096" : "#f6a9c2"} />
    </svg>
  );
}
