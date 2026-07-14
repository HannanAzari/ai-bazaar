"use client";

import { useMemo, useState } from "react";
import { useVillageStreet } from "@/components/nest/village/use-village-street";
import { SceneBackdrop } from "@/components/nest/village/scene-backdrop";
import { useAtmosphere } from "@/components/nest/village/use-atmosphere";
import {
  SKY_THEMES,
  WEATHER_THEMES,
  type TimeOfDay,
  type Weather,
} from "@/lib/nest-atmosphere";
import {
  hash01,
  hillY,
  cellContent,
  groundPath,
  roadPath,
  type Band,
} from "@/lib/village-street";

// ── /village-lab ─────────────────────────────────────────────────────────────
// Nestudio Village V2 — an endless, cozy rolling-hills neighbourhood you glide
// through. Sky stays up top; a hand-painted countryside of parallax bands rolls
// below, dotted with creator houses on the grass, winding roads, and enough trees,
// lamps, flowers, fences and mailboxes that it feels lived-in. Streams forever via
// deterministic cells (lib/village-street) — no globe, no projection, no Canvas.

const HOUSE_HUES = [14, 28, 200, 150, 42, 268, 340, 96, 178];

// Decor spacing (fine grid) per band — denser than houses so nothing feels empty.
const DECOR_SPACING: Record<string, number> = { far: 74, mid: 58, near: 50 };

// Band GEOMETRY the camera hook needs (id + parallax + spacing only — it ignores
// the visual fields). Viewport-independent so it's a stable module constant; the
// per-pixel bands (baseY etc.) are derived from the measured viewport in-render.
// freq/amp give a visible gentle roll across the screen (period ~1–1.5 screens).
const BAND_GEO: Band[] = [
  { id: "far", parallax: 0.34, baseY: 0, amp: 30, freq: 0.011, spacing: 300, scale: 0.5 },
  { id: "mid", parallax: 0.62, baseY: 0, amp: 50, freq: 0.0092, spacing: 260, scale: 0.82 },
  { id: "near", parallax: 1.0, baseY: 0, amp: 66, freq: 0.0075, spacing: 240, scale: 1.18 },
];

