"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useVillageGlobe, type GlobeItem } from "@/components/nest/village/use-village-globe";
import { SceneBackdrop } from "@/components/nest/village/scene-backdrop";
import { useAtmosphere } from "@/components/nest/village/use-atmosphere";
import { DEFAULT_SURFACE_CONFIG, type SurfaceConfig } from "@/lib/village-surface";

// ── /village-projection-lab ──────────────────────────────────────────────────
// Surface-anchored village globe. ONE curved terrain surface; every object —
// houses, roads, trees, bushes, lamps, labels, shadows — is placed in surface
// (longitude, latitude) coords and projected with lib/village-surface. Drag
// rotates the world; objects slide to a limb, sink behind the earth, and re-emerge
// from the opposite side. No object can float in open sky. Live sliders tune the
// globe; debug overlays a rotating graticule + world coords.

const TAU = Math.PI * 2;

function rnd(i: number, salt = 1): number {
  let h = Math.imul(i + 1, 374761393) + Math.imul(salt, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const HOUSE_COUNT = 16;
const HUES = [18, 32, 5, 200, 150, 275, 340, 45, 95];

type LabHouse = GlobeItem & { hue: number; label: string };
type LabDecor = GlobeItem & { kind: "tree" | "bush" | "flower" | "lamp"; label: string };

// Village band: latitudes kept in a strip so houses sit in the visible mid-ground
// of the near cap (not clipped off the bottom, not up at the far horizon).
const LAT_MIN = 0.05;
const LAT_MAX = 0.5;
// Houses cluster around the front over ~260° of longitude, leaving a back arc of
// open country — so rotating clearly shows houses sink behind one limb and emerge
// from the other.
const LON_ARC = 4.6;

export function VillageProjectionLabClient() {
  const atmosphere = useAtmosphere();
  const [debug, setDebug] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [showRoads, setShowRoads] = useState(true);

  const [cfg, setCfg] = useState<SurfaceConfig>({ ...DEFAULT_SURFACE_CONFIG });
  const set = (k: keyof SurfaceConfig) => (v: number) => setCfg((c) => ({ ...c, [k]: v }));

  // Houses on a jittered grid across the village arc, so every rotation shows a
  // vertical spread from foreground to horizon — a populated village, not a row.
  const houses = useMemo<LabHouse[]>(() => {
    const COLS = 8;
    return Array.from({ length: HOUSE_COUNT }, (_, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const lonBase = -LON_ARC / 2 + ((col + 0.5) / COLS) * LON_ARC;
      const latBase = LAT_MIN + ((row + 0.5) / 2) * (LAT_MAX - LAT_MIN);
      return {
        id: `house-${i}`,
        longitude: lonBase + (rnd(i, 7) - 0.5) * 0.35,
        latitude: latBase + (rnd(i, 3) - 0.5) * 0.18,
        hue: HUES[i % HUES.length],
        label: `H${i}`,
      };
    });
  }, []);

  // Decor scattered across the same surface.
  const decor = useMemo<LabDecor[]>(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        id: `decor-${i}`,
        longitude: -LON_ARC / 2 + rnd(i, 11) * LON_ARC,
        latitude: LAT_MIN - 0.12 + rnd(i, 13) * (LAT_MAX - LAT_MIN + 0.24),
        kind: (["tree", "bush", "flower", "lamp"] as const)[i % 4],
        label: "",
      })),
    [],
  );

  // Two roads: chains of surface points along the band (project with the same math).
  const roads = useMemo(
    () =>
      [0, 1].map((r) =>
        Array.from({ length: 48 }, (_, i) => ({
          longitude: -LON_ARC / 2 - 0.4 + (i / 47) * (LON_ARC + 0.8),
          latitude: (r === 0 ? 0.14 : 0.4) + Math.sin(i * 0.4 + r) * 0.05,
        })),
      ),
    [],
  );

  const items = useMemo<GlobeItem[]>(() => [...decor, ...houses], [decor, houses]);

  const globe = useVillageGlobe({
    items,
    config: cfg,
    onTap: (id) => {
      const h = houses.find((x) => x.id === id);
      if (h) globe.centerOn(h.longitude);
    },
  });

  const { width: vw, height: vh } = globe.viewport;
  const cx = vw / 2;
  const cy = vh * cfg.centerYFraction;
  const R = cfg.radius;
  const horizonY = cy - R; // top of the terrain disc = the horizon

  const night = atmosphere.sky.night;
  const grass = night
    ? { edge: "#24402e", mid: "#2c4a34", near: "#31513a" }
    : { edge: "#5f8f3f", mid: "#79a84f", near: "#8fc061" };

  // ── Roads + graticule are surface features: redraw every frame with projectPoint.
  const road0Ref = useRef<SVGPathElement>(null);
  const road1Ref = useRef<SVGPathElement>(null);
  const gratRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const buildRoad = (pts: { longitude: number; latitude: number }[]) => {
      // Break the polyline wherever a point rotates behind the earth (hidden).
      let d = "";
      let pen = false;
      for (const p of pts) {
        const pr = globe.projectPoint(p.longitude, p.latitude);
        if (!pr.visible) {
          pen = false;
          continue;
        }
        d += `${pen ? "L" : "M"}${pr.x.toFixed(1)},${pr.y.toFixed(1)} `;
        pen = true;
      }
      return d.trim();
    };
    const buildGraticule = () => {
      // A few meridians + latitude circles to make the curvature + rotation legible.
      const parts: string[] = [];
      for (let m = 0; m < 12; m++) {
        const lon = (m / 12) * TAU;
        let d = "";
        let pen = false;
        for (let k = 0; k <= 24; k++) {
          const lat = -0.5 + (k / 24) * 1.4;
          const pr = globe.projectPoint(lon, lat);
          if (!pr.visible) { pen = false; continue; }
          d += `${pen ? "L" : "M"}${pr.x.toFixed(1)},${pr.y.toFixed(1)} `;
          pen = true;
        }
        if (d) parts.push(d.trim());
      }
      for (let l = 0; l < 5; l++) {
        const lat = -0.3 + (l / 4) * 1.0;
        let d = "";
        let pen = false;
        for (let k = 0; k <= 48; k++) {
          const lon = (k / 48) * TAU;
          const pr = globe.projectPoint(lon, lat);
          if (!pr.visible) { pen = false; continue; }
          d += `${pen ? "L" : "M"}${pr.x.toFixed(1)},${pr.y.toFixed(1)} `;
          pen = true;
        }
        if (d) parts.push(d.trim());
      }
      return parts;
    };
    globe.setOnFrame(() => {
      if (showRoads) {
        road0Ref.current?.setAttribute("d", buildRoad(roads[0]));
        road1Ref.current?.setAttribute("d", buildRoad(roads[1]));
      } else {
        road0Ref.current?.setAttribute("d", "");
        road1Ref.current?.setAttribute("d", "");
      }
      const g = gratRef.current;
      if (g) {
        if (debug) {
          const paths = buildGraticule();
          g.innerHTML = paths
            .map((d) => `<path d="${d}" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="1" />`)
            .join("");
        } else {
          g.innerHTML = "";
        }
      }
    });
    return () => globe.setOnFrame(null);
  }, [globe, roads, showRoads, debug]);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-parchment">
      <div ref={globe.rootRef} className="absolute inset-0 touch-none select-none overflow-hidden" {...globe.handlers}>
        {/* sky */}
        <SceneBackdrop sky={atmosphere.sky} wx={atmosphere.wx} birds className="absolute inset-0" />

        {/* ── the ONE terrain surface — a sphere disc; its top arc is the horizon ── */}
        {vw > 0 ? (
          <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="none" aria-hidden>
            <defs>
              <radialGradient id="labEarth" cx="50%" cy={`${((cy - R * 0.35) / vh) * 100}%`} r="75%">
                <stop offset="0" stopColor={grass.near} />
                <stop offset="0.55" stopColor={grass.mid} />
                <stop offset="1" stopColor={grass.edge} />
              </radialGradient>
              <clipPath id="earthClip">
                <circle cx={cx} cy={cy} r={R} />
              </clipPath>
            </defs>
            {/* the earth body */}
            <circle cx={cx} cy={cy} r={R} fill="url(#labEarth)" />
            {/* soft rim light along the horizon */}
            <circle cx={cx} cy={cy} r={R} fill="none" stroke={night ? "rgba(180,200,230,0.25)" : "rgba(255,255,255,0.35)"} strokeWidth="2" />
            {/* rotating surface features live inside the disc clip */}
            <g clipPath="url(#earthClip)">
              <g ref={gratRef} />
              <path ref={road0Ref} d="" fill="none" stroke={night ? "#6b5a3a" : "#cbb389"} strokeWidth={6} strokeLinecap="round" opacity={0.9} />
              <path ref={road1Ref} d="" fill="none" stroke={night ? "#6b5a3a" : "#cbb389"} strokeWidth={5} strokeLinecap="round" opacity={0.8} />
            </g>
          </svg>
        ) : null}

        {/* time-of-day wash */}
        <div className="pointer-events-none absolute inset-0" style={{ background: atmosphere.sky.wash }} />

        {/* horizon guide (debug) */}
        {debug ? (
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-fuchsia-500/70" style={{ top: horizonY }}>
            <span className="absolute left-1 -top-4 rounded bg-fuchsia-600/80 px-1 text-[9px] font-bold text-white">horizon</span>
          </div>
        ) : null}

        {/* ── objects: all anchored to the surface, drawn above the terrain ── */}
        {decor.map((d) => (
          <div key={d.id} ref={globe.register(d.id)} data-world-id={d.id}>
            <Decor kind={d.kind} night={night} />
          </div>
        ))}
        {houses.map((h) => (
          <div key={h.id} ref={globe.register(h.id)} data-world-id={h.id}>
            <PlaceholderHouse hue={h.hue} night={night} label={debug ? h.label : undefined} />
          </div>
        ))}
      </div>

      {/* ── header ── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between p-3">
        <div className="pointer-events-auto rounded-xl bg-white/85 px-3 py-2 shadow-soft backdrop-blur">
          <p className="eyebrow text-terracotta">Prototype</p>
          <h1 className="display text-base leading-none">Village Globe</h1>
          <p className="mt-1 text-[10px] text-ink/55">{atmosphere.sky.label} · {atmosphere.wx.label} · drag to orbit</p>
        </div>
        <div className="pointer-events-auto flex flex-col items-end gap-1">
          <button onClick={() => setDebug((d) => !d)} className="rounded-full bg-white/85 px-3 py-1.5 text-xs font-bold text-ink/70 shadow-soft backdrop-blur">{debug ? "Debug ✓" : "Debug"}</button>
          <button onClick={() => setShowRoads((r) => !r)} className="rounded-full bg-white/85 px-3 py-1.5 text-xs font-bold text-ink/70 shadow-soft backdrop-blur">{showRoads ? "Roads ✓" : "Roads"}</button>
          <button onClick={() => setPanelOpen((p) => !p)} className="rounded-full bg-white/85 px-3 py-1.5 text-xs font-bold text-ink/70 shadow-soft backdrop-blur">{panelOpen ? "Hide" : "Tune"}</button>
        </div>
      </div>

      {/* ── tuning panel ── */}
      {panelOpen ? (
        <div className="absolute inset-x-0 bottom-0 z-30 max-h-[44vh] overflow-y-auto rounded-t-2xl bg-white/92 p-3 shadow-lift backdrop-blur">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <Slider label="radius" v={cfg.radius} min={180} max={640} step={5} onChange={set("radius")} fmt={(n) => String(Math.round(n))} />
            <Slider label="centerY frac" v={cfg.centerYFraction} min={0.55} max={1.15} step={0.01} onChange={set("centerYFraction")} />
            <Slider label="tilt" v={cfg.tilt} min={0.3} max={1.2} step={0.01} onChange={set("tilt")} />
            <Slider label="latExaggeration" v={cfg.latExaggeration} min={0.6} max={1.8} step={0.02} onChange={set("latExaggeration")} />
            <Slider label="baseScale" v={cfg.baseScale} min={0.5} max={1.8} step={0.02} onChange={set("baseScale")} />
            <Slider label="scaleByDepth" v={cfg.scaleByDepth} min={0} max={0.9} step={0.02} onChange={set("scaleByDepth")} />
            <Slider label="minScale" v={cfg.minScale} min={0.1} max={0.6} step={0.02} onChange={set("minScale")} />
            <Slider label="maxScale" v={cfg.maxScale} min={1} max={2.4} step={0.05} onChange={set("maxScale")} />
            <Slider label="limbFade" v={cfg.limbFade} min={0.04} max={0.4} step={0.01} onChange={set("limbFade")} />
            <Slider label="blurStrength" v={cfg.blurStrength} min={0} max={6} step={0.25} onChange={set("blurStrength")} />
            <Slider label="sensLon" v={cfg.sensitivityLon} min={0.002} max={0.012} step={0.0002} onChange={set("sensitivityLon")} fmt={(n) => n.toFixed(4)} />
            <Slider label="sensTilt" v={cfg.sensitivityTilt} min={0} max={0.006} step={0.0002} onChange={set("sensitivityTilt")} fmt={(n) => n.toFixed(4)} />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button onClick={() => setCfg({ ...DEFAULT_SURFACE_CONFIG })} className="rounded-full bg-ink/10 px-3 py-1 text-[11px] font-bold text-ink/70">Reset</button>
            <button onClick={() => navigator.clipboard?.writeText(JSON.stringify(cfg, null, 2))} className="rounded-full bg-terracotta px-3 py-1 text-[11px] font-bold text-parchment">Copy config JSON</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Slider({ label, v, min, max, step, onChange, fmt }: { label: string; v: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (n: number) => string }) {
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

function PlaceholderHouse({ hue, night, label }: { hue: number; night: boolean; label?: string }) {
  const wall = `hsl(${hue} 45% ${night ? 42 : 66}%)`;
  const roof = `hsl(${hue} 50% ${night ? 28 : 42}%)`;
  const lit = night ? "#ffe9a8" : "#fff6da";
  return (
    <div className="relative flex flex-col items-center" style={{ width: 84 }}>
      <svg width="84" height="86" viewBox="0 0 84 86" aria-hidden>
        <ellipse cx="42" cy="82" rx="30" ry="6" fill="rgba(20,14,8,0.28)" />
        <rect x="16" y="40" width="52" height="38" rx="3" fill={wall} />
        <path d="M10 42 L42 16 L74 42 Z" fill={roof} />
        <rect x="37" y="58" width="12" height="20" rx="2" fill={roof} />
        <rect x="22" y="48" width="10" height="10" rx="1.5" fill={lit} />
        <rect x="52" y="48" width="10" height="10" rx="1.5" fill={lit} />
      </svg>
      {label ? <span className="-mt-1 rounded-full bg-terracotta px-1.5 py-0.5 text-[9px] font-black text-parchment shadow-soft">{label}</span> : null}
    </div>
  );
}

function Decor({ kind, night }: { kind: LabDecor["kind"]; night: boolean }) {
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
  if (kind === "bush") {
    return (
      <svg width="30" height="24" viewBox="0 0 30 24" aria-hidden>
        <ellipse cx="15" cy="22" rx="11" ry="2.5" fill="rgba(20,14,8,0.22)" />
        <circle cx="10" cy="14" r="8" fill={night ? "#28442f" : "#4a833f"} />
        <circle cx="20" cy="14" r="8" fill={night ? "#28442f" : "#4a833f"} />
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