export function VillageLabClient() {
  const live = useAtmosphere();
  const [timeSel, setTimeSel] = useState<TimeOfDay | "live">("live");
  const [wxSel, setWxSel] = useState<Weather | "live">("live");
  const [selected, setSelected] = useState<{ name: string; hue: number } | null>(null);

  const sky = timeSel === "live" ? live.sky : SKY_THEMES[timeSel];
  const wx = wxSel === "live" ? live.wx : WEATHER_THEMES[wxSel];
  const night = sky.night;

  const street = useVillageStreet({ bands: BAND_GEO });
  const { width: vw, height: vh } = street.viewport;
  const floorY = vh + 260;

  // Visual bands: same id/parallax/spacing as BAND_GEO, with pixel heights derived
  // from the measured viewport. Far → near (higher baseY = lower on screen).
  const bands = useMemo<Band[]>(
    () => [
      { ...BAND_GEO[0], baseY: vh * 0.44 },
      { ...BAND_GEO[1], baseY: vh * 0.63 },
      { ...BAND_GEO[2], baseY: vh * 0.9 },
    ],
    [vh],
  );

  const bandSalt: Record<string, number> = { far: 3, mid: 8, near: 15 };
  const houseBias: Record<string, number> = { far: 0.0, mid: 0.12, near: 0.2 };

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-parchment">
      <div
        ref={street.rootRef}
        className="absolute inset-0 touch-none select-none overflow-hidden"
        {...street.handlers}
      >
        {/* ── SKY (fixed) — top ~28%, always visible. All atmosphere lives here. ── */}
        <SceneBackdrop sky={sky} wx={wx} birds className="absolute inset-0" />
        {/* a soft band of haze where the far hills meet the sky */}
        <div
          className="pointer-events-none absolute inset-x-0"
          style={{ top: vh * 0.3, height: vh * 0.16, background: `linear-gradient(to bottom, ${night ? "rgba(40,48,80,0.0)" : "rgba(226,236,224,0)"}, ${night ? "rgba(40,48,80,0.35)" : "rgba(226,236,224,0.55)"})` }}
        />

        {/* ── PARALLAX BANDS (far → near) ── */}
        {vw > 0
          ? bands.map((band) => {
              const win = street.windows[band.id];
              if (!win) return null;
              const worldLeft = win.kMin * band.spacing;
              const worldRight = win.kMax * band.spacing;
              const range = Math.max(1, worldRight - worldLeft);
              const salt = bandSalt[band.id];
              const hasRoad = band.id !== "far";

              // Houses on this band's coarse cells.
              const houses = [];
              for (let k = win.kMin; k <= win.kMax; k++) {
                const c = cellContent(k, band, salt, houseBias[band.id]);
                if (c.kind === "house") houses.push(c);
              }

              // Decor on a finer grid, SCATTERED down the slope (not just on the crest
              // line) so the band's grass reads as a populated field, not bare fill.
              // A far band's downhill decor is covered by the band in front (z-order),
              // which clips it naturally.
              const dspace = DECOR_SPACING[band.id];
              const scatterDepth = band.id === "far" ? vh * 0.16 : band.id === "mid" ? vh * 0.26 : vh * 0.34;
              const decor = [];
              const mMin = Math.floor(worldLeft / dspace);
              const mMax = Math.ceil(worldRight / dspace);
              for (let m = mMin; m <= mMax; m++) {
                const pick = hash01(m, salt + 200);
                if (pick < 0.14) continue; // a touch of breathing room, but keep it inhabited
                const worldX = m * dspace + (hash01(m, salt + 201) - 0.5) * dspace * 0.7;
                const nearHouse = houses.some((hh) => Math.abs(hh.worldX - worldX) < band.spacing * 0.16);
                if (nearHouse && pick < 0.6) continue;
                const yOff = hash01(m, salt + 204) * scatterDepth;
                const groundY = hillY(worldX, band) + yOff;
                const depthScale = 1 + (yOff / scatterDepth) * 0.5; // downhill = closer = bigger
                const kinds = ["tree", "tree", "bush", "flower", "flower", "lamp", "mailbox", "fence", "rock", "bush"] as const;
                const kind = kinds[Math.floor(hash01(m, salt + 202) * kinds.length)];
                decor.push({ id: `${band.id}-d-${m}`, worldX, groundY, depthScale, kind, variant: hash01(m, salt + 203) });
              }

              const grass = grassFor(band.id, night);

              return (
                <div key={band.id} ref={street.registerLayer(band.id)} className="absolute inset-0" style={{ zIndex: band.id === "far" ? 1 : band.id === "mid" ? 2 : 3 }}>
                  {/* ground + road, drawn in world coords inside a window-sized SVG */}
                  <svg
                    style={{ position: "absolute", left: worldLeft, top: 0, width: range, height: floorY, overflow: "visible" }}
                    viewBox={`${worldLeft} 0 ${range} ${floorY}`}
                    preserveAspectRatio="none"
                    aria-hidden
                  >
                    <defs>
                      <linearGradient id={`grass-${band.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor={grass.top} />
                        <stop offset="1" stopColor={grass.bottom} />
                      </linearGradient>
                    </defs>
                    <path d={groundPath(band, worldLeft, worldRight, floorY)} fill={`url(#grass-${band.id})`} />
                    {/* soft sunlit rim along the hill crest */}
                    <path d={roadPath(band, worldLeft, worldRight, -1)} fill="none" stroke={night ? "rgba(150,170,210,0.20)" : "rgba(255,255,255,0.35)"} strokeWidth={3} />
                    {hasRoad ? (
                      <>
                        <path d={roadPath(band, worldLeft, worldRight, band.id === "near" ? 26 : 16)} fill="none" stroke={night ? "#5c4f38" : "#d8c39a"} strokeWidth={band.id === "near" ? 22 : 13} strokeLinecap="round" />
                        <path d={roadPath(band, worldLeft, worldRight, band.id === "near" ? 26 : 16)} fill="none" stroke={night ? "#6b5d42" : "#e7d7b4"} strokeWidth={band.id === "near" ? 12 : 7} strokeLinecap="round" />
                      </>
                    ) : null}
                  </svg>

                  {/* houses */}
                  {houses.map((c) => (
                    <button
                      key={`${band.id}-h-${c.k}`}
                      data-house-id={`${band.id}-${c.k}`}
                      onClickCapture={(e) => { if (street.suppressTapRef.current) { e.stopPropagation(); street.suppressTapRef.current = false; } }}
                      onClick={() => { const hue = HOUSE_HUES[Math.floor(c.variant * HOUSE_HUES.length)]; street.glideToX(c.worldX, band.parallax); setSelected({ name: houseName(c.k, salt), hue }); }}
                      className="absolute"
                      style={{ left: c.worldX, top: c.groundY, transform: `translate(-50%,-100%) scale(${band.scale * (0.9 + c.variant * 0.24)})`, transformOrigin: "50% 100%", zIndex: Math.round(c.groundY) }}
                      aria-label="Creator house"
                    >
                      {/* front-path stub connecting the house to the road */}
                      {hasRoad ? <span className="absolute left-1/2 top-full h-4 w-2 -translate-x-1/2 rounded-b" style={{ background: night ? "#6b5d42" : "#e2cfa2" }} /> : null}
                      <CozyHouse hue={HOUSE_HUES[Math.floor(c.variant * HOUSE_HUES.length)]} night={night} variant={c.variant} />
                    </button>
                  ))}

                  {/* decor */}
                  {decor.map((d) => (
                    <span
                      key={d.id}
                      className="pointer-events-none absolute"
                      style={{ left: d.worldX, top: d.groundY, transform: `translate(-50%,-100%) scale(${band.scale * (0.85 + d.variant * 0.3) * d.depthScale})`, transformOrigin: "50% 100%", zIndex: Math.round(d.groundY) - 1 }}
                    >
                      <Decor kind={d.kind} night={night} variant={d.variant} />
                    </span>
                  ))}

                </div>
              );
            })
          : null}

        {/* time-of-day colour wash over the whole scene */}
        <div className="pointer-events-none absolute inset-0" style={{ background: sky.wash, zIndex: 6 }} />
      </div>

      {/* ── header + controls ── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between p-3">
        <div className="pointer-events-auto rounded-xl bg-white/85 px-3 py-2 shadow-soft backdrop-blur">
          <p className="eyebrow text-terracotta">Prototype</p>
          <h1 className="display text-base leading-none">Rolling Village</h1>
          <p className="mt-1 text-[10px] text-ink/55">{sky.label} · {wx.label} · drag to wander</p>
        </div>
      </div>

      {/* atmosphere pickers (bottom-left, above nav) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col gap-1.5 p-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}>
        <div className="pointer-events-auto flex flex-wrap gap-1">
          {(["live", "morning", "afternoon", "evening", "night"] as const).map((t) => (
            <button key={t} onClick={() => setTimeSel(t)} className={`rounded-full px-2.5 py-1 text-[10px] font-bold shadow-soft backdrop-blur ${timeSel === t ? "bg-terracotta text-parchment" : "bg-white/80 text-ink/60"}`}>{t}</button>
          ))}
        </div>
        <div className="pointer-events-auto flex flex-wrap gap-1">
          {(["live", "sunny", "cloudy", "rain", "snow"] as const).map((w) => (
            <button key={w} onClick={() => setWxSel(w)} className={`rounded-full px-2.5 py-1 text-[10px] font-bold shadow-soft backdrop-blur ${wxSel === w ? "bg-meadow-shade text-parchment" : "bg-white/80 text-ink/60"}`}>{w}</button>
          ))}
        </div>
      </div>

      {/* ── lightweight arrival card (placeholder for HouseFront) ── */}
      {selected ? (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/30 p-6 pb-24" onClick={() => setSelected(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-parchment p-5 shadow-lift" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="grid size-12 place-items-center rounded-full text-lg font-black text-parchment" style={{ background: `hsl(${selected.hue} 45% 52%)` }}>{selected.name[0]}</div>
              <div>
                <p className="display text-lg leading-none">{selected.name}</p>
                <p className="text-[11px] text-ink/55">Creator house · arrival preview</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="flex-1 rounded-xl bg-terracotta px-4 py-2.5 text-sm font-black text-parchment">Enter Nest</button>
              <button onClick={() => setSelected(null)} className="rounded-xl border border-timber/20 bg-white px-4 py-2.5 text-sm font-bold text-ink/60">Back</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function grassFor(bandId: string, night: boolean) {
  if (night) {
    return {
      far: { top: "#2e3d4e", bottom: "#263442" },
      mid: { top: "#274434", bottom: "#1e3628" },
      near: { top: "#2c5038", bottom: "#20402b" },
    }[bandId]!;
  }
  return {
    far: { top: "#a7c6a0", bottom: "#93b98d" },
    mid: { top: "#8fc06a", bottom: "#79ab55" },
    near: { top: "#84be5c", bottom: "#67a043" },
  }[bandId]!;
}

// ── Cozy storybook house — CSS/SVG, deterministic variety, grounded shadow. ──
function CozyHouse({ hue, night, variant }: { hue: number; night: boolean; variant: number }) {
  const wall = `hsl(${hue} 42% ${night ? 46 : 74}%)`;
  const wallShade = `hsl(${hue} 42% ${night ? 38 : 66}%)`;
  const roof = `hsl(${(hue + 18) % 360} 46% ${night ? 30 : 40}%)`;
  const lit = night ? "#ffe6a0" : "#fff6dc";
  const win = night ? lit : "#eaf3f6";
  const gable = variant > 0.5;
  const chimney = variant > 0.4;
  return (
    <svg width="92" height="96" viewBox="0 0 92 96" aria-hidden>
      <ellipse cx="46" cy="90" rx="34" ry="7" fill="rgba(20,14,8,0.24)" />
      {chimney ? <rect x="58" y="20" width="9" height="18" rx="1.5" fill={roof} /> : null}
      {/* body */}
      <rect x="16" y="44" width="60" height="42" rx="3" fill={wall} />
      <rect x="66" y="44" width="10" height="42" fill={wallShade} />
      {/* roof */}
      {gable
        ? <path d="M8 46 L46 16 L84 46 Z" fill={roof} />
        : <path d="M10 46 L24 22 L68 22 L82 46 Z" fill={roof} />}
      {/* door */}
      <rect x="40" y="62" width="13" height="24" rx="2" fill={roof} />
      <circle cx="50" cy="74" r="1.4" fill={lit} />
      {/* windows */}
      <rect x="22" y="52" width="12" height="12" rx="2" fill={win} stroke={roof} strokeWidth="1.5" />
      <rect x="58" y="52" width="12" height="12" rx="2" fill={win} stroke={roof} strokeWidth="1.5" />
    </svg>
  );
}

function Decor({ kind, night, variant }: { kind: string; night: boolean; variant: number }) {
  const leaf = night ? "#2c4a32" : variant > 0.5 ? "#4f8a45" : "#5a9a4c";
  const trunk = night ? "#5b4327" : "#7a5a33";
  switch (kind) {
    case "tree":
      return (
        <svg width="46" height="62" viewBox="0 0 46 62" aria-hidden>
          <ellipse cx="23" cy="59" rx="14" ry="3" fill="rgba(20,14,8,0.22)" />
          <rect x="20" y="38" width="6" height="20" rx="2" fill={trunk} />
          <circle cx="23" cy="26" r="17" fill={leaf} />
          <circle cx="14" cy="32" r="10" fill={leaf} />
          <circle cx="33" cy="31" r="10" fill={leaf} />
        </svg>
      );
    case "bush":
      return (
        <svg width="34" height="26" viewBox="0 0 34 26" aria-hidden>
          <ellipse cx="17" cy="24" rx="13" ry="2.5" fill="rgba(20,14,8,0.2)" />
          <circle cx="11" cy="15" r="9" fill={leaf} />
          <circle cx="23" cy="15" r="9" fill={leaf} />
          <circle cx="17" cy="11" r="9" fill={leaf} />
        </svg>
      );
    case "flower":
      return (
        <svg width="22" height="26" viewBox="0 0 22 26" aria-hidden>
          <ellipse cx="11" cy="24" rx="8" ry="2" fill="rgba(20,14,8,0.16)" />
          <rect x="10" y="12" width="2" height="12" fill={night ? "#3d6b3f" : "#4f8a45"} />
          <circle cx="11" cy="9" r="5" fill={night ? "#c58bb0" : ["#f191b0", "#f6c56a", "#c79be6"][Math.floor(variant * 3)]} />
          <circle cx="11" cy="9" r="1.8" fill="#fff6dc" />
        </svg>
      );
    case "lamp":
      return (
        <svg width="16" height="52" viewBox="0 0 16 52" aria-hidden>
          <ellipse cx="8" cy="50" rx="6" ry="2" fill="rgba(20,14,8,0.2)" />
          <rect x="6.5" y="14" width="3" height="36" fill={night ? "#3a3350" : "#6b6478"} />
          <circle cx="8" cy="10" r="6" fill={night ? "#ffe08a" : "#fff3c4"} />
          {night ? <circle cx="8" cy="10" r="11" fill="#ffe08a" opacity="0.25" /> : null}
        </svg>
      );
    case "mailbox":
      return (
        <svg width="20" height="34" viewBox="0 0 20 34" aria-hidden>
          <ellipse cx="10" cy="32" rx="7" ry="2" fill="rgba(20,14,8,0.2)" />
          <rect x="9" y="16" width="2.5" height="16" fill={trunk} />
          <rect x="4" y="8" width="13" height="9" rx="3" fill={night ? "#8a5a4a" : "#c8776a"} />
          <rect x="14" y="10" width="2" height="5" fill="#e7d7b4" />
        </svg>
      );
    case "fence":
      return (
        <svg width="40" height="22" viewBox="0 0 40 22" aria-hidden>
          <ellipse cx="20" cy="20" rx="18" ry="2" fill="rgba(20,14,8,0.16)" />
          {[3, 15, 27].map((x) => <rect key={x} x={x} y="6" width="4" height="14" rx="1" fill={night ? "#6b5a44" : "#c9b48a"} />)}
          <rect x="1" y="10" width="38" height="3" rx="1.5" fill={night ? "#6b5a44" : "#c9b48a"} />
        </svg>
      );
    case "rock":
      return (
        <svg width="26" height="18" viewBox="0 0 26 18" aria-hidden>
          <ellipse cx="13" cy="16" rx="11" ry="2" fill="rgba(20,14,8,0.18)" />
          <path d="M3 16 Q5 6 12 6 Q22 5 23 16 Z" fill={night ? "#4a5560" : "#a7a59c"} />
          <path d="M3 16 Q5 6 12 6 Q13 10 3 16 Z" fill={night ? "#3c454e" : "#918f86"} />
        </svg>
      );
    default:
      return null;
  }
}

function houseName(k: number, salt: number): string {
  const first = ["Mira", "Theo", "Jun", "Ivy", "Rowan", "Saffron", "Nico", "Wren", "Aster", "Lark", "Poppy", "Elio"];
  const last = ["makes", "folds", "vale", "studio", "cove", "field", "hollow", "grove", "brook", "moss"];
  return `${first[Math.floor(hash01(k, salt + 61) * first.length)]} ${last[Math.floor(hash01(k, salt + 62) * last.length)]}`;
}
